/**
 * Module de gestion de base de données MongoDB optimisé pour 2000+ connexions simultanées
 */

const mongoose = require('mongoose');

class DatabaseManager {
  constructor() {
    this.connection = null;
    this.connectionState = 'disconnected';
    this.retryCount = 0;
    // 0 ou non défini = reconnexion illimitée (MongoDB ne s'arrête pas de réessayer)
    this.maxRetries = parseInt(process.env.MONGODB_RECONNECT_MAX_RETRIES, 10);
    if (Number.isNaN(this.maxRetries)) this.maxRetries = 0;
    this.retryDelay = parseInt(process.env.MONGODB_RECONNECT_DELAY_MS, 10) || 5000;
    this.retryDelayMax = parseInt(process.env.MONGODB_RECONNECT_DELAY_MAX_MS, 10) || 60000;
    this.reconnectTimer = null;
  }

  /**
   * Configure les options de connexion optimisées pour haute charge
   */
  getConnectionOptions(serverType) {
    const isProduction = process.env.NODE_ENV === 'production';
    
    // Options de base optimisées pour 2000+ connexions
    const baseOptions = {
      retryWrites: true,
      w: 'majority',
      // Pool de connexions optimisé
      maxPoolSize: parseInt(process.env.MONGODB_MAX_POOL_SIZE) || 200,
      minPoolSize: parseInt(process.env.MONGODB_MIN_POOL_SIZE) || 10,
      // Timeouts optimisés
      socketTimeoutMS: 45000,
      serverSelectionTimeoutMS: 10000,
      heartbeatFrequencyMS: 10000,
      connectTimeoutMS: 30000,
      // Options de performance
      readPreference: 'primary',
      readConcern: { level: 'majority' },
      writeConcern: { w: 'majority', j: true },
      // Compression
      compressors: ['zlib', 'snappy'],
      // Désactiver le buffering des commandes (bufferMaxEntries n'est plus supporté par le driver récent)
      bufferCommands: false,
    };

    switch (serverType) {
      case 'atlas':
        return {
          ...baseOptions,
          maxPoolSize: 200,
          minPoolSize: 20,
        };

      case 'remote':
        return {
          ...baseOptions,
          maxPoolSize: 200,
          minPoolSize: 20,
          tls: process.env.MONGODB_TLS === 'true',
          tlsInsecure: process.env.MONGODB_TLS_INSECURE === 'true',
        };

      case 'local':
      default:
        return {
          ...baseOptions,
          directConnection: true,
          maxPoolSize: 100,
          minPoolSize: 10,
        };
    }
  }

  /**
   * Détecte le type de serveur MongoDB depuis l'URI
   */
  detectServerType(uri) {
    if (!uri) return 'unknown';
    
    if (uri.includes('mongodb+srv://')) {
      return 'atlas';
    } else if (uri.includes('localhost') || uri.includes('127.0.0.1')) {
      return 'local';
    } else {
      return 'remote';
    }
  }

  /**
   * Établit la connexion à MongoDB avec optimisations
   */
  async connect(uri) {
    if (!uri) {
      console.error('❌ MONGODB_URI non défini');
      return false;
    }

    const serverType = this.detectServerType(uri);
    const options = this.getConnectionOptions(serverType);

    console.log(`🔌 Connexion MongoDB optimisée (${serverType.toUpperCase()})...`);
    console.log(`📊 Pool: ${options.minPoolSize}-${options.maxPoolSize} connexions`);

    try {
      this.uri = uri;
      this.connection = await mongoose.connect(uri, options);
      this.connectionState = 'connected';
      this.retryCount = 0;

      console.log('✅ MongoDB connecté avec succès');
      console.log(`📊 Pool configuré: ${options.minPoolSize}-${options.maxPoolSize} connexions`);
      
      this.setupEventListeners();
      
      return true;
    } catch (error) {
      this.connectionState = 'error';
      console.error('❌ Erreur de connexion MongoDB:', error.message);
      const retryUnlimited = this.maxRetries <= 0;
      if (retryUnlimited || this.retryCount < this.maxRetries) {
        this.scheduleReconnect(uri);
      } else {
        console.error(`🛑 Nombre max de tentatives (${this.maxRetries}) atteint. Redémarrez le backend pour réessayer.`);
      }
      return false;
    }
  }

  /**
   * Configure les écouteurs d'événements MongoDB
   */
  setupEventListeners() {
    const connection = mongoose.connection;

    connection.on('connected', () => {
      this.connectionState = 'connected';
      console.log('✅ MongoDB: Connexion établie');
    });

    connection.on('error', (err) => {
      this.connectionState = 'error';
      console.error('❌ MongoDB: Erreur', err.message);
    });

    connection.on('disconnected', () => {
      this.connectionState = 'disconnected';
      console.warn('⚠️  MongoDB: Déconnecté — reconnexion automatique en cours...');
      if (this.uri) this.scheduleReconnect(this.uri);
    });

    connection.on('reconnected', () => {
      this.connectionState = 'connected';
      console.log('🔄 MongoDB: Reconnexion réussie');
    });

    // Monitoring du pool
    connection.on('fullsetup', () => {
      console.log('📊 MongoDB: Pool de connexions initialisé');
    });
  }

  /**
   * Planifie une tentative de reconnexion
   */
  scheduleReconnect(uri) {
    this.retryCount++;
    const delay = Math.min(this.retryDelay * this.retryCount, this.retryDelayMax);
    const label = this.maxRetries <= 0 ? `${this.retryCount}` : `${this.retryCount}/${this.maxRetries}`;
    console.log(`🔄 Reconnexion MongoDB dans ${delay / 1000}s (tentative ${label})...`);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => this.connect(uri), delay);
  }

  /**
   * Obtient des statistiques sur la connexion
   */
  getStats() {
    const connection = mongoose.connection;
    return {
      state: this.getConnectionState(),
      host: connection.host,
      port: connection.port,
      name: connection.name,
      readyState: connection.readyState,
      serverType: this.detectServerType(process.env.MONGODB_URI),
      poolSize: connection.db?.serverConfig?.poolSize || 'N/A',
    };
  }

  /**
   * Obtient l'état de la connexion
   */
  getConnectionState() {
    const states = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting',
    };
    return states[mongoose.connection.readyState] || 'unknown';
  }

  /**
   * Vérifie si connecté
   */
  isConnected() {
    return mongoose.connection.readyState === 1;
  }

  /**
   * Ferme la connexion proprement
   */
  async disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    if (this.connection) {
      await mongoose.connection.close();
      this.connectionState = 'disconnected';
      console.log('👋 MongoDB: Connexion fermée');
    }
  }
}

// Instance singleton
const dbManager = new DatabaseManager();

module.exports = dbManager;
