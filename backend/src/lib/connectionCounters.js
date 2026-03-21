/**
 * Compteur de connexions Socket.io cluster-safe via Redis (INCR/DECR atomiques).
 * Sans Redis : fallback variable locale (une seule instance).
 * La limite maxConnections est celle du serveur où tourne le backend (configurable au dashboard).
 */

const REDIS_KEY = 'socket:connections:total';

let redisStore = null; // cacheManager ou client Redis
let localTotal = 0;

function getShipId(socket) {
  return socket.handshake?.auth?.shipId || socket.handshake?.query?.shipId || null;
}

/**
 * Initialise le store Redis pour un compteur partagé entre workers (cluster).
 * À appeler après connexion Redis (ex. dans setupAfterDb avec cacheManager).
 * @param {{ incr: (k: string) => Promise<number>, decr: (k: string) => Promise<number>, get: (k: string) => Promise<string|null> } | null} cacheManagerOrNull
 */
function initRedis(cacheManagerOrNull) {
  redisStore = cacheManagerOrNull && typeof cacheManagerOrNull.incr === 'function' ? cacheManagerOrNull : null;
}

async function increment() {
  if (redisStore && redisStore.isConnected) {
    try {
      await redisStore.incr(REDIS_KEY);
      return;
    } catch (err) {
      console.warn('connectionCounters Redis INCR:', err?.message || err);
    }
  }
  localTotal += 1;
}

async function decrement() {
  if (redisStore && redisStore.isConnected) {
    try {
      if (typeof redisStore.decr === 'function') {
        await redisStore.decr(REDIS_KEY);
      }
      return;
    } catch (err) {
      console.warn('connectionCounters Redis DECR:', err?.message || err);
    }
  }
  if (localTotal > 0) {localTotal -= 1;}
}

/**
 * Retourne le total des connexions (async si Redis, sync en fallback).
 * Pour compatibilité appelant synchrone (gnv.js, analytics, server.js), retourne une Promise si Redis.
 */
async function getTotalCountAsync() {
  if (redisStore && redisStore.isConnected) {
    try {
      const val = await redisStore.getRaw(REDIS_KEY);
      const n = parseInt(val, 10);
      return Number.isNaN(n) ? 0 : Math.max(0, n);
    } catch (err) {
      console.warn('connectionCounters Redis GET:', err?.message || err);
      return localTotal;
    }
  }
  return localTotal;
}

function getTotalCount() {
  if (redisStore && redisStore.isConnected) {
    return undefined; // appelant doit utiliser getTotalCountAsync()
  }
  return localTotal;
}

module.exports = {
  getShipId,
  increment,
  decrement,
  getTotalCount,
  getTotalCountAsync,
  initRedis,
};
