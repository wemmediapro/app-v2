/**
 * Logs d’erreur HTTP homogènes : Pino JSON ; utiliser `req.log` pour inclure reqId / correlationId (request-context).
 */
const logger = require('./logger');

/**
 * @param {import('express').Request} req
 * @param {string} event identifiant stable pour filtrer les logs (snake_case)
 * @param {unknown} err
 * @param {Record<string, unknown>} [extra] champs additionnels (ex. hasAdminEmail, email)
 */
function logRouteError(req, event, err, extra = {}) {
  const msg = err instanceof Error ? err.message : String(err);
  const payload = { event, err: msg, ...extra };
  if (err instanceof Error && err.stack) {
    payload.stack = err.stack;
  }
  (req && req.log ? req.log : logger).error(payload);
}

module.exports = { logRouteError };
