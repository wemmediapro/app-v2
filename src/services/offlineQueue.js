/**
 * File d'attente des messages chat hors ligne (IndexedDB via idb, repli localStorage).
 * Structure d'un message : { id, room, content, timestamp, status }
 */
import { openDB } from 'idb';

export const OFFLINE_QUEUE_MAX = 100;

export const QUEUE_STATUS = {
  PENDING: 'pending',
  SENDING: 'sending',
  FAILED: 'failed',
};

const DB_NAME = 'gnv-offline-chat-queue';
const STORE = 'outbox';
/** Store clé/valeur pour le SW (ex. jeton Bearer copié depuis l’app) */
export const META_STORE = 'meta';
export const SW_TOKEN_META_KEY = 'bearerToken';
const DB_VERSION = 2;
const LS_KEY = 'gnv_offline_chat_outbox_v1';

function generateId() {
  return `oq-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

let useLocalStorageFallback = false;
let dbPromise = null;

/**
 * Déduit l’id du destinataire depuis la room Socket `chat:<idMin>_<idMax>` et l’utilisateur courant.
 */
export function parseReceiverFromChatRoom(room, myUserId) {
  if (!room || myUserId == null) return null;
  const prefix = 'chat:';
  const r = String(room);
  if (!r.startsWith(prefix)) return null;
  const rest = r.slice(prefix.length);
  const parts = rest.split('_');
  if (parts.length !== 2) return null;
  const [a, b] = parts;
  const me = String(myUserId);
  if (a === me) return b;
  if (b === me) return a;
  return null;
}

async function tryOpenDb() {
  if (useLocalStorageFallback) return null;
  try {
    if (!dbPromise) {
      dbPromise = openDB(DB_NAME, DB_VERSION, {
        upgrade(db, oldVersion) {
          if (!db.objectStoreNames.contains(STORE)) {
            db.createObjectStore(STORE, { keyPath: 'id' });
          }
          if (oldVersion < 2 && !db.objectStoreNames.contains(META_STORE)) {
            db.createObjectStore(META_STORE, { keyPath: 'key' });
          }
        },
      });
    }
    return await dbPromise;
  } catch (err) {
    console.warn('[offlineQueue] IndexedDB indisponible, repli localStorage', err);
    useLocalStorageFallback = true;
    dbPromise = null;
    return null;
  }
}

function readLocalStorage() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeLocalStorage(items) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(items));
  } catch (e) {
    console.warn('[offlineQueue] Écriture localStorage impossible', e);
  }
}

function sortByTimestamp(items) {
  return [...items].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

async function persistAll(items) {
  const sorted = sortByTimestamp(items);
  const db = await tryOpenDb();
  if (!db) {
    writeLocalStorage(sorted);
    return;
  }
  try {
    const tx = db.transaction(STORE, 'readwrite');
    await tx.store.clear();
    for (const it of sorted) {
      await tx.store.put(it);
    }
    await tx.done;
  } catch (e) {
    console.warn('[offlineQueue] Erreur persistance IDB, repli localStorage', e);
    useLocalStorageFallback = true;
    dbPromise = null;
    writeLocalStorage(sorted);
  }
}

/**
 * @returns {Promise<Array<{ id: string, room: string, content: string, timestamp: string, status: string }>>}
 */
export async function getAll() {
  try {
    const db = await tryOpenDb();
    if (!db) return sortByTimestamp(readLocalStorage());
    const rows = await db.getAll(STORE);
    return sortByTimestamp(rows);
  } catch (e) {
    console.warn('[offlineQueue] getAll → repli localStorage', e);
    useLocalStorageFallback = true;
    dbPromise = null;
    return sortByTimestamp(readLocalStorage());
  }
}

/**
 * @param {{ id?: string, room: string, content: string, timestamp?: string, status?: string }} partial
 */
export async function enqueue(partial) {
  const item = {
    id: partial.id || generateId(),
    room: partial.room,
    content: partial.content,
    timestamp: partial.timestamp || new Date().toISOString(),
    status: partial.status || QUEUE_STATUS.PENDING,
  };
  if (!item.room || typeof item.content !== 'string') {
    throw new Error('offlineQueue.enqueue: room et content (string) requis');
  }
  let items = await getAll();
  items.push(item);
  items = sortByTimestamp(items);
  while (items.length > OFFLINE_QUEUE_MAX) {
    items.shift();
  }
  await persistAll(items);
  return item;
}

export async function dequeue(id) {
  const items = (await getAll()).filter((x) => x.id !== id);
  await persistAll(items);
}

export async function clear() {
  await persistAll([]);
}

/**
 * Copie le jeton dans IndexedDB pour que le Service Worker puisse appeler /api/sync/offline-queue.
 * @param {string|null|undefined} token — vide pour effacer
 */
export async function setSwSyncAuthToken(token) {
  const db = await tryOpenDb();
  if (!db) return;
  try {
    const tx = db.transaction(META_STORE, 'readwrite');
    const trimmed = token && String(token).trim();
    if (trimmed) {
      await tx.store.put({
        key: SW_TOKEN_META_KEY,
        value: trimmed,
        updatedAt: new Date().toISOString(),
      });
    } else {
      await tx.store.delete(SW_TOKEN_META_KEY);
    }
    await tx.done;
  } catch (e) {
    console.warn('[offlineQueue] setSwSyncAuthToken', e);
  }
}

async function updateItemById(id, updater) {
  const items = await getAll();
  const idx = items.findIndex((x) => x.id === id);
  if (idx < 0) return;
  items[idx] = typeof updater === 'function' ? updater(items[idx]) : { ...items[idx], ...updater };
  await persistAll(items);
}

/**
 * Remet les messages en échec en `pending` pour un prochain envoi.
 */
export async function retry() {
  const items = await getAll();
  const next = items.map((it) =>
    it.status === QUEUE_STATUS.FAILED ? { ...it, status: QUEUE_STATUS.PENDING } : it
  );
  await persistAll(next);
  return next.filter((i) => i.status === QUEUE_STATUS.PENDING).length;
}

let flushHandler = null;

export function setOfflineFlushHandler(fn) {
  flushHandler = typeof fn === 'function' ? fn : null;
}

/**
 * Envoie tous les messages pending/failed via le handler enregistré (API + socket côté app).
 */
export async function flushPendingQueue() {
  if (!flushHandler) return { sent: 0, remaining: 0 };

  let sent = 0;
  const itemsSorted = await getAll();

  for (const item of itemsSorted) {
    if (item.status !== QUEUE_STATUS.PENDING && item.status !== QUEUE_STATUS.FAILED) continue;

    await updateItemById(item.id, { status: QUEUE_STATUS.SENDING });

    try {
      await flushHandler({ ...item, status: QUEUE_STATUS.SENDING });
      await dequeue(item.id);
      sent++;
    } catch (e) {
      console.warn('[offlineQueue] Échec envoi message', item.id, e);
      await updateItemById(item.id, { status: QUEUE_STATUS.FAILED });
    }
  }

  const rest = await getAll();
  const remaining = rest.filter(
    (x) =>
      x.status === QUEUE_STATUS.PENDING ||
      x.status === QUEUE_STATUS.FAILED ||
      x.status === QUEUE_STATUS.SENDING
  ).length;

  return { sent, remaining };
}
