const jwt = require('jsonwebtoken');

const isProduction = process.env.NODE_ENV === 'production';

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (isProduction && !secret) {
    throw new Error('JWT_SECRET must be set in production');
  }
  return secret || 'dev-secret';
}

/** Récupère le token depuis le cookie httpOnly (dashboard) ou le header Authorization */
function getTokenFromRequest(req) {
  return req.cookies?.adminToken || req.header('Authorization')?.replace('Bearer ', '') || '';
}

const generateToken = (payload) => {
  return jwt.sign(payload, getSecret(), {
    expiresIn: process.env.JWT_EXPIRES_IN || process.env.JWT_EXPIRE || '7d'
  });
};

const generateAccessToken = (payload) => {
  return jwt.sign(payload, getSecret(), {
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m'
  });
};

const verifyToken = (token) => {
  return jwt.verify(token, getSecret());
};

const authMiddleware = async (req, res, next) => {
  try {
    const token = getTokenFromRequest(req);
    if (!token) {
      return res.status(401).json({ message: 'Access denied. No token provided.' });
    }
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
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

const optionalAuth = async (req, res, next) => {
  try {
    const token = getTokenFromRequest(req);
    if (token) {
      try {
        const decoded = verifyToken(token);
        req.user = decoded;
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

module.exports = {
  generateToken,
  generateAccessToken,
  verifyToken,
  getTokenFromRequest,
  authMiddleware,
  authenticateToken,
  adminMiddleware,
  optionalAuth
};



