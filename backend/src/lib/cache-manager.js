/**
 * Gestionnaire de cache Redis optimisé pour haute performance
 * Améliore les performances en réduisant les requêtes MongoDB
 */

const { createClient } = require('redis');

/** TTL par type de contenu (secondes) : banners 300s, GNV 60s, positions 30s, films 86400s, radio 600s, auth 60s */
const TTL_BY_PREFIX = [
  { prefix: 'auth:user:', ttl: 60 },
  { prefix: 'list:banners:', ttl: 300 },
  { prefix: 'banner:', ttl: 300 },
  { prefix: 'list:gnv:', ttl: 60 },
  { prefix: 'gnv:', ttl: 60 },
  { prefix: 'positions:', ttl: 30 },
  { prefix: 'playback:', ttl: 30 },
  { prefix: 'list:movies:', ttl: 86400 },
  { prefix: 'list:radio:', ttl: 600 },
  { prefix: 'radio:', ttl: 600 },
  { prefix: 'list:magazine:', ttl: 60 },
  { prefix: 'list:shop:', ttl: 120 },
];

class CacheManager {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.defaultTTL = 3600; // 1 heure par défaut
  }

  /**
   * Retourne le TTL (secondes) selon le préfixe de la clé.
   */
  getTTL(key) {
    if (!key || typeof key !== 'string') {
      return this.defaultTTL;
    }
    for (const { prefix, ttl } of TTL_BY_PREFIX) {
      if (key.startsWith(prefix)) {
        return ttl;
      }
    }
    return this.defaultTTL;
  }

  /**
   * Initialise la connexion Redis
   * @param {string} [redisUrl] - Optionnel : utilise REDIS_URI, REDIS_URL ou redis://localhost:6379
   */
  async connect(redisUrl) {
    const url = redisUrl || process.env.REDIS_URI || process.env.REDIS_URL || 'redis://localhost:6379';

    try {
      this.client = createClient({
        url: url,
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
      console.log("⚠️  L'application continuera sans cache Redis");
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
   * Définit une valeur dans le cache (ttl optionnel : déduit du préfixe de key si absent)
   */
  async set(key, value, ttl) {
    if (!this.isConnected || !this.client) {
      return false;
    }
    const effectiveTTL = ttl !== undefined && ttl !== null ? ttl : this.getTTL(key);

    try {
      const serialized = JSON.stringify(value);
      await this.client.setEx(key, effectiveTTL, serialized);
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
   * Supprime toutes les clés correspondant à un pattern (SCAN au lieu de KEYS pour ne pas bloquer Redis).
   */
  async delPattern(pattern) {
    if (!this.isConnected || !this.client) {
      return false;
    }

    try {
      const keys = [];
      for await (const key of this.client.scanIterator({ MATCH: pattern, COUNT: 100 })) {
        keys.push(key);
      }
      let deleted = 0;
      const batchSize = 500;
      for (let i = 0; i < keys.length; i += batchSize) {
        const batch = keys.slice(i, i + batchSize);
        if (batch.length > 0) {
          await this.client.del(batch);
          deleted += batch.length;
        }
      }
      return deleted;
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
   * Décrémente une valeur (pour compteur cluster-safe)
   */
  async decr(key) {
    if (!this.isConnected || !this.client) {
      return null;
    }
    try {
      const n = await this.client.decr(key);
      if (n < 0) {
        await this.client.set(key, '0');
      }
      return n;
    } catch (error) {
      console.error(`❌ Erreur Redis DECR pour ${key}:`, error.message);
      return null;
    }
  }

  /**
   * Lit une valeur brute (string, sans JSON.parse) — pour compteurs
   */
  async getRaw(key) {
    if (!this.isConnected || !this.client) {
      return null;
    }
    try {
      return await this.client.get(key);
    } catch (error) {
      console.error(`❌ Erreur Redis GET raw pour ${key}:`, error.message);
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
