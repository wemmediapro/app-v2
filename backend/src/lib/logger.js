/**
 * Logs structurés JSON (Pino) — une ligne JSON par entrée, adaptée à ELK / OpenSearch / Loki / CloudWatch / Datadog.
 *
 * - Par défaut : **stdout JSON** (tous les environnements). Agrégation : capturer stdout (Fluent Bit, Filebeat, agent Datadog, etc.).
 * - Lecture locale : `LOG_PRETTY=1` (nécessite `pino-pretty`, fourni en dev) — désactivé automatiquement sous Jest.
 * - Niveaux : fatal, error, warn, info, debug, trace — `LOG_LEVEL` (défaut `info` en production, `debug` sinon).
 * - Contexte requête : `req.log` avec `reqId`, `requestId`, `correlationId`, `http`, OTEL (`request-context.js`).
 * - Serializers : `req` / `res` / `err` (conventions Pino), corps `req` redacté (OWASP).
 */
const crypto = require('crypto');
const pino = require('pino');

const isProduction = process.env.NODE_ENV === 'production';
const serviceName = (process.env.LOG_SERVICE_NAME || 'gnv-backend').trim() || 'gnv-backend';

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

/**
 * Destination lisible humain (local uniquement). Sans `pino-pretty` (ex. `npm ci --omit=dev`) → JSON stdout.
 * @returns {import('pino').TransportSingleOptions | null}
 */
function resolvePrettyDestination() {
  if (process.env.LOG_PRETTY !== '1' || process.env.JEST_WORKER_ID) {
    return null;
  }
  try {
    require.resolve('pino-pretty');
  } catch {
    return null;
  }
  return pino.transport({
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  });
}

const rootOptions = {
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  base: {
    service: serviceName,
    environment: process.env.NODE_ENV || 'development',
  },
  serializers: {
    req: (req) => {
      if (!req || typeof req !== 'object') {
        return req;
      }
      const serialized = pino.stdSerializers.req(req);
      if (req.body != null && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
        serialized.body = redact(req.body);
      }
      return serialized;
    },
    res: pino.stdSerializers.res,
    err: pino.stdSerializers.err,
  },
};

const prettyDest = resolvePrettyDestination();
/** Logger racine. Pour une requête HTTP : utiliser `req.log` (enfant avec `reqId` / `requestId` / `correlationId`). */
const logger = prettyDest ? pino(rootOptions, prettyDest) : pino(rootOptions);

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
