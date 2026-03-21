/**
 * Métriques Prometheus (processus Node) — GET /metrics si PROMETHEUS_METRICS_ENABLED=1.
 * À n’activer que derrière un accès réseau restreint (VPC, IP allowlist, mesh).
 */

'use strict';

const logger = require('./logger');

let register;
let initialized = false;

/**
 *
 */
function isPrometheusMetricsEnabled() {
  const v = process.env.PROMETHEUS_METRICS_ENABLED;
  return v === '1' || v === 'true' || v === 'yes';
}

/**
 *
 */
function initPrometheusMetrics() {
  if (!isPrometheusMetricsEnabled() || initialized) {
    return;
  }
  try {
    const client = require('prom-client');
    register = new client.Registry();
    client.collectDefaultMetrics({
      register,
      prefix: 'gnv_',
      labels: { app: 'gnv-backend' },
    });
    initialized = true;
    logger.info({ event: 'prometheus_metrics_enabled', path: '/metrics' });
  } catch (e) {
    logger.warn({
      event: 'prometheus_metrics_init_failed',
      err: e instanceof Error ? e.message : String(e),
    });
  }
}

/**
 * @param {import('express').Application} app
 */
function mountPrometheusMetricsRoute(app) {
  if (!initialized || !register) {
    return;
  }
  app.get('/metrics', async (req, res) => {
    try {
      res.setHeader('Content-Type', register.contentType);
      res.send(await register.metrics());
    } catch (e) {
      res
        .status(500)
        .type('text/plain')
        .send(e instanceof Error ? e.message : 'metrics error');
    }
  });
}

module.exports = {
  isPrometheusMetricsEnabled,
  initPrometheusMetrics,
  mountPrometheusMetricsRoute,
};
