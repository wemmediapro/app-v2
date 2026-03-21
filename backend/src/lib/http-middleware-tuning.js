/**
 * Réglages perf partagés pour la pile HTTP (server.js) : regex précompilées,
 * compression zlib, détection origines tunnel, cache court JWT pour skip rate-limit admin.
 */
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const compression = require('compression');
const logger = require('./logger');
const { RE_IMAGE_PNG_JPEG_CT } = require('../constants/regex');

/** zlib level 4 : ~15–25 % plus rapide que 6 sur JSON, taille ~5–10 % plus grande (souvent acceptable derrière CDN). */
const COMPRESSION_LEVEL = Math.min(9, Math.max(1, parseInt(process.env.COMPRESSION_LEVEL, 10) || 4));

/** PNG / JPEG : déjà compressés ; gzip coûte du CPU pour peu de gain. */
const RE_COMPRESSION_SKIP_PNG_JPEG_PATH = /\.(png|jpe?g)$/i;

const compressionStats = {
  filterInvocations: 0,
  skippedNoCompressionHeader: 0,
  skippedAlreadyEncoded: 0,
  skippedPngJpegPath: 0,
  skippedPngJpegContentType: 0,
  defaultFilterTrue: 0,
  defaultFilterFalse: 0,
};

/**
 *
 */
function getCompressionStats() {
  return { ...compressionStats };
}

/**
 *
 */
function resetCompressionStats() {
  Object.keys(compressionStats).forEach((k) => {
    compressionStats[k] = 0;
  });
}

/**
 * Filtre compression : exclut PNG/JPEG, réponses déjà encodées, puis délègue au filtre `compression` (compressible).
 */
function compressionRequestFilter(req, res) {
  compressionStats.filterInvocations += 1;
  if (req.headers['x-no-compression']) {
    compressionStats.skippedNoCompressionHeader += 1;
    return false;
  }
  const enc = res.getHeader('Content-Encoding');
  if (enc !== undefined && enc !== null && String(enc).trim() !== '') {
    compressionStats.skippedAlreadyEncoded += 1;
    return false;
  }
  const pathOnly = (req.path || (req.url && String(req.url).split('?')[0]) || '').toLowerCase();
  if (RE_COMPRESSION_SKIP_PNG_JPEG_PATH.test(pathOnly)) {
    compressionStats.skippedPngJpegPath += 1;
    return false;
  }
  const ct = res.getHeader('Content-Type');
  if (ct && RE_IMAGE_PNG_JPEG_CT.test(String(ct))) {
    compressionStats.skippedPngJpegContentType += 1;
    return false;
  }
  const ok = compression.filter(req, res);
  if (ok) {
    compressionStats.defaultFilterTrue += 1;
  } else {
    compressionStats.defaultFilterFalse += 1;
  }
  return ok;
}

const COMPRESSION_OPTIONS = {
  level: COMPRESSION_LEVEL,
  /** Ne pas compresser les très petites réponses (overhead gzip > gain). */
  threshold: parseInt(process.env.COMPRESSION_THRESHOLD_BYTES, 10) || 1024,
  filter: compressionRequestFilter,
};

let compressionStatsIntervalId = null;

/**
 * Logs périodiques des décisions du filtre (par worker). Activer avec COMPRESSION_STATS_INTERVAL_MS > 0.
 * @param {import('pino').Logger} [log] — défaut : logger applicatif
 * @returns {() => void} arrêt du timer
 */
function startCompressionStatsReporter(log = logger) {
  if (compressionStatsIntervalId) {
    clearInterval(compressionStatsIntervalId);
    compressionStatsIntervalId = null;
  }
  const ms = parseInt(process.env.COMPRESSION_STATS_INTERVAL_MS, 10);
  if (!Number.isFinite(ms) || ms <= 0) {
    return () => {};
  }
  compressionStatsIntervalId = setInterval(() => {
    log.info({ event: 'http_compression_filter_stats', ...getCompressionStats() });
  }, ms);
  if (typeof compressionStatsIntervalId.unref === 'function') {
    compressionStatsIntervalId.unref();
  }
  return () => {
    if (compressionStatsIntervalId) {
      clearInterval(compressionStatsIntervalId);
      compressionStatsIntervalId = null;
    }
  };
}

/** Origines tunnel (même logique que CORS Express et Socket.io). */
const RE_TUNNEL_TRYCLOUDFLARE = /\.trycloudflare\.com$/i;
const RE_TUNNEL_CLOUDFLARE = /\.cloudflare\.com$/i;
const RE_TUNNEL_NGROK = /\.ngrok/i;
const RE_TUNNEL_LOCALT = /\.loca\.lt$/i;

/**
 *
 */
function isTunnelOrigin(origin) {
  if (!origin || typeof origin !== 'string') {
    return false;
  }
  return (
    RE_TUNNEL_TRYCLOUDFLARE.test(origin) ||
    RE_TUNNEL_CLOUDFLARE.test(origin) ||
    RE_TUNNEL_NGROK.test(origin) ||
    RE_TUNNEL_LOCALT.test(origin)
  );
}

/** GET /api/... listes publiques — Cache-Control court (server.js). */
const RE_PUBLIC_GET_LIST_SUB =
  /^\/(movies|magazine|radio|banners|shop|restaurants|webtv|enfant|shipmap|notifications)(\/|$)/;

/** Fichiers statiques /uploads — en-têtes Cache-Control. */
const RE_STATIC_LONG_CACHE = /\.(webp|avif|jpe?g|png|gif|svg|ico|woff2)$/i;
const RE_STATIC_MEDIA_CACHE = /\.(mp4|webm|mp3|wav|m4a|m3u8|ts)$/i;

/** Fichiers statiques /public. */
const RE_PUBLIC_STATIC_LONG_CACHE = /\.(webp|avif|jpe?g|png|gif|svg|ico|woff2|js|css)$/i;

/**
 * Cache mémoire très court : évite jwt.verify() à chaque requête pour décider du skip rate-limit admin.
 * Sécurité : délai max avant prise en compte d’une révocation = TTL (défaut 8 s) pour ce seul chemin.
 */
class JwtAdminSkipCache {
  constructor(options = {}) {
    this.ttlMs = options.ttlMs ?? (parseInt(process.env.JWT_RATE_LIMIT_SKIP_CACHE_MS, 10) || 8000);
    this.maxEntries = options.maxEntries ?? (parseInt(process.env.JWT_RATE_LIMIT_SKIP_CACHE_MAX, 10) || 3000);
    this.map = new Map();
  }

  _tokenKey(token) {
    return crypto.createHash('sha256').update(String(token), 'utf8').digest('hex');
  }

  /**
   * @returns {boolean} true si JWT valide et role === 'admin'
   */
  isAdminVerified(token, secret) {
    if (!token || !secret) {
      return false;
    }
    const key = this._tokenKey(token);
    const now = Date.now();
    const hit = this.map.get(key);
    if (hit && hit.until > now) {
      return hit.isAdmin;
    }
    try {
      const decoded = jwt.verify(token, secret);
      const isAdmin = decoded.role === 'admin';
      this.map.set(key, { isAdmin, until: now + this.ttlMs });
      while (this.map.size > this.maxEntries) {
        const first = this.map.keys().next().value;
        this.map.delete(first);
      }
      return isAdmin;
    } catch {
      return false;
    }
  }
}

const jwtAdminSkipCache = new JwtAdminSkipCache();

module.exports = {
  COMPRESSION_OPTIONS,
  COMPRESSION_LEVEL,
  compressionRequestFilter,
  getCompressionStats,
  resetCompressionStats,
  startCompressionStatsReporter,
  isTunnelOrigin,
  RE_PUBLIC_GET_LIST_SUB,
  RE_STATIC_LONG_CACHE,
  RE_STATIC_MEDIA_CACHE,
  RE_PUBLIC_STATIC_LONG_CACHE,
  JwtAdminSkipCache,
  jwtAdminSkipCache,
};
