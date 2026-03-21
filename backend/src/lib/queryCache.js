/**
 * Cache de résultats de requêtes (Redis via `cache-manager`) pour réduire la charge MongoDB.
 * - Clés préfixées `query:` pour isoler des autres usages Redis.
 * - TTL par famille (restaurants, messages, users, …) ; surcharge possible par appel.
 * - Invalidation par motif (SCAN, pas KEYS) pour ne pas bloquer Redis.
 */
const crypto = require('crypto');
const cacheManager = require('./cache-manager');
const logger = require('./logger');

const PREFIX = 'query:';

/** Catégorie OTEL dérivée de la clé cache (premier segment après `query:`). */
function otelCacheCategory(fullKey) {
  return String(fullKey.replace(/^query:/, '').split(':')[0] || 'unknown').slice(0, 48);
}

/** Enregistre hit/miss métriques OpenTelemetry si le module tracing est actif. */
function recordCacheOtel(hit, fullKey) {
  try {
    const m = require('./tracing').getCustomMetrics?.();
    if (!m) {
      return;
    }
    const attrs = { 'cache.category': otelCacheCategory(fullKey) };
    if (hit) {
      m.recordCacheHit(attrs);
    } else {
      m.recordCacheMiss(attrs);
    }
  } catch (_) {
    /* ignore */
  }
}

const DEFAULT_TTL = {
  restaurants: 300,
  messages: 60,
  users: 1800,
  movies: 3600,
  statistics: 300,
};

/**
 * @param {string} key - Clé Redis complète `query:…`
 * @param {number} [explicitTtl]
 */
function resolveTtl(key, explicitTtl) {
  if (explicitTtl != null && Number.isFinite(explicitTtl) && explicitTtl > 0) {
    return Math.floor(explicitTtl);
  }
  const rest = key.startsWith(PREFIX) ? key.slice(PREFIX.length) : key;
  const category = rest.split(':')[0] || '';
  return DEFAULT_TTL[category] ?? 300;
}

/** Motif Redis SCAN `MATCH` à partir d’un préfixe logique (sans `KEYS`). */
function normalizeInvalidatePattern(pattern) {
  const raw = String(pattern).trim().replace(/\*/g, '').replace(/:+$/, '');
  if (!raw) {
    return `${PREFIX}*`;
  }
  const base = raw.startsWith(PREFIX) ? raw : `${PREFIX}${raw}`;
  return base.endsWith('*') ? base : `${base}*`;
}

/** Cache requête → Redis, TTL par préfixe de clé, invalidation par motif. */
class QueryCache {
  /**
   * @param {{ get: Function, set: Function, delPattern: Function, isConnected?: boolean }} [store] - défaut : singleton cache-manager
   */
  constructor(store = cacheManager) {
    this.store = store;
  }

  /** Empreinte courte pour query string / recherche (clés Redis bornées). */
  static hashPart(value) {
    const s = value == null ? '' : String(value);
    return crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);
  }

  /**
   * Lecture cache → sinon exécute `query()` et enregistre le résultat (JSON).
   * @param {string} key - Suffixe logique sans préfixe `query:` (ex. `restaurants:list:fr:all:abc123`)
   * @param {() => Promise<unknown>} query
   * @param {number} [ttl] - secondes
   */
  async getCached(key, query, ttl) {
    const fullKey = key.startsWith(PREFIX) ? key : `${PREFIX}${key}`;
    if (!this.store.isConnected) {
      return query();
    }
    try {
      const cached = await this.store.get(fullKey);
      if (cached !== null && cached !== undefined) {
        recordCacheOtel(true, fullKey);
        return cached;
      }
      recordCacheOtel(false, fullKey);
    } catch (err) {
      logger.warn({ event: 'query_cache_get_failed', key: fullKey, err: err.message });
      recordCacheOtel(false, fullKey);
      return query();
    }

    const result = await query();
    if (result === null || result === undefined) {
      return result;
    }
    const effectiveTtl = resolveTtl(fullKey, ttl);
    try {
      await this.store.set(fullKey, result, effectiveTtl);
    } catch (err) {
      logger.warn({ event: 'query_cache_set_failed', key: fullKey, err: err.message });
    }
    return result;
  }

  /**
   * Invalide les clés `query:${pattern…}*`. Ex. `invalidate('restaurants')` → `query:restaurants*`.
   * @returns {Promise<number>} nombre de clés supprimées (best-effort)
   */
  async invalidate(pattern) {
    if (!this.store.isConnected) {
      return 0;
    }
    const redisPattern = normalizeInvalidatePattern(pattern);
    try {
      const deleted = await this.store.delPattern(redisPattern);
      if (deleted > 0) {
        logger.info({ event: 'query_cache_invalidated', pattern: redisPattern, deleted });
      }
      return deleted;
    } catch (err) {
      logger.warn({ event: 'query_cache_invalidate_failed', pattern: redisPattern, err: err.message });
      return 0;
    }
  }
}

const queryCache = new QueryCache();

module.exports = queryCache;
module.exports.QueryCache = QueryCache;
module.exports.hashQueryPart = QueryCache.hashPart.bind(QueryCache);
module.exports.DEFAULT_TTL = DEFAULT_TTL;
module.exports.PREFIX = PREFIX;
