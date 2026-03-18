/**
 * Store Redis pour express-rate-limit (partagé entre workers en cluster).
 * Utilise le même Redis que Socket.io pour une limite globale cohérente.
 */

const redis = require('redis');

class RedisStore {
  constructor(options = {}) {
    this.prefix = options.prefix ?? 'rl:';
    this.client = null;
    this.windowMs = 900000; // défaut 15 min
  }

  init(options) {
    this.windowMs = options.windowMs;
  }

  prefixKey(key) {
    return `${this.prefix}${key}`;
  }

  async connect(redisUri) {
    if (this.client) return this.client;
    this.client = redis.createClient({ url: redisUri });
    this.client.on('error', (err) => console.warn('Rate limit Redis:', err.message));
    await this.client.connect();
    return this.client;
  }

  /**
   * Incrémente le compteur pour une clé. En cas d'erreur Redis (déconnexion, timeout),
   * retourne un résultat "fail open" pour ne pas bloquer toutes les requêtes API (500).
   */
  async increment(key) {
    if (!this.client) {
      return { totalHits: 0, resetTime: new Date(Date.now() + this.windowMs) };
    }
    try {
      const k = this.prefixKey(key);
      const totalHits = await this.client.incr(k);
      let ttlMs = await this.client.sendCommand(['PTTL', k]);
      if (ttlMs === -1) {
        await this.client.pExpire(k, this.windowMs);
        ttlMs = this.windowMs;
      }
      const resetTime = new Date(Date.now() + ttlMs);
      return { totalHits, resetTime };
    } catch (err) {
      console.warn('Rate limit Redis increment:', err.message);
      return { totalHits: 0, resetTime: new Date(Date.now() + this.windowMs) };
    }
  }

  async decrement(key) {
    if (!this.client) return;
    try {
      const k = this.prefixKey(key);
      const n = await this.client.decr(k);
      if (n <= 0) await this.client.del(k);
    } catch (err) {
      console.warn('Rate limit Redis decrement:', err.message);
    }
  }

  async resetKey(key) {
    if (!this.client) return;
    try {
      await this.client.del(this.prefixKey(key));
    } catch (err) {
      console.warn('Rate limit Redis resetKey:', err.message);
    }
  }
}

/**
 * Crée une instance de store connectée à Redis. En cas d'échec, retourne null (fallback mémoire côté appelant).
 * @param {string} redisUri
 * @param {string} prefix
 * @returns {Promise<RedisStore|null>}
 */
async function createRedisStore(redisUri, prefix = 'rl:api:') {
  if (!redisUri) return null;
  const store = new RedisStore({ prefix });
  try {
    await store.connect(redisUri);
    return store;
  } catch (err) {
    console.warn('Rate limit Redis store non disponible, utilisation mémoire:', err.message);
    return null;
  }
}

const rateLimit = require('express-rate-limit');

/**
 * Factory : crée un rate limiter avec store Redis optionnel (après DB/Redis ready).
 * @param {RedisStore|null} store - Store Redis ou null pour mémoire
 * @param {object} options - Options express-rate-limit (windowMs, max, message, ...)
 * @returns {import('express-rate-limit').RateLimitRequestHandler}
 */
function createLimiter(store, options = {}) {
  return rateLimit({
    ...options,
    store: store || undefined,
    standardHeaders: options.standardHeaders !== false,
    legacyHeaders: options.legacyHeaders === true,
  });
}

module.exports = { RedisStore, createRedisStore, createLimiter };
