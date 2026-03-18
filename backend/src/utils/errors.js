/**
 * Erreurs applicatives et gestionnaire global.
 * - AppError : erreurs opérationnelles (statusCode, code)
 * - globalErrorHandler : middleware Express (ne pas exposer stack en prod)
 */
const { AppError } = require('../lib/AppError');
const logger = require('../lib/logger');
const { redact } = require('../lib/logger');

/**
 * Middleware de gestion d'erreurs global.
 * À monter en dernier, après toutes les routes.
 * Différencie AppError (opérationnelle) des crashes (500, pas de stack en prod).
 */
function globalErrorHandler(config = {}) {
  const isProduction = config.env === 'production';

  return (err, req, res, next) => {
    if (res.headersSent) {
      return next(err);
    }

    if (err instanceof AppError) {
      logger.warn({
        event: 'app_error',
        message: err.message,
        statusCode: err.statusCode,
        code: err.code,
        path: req?.path,
        method: req?.method,
      });
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
        code: err.code,
        ...(isProduction ? {} : { stack: err.stack }),
      });
    }

    // Erreur non opérationnelle (crash, bug)
    logger.error({
      event: 'unhandled_error',
      err: err.message,
      stack: err.stack,
      path: req?.path,
      method: req?.method,
      body: redact(req?.body),
    });

    res.status(500).json({
      success: false,
      message: isProduction ? 'Internal server error' : (err.message || 'Erreur serveur'),
      code: 'INTERNAL_ERROR',
      ...(isProduction ? {} : { stack: err.stack }),
    });
  };
}

module.exports = { AppError, globalErrorHandler };
