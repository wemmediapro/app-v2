/**
 * Middleware d'audit pour requêtes admin.
 * Capture IP, User-Agent et fournit req.auditContext pour les routes.
 * Les routes appellent explicitement auditService.logAction() avec les détails (before/after).
 */
const auditService = require('../services/auditService');

/**
 * Récupère l'IP réelle du client (proxy, load balancer).
 */
function getClientIp(req) {
  return (
    req.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.get('x-real-ip') ||
    req.socket?.remoteAddress ||
    req.connection?.remoteAddress ||
    null
  );
}

/**
 * Récupère le User-Agent.
 */
function getUserAgent(req) {
  return req.get('user-agent') || null;
}

/**
 * Enrichit req avec auditContext (ipAddress, userAgent).
 * À placer après authMiddleware pour les routes protégées.
 */
function auditContext(req, res, next) {
  req.auditContext = {
    ipAddress: getClientIp(req),
    userAgent: getUserAgent(req),
  };
  next();
}

/**
 * Helper pour logger une action depuis une route.
 * Utilise req.auditContext si disponible.
 * @param {object} req - Express request
 * @param {object} opts - Options pour auditService.logAction
 */
async function logFromRequest(req, opts) {
  const ctx = req.auditContext || {};
  return auditService.logAction({
    ...opts,
    ipAddress: opts.ipAddress ?? ctx.ipAddress,
    userAgent: opts.userAgent ?? ctx.userAgent,
  });
}

/**
 * Wrapper pour loguer les erreurs dans les handlers.
 * À appeler dans les blocs catch.
 */
async function logError(req, opts) {
  return logFromRequest(req, {
    ...opts,
    status: 'failure',
    errorMessage: opts.errorMessage || opts.err?.message || 'Unknown error',
  });
}

module.exports = {
  auditContext,
  getClientIp,
  getUserAgent,
  logFromRequest,
  logError,
};
