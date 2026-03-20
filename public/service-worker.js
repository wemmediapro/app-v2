/* eslint-disable no-restricted-globals */
/**
 * Complément Workbox (importScripts) : Background Sync + file messages hors ligne.
 * Même IndexedDB que l’app : gnv-offline-chat-queue / outbox / meta (jeton).
 * Tag : sync-offline-queue
 */
(function () {
  var DB_NAME = 'gnv-offline-chat-queue';
  var DB_VERSION = 2;
  var STORE = 'outbox';
  var META = 'meta';
  var SYNC_TAG = 'sync-offline-queue';
  var BACKOFF_MS = [1000, 2000, 4000, 8000, 16000];

  function sleep(ms) {
    return new Promise(function (r) {
      setTimeout(r, ms);
    });
  }

  function openDb() {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onerror = function () {
        reject(req.error);
      };
      req.onsuccess = function () {
        resolve(req.result);
      };
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(META)) {
          db.createObjectStore(META, { keyPath: 'key' });
        }
      };
    });
  }

  function idbGetAll(storeName) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(storeName, 'readonly');
        var st = tx.objectStore(storeName);
        var r = st.getAll();
        r.onerror = function () {
          reject(r.error);
        };
        r.onsuccess = function () {
          resolve(r.result || []);
        };
      });
    });
  }

  function idbGetMetaToken() {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        if (!db.objectStoreNames.contains(META)) {
          resolve(null);
          return;
        }
        var tx = db.transaction(META, 'readonly');
        var r = tx.objectStore(META).get('bearerToken');
        r.onerror = function () {
          reject(r.error);
        };
        r.onsuccess = function () {
          var row = r.result;
          resolve(row && row.value ? String(row.value) : null);
        };
      });
    });
  }

  function idbDeleteIds(ids) {
    if (!ids || !ids.length) return Promise.resolve();
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, 'readwrite');
        var st = tx.objectStore(STORE);
        ids.forEach(function (id) {
          st.delete(id);
        });
        tx.oncomplete = function () {
          resolve();
        };
        tx.onerror = function () {
          reject(tx.error);
        };
      });
    });
  }

  function notifyClients(payload) {
    return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clients) {
      clients.forEach(function (c) {
        try {
          c.postMessage(payload);
        } catch (e) {}
      });
    });
  }

  function isActionable(item) {
    var s = item && item.status;
    return s === 'pending' || s === 'failed' || s === 'sending';
  }

  function syncUrl() {
    return new URL('/api/sync/offline-queue', self.location.origin).toString();
  }

  function postSyncWithBackoff(token, body) {
    var attempt = 0;
    function tryOnce() {
      return fetch(syncUrl(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify(body),
        credentials: 'same-origin',
      }).then(function (res) {
        if (!res.ok) {
          var err = new Error('HTTP ' + res.status);
          err.status = res.status;
          throw err;
        }
        return res.json();
      });
    }
    function loop() {
      return tryOnce().catch(function (err) {
        if (attempt >= BACKOFF_MS.length) throw err;
        var wait = BACKOFF_MS[attempt];
        attempt++;
        return sleep(wait).then(loop);
      });
    }
    return loop();
  }

  function runOfflineQueueSync() {
    return idbGetMetaToken()
      .then(function (token) {
        if (!token) {
          return notifyClients({
            type: 'GNV_OFFLINE_SYNC',
            ok: false,
            message: 'no_token',
            processed: 0,
          });
        }
        return idbGetAll(STORE).then(function (rows) {
          var items = (rows || []).filter(isActionable);
          if (!items.length) {
            return notifyClients({
              type: 'GNV_OFFLINE_SYNC',
              ok: true,
              processed: 0,
            });
          }
          var payload = {
            items: items.map(function (it) {
              return {
                id: it.id,
                room: it.room,
                content: it.content,
                timestamp: it.timestamp,
                type: 'text',
              };
            }),
            mergeStrategy: 'server_timestamp',
          };
          return postSyncWithBackoff(token, payload).then(function (data) {
            var ids = (data && data.processedIds) || [];
            return idbDeleteIds(ids).then(function () {
              return notifyClients({
                type: 'GNV_OFFLINE_SYNC',
                ok: true,
                processed: ids.length,
                skipped: (data && data.skipped) || [],
              });
            });
          });
        });
      })
      .catch(function (e) {
        return notifyClients({
          type: 'GNV_OFFLINE_SYNC',
          ok: false,
          message: (e && e.message) || 'sync_failed',
          processed: 0,
        });
      });
  }

  self.addEventListener('sync', function (event) {
    if (event.tag === SYNC_TAG) {
      event.waitUntil(runOfflineQueueSync());
    }
  });

  self.addEventListener('message', function (event) {
    var d = event.data;
    if (d && d.type === 'RUN_OFFLINE_SYNC') {
      event.waitUntil(runOfflineQueueSync());
    }
  });
})();
