/**
 * Module d'authentification — wrapper vers le système centralisé.
 *
 * L'auth réelle est dans :
 *   - backend/src/middleware/auth.js (JWT + MongoDB User lookup)
 *   - backend/src/routes/auth.js    (login, register, logout, refresh, profile)
 *
 * Ce module expose uniquement les middlewares pour la rétrocompatibilité
 * avec du code qui importerait depuis modules/auth.
 *
 * ⚠️  NE PAS ajouter de routes ici : elles sont montées par src/routes/index.js.
 */
const { authMiddleware: authenticateToken, adminMiddleware, requireRole } = require('../../middleware/auth');
const logger = require('../../lib/logger');

// Middleware d'autorisation admin (rétrocompat)
const requireAdmin = (req, res, next) => {
  return adminMiddleware(req, res, next);
};

// Middleware d'autorisation équipage (rétrocompat)
const requireCrew = (req, res, next) => {
  return requireRole('admin', 'crew')(req, res, next);
};

/**
 * Initialisation : les routes auth sont déjà montées par src/routes/index.js.
 * Cette fonction ne monte plus de routes pour éviter les doublons.
 */
const initialize = (app, io) => {
  logger.info({ event: 'module_auth_initialized' });
};

module.exports = {
  authenticateToken,
  requireAdmin,
  requireCrew,
  initialize,
};
