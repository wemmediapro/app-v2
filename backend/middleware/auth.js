/**
 * Point d'entrée unique auth : réexporte backend/src/middleware/auth.js.
 * Les routes doivent utiliser soit ce fichier (backend/routes) soit require('../middleware/auth')
 * depuis backend/src/routes — dans les deux cas c'est la même implémentation.
 * Noms legacy : authenticateToken = authMiddleware, requireRole, optionalAuth, generateToken(userId).
 */
const src = require('../src/middleware/auth');

module.exports = {
  authenticateToken: src.authMiddleware,
  requireRole: src.requireRole,
  optionalAuth: src.optionalAuth,
  authMiddleware: src.authMiddleware,
  adminMiddleware: src.adminMiddleware,
  generateToken: src.generateTokenCompat,
  verifyToken: src.verifyToken,
};
