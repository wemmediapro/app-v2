/**
 * Options de pool MongoDB + monitoring CMAP (checkout / utilisation) pour charge type ~1500 utilisateurs.
 * Utilisé par database-optimized.js ; arrêt propre via stopMongoPoolMonitoring() depuis disconnect().
 */

const https = require('https');
const http = require('http');
const logger = require('./logger');

/** Défaut cible ~1500 users / process : pool élargi (surcharge MONGODB_MAX_POOL_SIZE / cluster). */
const DEFAULT_MAX_POOL_SIZE = 30;
const DEFAULT_MIN_POOL_SIZE = 10;

const MONITOR_INTERVAL_MS =
  parseInt(process.env.MONGODB_POOL_MONITOR_INTERVAL_MS, 10) > 0
    ? parseInt(process.env.MONGODB_POOL_MONITOR_INTERVAL_MS, 10)
    : 30_000;

const ALERT_UTILIZATION =
  parseFloat(process.env.MONGODB_POOL_ALERT_UTILIZATION) > 0 &&
  parseFloat(process.env.MONGODB_POOL_ALERT_UTILIZATION) <= 1
    ? parseFloat(process.env.MONGODB_POOL_ALERT_UTILIZATION)
    : 0.9;

const ALERT_COOLDOWN_MS =
  parseInt(process.env.MONGODB_POOL_ALERT_COOLDOWN_MS, 10) > 0
    ? parseInt(process.env.MONGODB_POOL_ALERT_COOLDOWN_MS, 10)
    : 120_000;

const ACQUIRE_WARN_MS =
  parseInt(process.env.MONGODB_CONNECTION_ACQUIRE_WARN_MS, 10) >= 0
    ? parseInt(process.env.MONGODB_CONNECTION_ACQUIRE_WARN_MS, 10)
    : 100;

const POOL_WEBHOOK_THROTTLE_MS =
  parseInt(process.env.MONGODB_POOL_WEBHOOK_THROTTLE_MS, 10) > 0
    ? parseInt(process.env.MONGODB_POOL_WEBHOOK_THROTTLE_MS, 10)
    : 120_000;

const clientsWithCmapListeners = new WeakSet();

const state = {
  checkedOut: 0,
  maxPoolSize: DEFAULT_MAX_POOL_SIZE,
  /** @type {bigint[]} */
  pendingAcquireHr: [],
  monitorTimer: null,
  lastAlertAt: 0,
  lastWebhookAt: 0,
};

/**
 * Seuils exposés pour docs / health (observabilité).
 */
const MONGO_POOL_THRESHOLDS = {
  monitorIntervalMs: MONITOR_INTERVAL_MS,
  alertUtilization: ALERT_UTILIZATION,
  acquireWarnMs: ACQUIRE_WARN_MS,
  alertCooldownMs: ALERT_COOLDOWN_MS,
  defaultMaxPoolSize: DEFAULT_MAX_POOL_SIZE,
  defaultMinPoolSize: DEFAULT_MIN_POOL_SIZE,
};

/**
 * @returns {{ maxPoolSize: number, minPoolSize: number }}
 */
function buildMongoPoolOptions() {
  const maxEnv = parseInt(process.env.MONGODB_MAX_POOL_SIZE, 10);
  const minEnv = parseInt(process.env.MONGODB_MIN_POOL_SIZE, 10);
  const maxPoolSize = Number.isFinite(maxEnv) && maxEnv > 0 ? maxEnv : DEFAULT_MAX_POOL_SIZE;
  let minPoolSize = Number.isFinite(minEnv) && minEnv >= 0 ? minEnv : DEFAULT_MIN_POOL_SIZE;
  if (minPoolSize > maxPoolSize) {
    minPoolSize = maxPoolSize;
  }
  return { maxPoolSize, minPoolSize };
}

/**
 *
 */
function getMongoPoolMetrics() {
  const max = state.maxPoolSize || 1;
  const utilizationPercent = Math.round((10000 * state.checkedOut) / max) / 100;
  return {
    checkedOut: state.checkedOut,
    maxPoolSize: state.maxPoolSize,
    utilizationPercent,
    pendingAcquireQueueLength: state.pendingAcquireHr.length,
    thresholds: { ...MONGO_POOL_THRESHOLDS },
  };
}

/**
 *
 */
function postPoolWebhook(payload) {
  const url =
    process.env.MONGODB_POOL_ALERT_WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL || process.env.MEMORY_ALERT_WEBHOOK_URL;
  if (!url || typeof url !== 'string') {
    return Promise.resolve();
  }
  const now = Date.now();
  if (now - state.lastWebhookAt < POOL_WEBHOOK_THROTTLE_MS) {
    return Promise.resolve();
  }
  state.lastWebhookAt = now;
  return new Promise((resolve) => {
    try {
      const lib = new URL(url).protocol === 'https:' ? https : http;
      const text = `[GNV Backend] MongoDB pool\n${payload.title}\n${payload.detail}`;
      const body = JSON.stringify({ text });
      const req = lib.request(
        url,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
          },
          timeout: 8000,
        },
        (res) => {
          res.resume();
          res.on('end', resolve);
        }
      );
      req.on('error', (err) => {
        logger.warn({ event: 'mongodb_pool_webhook_error', err: err.message });
        resolve();
      });
      req.on('timeout', () => {
        req.destroy();
        resolve();
      });
      req.write(body);
      req.end();
    } catch (e) {
      logger.warn({ event: 'mongodb_pool_webhook_error', err: e.message });
      resolve();
    }
  });
}

/**
 *
 */
function runPoolMonitorTick() {
  const { checkedOut, maxPoolSize } = state;
  const util = maxPoolSize > 0 ? checkedOut / maxPoolSize : 0;
  const utilizationPercent = Math.round(10000 * util) / 100;

  logger.info({
    event: 'mongodb_pool_monitor',
    checkedOut,
    maxPoolSize,
    utilizationPercent,
    pendingAcquireQueueLength: state.pendingAcquireHr.length,
    alertThresholdPercent: Math.round(ALERT_UTILIZATION * 1000) / 10,
  });

  if (util >= ALERT_UTILIZATION) {
    const now = Date.now();
    if (now - state.lastAlertAt >= ALERT_COOLDOWN_MS) {
      state.lastAlertAt = now;
      logger.warn({
        event: 'mongodb_pool_utilization_high',
        checkedOut,
        maxPoolSize,
        utilizationPercent,
        threshold: ALERT_UTILIZATION,
        message:
          'Pool MongoDB au-delà du seuil — augmenter MONGODB_MAX_POOL_SIZE, réduire la charge, ou ajouter des workers MongoDB.',
      });
      void postPoolWebhook({
        title: 'Pool MongoDB ≥ seuil d’alerte',
        detail: `utilization=${utilizationPercent}% (${checkedOut}/${maxPoolSize}) — seuil ${Math.round(ALERT_UTILIZATION * 100)}%`,
      });
    }
  }
}

/**
 * Écouteurs CMAP sur MongoClient (driver Node officiel).
 * @param {import('mongodb').MongoClient} client
 */
function attachPoolCmapListeners(client) {
  if (!client || clientsWithCmapListeners.has(client)) {
    return;
  }
  clientsWithCmapListeners.add(client);

  client.on('connectionCheckOutStarted', () => {
    state.pendingAcquireHr.push(process.hrtime.bigint());
  });

  client.on('connectionCheckedOut', () => {
    state.checkedOut += 1;
    const t0 = state.pendingAcquireHr.shift();
    if (t0 != null) {
      const ms = Number(process.hrtime.bigint() - t0) / 1e6;
      logger.debug({
        event: 'mongodb_connection_acquire_ms',
        acquireMs: Math.round(ms * 1000) / 1000,
        checkedOut: state.checkedOut,
      });
      if (ms >= ACQUIRE_WARN_MS) {
        logger.warn({
          event: 'mongodb_connection_acquire_slow',
          acquireMs: Math.round(ms * 1000) / 1000,
          thresholdMs: ACQUIRE_WARN_MS,
        });
      }
    }
  });

  client.on('connectionCheckOutFailed', () => {
    state.pendingAcquireHr.shift();
    logger.warn({
      event: 'mongodb_connection_checkout_failed',
      pendingQueueLength: state.pendingAcquireHr.length,
    });
  });

  client.on('connectionCheckedIn', () => {
    state.checkedOut = Math.max(0, state.checkedOut - 1);
  });
}

/**
 * Démarre le monitoring périodique + branche les événements CMAP.
 * @param {import('mongoose').Connection} mongooseConnection
 * @param {{ maxPoolSize?: number }} poolOptions
 */
function startMongoPoolMonitoring(mongooseConnection, poolOptions = {}) {
  stopMongoPoolMonitoring();

  state.maxPoolSize =
    typeof poolOptions.maxPoolSize === 'number' && poolOptions.maxPoolSize > 0
      ? poolOptions.maxPoolSize
      : DEFAULT_MAX_POOL_SIZE;
  state.checkedOut = 0;
  state.pendingAcquireHr = [];
  state.lastAlertAt = 0;

  const client =
    mongooseConnection && typeof mongooseConnection.getClient === 'function' ? mongooseConnection.getClient() : null;
  if (client) {
    attachPoolCmapListeners(client);
  } else {
    logger.warn({
      event: 'mongodb_pool_monitor_skip',
      message: 'MongoClient indisponible — monitoring pool différé',
    });
  }

  runPoolMonitorTick();
  state.monitorTimer = setInterval(runPoolMonitorTick, MONITOR_INTERVAL_MS);
  /* unref : n’empêche pas l’arrêt du process ; sous Jest fake timers, unref peut exclure le timer. */
  if (typeof state.monitorTimer.unref === 'function' && !process.env.JEST_WORKER_ID) {
    state.monitorTimer.unref();
  }

  logger.info({
    event: 'mongodb_pool_monitoring_started',
    intervalMs: MONITOR_INTERVAL_MS,
    maxPoolSize: state.maxPoolSize,
    alertUtilization: ALERT_UTILIZATION,
  });
}

/**
 *
 */
function stopMongoPoolMonitoring() {
  if (state.monitorTimer) {
    clearInterval(state.monitorTimer);
    state.monitorTimer = null;
  }
  state.pendingAcquireHr = [];
  logger.info({ event: 'mongodb_pool_monitoring_stopped' });
}

/**
 * Arrêt gracieux : timer + reset compteurs (les listeners restent sur le client jusqu’à fermeture).
 */
function prepareMongoPoolGracefulShutdown() {
  stopMongoPoolMonitoring();
  state.checkedOut = 0;
}

module.exports = {
  buildMongoPoolOptions,
  getMongoPoolMetrics,
  startMongoPoolMonitoring,
  stopMongoPoolMonitoring,
  prepareMongoPoolGracefulShutdown,
  MONGO_POOL_THRESHOLDS,
};
