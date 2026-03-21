/**
 * Quotas par endpoint (complément du middleware `endpointRateLimit.js`) :
 * règles par défaut, clés par IP / utilisateur JWT vérifié, limite adaptative optionnelle (Redis).
 */

const logger = require('../lib/logger');

/** @typedef {'ip' | 'user' | 'auto'} RateLimitKeySource */
/** @typedef {'fixed' | 'sliding'} RateLimitWindowType */

/**
 * Règles par défaut (suffixe après `/api` ou `/api/v1`, cf. `getApiPathSuffix`).
 * Les entrées les plus spécifiques (`/admin/users`) doivent rester avant les préfixes plus courts si même longueur n’applique pas.
 */
const DEFAULT_ENDPOINT_RULES = [
  {
    prefix: '/admin/users',
    max: 100,
    windowMs: 60 * 60 * 1000,
    methods: ['POST'],
    bucket: 'admin_users_post',
    keySource: 'user',
    windowType: 'sliding',
  },
  {
    prefix: '/messages',
    max: 10,
    windowMs: 60 * 1000,
    methods: ['POST'],
    bucket: 'messages_post',
    keySource: 'user',
    windowType: 'sliding',
    adaptive: false,
  },
  {
    prefix: '/messages',
    max: 450,
    methods: ['GET', 'HEAD'],
    bucket: 'messages_read',
    keySource: 'ip',
    windowType: 'fixed',
  },
  {
    prefix: '/export',
    max: 30,
    windowMs: 60 * 60 * 1000,
    methods: ['GET', 'HEAD'],
    bucket: 'export_get',
    keySource: 'auto',
    windowType: 'sliding',
  },
  { prefix: '/auth', max: 200, bucket: 'auth', keySource: 'ip', windowType: 'fixed' },
  { prefix: '/admin', max: 500, bucket: 'admin', keySource: 'ip', windowType: 'fixed' },
  { prefix: '/sync', max: 250, bucket: 'sync', keySource: 'ip', windowType: 'fixed' },
  { prefix: '/analytics', max: 120, bucket: 'analytics', keySource: 'ip', windowType: 'fixed' },
  { prefix: '/notifications', max: 600, bucket: 'notifications', keySource: 'ip', windowType: 'fixed' },
];

/**
 * Identifiant JWT vérifié (signature) pour quotas par utilisateur — sans lookup Mongo.
 * Retourne null si pas de token ou token invalide / challenge 2FA.
 * @param {import('express').Request} req
 * @returns {string | null}
 */
function getJwtUserIdForRateLimit(req) {
  try {
    const { getTokenFromRequest, verifyToken } = require('../middleware/auth');
    const token = getTokenFromRequest(req);
    if (!token) {
      return null;
    }
    const decoded = verifyToken(token);
    if (decoded && decoded.typ === '2fa_challenge') {
      return null;
    }
    const id = decoded?.id ?? decoded?.sub ?? decoded?.userId;
    return id != null ? String(id) : null;
  } catch {
    return null;
  }
}

/**
 * @param {import('express').Request} req
 * @param {RateLimitKeySource} keySource
 * @returns {string}
 */
function buildRateLimitIdentity(req, keySource) {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  const mode = keySource || 'ip';
  if (mode === 'user') {
    const uid = getJwtUserIdForRateLimit(req);
    return uid ? `u:${uid}` : `ip:${ip}`;
  }
  if (mode === 'auto') {
    const uid = getJwtUserIdForRateLimit(req);
    return uid ? `u:${uid}` : `ip:${ip}`;
  }
  return `ip:${ip}`;
}

/**
 * Limite adaptative par scope (Redis) : ajuste un plafond effectif selon le taux de succès récent.
 * Utilisé seulement si `rule.adaptive` et qu’une instance est injectée dans le middleware endpoint.
 */
class AdaptiveRateLimiter {
  /**
   * @param {import('redis').RedisClientType | { get: Function, setEx: Function }} redis — client Redis connecté
   * @param {{ prefix?: string, ttlSec?: number, successThreshold?: number, lowThreshold?: number }} [options]
   */
  constructor(redis, options = {}) {
    this.redis = redis;
    this.prefix = options.prefix ?? 'arl:ep:';
    this.ttlSec = options.ttlSec ?? 3600;
    this.successThreshold = options.successThreshold ?? 0.95;
    this.lowThreshold = options.lowThreshold ?? 0.8;
  }

  limitKey(scope) {
    return `${this.prefix}limit:${scope}`;
  }

  statsKey(scope) {
    return `${this.prefix}stats:${scope}`;
  }

  /**
   * Plafond effectif (≤ defaultMax).
   * @param {string} scope
   * @param {number} defaultMax
   * @param {number} [minCap]
   */
  async getLimit(scope, defaultMax, minCap = 5) {
    if (!this.redis?.get) {
      return defaultMax;
    }
    try {
      const raw = await this.redis.get(this.limitKey(scope));
      if (!raw) {
        return defaultMax;
      }
      const j = JSON.parse(raw);
      const n = parseInt(j.limit, 10);
      if (!Number.isFinite(n)) {
        return defaultMax;
      }
      return Math.max(minCap, Math.min(defaultMax, n));
    } catch (err) {
      logger.warn({ event: 'adaptive_rate_limit_get_failed', err: err.message, scope });
      return defaultMax;
    }
  }

  /**
   * Met à jour stats + limite stockée après une requête terminée.
   * @param {string} scope
   * @param {boolean} success
   * @param {number} maxCap — plafond de la règle (ex. `rule.max`)
   * @param {number} minCap — plancher (ex. `rule.adaptiveMin ?? 5`)
   */
  async recordRequest(scope, success, maxCap, minCap = 5) {
    if (!this.redis?.get || !this.redis?.setEx) {
      return;
    }
    try {
      let stats = { total: 0, success: 0 };
      const sk = this.statsKey(scope);
      const existing = await this.redis.get(sk);
      if (existing) {
        try {
          const p = JSON.parse(existing);
          stats = { total: p.total || 0, success: p.success || 0 };
        } catch {
          /* ignore */
        }
      }
      stats.total += 1;
      if (success) {
        stats.success += 1;
      }
      const rate = stats.total > 0 ? stats.success / stats.total : 1;

      let currentLimit = maxCap;
      const limRaw = await this.redis.get(this.limitKey(scope));
      if (limRaw) {
        try {
          const j = JSON.parse(limRaw);
          const n = parseInt(j.limit, 10);
          if (Number.isFinite(n)) {
            currentLimit = n;
          }
        } catch {
          /* ignore */
        }
      }

      let newLimit = currentLimit;
      if (rate > this.successThreshold) {
        newLimit = Math.min(maxCap, currentLimit + 5);
      } else if (rate < this.lowThreshold) {
        newLimit = Math.max(minCap, currentLimit - 5);
      }

      await this.redis.setEx(this.limitKey(scope), this.ttlSec, JSON.stringify({ limit: newLimit }));
      await this.redis.setEx(sk, this.ttlSec, JSON.stringify(stats));
    } catch (err) {
      logger.warn({ event: 'adaptive_rate_limit_record_failed', err: err.message, scope });
    }
  }
}

module.exports = {
  DEFAULT_ENDPOINT_RULES,
  getJwtUserIdForRateLimit,
  buildRateLimitIdentity,
  AdaptiveRateLimiter,
};
