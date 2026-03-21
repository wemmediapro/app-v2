/**
 * Wrapper Background Sync API + repli (postMessage SW, setTimeout).
 * Stratégies de fusion des réponses batch : voir mergeOfflineSyncResults.
 */
import { setSwSyncAuthToken } from './offlineQueue';

export const MERGE_STRATEGY = {
  SERVER_TIMESTAMP: 'server_timestamp',
  PREFER_SERVER: 'prefer_server',
  USER_LOCAL: 'user_local',
};

const SYNC_TAG = 'sync-offline-queue';

function readTokenFromLocalStorage() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
  } catch {
    return null;
  }
}

/**
 * @returns {Promise<{ mode: 'background-sync' | 'postMessage' | 'timeout-fallback' | 'none' }>}
 */
export async function registerSync() {
  const token = readTokenFromLocalStorage();
  await setSwSyncAuthToken(token);

  if (typeof navigator === 'undefined' || !navigator.serviceWorker) {
    scheduleTimeoutFallback();
    return { mode: 'timeout-fallback' };
  }

  try {
    const reg = await navigator.serviceWorker.ready;
    if (reg && 'sync' in reg && reg.sync && typeof reg.sync.register === 'function') {
      await reg.sync.register(SYNC_TAG);
      return { mode: 'background-sync' };
    }
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'RUN_OFFLINE_SYNC' });
      return { mode: 'postMessage' };
    }
  } catch (e) {
    console.warn('[backgroundSync] registerSync', e);
  }

  scheduleTimeoutFallback();
  return { mode: 'timeout-fallback' };
}

function scheduleTimeoutFallback() {
  if (typeof window === 'undefined') return;
  window.setTimeout(function () {
    window.dispatchEvent(
      new CustomEvent('gnv-offline-sync-fallback', {
        detail: { reason: 'no_background_sync_api' },
      }),
    );
  }, 400);
}

/**
 * Fusionne les entrées serveur `merged` avec les items locaux pour l’UI.
 * - server_timestamp / prefer_server : ordre par createdAt message serveur
 * - user_local : conserve l’ordre des ids locaux, attache le message serveur si présent
 *
 * @param {Array<{ clientSyncId: string, message?: object, duplicate?: boolean }>} mergedFromServer
 * @param {Array<{ id: string, timestamp?: string }>} localItems
 * @param {string} strategy
 */
export function mergeOfflineSyncResults(mergedFromServer, localItems, strategy = MERGE_STRATEGY.SERVER_TIMESTAMP) {
  const byId = new Map((mergedFromServer || []).map((m) => [m.clientSyncId, m]));
  if (strategy === MERGE_STRATEGY.USER_LOCAL) {
    return (localItems || []).map((loc) => {
      const row = byId.get(loc.id);
      return {
        clientSyncId: loc.id,
        message: row && row.message,
        duplicate: row && row.duplicate,
        localTimestamp: loc.timestamp,
      };
    });
  }
  const rows = [...(mergedFromServer || [])].sort((a, b) => {
    const ta = a.message && a.message.createdAt ? new Date(a.message.createdAt).getTime() : 0;
    const tb = b.message && b.message.createdAt ? new Date(b.message.createdAt).getTime() : 0;
    return ta - tb;
  });
  return rows;
}

const listeners = new Set();

function dispatchToListeners(detail) {
  listeners.forEach(function (fn) {
    try {
      fn(detail);
    } catch (e) {
      console.warn('[backgroundSync] listener', e);
    }
  });
}

function onSwMessage(ev) {
  const d = ev.data;
  if (!d || d.type !== 'GNV_OFFLINE_SYNC') return;
  dispatchToListeners({
    ok: !!d.ok,
    processed: typeof d.processed === 'number' ? d.processed : 0,
    message: d.message,
    skipped: d.skipped,
    source: 'service-worker',
  });
}

function onFlushComplete(ev) {
  const sent = ev.detail && typeof ev.detail.sent === 'number' ? ev.detail.sent : 0;
  if (sent <= 0) return;
  dispatchToListeners({
    ok: true,
    processed: sent,
    source: 'main-thread-flush',
  });
}

/**
 * @param {(detail: { ok: boolean, processed: number, message?: string, source?: string }) => void} cb
 * @returns {() => void} unsubscribe
 */
export function attachSyncResultListener(cb) {
  if (typeof cb !== 'function') return function () {};
  listeners.add(cb);

  if (listeners.size === 1) {
    if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
      navigator.serviceWorker.addEventListener('message', onSwMessage);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('gnv-offline-flush-complete', onFlushComplete);
    }
  }

  return function unsubscribe() {
    listeners.delete(cb);
    if (listeners.size === 0) {
      if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
        navigator.serviceWorker.removeEventListener('message', onSwMessage);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('gnv-offline-flush-complete', onFlushComplete);
      }
    }
  };
}
