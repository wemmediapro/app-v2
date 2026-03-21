/**
 * Monitoring des commandes MongoDB (driver) : durée, échecs, requêtes lentes.
 * Branché sur MongoClient après connexion Mongoose — voir database-optimized.js.
 */

'use strict';

const logger = require('./logger');

/** Commandes internes / heartbeat — ne pas alerter « lent » */
const NOISE_COMMANDS = new Set([
  'hello',
  'ismaster',
  'ping',
  'buildInfo',
  'getLastError',
  'endSessions',
  'saslStart',
  'saslContinue',
  'compress',
]);

/**
 *
 */
function isMonitorDisabled() {
  const v = process.env.MONGODB_QUERY_MONITOR;
  return v === '0' || v === 'false' || v === 'off';
}

/**
 *
 */
function getSlowThresholdMs() {
  const n = parseInt(process.env.MONGODB_SLOW_QUERY_MS, 10);
  return Number.isFinite(n) && n > 0 ? n : 200;
}

/**
 *
 */
function getRateLimitPerMinute() {
  const n = parseInt(process.env.MONGODB_SLOW_QUERY_LOG_MAX_PER_MIN, 10);
  return Number.isFinite(n) && n >= 0 ? n : 60;
}

const stats = {
  slowCommandsLogged: 0,
  failedCommandsLogged: 0,
  rateLimitedSkips: 0,
  lastSlow: /** @type {{ commandName: string, durationMs: number, at: string } | null} */ (null),
};

let windowStart = Date.now();
let slowLogsThisWindow = 0;
let rateLimitNoticeSent = false;

/** @type {null | (() => void)} */
let detach = null;

/**
 *
 */
function resetRateWindowIfNeeded() {
  const now = Date.now();
  if (now - windowStart >= 60_000) {
    windowStart = now;
    slowLogsThisWindow = 0;
    rateLimitNoticeSent = false;
  }
}

/**
 *
 */
function tryConsumeSlowLogSlot() {
  resetRateWindowIfNeeded();
  const max = getRateLimitPerMinute();
  if (max === 0) {
    return false;
  }
  if (slowLogsThisWindow >= max) {
    stats.rateLimitedSkips += 1;
    if (!rateLimitNoticeSent) {
      rateLimitNoticeSent = true;
      logger.warn({
        event: 'mongodb_slow_query_rate_limited',
        maxPerMinute: max,
        message: 'Logs de requêtes lentes plafonnés pour cette minute',
      });
    }
    return false;
  }
  slowLogsThisWindow += 1;
  return true;
}

/**
 * @param {import('mongoose').Connection} connection
 */
function startMongoQueryMonitoring(connection) {
  stopMongoQueryMonitoring();

  if (isMonitorDisabled()) {
    return;
  }

  let client;
  try {
    client = connection.getClient();
  } catch {
    return;
  }
  if (!client || typeof client.on !== 'function') {
    return;
  }

  const slowMs = getSlowThresholdMs();

  /**
   * @param {object} event
   */
  function onCommandSucceeded(event) {
    const name = event && event.commandName;
    if (!name || NOISE_COMMANDS.has(name)) {
      return;
    }
    const durationMs =
      typeof event.duration === 'number' ? event.duration : typeof event.durationMS === 'number' ? event.durationMS : 0;
    if (durationMs < slowMs) {
      return;
    }
    if (!tryConsumeSlowLogSlot()) {
      return;
    }
    stats.slowCommandsLogged += 1;
    stats.lastSlow = {
      commandName: name,
      durationMs,
      at: new Date().toISOString(),
    };
    logger.warn({
      event: 'mongodb_slow_command',
      commandName: name,
      durationMs,
      databaseName: event.databaseName,
      thresholdMs: slowMs,
      address: event.address && String(event.address),
    });
  }

  /**
   * @param {object} event
   */
  function onCommandFailed(event) {
    const name = event && event.commandName;
    if (!name || NOISE_COMMANDS.has(name)) {
      return;
    }
    stats.failedCommandsLogged += 1;
    const durationMs =
      typeof event.duration === 'number'
        ? event.duration
        : typeof event.durationMS === 'number'
          ? event.durationMS
          : undefined;
    logger.error({
      event: 'mongodb_command_failed',
      commandName: name,
      databaseName: event.databaseName,
      durationMs,
      address: event.address && String(event.address),
      err: event.failure && (event.failure.message || String(event.failure)),
    });
  }

  client.on('commandSucceeded', onCommandSucceeded);
  client.on('commandFailed', onCommandFailed);

  detach = () => {
    try {
      client.off('commandSucceeded', onCommandSucceeded);
      client.off('commandFailed', onCommandFailed);
    } catch {
      client.removeListener('commandSucceeded', onCommandSucceeded);
      client.removeListener('commandFailed', onCommandFailed);
    }
    detach = null;
  };
}

/**
 *
 */
function stopMongoQueryMonitoring() {
  if (typeof detach === 'function') {
    detach();
  }
}

/**
 *
 */
function getMongoQueryMonitorStats() {
  return {
    ...stats,
    enabled: !isMonitorDisabled(),
    slowThresholdMs: getSlowThresholdMs(),
    rateLimitPerMinute: getRateLimitPerMinute(),
  };
}

module.exports = {
  startMongoQueryMonitoring,
  stopMongoQueryMonitoring,
  getMongoQueryMonitorStats,
};
