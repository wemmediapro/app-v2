/**
 * Serveur optimisé pour 2000+ connexions simultanées (LEGACY — non utilisé par PM2).
 * En production, PM2 utilise backend/server.production.js (voir ecosystem.production.cjs).
 * Ce fichier repose sur database-optimized / connection-manager ; conservé pour référence ou migration future.
 */

require('dotenv').config({ path: './config.env' });
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');

// Modules optimisés
const dbManager = require('./src/lib/database-optimized');
const cacheManager = require('./src/lib/cache-manager');
const connectionManager = require('./src/lib/connection-manager');

const isProduction = process.env.NODE_ENV === 'production';
const workerId = process.env.INSTANCE_ID || process.pid;

// Application Express
const app = express();
const server = createServer(app);

// Configuration Socket.io optimisée pour 2000+ connexions
const ioOptions = {
  cors: {
    origin: process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',') : ["http://localhost:5173"],
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  // Timeouts optimisés pour connexions longues
  pingTimeout: 60000,
  pingInterval: 25000,
  // Buffer optimisé
  maxHttpBufferSize: 1e8, // 100MB
  perMessageDeflate: {
    threshold: 1024, // Seuil de compression
    zlibDeflateOptions: {
      chunkSize: 1024,
      memLevel: 7,
      level: 3
    }
  },
  // Optimisations réseau
  connectTimeout: 45000,
  upgradeTimeout: 30000,
  // Limites
  allowRequest: (req, callback) => {
    // Rate limiting géré par connectionManager
    callback(null, true);
  }
};

const io = new Server(server, ioOptions);

// Configuration Redis Adapter pour Socket.io (essentiel pour clustering)
let redisAdapter = null;
let redisPubClient = null;
let redisSubClient = null;

async function setupRedisAdapter() {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  
  try {
    redisPubClient = createClient({ url: redisUrl });
    redisSubClient = redisPubClient.duplicate();

    await Promise.all([
      redisPubClient.connect(),
      redisSubClient.connect()
    ]);

    io.adapter(createAdapter(redisPubClient, redisSubClient));
    redisAdapter = { pubClient: redisPubClient, subClient: redisSubClient };
    
    console.log(`✅ Redis adapter activé pour Socket.io (Worker ${workerId})`);
    return true;
  } catch (err) {
    console.warn(`⚠️  Redis adapter non disponible (Worker ${workerId}):`, err.message);
    console.log('ℹ️  Socket.io fonctionne en mode standalone (non recommandé pour clustering)');
    return false;
  }
}

// Middleware optimisé
app.use(helmet({
  contentSecurityPolicy: isProduction ? undefined : false,
  crossOriginEmbedderPolicy: false
}));

app.use(cors({
  origin: process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',') : ["http://localhost:5173"],
  credentials: true,
  optionsSuccessStatus: 200
}));

// Morgan optimisé (moins verbeux en production)
if (isProduction) {
  app.use(morgan('combined'));
} else {
  app.use(morgan('dev'));
}

// Body parser optimisé
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Timeouts serveur HTTP optimisés
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;
server.maxConnections = 10000; // Limite de connexions HTTP

// Language middleware
const languageMiddleware = require('./src/middleware/language');
app.use(languageMiddleware);

// Rate limiting adaptatif pour production
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProduction ? 1000 : 100, // Plus permissif en production
  message: 'Trop de requêtes depuis cette IP, veuillez réessayer plus tard.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/api/health',
  // Store Redis pour partager les limites entre workers
  store: isProduction && cacheManager.isConnected ? {
    async increment(key) {
      const count = await cacheManager.incr(`rate-limit:${key}`);
      if (count === 1) {
        await cacheManager.set(`rate-limit:${key}`, 1, 900); // 15 minutes
      }
      return { totalHits: count || 0, resetTime: new Date(Date.now() + 900000) };
    }
  } : undefined
});

app.use('/api/', apiLimiter);

// Static files avec cache agressif
app.use('/uploads', express.static('public/uploads', {
  maxAge: '7d',
  etag: true,
  lastModified: true
}));

app.use('/public', express.static('public', {
  maxAge: '7d',
  etag: true,
  lastModified: true
}));

// Demo mode
const DEMO_MODE = process.env.DEMO_MODE === 'true' || process.env.FORCE_DEMO === 'true';

if (DEMO_MODE) {
  console.log('🎭 MODE DÉMO ACTIVÉ');
} else {
  // Connexion MongoDB optimisée
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/gnv_onboard';
  dbManager.connect(mongoUri).then(connected => {
    if (connected) {
      console.log(`✅ MongoDB connecté (Worker ${workerId})`);
    }
  });
}

// Connexion Redis pour cache
cacheManager.connect().then(connected => {
  if (connected) {
    console.log(`✅ Redis cache connecté (Worker ${workerId})`);
  }
});

// Routes
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/users', require('./src/routes/users'));
app.use('/api/restaurants', require('./src/routes/restaurants'));
app.use('/api/movies', require('./src/routes/movies'));
app.use('/api/radio', require('./src/routes/radio'));
app.use('/api/magazine', require('./src/routes/magazine'));
app.use('/api/messages', require('./src/routes/messages'));
app.use('/api/shop', require('./src/routes/shop'));
app.use('/api/feedback', require('./src/routes/feedback'));
app.use('/api/admin', require('./src/routes/admin'));
app.use('/api/demo', require('./src/routes/demo'));
app.use('/api/analytics', require('./src/routes/analytics'));
app.use('/api/gnv', require('./src/routes/gnv'));

// Health check amélioré avec métriques
app.get('/api/health', (req, res) => {
  const stats = connectionManager.getStats();
  const dbStats = dbManager.getStats();
  
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    worker: workerId,
    pid: process.pid,
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024)
    },
    connections: {
      socket: stats.current,
      peak: stats.peak,
      max: stats.maxAllowed
    },
    database: {
      state: dbStats.state,
      connected: dbManager.isConnected()
    },
    cache: {
      connected: cacheManager.isConnected
    }
  });
});

// Endpoint de statistiques détaillées
app.get('/api/stats', (req, res) => {
  if (!isProduction) {
    const stats = connectionManager.getStats();
    res.json(stats);
  } else {
    res.status(403).json({ message: 'Stats endpoint disabled in production' });
  }
});

// Configuration Socket.io avec gestionnaire de connexions (rate limit par socket = protection flood)
const { checkSocketRateLimit, checkSendMessageRateLimit, clearSocketRateLimit } = require('./src/socket/handlers');
setupRedisAdapter().then(() => {
  io.on('connection', (socket) => {
    // Enregistrer la connexion
    if (!connectionManager.addConnection(socket)) {
      socket.disconnect(true);
      return;
    }

    // Mettre à jour l'activité
    socket.onAny(() => {
      if (!checkSocketRateLimit(socket)) return;
      connectionManager.updateActivity(socket.id);
    });

    socket.on('join-room', (room) => {
      socket.join(room);
      connectionManager.joinRoom(socket.id, room);
    });

    socket.on('leave-room', (room) => {
      socket.leave(room);
      connectionManager.leaveRoom(socket.id, room);
    });

    socket.on('send-message', (data) => {
      if (!checkSendMessageRateLimit(socket)) return; // C6 : 60 msg/min/socket
      connectionManager.updateActivity(socket.id);
      socket.to(data.room).emit('new-message', data);
    });

    socket.on('disconnect', (reason) => {
      clearSocketRateLimit(socket.id);
      connectionManager.removeConnection(socket.id);
      if (!isProduction) {
        console.log(`👤 Disconnected: ${socket.id} (${reason})`);
      }
    });

    socket.on('error', (err) => {
      console.error(`Socket error (${socket.id}):`, err.message);
      connectionManager.removeConnection(socket.id);
    });
  });

  // Monitoring périodique des connexions
  setInterval(() => {
    const stats = connectionManager.getStats();
    if (isProduction && stats.current > 0) {
      console.log(`📊 Connexions: ${stats.current}/${stats.maxAllowed} (Peak: ${stats.peak}) - Worker ${workerId}`);
    }
  }, 60000); // Toutes les minutes
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).json({
    message: 'Something went wrong!',
    error: isProduction ? {} : err.message
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Démarrage du serveur
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT} (Worker ${workerId}, PID: ${process.pid})`);
  console.log(`📱 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`💾 Mode: ${DEMO_MODE ? 'DÉMO' : 'PRODUCTION'}`);
  
  // Signal ready pour PM2
  if (process.send) {
    process.send('ready');
  }
});

// Nettoyage à l'arrêt
const gracefulShutdown = async () => {
  console.log(`🛑 Worker ${workerId} reçoit signal d'arrêt, nettoyage...`);
  
  // Fermer les connexions Socket.io
  io.close();
  
  // Fermer Redis adapter
  if (redisAdapter) {
    try {
      await redisPubClient.quit();
      await redisSubClient.quit();
    } catch (err) {
      console.error('Erreur fermeture Redis adapter:', err);
    }
  }
  
  // Fermer cache Redis
  await cacheManager.disconnect();
  
  // Fermer MongoDB
  await dbManager.disconnect();
  
  // Nettoyer connection manager
  connectionManager.destroy();
  
  // Fermer serveur HTTP
  server.close(() => {
    console.log(`✅ Worker ${workerId} arrêté proprement`);
    process.exit(0);
  });
  
  // Timeout de sécurité
  setTimeout(() => {
    console.error('⚠️  Timeout lors de l\'arrêt, forçage...');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

module.exports = { app, io, server };
