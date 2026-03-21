/**
 * Journalisation des requêtes HTTP lentes (complète les métriques OTEL / access log).
 * Seuil : SLOW_HTTP_REQUEST_MS (défaut 500).
 */

const logger = require('../lib/logger');

let slowCountSinceStart = 0;
let totalFinishedSinceStart = 0;

/**
 * @returns {{ slowCount: number, totalFinished: number, slowRequestMs: number }}
 */
function getPerformanceMonitorStats() {
  return {
    slowCount: slowCountSinceStart,
    totalFinished: totalFinishedSinceStart,
    slowRequestMs:
      parseInt(process.env.SLOW_HTTP_REQUEST_MS, 10) > 0 ? parseInt(process.env.SLOW_HTTP_REQUEST_MS, 10) : 500,
  };
}

/**
 * @returns {import('express').RequestHandler}
 */
function createSlowRequestLoggerMiddleware() {
  const threshold =
    parseInt(process.env.SLOW_HTTP_REQUEST_MS, 10) > 0 ? parseInt(process.env.SLOW_HTTP_REQUEST_MS, 10) : 500;

  return function slowRequestLogger(req, res, next) {
    const start = Date.now();
    res.on('finish', () => {
      totalFinishedSinceStart += 1;
      const durationMs = Date.now() - start;
      if (durationMs < threshold) {
        return;
      }
      slowCountSinceStart += 1;
      const log = req.log || logger;
      log.warn({
        event: 'slow_http_request',
        durationMs,
        thresholdMs: threshold,
        method: req.method,
        path: (req.baseUrl || '') + (req.path || ''),
        statusCode: res.statusCode,
      });
    });
    next();
  };
}

module.exports = {
  createSlowRequestLoggerMiddleware,
  getPerformanceMonitorStats,
};
