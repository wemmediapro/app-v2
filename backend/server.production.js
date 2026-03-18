/**
 * Serveur de production (PM2 / déploiement).
 * Rôle : même stack que server.js mais sans clustering Node (le clustering est géré par PM2),
 * avec options Socket.io/Redis adaptées à la prod. À utiliser comme point d’entrée en production
 * (ex. ecosystem.config.cjs) à la place de server.js.
 */
require('dotenv').config({ path: './config.env' });
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');

// Configuration du clustering
// Note: PM2 gère le clustering, donc on utilise directement le code du worker
const isProduction = process.env.NODE_ENV === 'production';
const workerId = process.env.INSTANCE_ID || process.pid;

// Code du worker (PM2 gère le clustering)
  const app = express();
  const server = createServer(app);
  
  // Configuration Socket.io optimisée pour production
  const ioOptions = {
    cors: {
      origin: process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',') : ["http://localhost:5173", "http://localhost:3001"],
      methods: ["GET", "POST"],
      credentials: true
    },
    transports: ['websocket', 'polling'],
    allowEIO3: true,
    pingTimeout: 60000,
    pingInterval: 25000,
    maxHttpBufferSize: 1e8, // 100MB
    perMessageDeflate: true,
    // Optimisations pour les connexions multiples
    connectTimeout: 45000,
    upgradeTimeout: 30000,
    // Limites de connexions
    allowRequest: (req, callback) => {
      // Vérifier les limites de connexions par IP
      const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
      callback(null, true); // Accepter toutes les connexions (rate limiting géré ailleurs)
    }
  };
  
  const io = new Server(server, ioOptions);
  
  // Configuration Redis Adapter pour Socket.io (optionnel mais recommandé pour clustering)
  let redisAdapter = null;
  if (process.env.REDIS_URL) {
    try {
      const pubClient = createClient({ url: process.env.REDIS_URL });
      const subClient = pubClient.duplicate();
      
      Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
        io.adapter(createAdapter(pubClient, subClient));
        redisAdapter = { pubClient, subClient };
        console.log('✅ Redis adapter activé pour Socket.io (Worker PID:', process.pid, ')');
      }).catch(err => {
        console.warn('⚠️  Redis non disponible, utilisation du mode standalone:', err.message);
      });
    } catch (err) {
      console.warn('⚠️  Redis adapter non configuré:', err.message);
    }
  } else {
    console.log('ℹ️  Redis non configuré - Socket.io fonctionne en mode standalone');
  }
  
  // Middleware optimisé pour production
  app.use(helmet({
    contentSecurityPolicy: isProduction ? undefined : false,
    crossOriginEmbedderPolicy: false
  }));
  
  app.use(cors({
    origin: process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',') : ["http://localhost:5173", "http://localhost:3001"],
    credentials: true,
    optionsSuccessStatus: 200
  }));
  
  // Morgan seulement en production (moins verbeux)
  if (isProduction) {
    app.use(morgan('combined'));
  } else {
    app.use(morgan('dev'));
  }
  
  // Augmenter les limites pour les gros payloads
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));
  
  // Augmenter les timeouts du serveur HTTP
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;
  
  // Language middleware
  const languageMiddleware = require('./src/middleware/language');
  app.use(languageMiddleware);
  
  // Rate limiting adapté pour production (plus permissif mais toujours présent)
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: isProduction ? 1000 : 100, // Plus de requêtes en production
    message: 'Trop de requêtes depuis cette IP, veuillez réessayer plus tard.',
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      // Skip rate limiting pour health checks
      return req.path === '/api/health';
    }
  });
  
  app.use('/api/', limiter);
  
  // Rate limiting spécifique pour Socket.io connections
  const socketLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 10, // Max 10 connexions Socket.io par IP par minute
    message: 'Trop de tentatives de connexion WebSocket'
  });
  
  // Static files avec cache
  app.use('/uploads', express.static('public/uploads', {
    maxAge: '1d',
    etag: true
  }));
  app.use('/public', express.static('public', {
    maxAge: '1d',
    etag: true
  }));
  
  // Demo mode configuration
  const DEMO_MODE = process.env.DEMO_MODE === 'true' || process.env.FORCE_DEMO === 'true';
  
  if (DEMO_MODE) {
    console.log('🎭 MODE DÉMO ACTIVÉ - Utilisation de données de démonstration uniquement');
  } else {
    // Database connection avec gestion améliorée
    const dbManager = require('./src/lib/database');
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/gnv_onboard';
    
    dbManager.connect(mongoUri).then(connected => {
      if (connected) {
        console.log(`✅ MongoDB connected (Worker PID: ${process.pid})`);
      } else {
        console.log('⚠️  Application will continue but database features will be unavailable.');
      }
    });
  }
  
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
  
  // Health check amélioré
  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'OK', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      worker: workerId,
      pid: process.pid,
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
      }
    });
  });
  
  // Socket.io optimisé pour production
  let connectionCount = 0;
  const maxConnections = 2000; // Par worker
  
  io.on('connection', (socket) => {
    connectionCount++;
    
    // Vérifier les limites de connexions
    if (connectionCount > maxConnections) {
      console.warn(`⚠️  Limite de connexions atteinte (${maxConnections})`);
      socket.disconnect(true);
      return;
    }
    
    if (!isProduction) {
      console.log(`👤 User connected: ${socket.id} (Total: ${connectionCount})`);
    }
    
    socket.on('join-room', (room) => {
      socket.join(room);
      if (!isProduction) {
        console.log(`👤 User ${socket.id} joined room: ${room}`);
      }
    });
    
    socket.on('send-message', (data) => {
      socket.to(data.room).emit('new-message', data);
    });
    
    socket.on('disconnect', () => {
      connectionCount--;
      if (!isProduction) {
        console.log(`👤 User disconnected: ${socket.id} (Total: ${connectionCount})`);
      }
    });
    
    // Gérer les erreurs de socket
    socket.on('error', (err) => {
      console.error('Socket error:', err);
      connectionCount--;
    });
  });
  
  // Monitoring des connexions Socket.io
  setInterval(() => {
    if (isProduction && connectionCount > 0) {
      console.log(`📊 Connexions Socket.io actives: ${connectionCount} (Worker ${workerId})`);
    }
  }, 60000); // Toutes les minutes
  
  // Error handling middleware
  app.use((err, req, res, next) => {
    console.error('Error:', err.stack);
    res.status(500).json({ 
      message: 'Something went wrong!',
      error: isProduction ? {} : err.message
    });
  });
  
  // Serve index.html for root path
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });
  
  // 404 handler
  app.use('*', (req, res) => {
    res.status(404).json({ message: 'Route not found' });
  });
  
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT} (Worker PID: ${process.pid})`);
    console.log(`📱 Environment: ${process.env.NODE_ENV || 'development'}`);
    if (DEMO_MODE) {
      console.log(`🎭 Mode: DÉMO (Données statiques uniquement)`);
    } else {
      console.log(`💾 Mode: PRODUCTION (MongoDB requis)`);
    }
    
    // Envoyer le signal "ready" pour PM2
    if (process.send) {
      process.send('ready');
    }
  });
  
  // Nettoyage à l'arrêt
  process.on('SIGTERM', () => {
    console.log(`🛑 Worker ${process.pid} reçoit SIGTERM, arrêt propre...`);
    if (redisAdapter) {
      redisAdapter.pubClient.quit().catch(() => {});
      redisAdapter.subClient.quit().catch(() => {});
    }
    server.close(() => {
      process.exit(0);
    });
  });
  
  process.on('SIGINT', () => {
    console.log(`🛑 Worker ${process.pid} reçoit SIGINT, arrêt propre...`);
    if (redisAdapter) {
      redisAdapter.pubClient.quit().catch(() => {});
      redisAdapter.subClient.quit().catch(() => {});
    }
    server.close(() => {
      process.exit(0);
    });
  });
  
  module.exports = { app, io };
}
