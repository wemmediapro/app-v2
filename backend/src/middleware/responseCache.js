/**
 * Middleware de cache de réponses Redis pour GET publics.
 *
 * - GET uniquement
 * - Pas de cache si session / JWT (cookie authToken ou Authorization Bearer)
 * - TTL par endpoint via response-cache-config.js
 * - Invalidation : invalidateResponseCacheByTag / invalidateResponseCacheByEvent
 *
 * Activation : RESPONSE_CACHE_ENABLED=1 (désactivé par défaut).
 */
const crypto = require('crypto');
const { getApiPathSuffix } = require('../lib/apiPath');
const logger = require('../lib/logger');
const { matchResponseCacheRule, RESPONSE_CACHE_EVENTS } = require('./response-cache-config');

const CACHE_PAYLOAD_VERSION = 1;
const KEY_PREFIX = 'http:rsp:v1';

/**
 *
 */
function logTelemetry(event, fields) {
  logger.debug({ event, ...fields });
  if (process.env.RESPONSE_CACHE_LOG === '1') {
    logger.info({ event, ...fields });
  }
}

/**
 * Requêtes potentiellement personnalisées : pas de cache partagé.
 */
function hasUserSpecificContext(req) {
  const authz = req.get('Authorization');
  if (authz && String(authz).replace(/\s/g, '').length > 0) {
    return true;
  }
  if (req.cookies && req.cookies.authToken) {
    return true;
  }
  if (req.user) {
    return true;
  }
  const pragma = String(req.get('Pragma') || '').toLowerCase();
  const cc = String(req.get('Cache-Control') || '').toLowerCase();
  if (pragma === 'no-cache' || cc.includes('no-store') || cc.includes('no-cache')) {
    return true;
  }
  return false;
}

/**
 *
 */
function stableQueryString(query) {
  if (!query || typeof query !== 'object') {
    return '';
  }
  const keys = Object.keys(query).sort();
  const parts = [];
  for (const k of keys) {
    let v = query[k];
    if (v === undefined) {
      continue;
    }
    if (Array.isArray(v)) {
      v = v.map((x) => String(x)).join(',');
    }
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  }
  return parts.join('&');
}

/**
 *
 */
function buildCacheKey(req, rule) {
  const sub = getApiPathSuffix(req.path || req.url || '') || '/';
  const lang = (req.language && String(req.language)) || 'fr';
  const qs = stableQueryString(req.query);
  const basis = `${req.method}|${sub}|${lang}|${qs}`;
  const h = crypto.createHash('sha256').update(basis, 'utf8').digest('hex').slice(0, 32);
  return `${KEY_PREFIX}:${rule.tag}:GET:${h}`;
}

/**
 * @param {object} options
 * @param {import('../lib/cache-manager')} options.cacheManager
 * @param {boolean} [options.enabled] — défaut : process.env.RESPONSE_CACHE_ENABLED === '1'
 */
function createResponseCacheMiddleware(options = {}) {
  const cacheManager = options.cacheManager;
  if (!cacheManager) {
    throw new Error('createResponseCacheMiddleware: cacheManager is required');
  }

  const enabled = options.enabled !== undefined ? options.enabled : process.env.RESPONSE_CACHE_ENABLED === '1';

  return async function responseCacheMiddleware(req, res, next) {
    if (!enabled) {
      return next();
    }
    if (req.method !== 'GET') {
      return next();
    }
    if (!cacheManager.isConnected) {
      return next();
    }
    if (hasUserSpecificContext(req)) {
      return next();
    }

    const sub = getApiPathSuffix(req.path || req.url || '') || '/';
    const rule = matchResponseCacheRule(sub);
    if (!rule) {
      return next();
    }

    const cacheKey = buildCacheKey(req, rule);
    let hit = null;
    try {
      hit = await cacheManager.get(cacheKey);
    } catch (_) {
      hit = null;
    }

    if (hit && hit.v === CACHE_PAYLOAD_VERSION && hit.body !== undefined) {
      logTelemetry('response_cache_hit', { key: cacheKey, tag: rule.tag, sub });
      res.setHeader('X-Cache', 'HIT');
      if (hit.contentLanguage) {
        res.setHeader('Content-Language', hit.contentLanguage);
      }
      return res.status(typeof hit.status === 'number' ? hit.status : 200).json(hit.body);
    }

    logTelemetry('response_cache_miss', { key: cacheKey, tag: rule.tag, sub });

    const originalJson = res.json.bind(res);
    res.json = function responseCacheJsonWrapper(body) {
      const status = res.statusCode;
      const shouldStore = status === 200 && body !== undefined && !res.headersSent;
      const result = originalJson(body);
      if (shouldStore && cacheManager.isConnected) {
        const payload = {
          v: CACHE_PAYLOAD_VERSION,
          status,
          body,
          contentLanguage: res.get('Content-Language') || (req.language && String(req.language)) || undefined,
        };
        cacheManager.set(cacheKey, payload, rule.ttl).catch(() => {});
      }
      return result;
    };

    res.setHeader('X-Cache', 'MISS');
    next();
  };
}

/**
 * Supprime toutes les entrées de cache pour un tag (préfixe Redis).
 * @param {import('../lib/cache-manager')} cacheManager
 * @param {string} tag
 */
async function invalidateResponseCacheByTag(cacheManager, tag) {
  if (!cacheManager || !cacheManager.isConnected || !tag) {
    return 0;
  }
  const pattern = `${KEY_PREFIX}:${String(tag)}:*`;
  try {
    const n = await cacheManager.delPattern(pattern);
    logTelemetry('response_cache_invalidated', { tag, pattern, deleted: n });
    return n;
  } catch (err) {
    logger.warn({
      event: 'response_cache_invalidate_failed',
      tag,
      err: err.message,
    });
    return 0;
  }
}

/**
 * @param {import('../lib/cache-manager')} cacheManager
 * @param {string} event — clé de RESPONSE_CACHE_EVENTS ou nom de tag direct
 */
async function invalidateResponseCacheByEvent(cacheManager, event) {
  if (!event || !cacheManager) {
    return 0;
  }
  const tags = RESPONSE_CACHE_EVENTS[event] || [event];
  let total = 0;
  for (const tag of tags) {
    total += await invalidateResponseCacheByTag(cacheManager, tag);
  }
  return total;
}

module.exports = {
  createResponseCacheMiddleware,
  invalidateResponseCacheByTag,
  invalidateResponseCacheByEvent,
  RESPONSE_CACHE_KEY_PREFIX: KEY_PREFIX,
};
