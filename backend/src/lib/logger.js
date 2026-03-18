const pino = require('pino');

const isProduction = process.env.NODE_ENV === 'production';

// Masquer les champs sensibles dans les logs (OWASP Logging)
const SENSITIVE_KEYS = /password|token|secret|authorization|cookie|csrf|jwt|adminToken/i;
function redact(obj) {
  if (obj == null) return obj;
  if (typeof obj !== 'object') return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.test(k)) out[k] = '[REDACTED]';
    else if (typeof v === 'object' && v !== null && !Array.isArray(v)) out[k] = redact(v);
    else out[k] = v;
  }
  return out;
}

const logger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  serializers: {
    req: (req) => (req && req.body ? { ...req, body: redact(req.body) } : req),
    err: (err) => (err ? { message: err.message, stack: err.stack } : err),
  },
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
module.exports.redact = redact;
