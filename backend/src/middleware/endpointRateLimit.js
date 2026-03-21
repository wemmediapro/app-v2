const { getApiPathSuffix } = require('../lib/apiPath');
const logger = require('../lib/logger');
const { buildRateLimitIdentity } = require('./rateLimits');

/**
 * @typedef {'ip' | 'user' | 'auto'} RateLimitKeySource
 * @typedef {'fixed' | 'sliding'} RateLimitWindowType
 * @typedef {{ prefix: string, max: number, windowMs?: number, methods?: string[] | null, bucket?: string, keySource?: RateLimitKeySource, windowType?: RateLimitWindowType, adaptive?: boolean, adaptiveMin?: number }} EndpointRateRule
 */

/**
 *
 */
function normalizeSuffix(pathname) {
  let s = getApiPathSuffix(pathname || '').toLowerCase();
  if (s.length > 1 && s.endsWith('/')) {
    s = s.slice(0, -1);
  }
  return s;
}

/**
 *
 */
function prefixMatches(suffix, prefix) {
  const p = prefix.toLowerCase();
  if (!p.startsWith('/')) {
    return false;
  }
  return suffix === p || suffix.startsWith(`${p}/`);
}

/**
 *
 */
function ruleToBucket(rule) {
  if (rule.bucket && String(rule.bucket).trim()) {
    return String(rule.bucket)
      .replace(/[^a-z0-9_-]/gi, '_')
      .slice(0, 64);
  }
  return (
    rule.prefix
      .replace(/^\//, '')
      .replace(/[^a-z0-9]+/gi, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 64) || 'endpoint'
  );
}

/** @type {Map<string, { hits: number, resetAt: number }>} */
const memoryCounters = new Map();

/** @type {Map<string, number[]>} */
const slidingMemoryTimestamps = new Map();

/**
 *
 */
function memoryIncrement(key, windowMs) {
  const now = Date.now();
  let row = memoryCounters.get(key);
  if (!row || now >= row.resetAt) {
    row = { hits: 1, resetAt: now + windowMs };
    memoryCounters.set(key, row);
    return { totalHits: 1, resetTime: new Date(row.resetAt) };
  }
  row.hits += 1;
  return { totalHits: row.hits, resetTime: new Date(row.resetAt) };
}

/**
 * Fenêtre glissante en mémoire (fallback sans Redis).
 * @param {string} key
 * @param {number} windowMs
 * @returns {{ totalHits: number, resetTime: Date }}
 */
function slidingMemoryIncrement(key, windowMs) {
  const now = Date.now();
  const cutoff = now - windowMs;
  let arr = slidingMemoryTimestamps.get(key) || [];
  arr = arr.filter((t) => t > cutoff);
  arr.push(now);
  slidingMemoryTimestamps.set(key, arr);
  return { totalHits: arr.length, resetTime: new Date(now + windowMs) };
}

/**
 *
 */
function pickRule(suffix, rules) {
  const sorted = [...rules].sort((a, b) => b.prefix.length - a.prefix.length);
  for (const rule of sorted) {
    if (!prefixMatches(suffix, rule.prefix)) {
      continue;
    }
    return rule;
  }
  return null;
}

/**
 * Rate limit additionnel par préfixe de chemin (suffixe API), en plus du plafond global.
 */
function createEndpointRateLimitMiddleware({ rules, redisStore, skip, defaultWindowMs, adaptiveLimiter = null }) {
  if (!Array.isArray(rules) || rules.length === 0) {
    return (_req, _res, next) => next();
  }

  return async function endpointRateLimit(req, res, next) {
    if (process.env.RATE_LIMIT_PER_ENDPOINT === '0') {
      return next();
    }
    if (process.env.NODE_ENV !== 'production' && process.env.RATE_LIMIT_LOAD_TEST === '1') {
      return next();
    }
    if (skip(req)) {
      return next();
    }

    const suffix = normalizeSuffix(req.path);
    const rule = pickRule(suffix, rules);
    if (!rule) {
      return next();
    }

    const m = req.method?.toUpperCase() || 'GET';
    if (rule.methods && rule.methods.length > 0 && !rule.methods.map((x) => String(x).toUpperCase()).includes(m)) {
      return next();
    }

    const windowMs = rule.windowMs != null && rule.windowMs > 0 ? rule.windowMs : defaultWindowMs;
    const bucket = ruleToBucket(rule);
    const identity = buildRateLimitIdentity(req, rule.keySource || 'ip');
    const storeKey = `${bucket}:${identity}`;
    const windowType = rule.windowType === 'sliding' ? 'sliding' : 'fixed';
    const minAdaptive = rule.adaptiveMin != null && rule.adaptiveMin > 0 ? rule.adaptiveMin : 5;

    let effectiveMax = rule.max;
    if (rule.adaptive && adaptiveLimiter) {
      try {
        effectiveMax = await adaptiveLimiter.getLimit(storeKey, rule.max, minAdaptive);
      } catch {
        effectiveMax = rule.max;
      }
    }

    try {
      let totalHits;
      let resetTime;
      if (redisStore?.client) {
        const r =
          windowType === 'sliding'
            ? await redisStore.slidingIncrement(storeKey, { windowMs })
            : await redisStore.increment(storeKey, { windowMs });
        totalHits = r.totalHits;
        resetTime = r.resetTime;
      } else if (windowType === 'sliding') {
        const r = slidingMemoryIncrement(`ep_sw:${storeKey}`, windowMs);
        totalHits = r.totalHits;
        resetTime = r.resetTime;
      } else {
        const r = memoryIncrement(`ep_mem:${storeKey}`, windowMs);
        totalHits = r.totalHits;
        resetTime = r.resetTime;
      }

      const resetSec = Math.ceil(resetTime.getTime() / 1000);
      res.setHeader('RateLimit-Endpoint-Limit', String(effectiveMax));
      res.setHeader('RateLimit-Endpoint-Remaining', String(Math.max(0, effectiveMax - totalHits)));
      res.setHeader('RateLimit-Endpoint-Reset', String(resetSec));

      if (totalHits > effectiveMax) {
        res.setHeader('Retry-After', String(Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000))));
        logger.warn({
          event: 'endpoint_rate_limit_exceeded',
          bucket,
          identityKind: identity.startsWith('u:') ? 'user' : 'ip',
          path: req.path,
          method: req.method,
          windowType,
        });
        return res.status(429).json({
          success: false,
          message: 'Trop de requêtes sur cette ressource. Réessayez plus tard.',
          code: 'ENDPOINT_RATE_LIMIT',
        });
      }

      if (rule.adaptive && adaptiveLimiter) {
        const scope = storeKey;
        res.on('finish', () => {
          const ok = res.statusCode < 400;
          adaptiveLimiter.recordRequest(scope, ok, rule.max, minAdaptive).catch(() => {});
        });
      }

      return next();
    } catch (err) {
      return next(err);
    }
  };
}

module.exports = {
  createEndpointRateLimitMiddleware,
  normalizeSuffixForEndpointRateLimit: normalizeSuffix,
  pickEndpointRateRule: pickRule,
  ruleToBucket,
  memoryIncrementForTests: memoryIncrement,
  clearMemoryCountersForTests: () => memoryCounters.clear(),
  clearSlidingMemoryForTests: () => slidingMemoryTimestamps.clear(),
};
