const path = require('path');
const fs = require('fs');
// config.env en premier, puis .env (pour que .env écrase et aligne la DB avec le seed magazine)
require('dotenv').config({ path: path.join(__dirname, 'config.env') });
require('dotenv').config({ path: path.join(__dirname, '.env') });

const config = require('./src/config');

// En production : refuser de démarrer sans secrets obligatoires
if (config.env === 'production') {
  if (!config.jwt.secret) {
    console.error('CRITICAL: JWT_SECRET must be set in production. Set it in config.env or .env.');
    process.exit(1);
  }
  if (!process.env.ADMIN_PASSWORD) {
    console.error('CRITICAL: ADMIN_PASSWORD must be set in production. Set it in config.env or .env.');
    process.exit(1);
  }
}

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
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https:"],
      imgSrc: ["'self'", "data:", "blob:"],
      mediaSrc: ["'self'", "blob:"],
      connectSrc: ["'self'", "ws:", "wss:"],
      fontSrc: ["'self'", "https:", "data:"],
    },
  },
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));
app.use(cookieParser());
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
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(require('./src/middleware/language'));

// Rate limiting — protège l’API pour 1000+ connexions (exclusions: stream, upload, health)
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: { success: false, message: 'Trop de requêtes. Veuillez patienter quelques minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    const p = req.path || '';
    return p === '/api/health' || p.startsWith('/api/stream') || p.startsWith('/api/upload') || p.startsWith('/api/media-library');
  },
});
app.use('/api/', limiter);

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
  // Pas de cache navigateur pour les listes : modifs (ex. vidéo dans « Modifier le contenu ») visibles sans redémarrer le backend
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
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

dbManager.connect(config.mongodb.uri).then((connected) => {
  if (connected) {
    console.log('✅ MongoDB connecté — Radio, WebTV, Films, etc. reliés à la base.');
  } else {
    console.log('⚠️  MongoDB non connecté. Démarrez MongoDB (docker run -d -p 27017:27017 mongo) puis redémarrez le backend.');
    console.log('   MONGODB_URI utilisé:', config.mongodb.uri);
  }
  startServer();
});

// Montage de toutes les routes API (ergonomie centralisée)
const { mountRoutes } = require('./src/routes');
mountRoutes(app, { dbManager });

// Socket.io : authentification par JWT (évite accès anonyme aux rooms / send-message)
const { verifyToken } = require('./src/middleware/auth');
const connectionCounters = require('./src/lib/connectionCounters');
const mongoose = require('mongoose');
const LocalServerConfig = require('./src/models/LocalServerConfig');

io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (!token) {
    return next(new Error('Authentication required'));
  }
  try {
    const decoded = verifyToken(token);
    socket.user = decoded;
  } catch (err) {
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

// Socket.io for real-time features
io.on('connection', (socket) => {
  const shipId = socket._shipId || connectionCounters.getShipId(socket);
  connectionCounters.increment();
  console.log('👤 User connected:', socket.id, socket.user?.email || '', shipId ? `(ship: ${shipId})` : '');

  socket.on('join-room', (room) => {
    if (typeof room !== 'string' || room.length > 64) return;
    socket.join(room);
    console.log(`👤 User ${socket.id} joined room: ${room}`);
  });

  socket.on('send-message', (data) => {
    if (!data || typeof data.room !== 'string' || data.room.length > 64) return;
    socket.to(data.room).emit('new-message', data);
  });

  socket.on('disconnect', () => {
    connectionCounters.decrement();
    console.log('👤 User disconnected:', socket.id);
  });
});

// Gestion des erreurs (réponse cohérente)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: err.message || 'Erreur serveur',
    ...(config.env === 'development' && { stack: err.stack }),
  });
});

// SPA fallback (dashboard React)
const publicIndex = path.join(config.paths.public, 'index.html');
app.get('/', (req, res) => {
  res.sendFile(publicIndex);
});
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
  res.sendFile(publicIndex);
});

// 404 handler (API / autres requêtes non gérées)
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Démarrage après tentative de connexion MongoDB (voir plus haut)
module.exports = { app, io };
