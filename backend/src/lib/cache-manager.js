/**
 * Gestionnaire de cache Redis optimisé pour haute performance
 * Améliore les performances en réduisant les requêtes MongoDB
 */

const { createClient } = require('redis');

class CacheManager {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.defaultTTL = 3600; // 1 heure par défaut
  }

  /**
   * Initialise la connexion Redis
   */
  async connect() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    try {
      this.client = createClient({
        url: redisUrl,
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              console.error('❌ Redis: Trop de tentatives de reconnexion');
              return new Error('Trop de tentatives');
            }
            return Math.min(retries * 100, 3000);
          },
          connectTimeout: 10000,
        },
        // Optimisations pour haute charge
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        enableOfflineQueue: false, // Ne pas mettre en queue si déconnecté
      });

      this.client.on('error', (err) => {
        console.error('❌ Redis error:', err.message);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        console.log('🔌 Redis: Connexion en cours...');
      });

      this.client.on('ready', () => {
        this.isConnected = true;
        console.log('✅ Redis: Prêt');
      });

      this.client.on('reconnecting', () => {
        console.log('🔄 Redis: Reconnexion...');
      });

      await this.client.connect();
      return true;
    } catch (error) {
      console.error('❌ Erreur de connexion Redis:', error.message);
      console.log('⚠️  L\'application continuera sans cache Redis');
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Obtient une valeur depuis le cache
   */
  async get(key) {
    if (!this.isConnected || !this.client) {
      return null;
    }

    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error(`❌ Erreur Redis GET pour ${key}:`, error.message);
      return null;
    }
  }

  /**
   * Définit une valeur dans le cache
   */
  async set(key, value, ttl = this.defaultTTL) {
    if (!this.isConnected || !this.client) {
      return false;
    }

    try {
      const serialized = JSON.stringify(value);
      await this.client.setEx(key, ttl, serialized);
      return true;
    } catch (error) {
      console.error(`❌ Erreur Redis SET pour ${key}:`, error.message);
      return false;
    }
  }

  /**
   * Supprime une clé du cache
   */
  async del(key) {
    if (!this.isConnected || !this.client) {
      return false;
    }

    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      console.error(`❌ Erreur Redis DEL pour ${key}:`, error.message);
      return false;
    }
  }

  /**
   * Supprime toutes les clés correspondant à un pattern
   */
  async delPattern(pattern) {
    if (!this.isConnected || !this.client) {
      return false;
    }

    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
      }
      return keys.length;
    } catch (error) {
      console.error(`❌ Erreur Redis DEL PATTERN pour ${pattern}:`, error.message);
      return 0;
    }
  }

  /**
   * Vérifie si une clé existe
   */
  async exists(key) {
    if (!this.isConnected || !this.client) {
      return false;
    }

    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      console.error(`❌ Erreur Redis EXISTS pour ${key}:`, error.message);
      return false;
    }
  }

  /**
   * Incrémente une valeur
   */
  async incr(key) {
    if (!this.isConnected || !this.client) {
      return null;
    }

    try {
      return await this.client.incr(key);
    } catch (error) {
      console.error(`❌ Erreur Redis INCR pour ${key}:`, error.message);
      return null;
    }
  }

  /**
   * Obtient les statistiques Redis
   */
  async getStats() {
    if (!this.isConnected || !this.client) {
      return null;
    }

    try {
      const info = await this.client.info('stats');
      const memory = await this.client.info('memory');
      return { info, memory };
    } catch (error) {
      console.error('❌ Erreur Redis INFO:', error.message);
      return null;
    }
  }

  /**
   * Vide tout le cache (FLUSHDB - base courante uniquement)
   */
  async flush() {
    if (!this.isConnected || !this.client) {
      return false;
    }
    try {
      await this.client.flushDb();
      console.log('✅ Cache Redis vidé');
      return true;
    } catch (error) {
      console.error('❌ Erreur Redis FLUSHDB:', error.message);
      return false;
    }
  }

  /**
   * Ferme la connexion Redis
   */
  async disconnect() {
    if (this.client && this.isConnected) {
      try {
        await this.client.quit();
        this.isConnected = false;
        console.log('👋 Redis: Connexion fermée');
      } catch (error) {
        console.error('❌ Erreur lors de la fermeture Redis:', error.message);
      }
    }
  }
}

// Instance singleton
const cacheManager = new CacheManager();

module.exports = cacheManager;
