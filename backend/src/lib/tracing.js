/**
 * OpenTelemetry (traces + métriques custom) — opt-in via OTEL_ENABLED=1.
 * Export OTLP (HTTP) : Jaeger (4318), Datadog Agent, Grafana Tempo, etc.
 *
 * Variables utiles :
 * - OTEL_ENABLED=1
 * - OTEL_SERVICE_NAME=gnv-backend
 * - OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 (traces + métriques /v1/traces, /v1/metrics)
 * - OTEL_METRIC_EXPORT_INTERVAL_MS=60000
 */

const logger = require('./logger');

const TRACER_NAME = 'gnv-backend';
let sdk = null;
let started = false;
let customMetricsSingleton = null;

/**
 * @returns {boolean}
 */
function isOtelEnabled() {
  const v = process.env.OTEL_ENABLED;
  return v === '1' || String(v).toLowerCase() === 'true';
}

/**
 * Champs pour corrélation logs ↔ traces (span actif).
 * @returns {Record<string, string|number>}
 */
function getTraceLogFields() {
  if (!started) {
    return {};
  }
  try {
    const { trace, context } = require('@opentelemetry/api');
    const span = trace.getSpan(context.active());
    if (!span) {
      return {};
    }
    const sc = span.spanContext();
    if (!sc || !sc.traceId || sc.traceId === '00000000000000000000000000000000') {
      return {};
    }
    return {
      traceId: sc.traceId,
      spanId: sc.spanId,
    };
  } catch {
    return {};
  }
}

/** Métriques applicatives (histogrammes / compteurs OTEL). */
class CustomMetrics {
  /**
   * @param {import('@opentelemetry/api').Meter} meter
   */
  constructor(meter) {
    this.meter = meter;
    this.httpDuration = meter.createHistogram('gnv.http.server.duration_ms', {
      description: 'Durée des requêtes HTTP (ms)',
      unit: 'ms',
    });
    this.httpErrors = meter.createCounter('gnv.http.server.errors_total', {
      description: 'Réponses HTTP 5xx',
    });
    this.dbDuration = meter.createHistogram('gnv.db.operation.duration_ms', {
      description: 'Durée des opérations base (hooks manuels)',
      unit: 'ms',
    });
    this.cacheHits = meter.createCounter('gnv.cache.hits_total', { description: 'Cache hits' });
    this.cacheMisses = meter.createCounter('gnv.cache.misses_total', { description: 'Cache misses' });
    this.socketEvents = meter.createCounter('gnv.socket.events_total', {
      description: 'Événements Socket.io instrumentés',
    });
  }

  /**
   * @param {number} durationMs
   * @param {Record<string, string>} [attributes]
   */
  recordHttpDuration(durationMs, attributes = {}) {
    this.httpDuration.record(durationMs, attributes);
  }

  /**
   * @param {Record<string, string>} [attributes]
   */
  recordHttpError(attributes = {}) {
    this.httpErrors.add(1, attributes);
  }

  /**
   * @param {number} durationMs
   * @param {Record<string, string>} [attributes]
   */
  recordDbDuration(durationMs, attributes = {}) {
    this.dbDuration.record(durationMs, attributes);
  }

  recordCacheHit(attributes = {}) {
    this.cacheHits.add(1, attributes);
  }

  recordCacheMiss(attributes = {}) {
    this.cacheMisses.add(1, attributes);
  }

  /**
   * @param {string} eventName
   * @param {Record<string, string>} [attributes]
   */
  recordSocketEvent(eventName, attributes = {}) {
    this.socketEvents.add(1, { ...attributes, 'socket.event': eventName });
  }
}

/**
 * @returns {CustomMetrics | null}
 */
function getCustomMetrics() {
  return customMetricsSingleton;
}

/**
 * Middleware Express : enregistre les métriques HTTP custom (complète l’auto-instrumentation).
 * @returns {import('express').RequestHandler}
 */
function otelHttpCustomMetricsMiddleware() {
  return (req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const m = getCustomMetrics();
      if (!m) {
        return;
      }
      const duration = Date.now() - start;
      const route = req.route?.path || req.path || '';
      const attrs = {
        'http.method': req.method,
        'http.status_code': String(res.statusCode),
        'http.route': String(route).slice(0, 200),
      };
      m.recordHttpDuration(duration, attrs);
      if (res.statusCode >= 500) {
        m.recordHttpError(attrs);
      }
    });
    next();
  };
}

/**
 * Exécute une fonction dans un span actif (ex. Socket.io).
 * @param {string} spanName
 * @param {(span: import('@opentelemetry/api').Span) => void} fn
 */
function runInActiveSpan(spanName, fn) {
  if (!started) {
    fn(null);
    return;
  }
  try {
    const { trace, SpanStatusCode } = require('@opentelemetry/api');
    const tracer = trace.getTracer(TRACER_NAME);
    tracer.startActiveSpan(spanName, (span) => {
      try {
        fn(span);
      } catch (err) {
        span.recordException(/** @type {Error} */ (err));
        span.setStatus({ code: SpanStatusCode.ERROR, message: err instanceof Error ? err.message : String(err) });
        throw err;
      } finally {
        span.end();
      }
    });
  } catch (err) {
    logger.warn({ event: 'otel_run_in_span_failed', err: err instanceof Error ? err.message : String(err) });
    fn(null);
  }
}

/**
 * Démarre le SDK Node (traces + métriques OTLP). À appeler **avant** `require('express')`.
 */
function initTracing() {
  if (!isOtelEnabled() || started) {
    return;
  }
  try {
    const { NodeSDK } = require('@opentelemetry/sdk-node');
    const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
    const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
    const { OTLPMetricExporter } = require('@opentelemetry/exporter-metrics-otlp-http');
    const { PeriodicExportingMetricReader } = require('@opentelemetry/sdk-metrics');
    const { resourceFromAttributes } = require('@opentelemetry/resources');
    const { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION } = require('@opentelemetry/semantic-conventions');
    const { metrics } = require('@opentelemetry/api');

    const serviceName = (process.env.OTEL_SERVICE_NAME || 'gnv-backend').trim();
    const serviceVersion = (process.env.npm_package_version || process.env.OTEL_SERVICE_VERSION || '1.0.0').trim();

    const resource = resourceFromAttributes({
      [SEMRESATTRS_SERVICE_NAME]: serviceName,
      [SEMRESATTRS_SERVICE_VERSION]: serviceVersion,
    });

    const traceExporter = new OTLPTraceExporter();
    const metricExporter = new OTLPMetricExporter();
    const exportIntervalMs = parseInt(process.env.OTEL_METRIC_EXPORT_INTERVAL_MS, 10);
    const metricReader = new PeriodicExportingMetricReader({
      exporter: metricExporter,
      exportIntervalMillis: Number.isFinite(exportIntervalMs) && exportIntervalMs > 0 ? exportIntervalMs : 60_000,
    });

    sdk = new NodeSDK({
      resource,
      traceExporter,
      metricReaders: [metricReader],
      instrumentations: [
        getNodeAutoInstrumentations({
          '@opentelemetry/instrumentation-fs': { enabled: false },
        }),
      ],
    });

    sdk.start();
    started = true;

    const meter = metrics.getMeter(TRACER_NAME, serviceVersion);
    customMetricsSingleton = new CustomMetrics(meter);

    logger.info({
      event: 'otel_sdk_started',
      serviceName,
      endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'default (env OTEL)',
    });
  } catch (err) {
    logger.warn({
      event: 'otel_sdk_start_failed',
      err: err instanceof Error ? err.message : String(err),
    });
    sdk = null;
    started = false;
    customMetricsSingleton = null;
  }
}

/**
 * @returns {Promise<void>}
 */
async function shutdownTracing() {
  if (!sdk) {
    return;
  }
  try {
    await sdk.shutdown();
    logger.info({ event: 'otel_sdk_shutdown_ok' });
  } catch (err) {
    logger.warn({ event: 'otel_sdk_shutdown_failed', err: err instanceof Error ? err.message : String(err) });
  } finally {
    sdk = null;
    started = false;
    customMetricsSingleton = null;
  }
}

module.exports = {
  isOtelEnabled,
  initTracing,
  shutdownTracing,
  getTraceLogFields,
  getCustomMetrics,
  CustomMetrics,
  otelHttpCustomMetricsMiddleware,
  runInActiveSpan,
};
