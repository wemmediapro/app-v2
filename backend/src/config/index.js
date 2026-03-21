/**
 * Configuration centralisée du backend.
 * Charge config.env via dotenv (appelé depuis server.js) et expose des valeurs typées.
 */
const path = require('path');
const logger = require('../lib/logger');
const { DEFAULT_ENDPOINT_RULES } = require('../middleware/rateLimits');

const ROOT = path.join(__dirname, '..', '..');

/** Plafonds par préfixe (suffixe après /api[/v1]) — complètent le rate limit global. */
const DEFAULT_RATE_LIMIT_ENDPOINT_RULES = DEFAULT_ENDPOINT_RULES;

function parseRateLimitEndpointRules(fallbackWindowMs) {
  const raw = process.env.RATE_LIMIT_ENDPOINT_RULES_JSON;
  if (raw && String(raw).trim()) {
    try {
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) {
        logger.warn({ event: 'rate_limit_endpoint_rules_json_not_array' });
        return DEFAULT_RATE_LIMIT_ENDPOINT_RULES.map((r) => ({ ...r, windowMs: r.windowMs ?? fallbackWindowMs }));
      }
      const parsed = arr
        .map((r) => {
          const pre = String(r.prefix ?? '').trim();
          const prefix = pre.startsWith('/') ? pre : `/${pre}`;
          const max = Math.max(1, parseInt(r.max, 10) || 100);
          const windowMs = r.windowMs != null && r.windowMs !== '' ? parseInt(r.windowMs, 10) : undefined;
          const methods = Array.isArray(r.methods) ? r.methods.map((m) => String(m).toUpperCase()) : null;
          const bucket = r.bucket != null ? String(r.bucket) : undefined;
          const ks = r.keySource;
          const keySource = ks === 'user' || ks === 'auto' || ks === 'ip' ? ks : undefined;
          const wt = r.windowType;
          const windowType = wt === 'sliding' || wt === 'fixed' ? wt : undefined;
          const adaptive = r.adaptive === true || r.adaptive === 'true' || r.adaptive === 1;
          const adaptiveMinRaw = parseInt(r.adaptiveMin, 10);
          const adaptiveMin = Number.isFinite(adaptiveMinRaw) && adaptiveMinRaw > 0 ? adaptiveMinRaw : undefined;
          return {
            prefix,
            max,
            windowMs: Number.isFinite(windowMs) && windowMs > 0 ? windowMs : undefined,
            methods,
            bucket,
            keySource,
            windowType,
            adaptive: adaptive || undefined,
            adaptiveMin,
          };
        })
        .filter((r) => r.prefix.length > 1);
      if (parsed.length === 0) {
        logger.warn({ event: 'rate_limit_endpoint_rules_json_empty' });
        return DEFAULT_RATE_LIMIT_ENDPOINT_RULES.map((r) => ({ ...r, windowMs: r.windowMs ?? fallbackWindowMs }));
      }
      return parsed.map((r) => {
        const base = {
          ...r,
          windowMs: r.windowMs ?? fallbackWindowMs,
        };
        if (base.adaptive === undefined) {
          delete base.adaptive;
        }
        if (base.adaptiveMin === undefined) {
          delete base.adaptiveMin;
        }
        return base;
      });
    } catch (e) {
      logger.warn({ event: 'rate_limit_endpoint_rules_json_invalid', err: e.message });
    }
  }
  return DEFAULT_RATE_LIMIT_ENDPOINT_RULES.map((r) => ({ ...r, windowMs: r.windowMs ?? fallbackWindowMs }));
}

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,

  // Base de données : MongoDB :27017, DB gnv_onboard (voir backend/.env)
  mongodb: {
    uri:
      process.env.DATABASE_URL ||
      process.env.MONGODB_URI ||
      'mongodb://localhost:27017/gnv_onboard?directConnection=true',
    dbName: process.env.DB_NAME || 'gnv_onboard',
    reconnectMaxRetries: parseInt(process.env.MONGODB_RECONNECT_MAX_RETRIES, 10) ?? 0,
    reconnectDelayMs: parseInt(process.env.MONGODB_RECONNECT_DELAY_MS, 10) || 5000,
    reconnectDelayMaxMs: parseInt(process.env.MONGODB_RECONNECT_DELAY_MAX_MS, 10) || 60000,
  },

  // JWT : pas de fallback en clair — JWT_SECRET obligatoire (prod + dev)
  jwt: (() => {
    const JWT_MIN_LENGTH = 32;
    const rawSecret = process.env.JWT_SECRET || undefined;
    if (process.env.NODE_ENV === 'production') {
      if (!rawSecret || typeof rawSecret !== 'string' || rawSecret.length < JWT_MIN_LENGTH) {
        logger.error({
          event: 'jwt_secret_invalid_production',
          err: `JWT_SECRET must be set and at least ${JWT_MIN_LENGTH} characters in production.`,
        });
        process.exit(1);
      }
    } else if (rawSecret && rawSecret.length < JWT_MIN_LENGTH) {
      logger.warn({
        event: 'jwt_secret_short_dev',
        message: `JWT_SECRET should be at least ${JWT_MIN_LENGTH} characters for production.`,
      });
    }
    return {
      secret: rawSecret,
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    };
  })(),

  // CORS : origines autorisées (+ tunnels type Cloudflare pour accès distant)
  // [SEC-3] Origines localhost uniquement en dehors de la production
  cors: {
    origins: [
      ...(process.env.FRONTEND_URL
        ? process.env.FRONTEND_URL.split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : []),
      ...(process.env.NODE_ENV !== 'production'
        ? ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:3000']
        : []),
    ].filter((v, i, a) => a.indexOf(v) === i),
    // Tunnels (trycloudflare, ngrok) : en production désactivés sauf si ALLOW_TUNNEL_ORIGINS=true
    allowTunnelOrigins: process.env.NODE_ENV !== 'production' || process.env.ALLOW_TUNNEL_ORIGINS === 'true',
  },

  // Redis (Socket.io adapter multi-instances + cache)
  redis: {
    uri: process.env.REDIS_URI || process.env.REDIS_URL || 'redis://localhost:6379',
  },

  // Rate limit (S1 : 2000 par défaut au lieu de 10000 pour limiter les abus)
  // Accepte RATE_LIMIT_WINDOW_MS ou RATE_LIMIT_WINDOW ; RATE_LIMIT_MAX_REQUESTS ou RATE_LIMIT_MAX
  rateLimit: (() => {
    const windowMs =
      parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || parseInt(process.env.RATE_LIMIT_WINDOW, 10) || 15 * 60 * 1000;
    const fromEnv =
      parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || parseInt(process.env.RATE_LIMIT_MAX, 10) || 2000;
    let max = fromEnv;
    // Dev : les exemples .env historiques mettaient 100 req / 15 min — trop bas pour une SPA (many GET + Strict Mode + polls).
    // Plancher 8000 en NODE_ENV=development uniquement (pas en test/staging/prod). RATE_LIMIT_STRICT_DEV=1 pour tests du rate limit.
    const nodeEnv = process.env.NODE_ENV || 'development';
    const devFloor = 8000;
    if (nodeEnv === 'development' && process.env.RATE_LIMIT_STRICT_DEV !== '1' && max < devFloor) {
      logger.warn({
        event: 'rate_limit_dev_floor_applied',
        previousMax: max,
        appliedMax: devFloor,
        message:
          'NODE_ENV=development : RATE_LIMIT_MAX relevé au plancher dev (RATE_LIMIT_STRICT_DEV=1 pour désactiver).',
      });
      max = devFloor;
    }
    return {
      windowMs,
      max,
      streamWindowMs: parseInt(process.env.RATE_LIMIT_STREAM_WINDOW_MS, 10) || 60 * 1000,
      streamMax: parseInt(process.env.RATE_LIMIT_STREAM_MAX, 10) || 1200,
      endpointRules: parseRateLimitEndpointRules(windowMs),
    };
  })(),

  // Upload & médias (chemins absolus)
  paths: {
    root: ROOT,
    public: path.join(ROOT, 'public'),
    uploads: path.join(ROOT, 'public', 'uploads'),
    videos: path.join(ROOT, 'public', 'uploads', 'videos'),
    images: path.join(ROOT, 'public', 'uploads', 'images'),
    audio: path.join(ROOT, 'public', 'uploads', 'audio'),
    temp: path.join(ROOT, 'public', 'uploads', 'temp'),
    videosHls: path.join(ROOT, 'public', 'uploads', 'videos_hls'),
  },

  // API (pour construire les URLs des médias)
  apiBaseUrl: process.env.API_BASE_URL || '',
};

// Config mid-roll : uniquement par % de la durée (MIDROLL_CUE_POINTS_PERCENT)
const parseCuePoints = (envVal, defaultList) => {
  if (envVal == null || String(envVal).trim() === '') {
    return defaultList;
  }
  const arr = String(envVal)
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !Number.isNaN(n) && n >= 0);
  return arr.length ? arr : defaultList;
};

module.exports.ads = {
  midrollCuePointsSeconds: [], // non utilisé : système uniquement en %
  midrollCuePointsPercent: parseCuePoints(process.env.MIDROLL_CUE_POINTS_PERCENT, [50]),
};
