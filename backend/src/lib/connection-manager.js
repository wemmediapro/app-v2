/**
 * Gestionnaire de connexions Socket.io — Map locale (latence &lt; 5 ms) pour lookup,
 * synchronisation Redis asynchrone pour limites et stats cross-workers (PM2 cluster).
 *
 * @see redis-connection-manager.js — clés gnv:connections:*, limite IP globale (MAX_CONNECTIONS_PER_IP).
 */

const EventEmitter = require('events');
const redisConnectionManager = require('./redis-connection-manager');

/** Inactivité avant déconnexion (socket) — 3 min pour 1500+ connexions */
const DEFAULT_INACTIVITY_MS = parseInt(process.env.SOCKET_INACTIVITY_TIMEOUT_MS, 10) || 3 * 60 * 1000;
/** Sous pression mémoire (memory-warning ~85 %) */
const AGGRESSIVE_INACTIVITY_MS = parseInt(process.env.SOCKET_INACTIVITY_AGGRESSIVE_MS, 10) || 60 * 1000;
/** Sous pression critique (~90 %) */
const CRITICAL_INACTIVITY_MS = parseInt(process.env.SOCKET_INACTIVITY_CRITICAL_MS, 10) || 30 * 1000;
const CLEANUP_MAX_PER_CYCLE = parseInt(process.env.SOCKET_CLEANUP_MAX_PER_CYCLE, 10) || 50;

class ConnectionManager extends EventEmitter {
  constructor() {
    super();
    this.socketConnections = new Map(); // socketId -> connection info
    this.defaultInactivityMs = DEFAULT_INACTIVITY_MS;
    this.connectionCount = 0;
    this.maxConnections =
      parseInt(process.env.MAX_SOCKET_CONNECTIONS || process.env.SOCKET_MAX_CONNECTIONS, 10) || 2000;
    this.maxConnectionsPerIP = parseInt(process.env.MAX_CONNECTIONS_PER_IP, 10) || 50;
    this.ipConnections = new Map(); // ip -> count (worker local)
    this.connectionStats = {
      total: 0,
      active: 0,
      rejected: 0,
      disconnected: 0,
      peak: 0,
      byIP: {},
    };

    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveConnections();
    }, 60000);
  }

  /**
   * Nettoie les sockets inactifs depuis plus de `idleMs`.
   * @param {{ idleMs?: number, maxDisconnect?: number }} opts — maxDisconnect plafonne les déconnexions (défaut 50).
   */
  cleanupInactiveConnections(opts = {}) {
    const idleMs = opts.idleMs != null ? opts.idleMs : this.defaultInactivityMs;
    const maxDisconnect = Math.min(
      CLEANUP_MAX_PER_CYCLE,
      Math.max(1, opts.maxDisconnect != null ? opts.maxDisconnect : CLEANUP_MAX_PER_CYCLE)
    );
    const now = Date.now();
    const entries = [];

    for (const [socketId, conn] of this.socketConnections.entries()) {
      if (now - conn.lastActivity > idleMs) {
        entries.push({ socketId, lastActivity: conn.lastActivity });
      }
    }

    entries.sort((a, b) => a.lastActivity - b.lastActivity);
    const toRemove = entries.slice(0, maxDisconnect).map((e) => e.socketId);

    toRemove.forEach((socketId) => {
      const conn = this.socketConnections.get(socketId);
      if (conn && conn.socket) {
        conn.socket.disconnect(true);
        this.removeConnection(socketId);
      }
    });

    if (toRemove.length > 0) {
      this.emit('cleanup', { removed: toRemove.length, idleMs, aggressive: idleMs < this.defaultInactivityMs });
    }
  }

  /** Appelé quand le moniteur mémoire dépasse 85 % (cleanup plus agressif) ou 90 % (critique). */
  cleanupForMemoryPressure(level) {
    if (level === 'critical') {
      this.cleanupInactiveConnections({ idleMs: CRITICAL_INACTIVITY_MS, maxDisconnect: CLEANUP_MAX_PER_CYCLE });
    } else {
      this.cleanupForMemoryPressureWarning();
    }
  }

  cleanupForMemoryPressureWarning() {
    this.cleanupInactiveConnections({ idleMs: AGGRESSIVE_INACTIVITY_MS, maxDisconnect: CLEANUP_MAX_PER_CYCLE });
  }

  /**
   * Amorce peak / métadonnées depuis Redis au démarrage (stats globales).
   * @param {{ active?: number }} stats
   */
  applyGlobalSnapshotFromRedis(stats) {
    if (!stats || typeof stats.active !== 'number') {
      return;
    }
    if (stats.active > this.connectionStats.peak) {
      this.connectionStats.peak = stats.active;
    }
  }

  /**
   * Enregistre une nouvelle connexion Socket.io (vérifie Redis avant la Map locale si Redis actif).
   * @returns {Promise<boolean>}
   */
  async addConnection(socket) {
    const ip = this.getClientIP(socket);
    const useGlobalIp = redisConnectionManager.isEnabled();

    if (useGlobalIp) {
      const okGlobal = await redisConnectionManager.addConnectionGlobal(socket.id, ip, this.maxConnectionsPerIP);
      if (!okGlobal) {
        this.connectionStats.rejected++;
        this.emit('connection-rejected', { socket, reason: 'IP limit exceeded (global Redis)', ip });
        return false;
      }
    } else {
      const ipCount = this.ipConnections.get(ip) || 0;
      if (ipCount >= this.maxConnectionsPerIP) {
        this.connectionStats.rejected++;
        this.emit('connection-rejected', { socket, reason: 'IP limit exceeded', ip });
        return false;
      }
    }

    if (this.connectionCount >= this.maxConnections) {
      if (useGlobalIp) {
        void redisConnectionManager.removeConnectionGlobal(socket.id).catch(() => {});
      }
      this.connectionStats.rejected++;
      this.emit('connection-rejected', { socket, reason: 'Global limit exceeded' });
      return false;
    }

    this.socketConnections.set(socket.id, {
      socket,
      ip,
      connectedAt: Date.now(),
      lastActivity: Date.now(),
      rooms: new Set(),
    });

    this.connectionCount++;
    const ipCountLocal = this.ipConnections.get(ip) || 0;
    this.ipConnections.set(ip, ipCountLocal + 1);
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
   * Supprime une connexion (Map locale immédiate, Redis en arrière-plan).
   */
  removeConnection(socketId) {
    const connection = this.socketConnections.get(socketId);
    if (!connection) {
      return;
    }

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

    void redisConnectionManager.removeConnectionGlobal(socketId).catch(() => {});

    this.emit('connection-removed', { socketId, ip, total: this.connectionCount });
  }

  updateActivity(socketId) {
    const conn = this.socketConnections.get(socketId);
    if (conn) {
      conn.lastActivity = Date.now();
    }
  }

  joinRoom(socketId, room) {
    const conn = this.socketConnections.get(socketId);
    if (conn) {
      conn.rooms.add(room);
      this.updateActivity(socketId);
    }
  }

  leaveRoom(socketId, room) {
    const conn = this.socketConnections.get(socketId);
    if (conn) {
      conn.rooms.delete(room);
      this.updateActivity(socketId);
    }
  }

  getClientIP(socket) {
    return (
      socket.handshake.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      socket.handshake.headers['x-real-ip'] ||
      socket.handshake.address ||
      socket.request?.connection?.remoteAddress ||
      'unknown'
    );
  }

  getStats() {
    return {
      ...this.connectionStats,
      current: this.connectionCount,
      maxAllowed: this.maxConnections,
      maxPerIP: this.maxConnectionsPerIP,
      uniqueIPs: this.ipConnections.size,
      topIPs: Object.entries(this.connectionStats.byIP)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([ipp, count]) => ({ ip: ipp, count })),
      workerLocal: true,
    };
  }

  resetStats() {
    this.connectionStats = {
      total: 0,
      active: 0,
      rejected: 0,
      disconnected: 0,
      peak: 0,
      byIP: {},
    };
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.socketConnections.clear();
    this.ipConnections.clear();
    this.removeAllListeners();
  }
}

const connectionManager = new ConnectionManager();

module.exports = connectionManager;
