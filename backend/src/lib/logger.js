const crypto = require('crypto');
const pino = require('pino');

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Hachage SHA-256 tronqué pour les logs : corrélation possible sans email en clair (anti-énumération).
 */
function hashEmailForLog(email) {
  const normalized = email == null || String(email).trim() === '' ? 'unknown' : String(email).trim().toLowerCase();
  return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex').slice(0, 16);
}

/**
 * Masque un email pour affichage (debug / messages utilisateur), pas pour les logs d’audit structurés.
 */
function redactEmail(email) {
  if (!email || typeof email !== 'string' || email.length < 5) {
    return '***';
  }
  const [local = '', domain] = email.split('@');
  const redactedLocal = local.slice(0, 2) + '*'.repeat(Math.max(0, local.length - 2));
  const redactedDomain = domain ? '*'.repeat(domain.length) : '***';
  return `${redactedLocal}@${redactedDomain}`;
}

// Masquer les champs sensibles dans les logs (OWASP Logging)
const SENSITIVE_KEYS = /password|token|secret|authorization|cookie|csrf|jwt|adminToken/i;
/**
 *
 */
function redact(obj) {
  if (obj == null) {
    return obj;
  }
  if (typeof obj !== 'object') {
    return obj;
  }
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.test(k)) {
      out[k] = '[REDACTED]';
    } else if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      out[k] = redact(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

/** Logger racine. Pour une requête HTTP : utiliser `req.log` (enfant avec `reqId`, défini dans server.js). */
const logger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  serializers: {
    req: (req) => (req && req.body ? { ...req, body: redact(req.body) } : req),
    err: (err) => (err ? { message: err.message, stack: err.stack } : err),
  },
});

/** Log tentative de connexion échouée (sécurité — pas d’email en clair) */
function logFailedLogin(email, reason, req = null) {
  logger.warn({
    event: 'auth_failed_login',
    emailHash: hashEmailForLog(email),
    reason,
    ip: req?.ip || req?.socket?.remoteAddress,
    path: req?.path,
  });
}

/**
 * @deprecated Préférer `logRouteError` côté routes HTTP (`route-logger.js`, `event` snake_case).
 * Conservé pour compatibilité ; n’est plus utilisé par `auth.js`.
 */
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
module.exports.hashEmailForLog = hashEmailForLog;
module.exports.redactEmail = redactEmail;
