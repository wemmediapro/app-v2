/**
 * Gestionnaire de connexions optimisé pour 2000+ connexions simultanées
 * Gère les connexions Socket.io, MongoDB, Redis et les limites système
 *
 * Limitation : singleton en mémoire, non partagé entre workers PM2. Les stats (byIP, peak, etc.)
 * et les limites par IP sont locales à chaque processus. Pour des limites cross-workers,
 * utiliser connectionCounters (Redis) côté serveur principal — voir server.js.
 */

const EventEmitter = require('events');

class ConnectionManager extends EventEmitter {
  constructor() {
    super();
    this.socketConnections = new Map(); // socketId -> connection info
    this.connectionCount = 0;
    this.maxConnections = parseInt(process.env.MAX_SOCKET_CONNECTIONS) || 2000;
    this.maxConnectionsPerIP = parseInt(process.env.MAX_CONNECTIONS_PER_IP) || 50;
    this.ipConnections = new Map(); // ip -> count
    this.connectionStats = {
      total: 0,
      active: 0,
      rejected: 0,
      disconnected: 0,
      peak: 0,
      byIP: {}
    };
    
    // Nettoyage périodique des connexions inactives
    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveConnections();
    }, 60000); // Toutes les minutes
  }

  /**
   * Enregistre une nouvelle connexion Socket.io
   */
  addConnection(socket) {
    const ip = this.getClientIP(socket);
    const ipCount = this.ipConnections.get(ip) || 0;

    // Vérifier les limites par IP
    if (ipCount >= this.maxConnectionsPerIP) {
      this.connectionStats.rejected++;
      this.emit('connection-rejected', { socket, reason: 'IP limit exceeded', ip });
      return false;
    }

    // Vérifier les limites globales
    if (this.connectionCount >= this.maxConnections) {
      this.connectionStats.rejected++;
      this.emit('connection-rejected', { socket, reason: 'Global limit exceeded' });
      return false;
    }

    // Enregistrer la connexion
    this.socketConnections.set(socket.id, {
      socket,
      ip,
      connectedAt: Date.now(),
      lastActivity: Date.now(),
      rooms: new Set()
    });

    this.connectionCount++;
    this.ipConnections.set(ip, ipCount + 1);
    this.connectionStats.total++;
    this.connectionStats.active = this.connectionCount;
    this.connectionStats.byIP[ip] = (this.connectionStats.byIP[ip] || 0) + 1;

    if (this.connectionCount > this.connectionStats.peak) {
      this.connectionStats.peak = this.connectionCount;
    }

    this.emit('connection-added', { socketId: socket.id, ip, total: this.connectionCount });
    return true;
  }

  /**
   * Supprime une connexion
   */
  removeConnection(socketId) {
    const connection = this.socketConnections.get(socketId);
    if (!connection) return;

    const ip = connection.ip;
    const ipCount = this.ipConnections.get(ip) || 0;
    
    this.socketConnections.delete(socketId);
    this.connectionCount--;
    this.connectionStats.disconnected++;
    this.connectionStats.active = this.connectionCount;

    if (ipCount > 1) {
      this.ipConnections.set(ip, ipCount - 1);
      this.connectionStats.byIP[ip]--;
    } else {
      this.ipConnections.delete(ip);
      delete this.connectionStats.byIP[ip];
    }

    this.emit('connection-removed', { socketId, ip, total: this.connectionCount });
  }

  /**
   * Met à jour l'activité d'une connexion
   */
  updateActivity(socketId) {
    const connection = this.socketConnections.get(socketId);
    if (connection) {
      connection.lastActivity = Date.now();
    }
  }

  /**
   * Ajoute une connexion à une room
   */
  joinRoom(socketId, room) {
    const connection = this.socketConnections.get(socketId);
    if (connection) {
      connection.rooms.add(room);
      this.updateActivity(socketId);
    }
  }

  /**
   * Retire une connexion d'une room
   */
  leaveRoom(socketId, room) {
    const connection = this.socketConnections.get(socketId);
    if (connection) {
      connection.rooms.delete(room);
      this.updateActivity(socketId);
    }
  }

  /**
   * Nettoie les connexions inactives (timeout > 5 minutes)
   */
  cleanupInactiveConnections() {
    const now = Date.now();
    const timeout = 5 * 60 * 1000; // 5 minutes
    const toRemove = [];

    for (const [socketId, connection] of this.socketConnections.entries()) {
      if (now - connection.lastActivity > timeout) {
        toRemove.push(socketId);
      }
    }

    toRemove.forEach(socketId => {
      const connection = this.socketConnections.get(socketId);
      if (connection && connection.socket) {
        connection.socket.disconnect(true);
        this.removeConnection(socketId);
      }
    });

    if (toRemove.length > 0) {
      this.emit('cleanup', { removed: toRemove.length });
    }
  }

  /**
   * Obtient l'IP du client depuis la socket
   */
  getClientIP(socket) {
    return socket.handshake.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
           socket.handshake.headers['x-real-ip'] ||
           socket.handshake.address ||
           socket.request.connection.remoteAddress ||
           'unknown';
  }

  /**
   * Obtient les statistiques de connexions
   */
  getStats() {
    return {
      ...this.connectionStats,
      current: this.connectionCount,
      maxAllowed: this.maxConnections,
      maxPerIP: this.maxConnectionsPerIP,
      uniqueIPs: this.ipConnections.size,
      topIPs: Object.entries(this.connectionStats.byIP)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([ip, count]) => ({ ip, count }))
    };
  }

  /**
   * Réinitialise les statistiques
   */
  resetStats() {
    this.connectionStats = {
      total: 0,
      active: 0,
      rejected: 0,
      disconnected: 0,
      peak: 0,
      byIP: {}
    };
  }

  /**
   * Nettoie toutes les ressources
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.socketConnections.clear();
    this.ipConnections.clear();
    this.removeAllListeners();
  }
}

// Instance singleton
const connectionManager = new ConnectionManager();

module.exports = connectionManager;
