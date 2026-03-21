const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
// config.env en premier, puis .env (pour que .env écrase et aligne la DB avec le seed magazine)
require('dotenv').config({ path: path.join(__dirname, 'config.env') });
require('dotenv').config({ path: path.join(__dirname, '.env') });

const logger = require('./src/lib/logger');
const { validateSecurityConfig } = require('./src/lib/security-config');
try {
  validateSecurityConfig();
} catch (e) {
  logger.error({
    event: 'security_config_validation_failed',
    err: e instanceof Error ? e.message : String(e),
    stack: e instanceof Error ? e.stack : undefined,
  });
  process.exit(1);
}
const config = require('./src/config');
const connectionCounters = require('./src/lib/connectionCounters');
const sentry = require('./src/lib/sentry');

if (process.env.NODE_ENV === 'production') {
  sentry.init();
  process.on('uncaughtException', (err) => {
    sentry.captureException(err);
    logger.error({
      event: 'process_uncaught_exception',
      err: err.message,
      stack: err.stack,
    });
    process.exit(1);
  });
  process.on('unhandledRejection', (reason, _promise) => {
    sentry.captureException(reason instanceof Error ? reason : new Error(String(reason)));
    const msg = reason instanceof Error ? reason.message : String(reason);
    const stack = reason instanceof Error ? reason.stack : undefined;
    logger.error({ event: 'process_unhandled_rejection', err: msg, stack });
  });
}

// [SEC] RATE_LIMIT_LOAD_TEST : en production, ne jamais l'honorer (éviter relâchement rate limit par erreur)
if (process.env.NODE_ENV === 'production' && process.env.RATE_LIMIT_LOAD_TEST) {
  logger.warn({
    event: 'rate_limit_load_test_ignored_production',
    message: 'RATE_LIMIT_LOAD_TEST défini en production — ignoré.',
  });
  delete process.env.RATE_LIMIT_LOAD_TEST;
}

const express = require('express');
const compression = require('compression');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cluster = require('cluster');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const { verifyToken } = require('./src/middleware/auth');
const { logSocketAuthFailed } = require('./src/lib/logger');
const LocalServerConfig = require('./src/models/LocalServerConfig');
const { csrfCookie, csrfProtection } = require('./src/middleware/csrf');
const { videoStreamMiddleware, audioStreamMiddleware } = require('./src/routes/stream');
const { createRedisStore } = require('./src/lib/rateLimitRedisStore');
const { mountRoutes } = require('./src/routes');
const { globalErrorHandler } = require('./src/utils/errors');
const { attachSocketHandlers } = require('./src/socket/handlers');
const connectionManager = require('./src/lib/connection-manager');
const redisConnectionManager = require('./src/lib/redis-connection-manager');
const memoryMonitor = require('./src/lib/memory-monitor');
const https = require('https');
const http = require('http');
const { getApiPathSuffix } = require('./src/lib/apiPath');
const { API_BASE_PATHS } = require('./src/constants/apiVersion');

const app = express();

// Créer les dossiers upload au démarrage (config centralisée)
[config.paths.videos, config.paths.images, config.paths.audio, config.paths.videosHls].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    logger.info({ event: 'library_upload_dir_created', dir });
  }
});

const server = createServer(app);

// Timeouts HTTP pour éviter les connexions pendues et garder le streaming fluide (nombreuses connexions)
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

const io = new Server(server, {
  transports: ['websocket'],
  cors: {
    origin: (origin, callback) => {
      const allowed = config.cors.origins;
      const isTunnel =
        config.cors.allowTunnelOrigins &&
        origin &&
        (/\.trycloudflare\.com$/i.test(origin) ||
          /\.cloudflare\.com$/i.test(origin) ||
          /\.ngrok/i.test(origin) ||
          /\.loca\.lt$/i.test(origin));
      if (!origin || allowed.includes(origin) || isTunnel) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    methods: ['GET', 'POST'],
  },
  pingTimeout: 20000,
  pingInterval: 10000,
});

// Adapter Redis pour Socket.io (scalabilité multi-instances / cluster)
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');
if (config.redis && config.redis.uri) {
  try {
    const pubClient = createClient({ url: config.redis.uri });
    const subClient = pubClient.duplicate();
    Promise.all([pubClient.connect(), subClient.connect()])
      .then(() => {
        io.adapter(createAdapter(pubClient, subClient));
        logger.info({ event: 'socket_io_redis_adapter_enabled' });
      })
      .catch((err) => {
        logger.warn({
          event: 'socket_io_redis_adapter_unavailable',
          err: err.message,
          stack: err.stack,
        });
      });
  } catch (err) {
    logger.warn({ event: 'socket_io_redis_adapter_init_failed', err: err.message, stack: err.stack });
  }
}

// Middleware
app.set('trust proxy', 1);
// [PERF-2] Compression gzip des réponses (JSON, HTML, etc.)
app.use(compression());

// Redirection HTTP→HTTPS gérée par Nginx (voir nginx.conf)

// Nonce CSP : un par requête pour autoriser les scripts sans 'unsafe-inline'
app.use((_req, res, next) => {
  res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
  next();
});
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", (req, res) => `'nonce-${res.locals.cspNonce || ''}'`],
        imgSrc: ["'self'", 'data:', 'https:'],
        // React utilise style={{ … }} (attributs style inline) — sans 'unsafe-inline', l’UI est bloquée par la CSP.
        styleSrc: ["'self'", "'unsafe-inline'"],
        mediaSrc: ["'self'", 'blob:'],
        connectSrc: ["'self'", 'ws:', 'wss:'],
        fontSrc: ["'self'", 'https:', 'data:'],
      },
    },
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(cookieParser());
app.use('/api', csrfCookie);
app.use('/api', csrfProtection);
const corsOptions = {
  origin: (origin, callback) => {
    const allowed = config.cors.origins;
    const isTunnel =
      config.cors.allowTunnelOrigins &&
      origin &&
      (/\.trycloudflare\.com$/i.test(origin) ||
        /\.cloudflare\.com$/i.test(origin) ||
        /\.ngrok/i.test(origin) ||
        /\.loca\.lt$/i.test(origin));
    if (!origin || allowed.includes(origin) || isTunnel) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
};
app.use(cors(corsOptions));
// Corrélation avant Morgan (ligne d’accès inclut reqId) + logger enfant pour routes / erreurs
app.use((req, res, next) => {
  req.id = req.get('x-request-id') || req.get('X-Request-Id') || crypto.randomBytes(8).toString('hex');
  req.log = logger.child({ reqId: req.id });
  res.setHeader('X-Request-Id', req.id);
  next();
});
morgan.token('req-id', (req) => req.id || '-');
const morganAccessFormat =
  config.env === 'production'
    ? ':req-id :remote-addr :method :url :status :res[content-length] - :response-time ms'
    : ':req-id :remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"';
const morganStream = {
  write(str) {
    const line = typeof str === 'string' ? str.trim() : String(str).trim();
    if (!line) {
      return;
    }
    logger.info({ event: 'http_access', line });
  },
};
// Pas de log health / uploads (réduit I/O) ; sortie JSON via Pino (stream), plus de stdout Apache brut
app.use(
  morgan(morganAccessFormat, {
    stream: morganStream,
    skip: (req) => {
      const sub = getApiPathSuffix(req.path || '');
      return (
        sub === '/health' ||
        sub.startsWith('/health/') ||
        sub === '/metrics/web-vitals' ||
        req.path?.startsWith('/uploads/')
      );
    },
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(require('./src/middleware/language'));

// Rate limiting — protège l’API pour 1000+ connexions (exclusions: stream, upload, health)
// Limiter API (store Redis ou mémoire) — monté dans setupAfterDb()

// En-tête Date sur toutes les réponses API (pour synchro heure serveur radio / WebTV)
app.use('/api', (req, res, next) => {
  res.setHeader('Date', new Date().toUTCString());
  next();
});
// Cache-Control pour les réponses GET publiques (listes) — pas de cache pour que les modifs dashboard (films, vidéos, etc.) s’affichent tout de suite dans l’app
// Les requêtes avec Authorization (dashboard admin) ne sont pas mises en cache pour que les ajouts/modifs/suppressions s'affichent immédiatement
// GET /notifications (app passagers) : pas de cache pour que les notifications envoyées depuis le dashboard s'affichent tout de suite
app.use('/api', (req, res, next) => {
  if (req.method !== 'GET') {
    return next();
  }
  const sub = getApiPathSuffix(req.path || '');
  if (sub === '/notifications' || sub === '/notifications/') {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    return next();
  }
  const isListPath =
    /^\/(movies|magazine|radio|banners|shop|restaurants|webtv|enfant|shipmap|notifications)(\/|$)/.test(sub);
  if (!isListPath) {
    return next();
  }
  if (req.get('Authorization')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    return next();
  }
  // Cache court (60 s) pour listes publiques — réduit la charge MongoDB sous 1000+ users (audit CTO)
  res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=30');
  next();
});

// Rate limit strict pour les uploads (évite abus bande passante / stockage)
const uploadLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: parseInt(process.env.RATE_LIMIT_UPLOAD_MAX, 10) || 100,
  message: { success: false, message: "Trop d'uploads. Réessayez plus tard." },
  standardHeaders: true,
  legacyHeaders: false,
});
for (const px of API_BASE_PATHS) {
  app.use(`${px}/upload`, uploadLimiter);
}

// Rate limit dédié au streaming (vidéo/audio) : limite par IP pour supporter beaucoup de connexions sans abus
const streamLimiter = rateLimit({
  windowMs: config.rateLimit.streamWindowMs,
  max: config.rateLimit.streamMax,
  message: { success: false, message: 'Trop de requêtes de streaming. Réessayez dans une minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});
for (const px of API_BASE_PATHS) {
  app.use(`${px}/stream`, streamLimiter);
}

// Rate limit bibliothèque média (admin)
const mediaLibraryLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: parseInt(process.env.RATE_LIMIT_MEDIA_LIBRARY_MAX, 10) || 200,
  message: { success: false, message: 'Trop de requêtes. Réessayez plus tard.' },
  standardHeaders: true,
  legacyHeaders: false,
});
for (const px of API_BASE_PATHS) {
  app.use(`${px}/media-library`, mediaLibraryLimiter);
}

const feedbackLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, message: 'Trop de feedbacks envoyés. Réessayez plus tard.' },
  standardHeaders: true,
  legacyHeaders: false,
});
for (const px of API_BASE_PATHS) {
  app.use(`${px}/feedback`, feedbackLimiter);
}

// Fichiers statiques et streaming
app.use('/uploads', videoStreamMiddleware);
app.use('/uploads', audioStreamMiddleware);
app.use(
  '/uploads',
  express.static(config.paths.uploads, {
    etag: true,
    lastModified: true,
    setHeaders(res, filePath) {
      if (/\.(webp|avif|jpe?g|png|gif|svg|ico|woff2)$/i.test(filePath)) {
        res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');
      } else if (/\.(mp4|webm|mp3|wav|m4a|m3u8|ts)$/i.test(filePath)) {
        res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=3600');
      }
    },
  })
);
app.use(
  '/public',
  express.static(config.paths.public, {
    etag: true,
    lastModified: true,
    setHeaders(res, filePath) {
      if (/\.(webp|avif|jpe?g|png|gif|svg|ico|woff2|js|css)$/i.test(filePath)) {
        res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');
      }
    },
  })
);

// Base de données (config centralisée)
const dbManager = require('./src/lib/database');
const cacheManager = require('./src/lib/cache-manager');

/** En production : vérifier que Redis est accessible (obligatoire pour rate limit, Socket.io, cache). */
async function ensureRedisInProduction() {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }
  const uri = config.redis?.uri;
  if (!uri || typeof uri !== 'string' || !uri.startsWith('redis')) {
    logger.error({
      event: 'redis_uri_missing_production',
      err: 'REDIS_URI (ou REDIS_URL) doit être défini en production.',
    });
    process.exit(1);
  }
  const { createClient } = require('redis');
  const client = createClient({ url: uri });
  try {
    await client.connect();
    await client.ping();
    await client.quit();
    logger.info({ event: 'redis_production_precheck_ok' });
  } catch (err) {
    logger.error({
      event: 'redis_unreachable_production',
      err: err.message,
      stack: err.stack,
    });
    process.exit(1);
  }
}

/** Monte le rate limit API (store Redis en cluster, sinon mémoire), connecte le cache listes, puis les routes */
async function setupAfterDb() {
  await ensureRedisInProduction();
  const redisStore = await createRedisStore(config.redis && config.redis.uri, 'rl:api:');
  if (redisStore) {
    redisStore.init({ windowMs: config.rateLimit.windowMs });
  }
  if (config.redis && config.redis.uri) {
    const cacheConnected = await cacheManager.connect(config.redis.uri);
    if (cacheConnected) {
      logger.info({ event: 'list_cache_redis_active', ttlSeconds: 60 });
      connectionCounters.initRedis(cacheManager);
      await redisConnectionManager.init(cacheManager);
      try {
        const globalConnStats = await redisConnectionManager.loadGlobalStatsOnStartup();
        connectionManager.applyGlobalSnapshotFromRedis(globalConnStats);
      } catch (e) {
        logger.warn({
          event: 'redis_connection_stats_startup_failed',
          err: e.message,
          stack: e.stack,
        });
      }
    }
  }
  /** Loopback / local : SPA + React Strict Mode + polls = beaucoup de GET d’un coup. */
  const isLocalLoopbackIp = (req) => {
    const raw = req.ip || req.socket?.remoteAddress || '';
    const ip = String(raw).replace(/^::ffff:/i, '');
    return ip === '127.0.0.1' || ip === '::1' || ip === 'localhost';
  };

  const skipApiLimit = (req) => {
    const p = getApiPathSuffix(req.path || '').toLowerCase();
    if (p === '/health' || p === '/health/ready' || p === '/time') {
      return true;
    }
    if (p.startsWith('/stream') || p.startsWith('/upload') || p.startsWith('/media-library')) {
      return true;
    }
    // Dev : pas de rate limit sur loopback (évite 429 au premier chargement + compteurs Redis résiduels)
    if (
      process.env.NODE_ENV !== 'production' &&
      process.env.RATE_LIMIT_LOCALHOST !== '0' &&
      isLocalLoopbackIp(req)
    ) {
      return true;
    }
    try {
      const token = req.get('Authorization')?.replace('Bearer ', '') || req.cookies?.authToken;
      if (token && config.jwt?.secret) {
        const decoded = jwt.verify(token, config.jwt.secret);
        if (decoded.role === 'admin') {
          return true;
        }
      }
    } catch (e) {
      /* ignore */
    }
    return false;
  };
  // [SEC-6] RATE_LIMIT_LOAD_TEST ignoré en production (réservé aux tests de charge en dev)
  const apiLimitMax =
    process.env.NODE_ENV !== 'production' && process.env.RATE_LIMIT_LOAD_TEST === '1' ? 1000000 : config.rateLimit.max;
  const apiLimiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: apiLimitMax,
    skip: skipApiLimit,
    message: { success: false, message: 'Trop de requêtes. Veuillez patienter quelques minutes.' },
    standardHeaders: true,
    legacyHeaders: false,
    store: redisStore || undefined,
  });
  app.use('/api/', apiLimiter);
  if (redisStore) {
    logger.info({ event: 'api_rate_limit_redis_store_active' });
  } else if (process.env.NODE_ENV === 'production') {
    logger.warn({
      event: 'rate_limit_memory_store_production',
      message:
        "Rate limit API : store mémoire (REDIS_URI non configuré). En multi-process la limite n'est pas partagée.",
    });
  }
  mountRoutes(app, { dbManager, connectionCounters, cacheManager });

  // Documentation API Swagger/OpenAPI
  if (process.env.NODE_ENV !== 'production' || process.env.SWAGGER_ENABLED === 'true') {
    const swaggerUi = require('swagger-ui-express');
    const swaggerSpec = require('./src/lib/swagger');
    app.use(
      '/api-docs',
      swaggerUi.serve,
      swaggerUi.setup(swaggerSpec, {
        customCss: '.swagger-ui .topbar { display: none }',
        customSiteTitle: 'GNV OnBoard API Documentation',
      })
    );
    app.get('/api-docs.json', (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.send(swaggerSpec);
    });
    logger.info({ event: 'swagger_enabled', path: '/api-docs' });
  }

  // SPA fallback : index.html en cache mémoire, seule la substitution du nonce CSP à la volée (évite fs.readFileSync à chaque requête)
  const publicIndex = path.join(config.paths.public, 'index.html');
  let cachedIndexHtml = null;
  try {
    cachedIndexHtml = fs.readFileSync(publicIndex, 'utf8');
  } catch (err) {
    // index.html absent au démarrage, on lira au moment de la requête (fallback)
  }
  const sendIndexWithNonce = (req, res) => {
    const nonce = res.locals.cspNonce || '';
    let html = cachedIndexHtml;
    if (html == null) {
      try {
        html = fs.readFileSync(publicIndex, 'utf8');
        cachedIndexHtml = html;
      } catch (e) {
        return res.status(500).send('index.html not found');
      }
    }
    html = html.replace(/__CSP_NONCE__/g, nonce);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.send(html);
  };
  app.get('/', sendIndexWithNonce);
  // Express 5 : wildcard doit être nommé (ex. /*splat)
  app.get('/*splat', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      return next();
    }
    sendIndexWithNonce(req, res);
  });
  app.use('/*splat', (req, res) => {
    res.status(404).json({ message: 'Route not found' });
  });

  app.use(globalErrorHandler(config));
}

function startServer() {
  const PORT = config.port;
  const listenOptions = typeof cluster !== 'undefined' && cluster.isWorker ? { reusePort: true } : {};
  server
    .listen(PORT, listenOptions, () => {
      const workerId = typeof cluster !== 'undefined' && cluster.worker ? cluster.worker.id : '-';
      logger.info({
        event: 'http_server_listening',
        port: PORT,
        workerId: workerId !== '-' ? workerId : undefined,
        env: config.env,
      });
    })
    .on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        logger.error({
          event: 'server_listen_eaddrinuse',
          err: `Port ${PORT} déjà utilisé. Arrêtez l'autre processus (lsof -i :${PORT}) ou changez PORT dans config.env`,
        });
      } else {
        logger.error({ event: 'server_listen_failed', err: err.message, stack: err.stack });
      }
      process.exit(1);
    });
}

dbManager.connect(config.mongodb.uri).then(async (connected) => {
  if (connected) {
    logger.info({ event: 'mongodb_startup_connected' });
  } else {
    let mongoHost;
    try {
      mongoHost = new URL(config.mongodb.uri).hostname;
    } catch (_) {
      mongoHost = undefined;
    }
    logger.warn({
      event: 'mongodb_startup_disconnected',
      message: 'MongoDB non connecté — démarrez MongoDB puis redémarrez le backend.',
      mongoHost,
    });
  }
  await setupAfterDb();
  startServer();
});

// Socket.io : authentification par JWT (évite accès anonyme aux rooms / send-message)
io.use(async (socket, next) => {
  // [SEC-5] Token uniquement via auth (pas via query pour éviter exposition dans logs/URLs)
  const token = socket.handshake.auth?.token;
  if (!token) {
    logSocketAuthFailed(socket.id, 'missing_token');
    return next(new Error('Authentication required'));
  }
  try {
    const decoded = verifyToken(token);
    socket.user = decoded;
  } catch (err) {
    logSocketAuthFailed(socket.id, 'invalid_token');
    return next(new Error('Invalid token'));
  }

  const clientIp = connectionManager.getClientIP(socket);
  if (redisConnectionManager.isEnabled()) {
    try {
      const atLimit = await redisConnectionManager.isIpAtOrOverLimit(
        clientIp,
        parseInt(process.env.MAX_CONNECTIONS_PER_IP, 10) || 50
      );
      if (atLimit) {
        logSocketAuthFailed(socket.id, 'ip_limit_global');
        return next(new Error('Too many connections from this IP'));
      }
    } catch (err) {
      return next(err);
    }
  }

  socket._shipId = connectionCounters.getShipId(socket) || null;
  try {
    if (mongoose.connection.readyState === 1) {
      const config = await LocalServerConfig.findOne({ id: 'local' }).lean();
      const maxConn = config?.maxConnections;
      if (maxConn != null && maxConn >= 0) {
        const current = await connectionCounters.getTotalCountAsync();
        if (current >= maxConn) {
          return next(new Error('Connection limit reached for this server'));
        }
      }
    }
  } catch (err) {
    return next(err);
  }
  next();
});

// Socket.io : handlers (autorisation rooms, sanitization, logging)
attachSocketHandlers(io, connectionCounters);

/** Webhook optionnel (Slack, Discord, etc.) pour alertes mémoire — MEMORY_ALERT_WEBHOOK_URL ou SLACK_WEBHOOK_URL */
const MEMORY_WEBHOOK_THROTTLE_MS = parseInt(process.env.MEMORY_ALERT_WEBHOOK_THROTTLE_MS, 10) || 120_000;
let lastMemoryWebhookWarning = 0;
let lastMemoryWebhookCritical = 0;

function postMemoryWebhook(payload) {
  const url = process.env.MEMORY_ALERT_WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL;
  if (!url || typeof url !== 'string') {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    try {
      const lib = new URL(url).protocol === 'https:' ? https : http;
      const text = `[GNV Backend] ${payload.title || 'Memory'}\nheap ${payload.percent}% | used=${payload.heapUsed} | rss=${payload.rss} | ${payload.timestamp}`;
      const body = JSON.stringify(payload.raw && typeof payload.raw === 'object' ? payload.raw : { text });
      const req = lib.request(
        url,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
          },
          timeout: 8000,
        },
        (res) => {
          res.resume();
          res.on('end', resolve);
        }
      );
      req.on('error', (err) => {
        logger.warn({ event: 'memory_webhook_error', message: err.message });
        resolve();
      });
      req.on('timeout', () => {
        req.destroy();
        resolve();
      });
      req.write(body);
      req.end();
    } catch (e) {
      logger.warn({ event: 'memory_webhook_error', message: e.message });
      resolve();
    }
  });
}

function initMemoryMonitoring() {
  memoryMonitor.start({
    intervalMs: parseInt(process.env.MEMORY_MONITOR_INTERVAL_MS, 10) || 30_000,
  });

  memoryMonitor.on('memory-warning', (snap) => {
    logger.warn({
      event: 'memory_pressure_warning',
      percent: snap.percent,
      heapUsed: snap.heapUsed,
      rss: snap.rss,
    });
    connectionManager.cleanupForMemoryPressureWarning();
    const now = Date.now();
    if (now - lastMemoryWebhookWarning >= MEMORY_WEBHOOK_THROTTLE_MS) {
      lastMemoryWebhookWarning = now;
      void postMemoryWebhook({
        title: 'Avertissement mémoire (≥85 % heap)',
        ...snap,
      });
    }
  });

  memoryMonitor.on('memory-critical', (snap) => {
    logger.error({
      event: 'memory_pressure_critical',
      percent: snap.percent,
      heapUsed: snap.heapUsed,
      rss: snap.rss,
    });
    connectionManager.cleanupForMemoryPressure('critical');
    const gcRan = memoryMonitor.forceGC();
    logger.warn({ event: 'memory_force_gc', ran: gcRan });
    const now = Date.now();
    if (now - lastMemoryWebhookCritical >= MEMORY_WEBHOOK_THROTTLE_MS) {
      lastMemoryWebhookCritical = now;
      void postMemoryWebhook({
        title: 'Critique mémoire (≥90 % heap) — cleanup + GC',
        ...snap,
        gcHint: gcRan,
      });
    }
  });
}

initMemoryMonitoring();

// Graceful shutdown (PM2 restart, Docker stop, etc.)
function gracefulShutdown(signal) {
  logger.info({ event: 'graceful_shutdown_signal', signal });
  try {
    memoryMonitor.stop();
  } catch (_) {}
  server.close(() => {
    logger.info({ event: 'http_server_closed' });
    Promise.resolve(dbManager.disconnect?.())
      .then(() => process.exit(0))
      .catch(() => process.exit(0));
  });
  setTimeout(() => {
    logger.error({ event: 'graceful_shutdown_timeout', err: 'Arrêt forcé après timeout' });
    process.exit(1);
  }, 30000);
}
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Démarrage après tentative de connexion MongoDB (voir plus haut)
module.exports = { app, io };
