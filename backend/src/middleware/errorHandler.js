/**
 * Middleware Express de gestion des erreurs (4 arguments : err, req, res, next).
 * À placer après les routes ; capte les erreurs passées à next(err).
 */
const { logRouteError } = require('../lib/route-logger');

let sentry;
try {
  sentry = require('../lib/sentry');
} catch (_) {
  sentry = { captureException: () => {} };
}

function errorHandler(err, req, res, next) {
  const status = err.status ?? err.statusCode ?? res.statusCode ?? 500;
  const message = err.message ?? 'Internal Server Error';
  if (status >= 500) {
    logRouteError(req, 'express_legacy_error_handler', err);
    if (sentry && typeof sentry.captureException === 'function') {
      sentry.captureException(err);
    }
  }
  res.status(status).json({
    message: status >= 500 ? 'Internal Server Error' : message,
    ...(process.env.NODE_ENV !== 'production' && { error: message }),
  });
}

module.exports = { errorHandler };
