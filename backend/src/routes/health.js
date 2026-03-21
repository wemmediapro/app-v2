/**
 * Santé détaillée : MongoDB, Redis, mémoire processus, espace disque (fs.statfs si dispo), services externes optionnels, versions.
 * - GET …/health/live : liveness K8s (toujours 200).
 * - GET …/health/ready : readiness (503 si Mongo ou Redis indisponible en production).
 * - GET …/health : rapport complet ; HTTP 503 si `HEALTH_HTTP_STRICT=1` et état `unhealthy` (défaut : 200 avec corps explicite).
 */
const path = require('path');
const fs = require('fs').promises;
const mongoose = require('mongoose');
const config = require('../config');

const SERVICE_PKG = require(path.join(__dirname, '..', '..', 'package.json'));

/**
 * @typedef {{ dbManager?: object, cacheManager?: object, connectionCounters?: object, externalServices?: Record<string, { healthCheck: () => Promise<void> }>, paths?: object }} HealthDeps
 */

class HealthChecker {
  /**
   * @param {HealthDeps} dependencies
   */
  constructor(dependencies = {}) {
    this.dbManager = dependencies.dbManager;
    this.cacheManager = dependencies.cacheManager;
    this.connectionCounters = dependencies.connectionCounters;
    this.externalServices = dependencies.externalServices || {};
    this.paths = dependencies.paths || config.paths;
  }

  /**
   * @returns {boolean}
   */
  isProduction() {
    return process.env.NODE_ENV === 'production';
  }

  /**
   * @returns {Promise<{ status: string, responseTimeMs?: number, error?: string, pool?: object }>}
   */
  async checkDatabase() {
    const start = Date.now();
    try {
      if (!this.dbManager || typeof this.dbManager.isConnected !== 'function' || !this.dbManager.isConnected()) {
        return { status: 'unhealthy', error: 'mongodb_not_connected' };
      }
      const db = mongoose.connection.db;
      if (!db) {
        return { status: 'unhealthy', error: 'mongodb_db_handle_missing' };
      }
      await db.admin().command({ ping: 1 });
      const responseTimeMs = Date.now() - start;
      let pool;
      if (typeof this.dbManager.getStats === 'function') {
        const st = this.dbManager.getStats();
        if (st.pool && typeof st.pool === 'object') {
          pool = {
            checkedOut: st.pool.checkedOut,
            maxPoolSize: st.pool.maxPoolSize,
            utilizationPercent: st.pool.utilizationPercent,
          };
        }
      }
      return { status: 'healthy', responseTimeMs, pool };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * @returns {Promise<{ status: string, responseTimeMs?: number, memory?: string, error?: string }>}
   */
  async checkRedis() {
    const cm = this.cacheManager;
    if (!cm?.client) {
      return {
        status: this.isProduction() ? 'unhealthy' : 'skipped',
        error: this.isProduction() ? 'redis_client_missing' : undefined,
      };
    }
    if (!cm.isConnected) {
      return { status: 'unhealthy', error: 'redis_not_connected' };
    }
    const start = Date.now();
    try {
      const pong = await cm.client.ping();
      if (pong !== 'PONG') {
        return { status: 'unhealthy', error: 'redis_ping_unexpected' };
      }
      let memoryHuman;
      try {
        const mem = await cm.client.info('memory');
        const m = String(mem).match(/used_memory_human:([^\r\n]+)/);
        memoryHuman = m ? m[1].trim() : undefined;
      } catch {
        /* optionnel */
      }
      return { status: 'healthy', responseTimeMs: Date.now() - start, memory: memoryHuman };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * @returns {{ status: string, heapUsedMB: number, heapTotalMB: number, heapRatioPercent: number, rssMB: number }}
   */
  checkMemory() {
    const usage = process.memoryUsage();
    const threshold =
      parseFloat(process.env.HEALTH_HEAP_RATIO_WARN, 10) > 0 && parseFloat(process.env.HEALTH_HEAP_RATIO_WARN, 10) <= 1
        ? parseFloat(process.env.HEALTH_HEAP_RATIO_WARN, 10)
        : 0.92;
    const heapRatio = usage.heapTotal > 0 ? usage.heapUsed / usage.heapTotal : 0;
    const status = heapRatio > threshold ? 'degraded' : 'healthy';
    return {
      status,
      heapUsedMB: Math.round(usage.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(usage.heapTotal / 1024 / 1024),
      heapRatioPercent: Math.round(heapRatio * 1000) / 10,
      rssMB: Math.round(usage.rss / 1024 / 1024),
      thresholdRatio: threshold,
    };
  }

  /**
   * @returns {Promise<{ status: string, path?: string, availableBytes?: number, totalBytes?: number, availableGB?: number, error?: string, message?: string }>}
   */
  async checkDisk() {
    const diskPath = (this.paths && (this.paths.root || this.paths.public || this.paths.uploads)) || process.cwd();
    try {
      if (typeof fs.statfs !== 'function') {
        return { status: 'unknown', message: 'fs.statfs_not_available', path: diskPath };
      }
      const s = await fs.statfs(diskPath);
      const bavail = Number(s.bavail != null ? s.bavail : s.bfree);
      const bsize = Number(s.bsize);
      const blocks = Number(s.blocks);
      const available = bavail * bsize;
      const total = blocks * bsize;
      const minFree = parseInt(process.env.HEALTH_DISK_MIN_FREE_BYTES, 10) || 1e9;
      const st = available < minFree ? 'degraded' : 'healthy';
      return {
        status: st,
        path: diskPath,
        availableBytes: available,
        totalBytes: total,
        availableGB: Math.round((available / 1e9) * 10) / 10,
        minFreeBytes: minFree,
      };
    } catch (error) {
      return {
        status: 'unknown',
        error: error instanceof Error ? error.message : String(error),
        path: diskPath,
      };
    }
  }

  /**
   * @returns {Promise<Record<string, { status: string, responseTimeMs?: number, error?: string }>>}
   */
  async checkExternalServices() {
    const results = {};
    for (const [name, service] of Object.entries(this.externalServices)) {
      if (!service || typeof service.healthCheck !== 'function') {
        results[name] = { status: 'unknown', error: 'no_healthCheck' };
        continue;
      }
      const start = Date.now();
      try {
        await service.healthCheck();
        results[name] = { status: 'healthy', responseTimeMs: Date.now() - start };
      } catch (error) {
        results[name] = {
          status: 'unhealthy',
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }
    return results;
  }

  /**
   * @returns {{ status: string, node: string, service: { name: string, version: string } }}
   */
  checkVersions() {
    return {
      status: 'healthy',
      node: process.version,
      service: {
        name: SERVICE_PKG.name || 'gnv-backend',
        version: SERVICE_PKG.version || '0.0.0',
      },
    };
  }

  /**
   * @param {Record<string, unknown>} externalResults
   */
  static externalOverall(externalResults) {
    const vals = Object.values(externalResults || {});
    if (vals.length === 0) {
      return 'healthy';
    }
    if (vals.some((v) => v && v.status === 'unhealthy')) {
      return 'degraded';
    }
    if (vals.some((v) => v && v.status === 'unknown')) {
      return 'degraded';
    }
    return 'healthy';
  }

  /**
   * @returns {Promise<{ overall: 'healthy'|'degraded'|'unhealthy', checks: object, legacy: object }>}
   */
  async check() {
    const checks = {
      timestamp: new Date().toISOString(),
      database: await this.checkDatabase(),
      redis: await this.checkRedis(),
      memory: this.checkMemory(),
      disk: await this.checkDisk(),
      external: await this.checkExternalServices(),
      versions: this.checkVersions(),
    };

    let overall = 'healthy';

    if (checks.database.status !== 'healthy') {
      overall = 'unhealthy';
    } else if (checks.redis.status === 'unhealthy') {
      overall = 'unhealthy';
    } else if (checks.redis.status === 'skipped' && this.isProduction()) {
      overall = 'unhealthy';
    } else {
      if (checks.memory.status === 'degraded' || checks.disk.status === 'degraded') {
        overall = 'degraded';
      }
      const ext = HealthChecker.externalOverall(checks.external);
      if (ext === 'degraded' && overall === 'healthy') {
        overall = 'degraded';
      }
    }

    const dbConnected = checks.database.status === 'healthy';

    let connections;
    if (this.connectionCounters && typeof this.connectionCounters.getTotalCountAsync === 'function') {
      try {
        connections = await this.connectionCounters.getTotalCountAsync();
      } catch (_) {
        connections = this.connectionCounters.getTotalCount ? this.connectionCounters.getTotalCount() : undefined;
      }
    } else if (this.connectionCounters && typeof this.connectionCounters.getTotalCount === 'function') {
      connections = this.connectionCounters.getTotalCount();
    }

    const legacy = {
      status: overall === 'healthy' ? 'OK' : overall === 'degraded' ? 'DEGRADED' : 'UNHEALTHY',
      healthOverall: overall,
      timestamp: checks.timestamp,
      uptime: process.uptime(),
      apiVersion: 'v1',
      mongodb: dbConnected ? 'connected' : 'disconnected',
      offlineMode: !dbConnected,
      connections,
      memoryMB: checks.memory.heapUsedMB,
    };

    if (dbConnected && this.dbManager && typeof this.dbManager.getStats === 'function') {
      const stats = this.dbManager.getStats();
      if (stats.name) {
        legacy.mongodbDatabase = stats.name;
      }
      if (stats.pool && typeof stats.pool === 'object') {
        legacy.mongoPool = {
          checkedOut: stats.pool.checkedOut,
          maxPoolSize: stats.pool.maxPoolSize,
          utilizationPercent: stats.pool.utilizationPercent,
        };
      }
    }

    if (config.env !== 'production') {
      legacy.environment = config.env;
      if (config.mongodb && config.mongodb.dbName) {
        legacy.mongodbDbName = config.mongodb.dbName;
      }
    }

    return { overall, checks, legacy };
  }
}

/**
 * @param {import('express').Application} app
 * @param {string} base
 * @param {HealthDeps} deps
 */
/**
 * @param {string} rs
 * @returns {'connected'|'skipped'|'error'}
 */
function mapRedisStatusForReady(rs) {
  if (rs === 'healthy') {
    return 'connected';
  }
  if (rs === 'skipped') {
    return 'skipped';
  }
  return 'error';
}

function registerHealthRoutes(app, base, deps) {
  const checker = new HealthChecker(deps);

  app.get(`${base}/health/live`, (_req, res) => {
    res.status(200).json({
      status: 'alive',
      timestamp: new Date().toISOString(),
      apiVersion: 'v1',
    });
  });

  app.get(`${base}/health`, async (_req, res) => {
    try {
      const { overall, checks, legacy } = await checker.check();
      const strict = process.env.HEALTH_HTTP_STRICT === '1';
      const code = overall === 'unhealthy' || (strict && overall === 'degraded') ? 503 : 200;
      res.status(code).json({
        ...legacy,
        checks,
      });
    } catch (err) {
      res.status(500).json({
        status: 'ERROR',
        healthOverall: 'unhealthy',
        message: err instanceof Error ? err.message : String(err),
        apiVersion: 'v1',
        timestamp: new Date().toISOString(),
      });
    }
  });

  app.get(`${base}/health/ready`, async (_req, res) => {
    try {
      const { overall, checks, legacy } = await checker.check();
      const isProd = checker.isProduction();
      const dbOk = checks.database?.status === 'healthy';
      const rs = checks.redis?.status;
      const redisOk = isProd ? rs === 'healthy' : rs === 'healthy' || rs === 'skipped';
      const ready = dbOk && redisOk;

      const body = {
        ready,
        healthOverall: overall,
        mongodb: legacy.mongodb,
        redis: mapRedisStatusForReady(rs),
        apiVersion: 'v1',
        timestamp: checks.timestamp,
        checks,
      };

      if (ready) {
        return res.status(200).json(body);
      }
      return res.status(503).json(body);
    } catch (err) {
      return res.status(503).json({
        ready: false,
        error: err instanceof Error ? err.message : String(err),
        apiVersion: 'v1',
        timestamp: new Date().toISOString(),
      });
    }
  });
}

module.exports = { HealthChecker, registerHealthRoutes };
