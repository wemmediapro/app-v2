/**
 * Store Redis pour express-rate-limit (partagé entre workers en cluster).
 * Utilise le même Redis que Socket.io pour une limite globale cohérente.
 */

const redis = require('redis');
const logger = require('./logger');

/**
 *
 */
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
    if (this.client) {
      return this.client;
    }
    this.client = redis.createClient({ url: redisUri });
    this.client.on('error', (err) =>
      logger.warn({ event: 'rate_limit_redis_client_error', err: err.message, stack: err.stack })
    );
    await this.client.connect();
    return this.client;
  }

  /**
   * Incrémente le compteur pour une clé. En cas d'erreur Redis (déconnexion, timeout),
   * retourne un résultat "fail open" pour ne pas bloquer l'API.
   * express-rate-limit v7 exige totalHits >= 1 (validation positiveHits) — jamais 0.
   * @param {string} key
   * @param {{ windowMs?: number }} [options] — fenêtre par clé (rate limit par endpoint)
   */
  async increment(key, options = {}) {
    const windowMs = Number.isFinite(options.windowMs) && options.windowMs > 0 ? options.windowMs : this.windowMs;
    const resetTime = new Date(Date.now() + windowMs);
    if (!this.client) {
      return { totalHits: 1, resetTime };
    }
    try {
      const k = this.prefixKey(key);
      const totalHits = await this.client.incr(k);
      let ttlMs = await this.client.sendCommand(['PTTL', k]);
      if (ttlMs === -1) {
        await this.client.pExpire(k, windowMs);
        ttlMs = windowMs;
      }
      const rt = new Date(Date.now() + ttlMs);
      return { totalHits, resetTime: rt };
    } catch (err) {
      logger.warn({ event: 'rate_limit_redis_increment_failed', err: err.message, stack: err.stack });
      return { totalHits: 1, resetTime };
    }
  }

  async decrement(key) {
    if (!this.client) {
      return;
    }
    try {
      const k = this.prefixKey(key);
      const n = await this.client.decr(k);
      if (n <= 0) {
        await this.client.del(k);
      }
    } catch (err) {
      logger.warn({ event: 'rate_limit_redis_decrement_failed', err: err.message, stack: err.stack });
    }
  }

  async resetKey(key) {
    if (!this.client) {
      return;
    }
    try {
      await this.client.del(this.prefixKey(key));
    } catch (err) {
      logger.warn({ event: 'rate_limit_redis_reset_key_failed', err: err.message, stack: err.stack });
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
  if (!redisUri) {
    return null;
  }
  const store = new RedisStore({ prefix });
  try {
    await store.connect(redisUri);
    return store;
  } catch (err) {
    logger.warn({
      event: 'rate_limit_redis_store_connect_failed',
      err: err.message,
      stack: err.stack,
      message: 'Fallback store mémoire.',
    });
    return null;
  }
}

module.exports = { RedisStore, createRedisStore };
