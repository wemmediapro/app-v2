/**
 * Wrapper de compatibilité : délègue à backend/src/middleware/auth.js (seule implémentation).
 * JWT_SECRET est géré uniquement dans src/middleware/auth.js via getSecret() (P1 : pas d'accès direct sans guard).
 * C2 : guard explicite avant toute utilisation JWT — throw si JWT_SECRET absent.
 * Utilisé par backend/routes/*.js si ces routes sont montées.
 */
const srcAuth = require('../src/middleware/auth');
const config = require('../src/config');

/** C2 : throw si JWT_SECRET absent (avant jwt.verify / jwt.sign). */
function guardJwtSecret() {
  const secret = config.jwt?.secret ?? process.env.JWT_SECRET;
  if (!secret || typeof secret !== 'string' || secret.length === 0) {
    throw new Error('JWT_SECRET must be set in config.env or .env');
  }
  if (process.env.NODE_ENV === 'production' && secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters in production');
  }
}

const wrapAuth = (fn) => (req, res, next) => {
  try {
    guardJwtSecret();
  } catch (e) {
    return res.status(503).json({ message: e.message, code: 'JWT_NOT_CONFIGURED' });
  }
  return fn(req, res, next);
};

const wrapOptionalAuth = (fn) => async (req, res, next) => {
  try {
    guardJwtSecret();
  } catch (e) {
    return res.status(503).json({ message: e.message, code: 'JWT_NOT_CONFIGURED' });
  }
  return fn(req, res, next);
};

module.exports = {
  authenticateToken: wrapAuth(srcAuth.authMiddleware),
  requireRole: srcAuth.requireRole,
  optionalAuth: wrapOptionalAuth(srcAuth.optionalAuth),
  /** Compatibilité backend/routes : generateToken(userId) → payload { id, userId } */
  generateToken: (userId) => {
    guardJwtSecret();
    return srcAuth.generateToken(typeof userId === 'object' ? userId : { id: userId, userId });
  }
};
