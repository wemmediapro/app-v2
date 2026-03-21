/**
 * Contexte HTTP : ID de corrélation (traçage bout-en-bout) + `req.log` enfant Pino.
 * Accepte les en-têtes entrants `X-Request-Id` ou `X-Correlation-Id` ; sinon génère un ID.
 * Journal d’accès HTTP structuré (remplace une ligne Apache texte) pour ELK / Loki / etc.
 */

const crypto = require('crypto');
const logger = require('./logger');
const { getApiPathSuffix } = require('./apiPath');

const MAX_CORRELATION_LEN = 128;

/**
 * @param {import('express').Request} req
 * @returns {string | null}
 */
function readIncomingCorrelationId(req) {
  const a = req.get('x-request-id') || req.get('X-Request-Id');
  const b = req.get('x-correlation-id') || req.get('X-Correlation-Id');
  const raw = String(a || b || '').trim();
  if (!raw) {
    return null;
  }
  const safe = raw.replace(/[^a-zA-Z0-9_\-.:@]/g, '').slice(0, MAX_CORRELATION_LEN);
  return safe.length > 0 ? safe : null;
}

/**
 * @returns {import('express').RequestHandler}
 */
function requestContextMiddleware() {
  return function requestContext(req, res, next) {
    const incoming = readIncomingCorrelationId(req);
    req.id = incoming || crypto.randomBytes(12).toString('hex');
    req.correlationId = req.id;

    res.setHeader('X-Request-Id', req.id);
    res.setHeader('X-Correlation-Id', req.id);

    const pathOnly = (req.originalUrl || req.url || '').split('?')[0] || '';
    req.log = logger.child({
      reqId: req.id,
      correlationId: req.id,
      http: {
        method: req.method,
        path: pathOnly,
      },
    });

    next();
  };
}

/**
 * @param {import('express').Request} req
 */
function shouldSkipHttpAccessLog(req) {
  const sub = getApiPathSuffix(req.path || '');
  return (
    sub === '/health' ||
    sub.startsWith('/health/') ||
    sub === '/metrics/web-vitals' ||
    req.path === '/metrics' ||
    req.path?.startsWith('/uploads/')
  );
}

/**
 * Une ligne de log JSON par requête HTTP terminée (hors chemins bruyants / health).
 * @returns {import('express').RequestHandler}
 */
function httpAccessStructuredMiddleware() {
  return function httpAccessStructured(req, res, next) {
    const start = Date.now();
    let wrote = false;
    const write = () => {
      if (wrote) {
        return;
      }
      wrote = true;
      if (shouldSkipHttpAccessLog(req)) {
        return;
      }
      const log = req.log || logger;
      const path =
        ((req.baseUrl || '') + (req.path || '')).replace(/\/+/g, '/') ||
        (req.originalUrl || req.url || '').split('?')[0] ||
        '';
      log.info({
        event: 'http_access',
        http: {
          method: req.method,
          path: path || '/',
          statusCode: res.statusCode,
          responseTimeMs: Date.now() - start,
          contentLength: res.get('content-length') || undefined,
        },
      });
    };
    res.on('finish', write);
    res.on('close', write);
    next();
  };
}

module.exports = {
  requestContextMiddleware,
  httpAccessStructuredMiddleware,
  shouldSkipHttpAccessLog,
  readIncomingCorrelationId,
};
