const pino = require('pino');

const isProduction = process.env.NODE_ENV === 'production';

const logger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
});

/** Log tentative de connexion échouée (sécurité) */
function logFailedLogin(email, reason, req = null) {
  logger.warn({
    event: 'auth_failed_login',
    email: email || '(missing)',
    reason,
    ip: req?.ip || req?.socket?.remoteAddress,
    path: req?.path,
  });
}

/** Log erreur API / requête suspecte */
function logApiError(message, meta = {}) {
  logger.warn({ event: 'api_error', message, ...meta });
}

/** Log erreur Socket.io (auth refusée) */
function logSocketAuthFailed(socketId, reason) {
  logger.warn({ event: 'socket_auth_failed', socketId, reason });
}

module.exports = logger;
module.exports.logFailedLogin = logFailedLogin;
module.exports.logApiError = logApiError;
module.exports.logSocketAuthFailed = logSocketAuthFailed;
