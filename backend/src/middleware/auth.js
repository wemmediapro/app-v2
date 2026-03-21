/**
 * Auth middleware unique (backend/src). Token : cookie authToken ou header Authorization.
 * Vérification : JWT + lookup MongoDB User (existence, isActive). backend/middleware/auth.js en est un wrapper.
 * Cache Redis 1 min pour éviter un hit MongoDB à chaque requête (invalide immédiatement si user supprimé/désactivé après 1 min max).
 * Voir backend/docs/AUTH-MIDDLEWARE.md.
 */
const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');
const cacheManager = require('../lib/cache-manager');
const authService = require('../services/authService');

const AUTH_USER_CACHE_TTL = 60; // 1 min
const AUTH_USER_CACHE_PREFIX = 'auth:user:';

const isProduction = process.env.NODE_ENV === 'production';
let secretMissingWarned = false;

/** P1 : JWT_SECRET jamais utilisé sans guard — lecture centralisée avec vérification. */
const JWT_MIN_LENGTH = 32;
function getSecret() {
  const secret = config.jwt?.secret;
  if (!secret || typeof secret !== 'string' || secret.length === 0) {
    if (isProduction) {
      throw new Error('JWT_SECRET must be set in production');
    }
    if (!secretMissingWarned) {
      secretMissingWarned = true;
      console.error('CRITICAL: JWT_SECRET is not set. Set it in backend/config.env or backend/.env. Refusing to use a fallback secret.');
    }
    throw new Error('JWT_SECRET must be set in config.env or .env');
  }
  if (isProduction && secret.length < JWT_MIN_LENGTH) {
    throw new Error(`JWT_SECRET must be at least ${JWT_MIN_LENGTH} characters in production`);
  }
  return secret;
}

/** Récupère le token depuis le cookie httpOnly (dashboard) ou le header Authorization */
function getTokenFromRequest(req) {
  return req.cookies?.authToken || req.header('Authorization')?.replace('Bearer ', '') || '';
}

const generateToken = (payload) => {
  return jwt.sign(payload, getSecret(), {
    expiresIn: process.env.JWT_EXPIRES_IN || process.env.JWT_EXPIRE || '7d',
  });
};

const generateAccessToken = (payload) => {
  return jwt.sign(payload, getSecret(), {
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  });
};

const verifyToken = (token) => {
  return jwt.verify(token, getSecret());
};

const TWO_FACTOR_CHALLENGE_TTL = process.env.TWO_FACTOR_CHALLENGE_EXPIRES_IN || '5m';

/** JWT court : étape intermédiaire après mot de passe OK, avant saisie TOTP. */
function generateTwoFactorChallengeToken(userId, email) {
  return jwt.sign(
    {
      typ: '2fa_challenge',
      id: String(userId),
      sub: String(userId),
      email: email || undefined,
    },
    getSecret(),
    { expiresIn: TWO_FACTOR_CHALLENGE_TTL },
  );
}

function verifyTwoFactorChallengeToken(token) {
  const d = jwt.verify(token, getSecret());
  if (d.typ !== '2fa_challenge') {
    const e = new Error('Invalid challenge type');
    e.name = 'JsonWebTokenError';
    throw e;
  }
  return d;
}

/** Routes /api/auth/* où un admin avec 2FA peut utiliser un JWT sans claim `mfa`. */
function isMfaExemptApiPath(req) {
  const raw = (req.originalUrl || req.url || '').split('?')[0];
  const path = raw.replace(/^\/api\/?/, '/') || '/';
  const exempt = new Set([
    '/auth/login',
    '/auth/logout',
    '/auth/2fa/complete-login',
    '/auth/me',
    '/auth/2fa/setup',
    '/auth/2fa/verify',
  ]);
  if (exempt.has(path)) {return true;}
  return false;
}

const authMiddleware = async (req, res, next) => {
  try {
    getSecret();
  } catch (e) {
    return res.status(503).json({ message: e.message, code: 'JWT_NOT_CONFIGURED' });
  }
  try {
    const token = getTokenFromRequest(req);
    if (!token) {
      return res.status(401).json({ message: 'Access denied. No token provided.' });
    }
    const decoded = verifyToken(token);
    if (decoded.typ === '2fa_challenge') {
      return res.status(401).json({
        message: 'Token de challenge 2FA non utilisable pour cette ressource.',
        code: 'INVALID_TOKEN_TYPE',
      });
    }
    if (cacheManager.isConnected) {
      try {
        const blacklisted = await cacheManager.get(`blacklist:${token}`);
        if (blacklisted) {
          return res.status(401).json({ message: 'Token has been revoked.', code: 'TOKEN_REVOKED' });
        }
      } catch (_) { /* Redis down, skip check */ }
    }
    const userId = decoded.id || decoded.userId || decoded._id;
    if (!userId) {
      return res.status(401).json({ message: 'Invalid token payload.' });
    }
    const cacheKey = AUTH_USER_CACHE_PREFIX + userId;
    if (cacheManager.isConnected) {
      try {
        const cached = await cacheManager.get(cacheKey);
        if (cached && typeof cached === 'object') {
          if (cached.invalid) {
            return res.status(401).json({ message: 'User not found.', code: 'INVALID_TOKEN' });
          }
          if (cached.isActive === false) {
            return res.status(401).json({ message: 'Account is deactivated.', code: 'ACCOUNT_DEACTIVATED' });
          }
          req.user = { ...cached, id: cached._id || cached.id };
          return next();
        }
      } catch (_) {
        /* cache miss or error: fall through to MongoDB */
      }
    }
    const user = await User.findById(userId).select('-password').lean();
    if (!user) {
      if (cacheManager.isConnected) {
        await cacheManager.set(cacheKey, { invalid: true }, AUTH_USER_CACHE_TTL);
      }
      return res.status(401).json({ message: 'User not found.', code: 'INVALID_TOKEN' });
    }
    if (user.isActive === false) {
      if (cacheManager.isConnected) {
        await cacheManager.set(cacheKey, { ...user, invalid: true }, AUTH_USER_CACHE_TTL);
      }
      return res.status(401).json({ message: 'Account is deactivated.', code: 'ACCOUNT_DEACTIVATED' });
    }
    if (cacheManager.isConnected) {
      await cacheManager.set(cacheKey, user, AUTH_USER_CACHE_TTL);
    }
    req.user = { ...user, id: user._id };

    // Admins avec 2FA activé : JWT doit contenir mfa: true (sauf routes d’onboarding / profil léger)
    if (user.role === 'admin' && user.twoFactorEnabled && decoded.mfa !== true) {
      const headerTotp = (req.get('X-2FA-Token') || req.get('x-2fa-token') || '').replace(/\s/g, '');
      let headerOk = false;
      if (headerTotp && /^\d{6}$/.test(headerTotp)) {
        try {
          const u2 = await User.findById(userId).select('+twoFactorSecret').lean();
          if (u2 && u2.twoFactorSecret) {
            headerOk = authService.verifyTOTPToken(u2.twoFactorSecret, headerTotp);
          }
        } catch (_) {
          headerOk = false;
        }
      }
      if (!headerOk && !isMfaExemptApiPath(req)) {
        return res.status(401).json({
          message:
            'Authentification à deux facteurs requise. Reconnectez-vous avec le code TOTP ou envoyez X-2FA-Token (6 chiffres) pour cette requête.',
          code: 'MFA_REQUIRED',
        });
      }
    }

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token.', code: 'INVALID_TOKEN' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired.', code: 'TOKEN_EXPIRED' });
    }
    res.status(401).json({ message: 'Invalid token.' });
  }
};

const adminMiddleware = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required.' });
    }
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
    }
    next();
  } catch (error) {
    res.status(403).json({ message: 'Access denied.' });
  }
};

/** Vérifie que req.user a l'un des rôles autorisés (après authMiddleware/authenticateToken). */
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required', code: 'AUTH_REQUIRED' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Insufficient permissions', code: 'INSUFFICIENT_PERMISSIONS' });
    }
    next();
  };
};

const optionalAuth = async (req, res, next) => {
  try {
    getSecret();
  } catch (e) {
    return res.status(503).json({ message: e.message, code: 'JWT_NOT_CONFIGURED' });
  }
  try {
    const token = getTokenFromRequest(req);
    if (token) {
      try {
        const decoded = verifyToken(token);
        const userId = decoded.id || decoded.userId || decoded._id;
        if (userId) {
          const cacheKey = AUTH_USER_CACHE_PREFIX + userId;
          if (cacheManager.isConnected) {
            try {
              const cached = await cacheManager.get(cacheKey);
              if (cached && typeof cached === 'object' && !cached.invalid && cached.isActive !== false) {
                req.user = { ...cached, id: cached._id || cached.id };
                return next();
              }
              if (cached && cached.invalid) {
                req.user = null;
                return next();
              }
            } catch (_) { /* fall through */ }
          }
          const user = await User.findById(userId).select('-password').lean();
          if (user && user.isActive !== false) {
            if (cacheManager.isConnected) {
              await cacheManager.set(cacheKey, user, AUTH_USER_CACHE_TTL);
            }
            req.user = { ...user, id: user._id };
          } else {
            req.user = null;
          }
        } else {
          req.user = null;
        }
      } catch (error) {
        req.user = null;
      }
    } else {
      req.user = null;
    }
    next();
  } catch (error) {
    req.user = null;
    next();
  }
};

const authenticateToken = authMiddleware;

/** Compatibilité legacy : generateToken(userId) ou generateToken({ id, userId }). */
function generateTokenCompat(payloadOrId) {
  const payload = typeof payloadOrId === 'object' && payloadOrId !== null
    ? payloadOrId
    : { id: payloadOrId, userId: payloadOrId };
  return generateToken(payload);
}

module.exports = {
  generateToken,
  generateTokenCompat,
  generateAccessToken,
  verifyToken,
  getTokenFromRequest,
  generateTwoFactorChallengeToken,
  verifyTwoFactorChallengeToken,
  isMfaExemptApiPath,
  authMiddleware,
  authenticateToken,
  adminMiddleware,
  requireRole,
  optionalAuth,
};



