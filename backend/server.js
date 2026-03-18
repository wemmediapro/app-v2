const path = require('path');
const fs = require('fs');
// config.env en premier, puis .env (pour que .env écrase et aligne la DB avec le seed magazine)
require('dotenv').config({ path: path.join(__dirname, 'config.env') });
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { validateSecurityConfig } = require('./src/lib/security-config');
try {
  validateSecurityConfig();
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
const config = require('./src/config');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cluster = require('cluster');

const app = express();

// Créer les dossiers upload au démarrage (config centralisée)
[config.paths.videos, config.paths.images, config.paths.audio, config.paths.videosHls].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log('📁 Dossier créé (bibliothèque):', dir);
  }
});

const server = createServer(app);

// Timeouts HTTP pour éviter les connexions pendues et garder le streaming fluide (nombreuses connexions)
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      const allowed = config.cors.origins;
      const isTunnel = config.cors.allowTunnelOrigins && origin && (
        /\.trycloudflare\.com$/i.test(origin) ||
        /\.cloudflare\.com$/i.test(origin) ||
        /\.ngrok/i.test(origin) ||
        /\.loca\.lt$/i.test(origin)
      );
      if (!origin || allowed.includes(origin) || isTunnel) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Adapter Redis pour Socket.io (scalabilité multi-instances / cluster)
if (config.redis && config.redis.uri) {
  try {
    const { createAdapter } = require('@socket.io/redis-adapter');
    const { createClient } = require('redis');
    const pubClient = createClient({ url: config.redis.uri });
    const subClient = pubClient.duplicate();
    Promise.all([pubClient.connect(), subClient.connect()])
      .then(() => {
        io.adapter(createAdapter(pubClient, subClient));
        console.log('✅ Socket.io Redis adapter activé');
      })
      .catch((err) => {
        console.warn('⚠️  Redis non disponible, Socket.io en mode local:', err.message);
      });
  } catch (err) {
    console.warn('⚠️  Redis adapter non chargé:', err.message);
  }
}

// Middleware
app.set('trust proxy', 1);

// Redirect HTTP to HTTPS in production (when behind a proxy that sets x-forwarded-proto)
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      return res.redirect(301, `https://${req.header('host')}${req.url}`);
    }
    next();
  });
}

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // Improve later
      imgSrc: ["'self'", "data:", "https:"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      mediaSrc: ["'self'", "blob:"],
      connectSrc: ["'self'", "ws:", "wss:"],
      fontSrc: ["'self'", "https:", "data:"],
    },
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
  },
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));
app.use(cookieParser());
const { csrfCookie, csrfProtection } = require('./src/middleware/csrf');
app.use('/api', csrfCookie);
app.use('/api', csrfProtection);
const corsOptions = {
  origin: (origin, callback) => {
    const allowed = config.cors.origins;
    const isTunnel = config.cors.allowTunnelOrigins && origin && (
      /\.trycloudflare\.com$/i.test(origin) ||
      /\.cloudflare\.com$/i.test(origin) ||
      /\.ngrok/i.test(origin) ||
      /\.loca\.lt$/i.test(origin)
    );
    if (!origin || allowed.includes(origin) || isTunnel) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
};
app.use(cors(corsOptions));
// En prod : format court + pas de log health/uploads (réduit I/O et bruit — audit CTO)
app.use(morgan(config.env === 'production' ? 'short' : 'combined', {
  skip: (req) => req.path === '/api/health' || req.path?.startsWith('/uploads/'),
}));
// Identifiant de requête pour le log d'erreurs et les réponses (requestId)
app.use((req, res, next) => {
  req.id = req.get('x-request-id') || require('crypto').randomBytes(8).toString('hex');
  next();
});
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
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
  if (req.method !== 'GET') return next();
  if (req.path === '/notifications' || req.path === '/notifications/') {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    return next();
  }
  const isListPath = /^\/(movies|magazine|radio|banners|shop|restaurants|webtv|enfant|shipmap|notifications)(\/|$)/.test(req.path);
  if (!isListPath) return next();
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
  message: { success: false, message: 'Trop d\'uploads. Réessayez plus tard.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/upload', uploadLimiter);

// Rate limit dédié au streaming (vidéo/audio) : limite par IP pour supporter beaucoup de connexions sans abus
const streamLimiter = rateLimit({
  windowMs: config.rateLimit.streamWindowMs,
  max: config.rateLimit.streamMax,
  message: { success: false, message: 'Trop de requêtes de streaming. Réessayez dans une minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/stream', streamLimiter);

// Rate limit bibliothèque média (admin)
const mediaLibraryLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: parseInt(process.env.RATE_LIMIT_MEDIA_LIBRARY_MAX, 10) || 200,
  message: { success: false, message: 'Trop de requêtes. Réessayez plus tard.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/media-library', mediaLibraryLimiter);

// Fichiers statiques et streaming
const { videoStreamMiddleware, audioStreamMiddleware } = require('./src/routes/stream');
app.use('/uploads', videoStreamMiddleware);
app.use('/uploads', audioStreamMiddleware);
app.use('/uploads', express.static(config.paths.uploads));
app.use('/public', express.static(config.paths.public));

// Base de données (config centralisée)
const dbManager = require('./src/lib/database');
const { createRedisStore } = require('./src/lib/rateLimitRedisStore');
const connectionCounters = require('./src/lib/connectionCounters');
const cacheManager = require('./src/lib/cache-manager');

/** Monte le rate limit API (store Redis en cluster, sinon mémoire), connecte le cache listes, puis les routes */
async function setupAfterDb() {
  const redisStore = await createRedisStore(config.redis && config.redis.uri, 'rl:api:');
  if (redisStore) redisStore.init({ windowMs: config.rateLimit.windowMs });
  if (config.redis && config.redis.uri) {
    const cacheConnected = await cacheManager.connect(config.redis.uri);
    if (cacheConnected) console.log('✅ Cache listes (Redis) actif — TTL 60s');
  }
  const jwt = require('jsonwebtoken');
  const skipApiLimit = (req) => {
    const p = (req.path || '').toLowerCase();
    if (p === '/health' || p === '/time') return true;
    if (p.startsWith('/stream') || p.startsWith('/upload') || p.startsWith('/media-library')) return true;
    try {
      const token = req.get('Authorization')?.replace('Bearer ', '') || req.cookies?.adminToken;
      if (token && config.jwt?.secret) {
        const decoded = jwt.verify(token, config.jwt.secret);
        if (decoded.role === 'admin') return true;
      }
    } catch (e) { /* ignore */ }
    return false;
  };
  const apiLimitMax = process.env.RATE_LIMIT_LOAD_TEST === '1' ? 1000000 : config.rateLimit.max;
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
    console.log('✅ Rate limit API : store Redis actif');
  } else if (process.env.NODE_ENV === 'production') {
    console.warn('⚠️ Rate limit API : store mémoire (REDIS_URI non configuré). En multi-process la limite n\'est pas partagée.');
  }
  const { mountRoutes } = require('./src/routes');
  mountRoutes(app, { dbManager, connectionCounters });

  // SPA fallback et 404 après les routes API (sinon /api/health etc. sont captés par le catch-all)
  const publicIndex = path.join(config.paths.public, 'index.html');
  app.get('/', (req, res) => {
    res.sendFile(publicIndex);
  });
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
    res.sendFile(publicIndex);
  });
  app.use('*', (req, res) => {
    res.status(404).json({ message: 'Route not found' });
  });

  const { globalErrorHandler } = require('./src/utils/errors');
  app.use(globalErrorHandler(config));
}

function startServer() {
  const PORT = config.port;
  const listenOptions = typeof cluster !== 'undefined' && cluster.isWorker ? { reusePort: true } : {};
  server.listen(PORT, listenOptions, () => {
    const workerId = typeof cluster !== 'undefined' && cluster.worker ? cluster.worker.id : '-';
    console.log(`🚀 Server running on port ${PORT}${workerId !== '-' ? ` (worker ${workerId})` : ''}`);
    console.log(`📱 Environment: ${config.env}`);
  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ Port ${PORT} déjà utilisé. Arrêtez l'autre processus (lsof -i :${PORT}) ou changez PORT dans config.env`);
    } else {
      console.error('❌ Erreur serveur:', err.message);
    }
    process.exit(1);
  });
}

dbManager.connect(config.mongodb.uri).then(async (connected) => {
  if (connected) {
    console.log('✅ MongoDB connecté — Radio, WebTV, Films, etc. reliés à la base.');
  } else {
    console.log('⚠️  MongoDB non connecté. Démarrez MongoDB (docker run -d -p 27017:27017 mongo) puis redémarrez le backend.');
    console.log('   MONGODB_URI utilisé:', config.mongodb.uri);
  }
  await setupAfterDb();
  startServer();
});

// Socket.io : authentification par JWT (évite accès anonyme aux rooms / send-message)
const { verifyToken } = require('./src/middleware/auth');
const { logSocketAuthFailed, redact } = require('./src/lib/logger');
const mongoose = require('mongoose');
const LocalServerConfig = require('./src/models/LocalServerConfig');

io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
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
  socket._shipId = connectionCounters.getShipId(socket) || null;
  try {
    if (mongoose.connection.readyState === 1) {
      const config = await LocalServerConfig.findOne({ id: 'local' }).lean();
      const maxConn = config?.maxConnections;
      if (maxConn != null && maxConn >= 0) {
        const current = connectionCounters.getTotalCount();
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
const { attachSocketHandlers } = require('./src/socket/handlers');
attachSocketHandlers(io, connectionCounters);

// Démarrage après tentative de connexion MongoDB (voir plus haut)
module.exports = { app, io };
