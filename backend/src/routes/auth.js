const express = require('express');
const bcrypt = require('bcryptjs');
const { registerValidation, loginValidation, profileValidation } = require('../middleware/validation');
const { generateToken, generateAccessToken, verifyToken, authMiddleware, adminMiddleware } = require('../middleware/auth');
const User = require('../models/User');
const cacheManager = require('../lib/cache-manager');
const { logFailedLogin, logApiError } = require('../lib/logger');
const { createRedisStore, createLimiter } = require('../lib/rateLimitRedisStore');

// [SEC-1/PERF-1] Hash bcrypt admin pré-calculé une fois au premier login (évite bcrypt.hash à chaque requête)
let cachedAdminPasswordHash = null;
async function getAdminPasswordHash(adminPassword) {
  if (!adminPassword) return null;
  if (cachedAdminPasswordHash !== null) return cachedAdminPasswordHash;
  cachedAdminPasswordHash = await bcrypt.hash(adminPassword, 12);
  return cachedAdminPasswordHash;
}

const LOGIN_WINDOW_MS = 15 * 60 * 1000;

// Limite : 5 tentatives de login par 15 min par IP (brute-force protection, configurable via LOGIN_RATE_LIMIT_MAX)
const defaultLoginLimiter = createLimiter(null, {
  windowMs: LOGIN_WINDOW_MS,
  max: parseInt(process.env.LOGIN_RATE_LIMIT_MAX, 10) || 5,
  message: { message: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.' },
});

const defaultRegisterLimiter = createLimiter(null, {
  windowMs: LOGIN_WINDOW_MS,
  max: 10,
  message: { message: 'Trop de tentatives d\'inscription. Réessayez dans 15 minutes.' },
});

/**
 * Construit le routeur auth avec les limiters fournis (Redis-backed si stores passés).
 * @param {import('express-rate-limit').RateLimitRequestHandler} loginLimiter
 * @param {import('express-rate-limit').RateLimitRequestHandler} registerLimiter
 * @returns {express.Router}
 */
function createRouterWithLimiters(loginLimiter, registerLimiter) {
  const router = express.Router();

/** Option secure du cookie : true seulement si la requête arrive en HTTPS (évite 401 sur dashboard en HTTP). */
function isSecureRequest(req) {
  const proto = req.get('X-Forwarded-Proto');
  if (proto === 'https') return true;
  if (proto === 'http') return false;
  return !!req.secure;
}

function getCookieOptions(req) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' ? isSecureRequest(req) : false,
    sameSite: 'lax', // 'lax' pour éviter déconnexion auto (strict bloquait l'envoi du cookie après login)
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  };
}

// @route   POST /api/auth/register
// @desc    Register a new user (admin only)
// @access  Private (admin)
  router.post('/register', authMiddleware, adminMiddleware, registerLimiter, registerValidation, async (req, res) => {
  try {
    const { firstName, lastName, email, password, phone, cabinNumber, country, dateOfBirth } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    // C3 : new User() + save() → mot de passe hashé par le hook pre('save') du modèle User (bcrypt).
    const user = new User({
      firstName,
      lastName,
      email,
      password,
      phone,
      cabinNumber,
      country: country || undefined,
      dateOfBirth: dateOfBirth || undefined
    });

    await user.save();

    // [SEC-4] JWT uniquement dans le cookie httpOnly, pas dans le body
    const token = generateToken({
      id: user._id,
      email: user.email,
      role: user.role
    });
    res.cookie('authToken', token, getCookieOptions(req));

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        cabinNumber: user.cabinNumber,
        country: user.country,
        dateOfBirth: user.dateOfBirth,
        phone: user.phone,
        userData: user.userData || { favorites: { magazineIds: [], restaurantIds: [], enfantIds: [], watchlist: [], shopItems: [] }, playbackPositions: {} }
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
  router.post('/login', loginLimiter, loginValidation, async (req, res) => {
  try {
    const { email, password } = req.body;
    const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    const adminPassword = process.env.ADMIN_PASSWORD;
    const isProduction = process.env.NODE_ENV === 'production';

    // Aucun fallback sur identifiants admin : exiger ADMIN_EMAIL et ADMIN_PASSWORD (prod et dev)
    if (!adminEmail || !adminPassword) {
      const emailMatch = email && email.trim().toLowerCase() === adminEmail;
      if (emailMatch || !adminEmail) {
        return res.status(503).json({
          message: 'Admin login is not configured. Set ADMIN_EMAIL and ADMIN_PASSWORD in config.env (no default credentials).',
        });
      }
    }

    const effectiveAdminEmail = adminEmail;
    const effectiveAdminPassword = adminPassword;
    // P3 : jamais de comparaison en clair — hash bcrypt pré-calculé (SEC-1/PERF-1)
    const adminPasswordHash = await getAdminPasswordHash(effectiveAdminPassword);

    // Find user by email (inclure le password pour comparePassword, car select: false sur le schéma)
    let user = await User.findOne({ email: email.trim().toLowerCase() }).select('+password');
    if (!user) {
      // C3 / P2 : auto-création admin — comparaison uniquement via bcrypt.compare (jamais === en clair).
      // User créé avec mot de passe en clair puis save() → pre('save') bcrypt du modèle hash avant persistance.
      const envPasswordMatches = adminPasswordHash && await bcrypt.compare(password, adminPasswordHash);
      if (email.trim().toLowerCase() === effectiveAdminEmail && envPasswordMatches) {
        const adminUser = new User({
          firstName: 'Admin',
          lastName: 'GNV',
          email: effectiveAdminEmail,
          password: effectiveAdminPassword,
          role: 'admin',
          isActive: true
        });
        await adminUser.save();
        user = adminUser;
      } else {
        logFailedLogin(email, 'user_not_found', req);
        return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
      }
    } else {
      // Check if user is active
      if (!user.isActive) {
        logFailedLogin(email, 'account_deactivated', req);
        return res.status(401).json({ message: 'Compte désactivé' });
      }

      // C3 / P3 : comparaison toujours via bcrypt.compare / user.comparePassword, jamais timing ou === en clair.
      const isPasswordValid = await user.comparePassword(password);
      const envPasswordMatch = (user.role === 'admin' && adminPasswordHash && await bcrypt.compare(password, adminPasswordHash));
      if (!isPasswordValid && !envPasswordMatch) {
        logFailedLogin(email, 'invalid_password', req);
        return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
      }
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate token
    const token = generateToken({
      id: user._id,
      email: user.email,
      role: user.role
    });

    res.cookie('authToken', token, getCookieOptions(req));

    // [SEC-4] JWT uniquement dans le cookie, pas dans le body
    res.json({
      message: 'Login successful',
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        phone: user.phone,
        cabinNumber: user.cabinNumber,
        country: user.country,
        dateOfBirth: user.dateOfBirth,
        preferences: user.preferences,
        allowedModules: user.allowedModules,
        mustChangePassword: !!user.mustChangePassword,
        userData: user.userData || { favorites: { magazineIds: [], restaurantIds: [], enfantIds: [], watchlist: [], shopItems: [] }, playbackPositions: {} }
      }
    });
  } catch (error) {
    logApiError('Login error', { err: error.message, email: req.body?.email });
    res.status(500).json({ message: 'Server error during login' });
  }
});

// @route   POST /api/auth/logout
// @desc    Invalide la session (supprime le cookie authToken, blacklist JWT)
// @access  Public
  router.post('/logout', async (req, res) => {
  const token = req.cookies?.authToken || req.header('Authorization')?.replace('Bearer ', '');
  if (token && cacheManager.isConnected) {
    try {
      const decoded = verifyToken(token);
      const ttl = decoded.exp ? decoded.exp - Math.floor(Date.now() / 1000) : 7 * 24 * 60 * 60;
      if (ttl > 0) {
        await cacheManager.set(`blacklist:${token}`, '1', ttl);
      }
    } catch (e) {
      // Token invalide ou expiré, pas besoin de blacklister
    }
  }
  res.clearCookie('authToken', { path: '/', httpOnly: true });
  res.json({ message: 'Logged out successfully' });
});

// @route   POST /api/auth/refresh
// @desc    Renvoie un nouveau token dans le cookie httpOnly pour prolonger la session
// @access  Private (token valide requis)
// [SEC-4] JWT uniquement dans le cookie, pas dans le body
  router.post('/refresh', authMiddleware, (req, res) => {
  const newToken = generateToken({
    id: req.user.id,
    email: req.user.email,
    role: req.user.role
  });
  res.cookie('authToken', newToken, getCookieOptions(req));
  res.json({ message: 'Token refreshed' });
});

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
  router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    const json = user.toObject ? user.toObject() : user;
    json.mustChangePassword = !!user.mustChangePassword;
    res.json(json);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/auth/profile
// @desc    Update user profile
// @access  Private
// [Q1] Validation des champs (longueurs, format téléphone, date ISO, etc.)
  router.put('/profile', authMiddleware, profileValidation, async (req, res) => {
  try {
    const { firstName, lastName, phone, cabinNumber, country, dateOfBirth, preferences } = req.body;
    
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update fields (email cannot be changed)
    if (firstName !== undefined) user.firstName = firstName;
    if (lastName !== undefined) user.lastName = lastName;
    if (phone !== undefined) user.phone = phone;
    if (cabinNumber !== undefined) user.cabinNumber = cabinNumber;
    if (country !== undefined) user.country = country;
    if (dateOfBirth !== undefined) user.dateOfBirth = dateOfBirth;
    if (preferences) user.preferences = { ...user.preferences, ...preferences };

    await user.save();

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        cabinNumber: user.cabinNumber,
        country: user.country,
        dateOfBirth: user.dateOfBirth,
        preferences: user.preferences
      }
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ message: 'Server error during profile update' });
  }
});

// @route   PUT /api/auth/change-password
// @desc    Change user password (current + new)
// @access  Private
  router.put('/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Mot de passe actuel et nouveau mot de passe requis' });
    }
    if (String(newPassword).trim().length < 8) {
      return res.status(400).json({ message: 'Le nouveau mot de passe doit contenir au moins 8 caractères' });
    }
    const user = await User.findById(req.user.id).select('+password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    const isValid = await user.comparePassword(currentPassword);
    if (!isValid) {
      return res.status(400).json({ message: 'Mot de passe actuel incorrect' });
    }
    user.password = newPassword.trim();
    user.mustChangePassword = false;
    await user.save();
    res.json({ message: 'Mot de passe modifié avec succès' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Erreur lors du changement de mot de passe' });
  }
});

// @route   GET /api/auth/user-data
// @desc    Get user favorites and playback positions (for sync after login / cache clear)
// @access  Private
  router.get('/user-data', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('userData').lean();
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    const data = user.userData || {};
    const favorites = data.favorites || {
      magazineIds: [], restaurantIds: [], enfantIds: [], watchlist: [], shopItems: []
    };
    const playbackPositions = data.playbackPositions || {};
    res.json({ favorites, playbackPositions });
  } catch (error) {
    console.error('Get user-data error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/auth/user-data
// @desc    Save user favorites and/or playback positions
// @access  Private
  router.put('/user-data', authMiddleware, async (req, res) => {
  try {
    const { favorites, playbackPositions } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (!user.userData || typeof user.userData !== 'object') {
      user.userData = {};
    }
    // [Q2] Limiter chaque tableau de favoris à 500 éléments max
    const FAVORITES_MAX = 500;
    const cap = (arr) => (Array.isArray(arr) ? arr.slice(0, FAVORITES_MAX) : []);
    if (favorites !== undefined) {
      const prev = user.userData.favorites || {};
      user.userData.favorites = {
        magazineIds: cap(Array.isArray(favorites.magazineIds) ? favorites.magazineIds : prev.magazineIds),
        restaurantIds: cap(Array.isArray(favorites.restaurantIds) ? favorites.restaurantIds : prev.restaurantIds),
        enfantIds: cap(Array.isArray(favorites.enfantIds) ? favorites.enfantIds : prev.enfantIds),
        watchlist: cap(Array.isArray(favorites.watchlist) ? favorites.watchlist : prev.watchlist),
        shopItems: cap(Array.isArray(favorites.shopItems) ? favorites.shopItems : prev.shopItems)
      };
    }
    if (playbackPositions !== undefined && typeof playbackPositions === 'object' && playbackPositions !== null) {
      user.userData.playbackPositions = playbackPositions;
    }
    user.markModified('userData');
    await user.save();
    res.json({
      message: 'User data saved',
      favorites: user.userData.favorites,
      playbackPositions: user.userData.playbackPositions
    });
  } catch (error) {
    console.error('Put user-data error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

  return router;
}

/** Crée le routeur auth avec limiters Redis quand redisUri est configuré (après DB/Redis ready). */
async function createAuthRouter(redisUri) {
  let loginStore = null;
  let registerStore = null;
  if (redisUri) {
    loginStore = await createRedisStore(redisUri, 'rl:login:');
    if (loginStore) loginStore.init({ windowMs: LOGIN_WINDOW_MS });
    registerStore = await createRedisStore(redisUri, 'rl:register:');
    if (registerStore) registerStore.init({ windowMs: LOGIN_WINDOW_MS });
  }
  const loginLimiter = createLimiter(loginStore, {
    windowMs: LOGIN_WINDOW_MS,
    max: parseInt(process.env.LOGIN_RATE_LIMIT_MAX, 10) || 5,
    message: { message: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.' },
  });
  const registerLimiter = createLimiter(registerStore, {
    windowMs: LOGIN_WINDOW_MS,
    max: 10,
    message: { message: 'Trop de tentatives d\'inscription. Réessayez dans 15 minutes.' },
  });
  return createRouterWithLimiters(loginLimiter, registerLimiter);
}

module.exports = createRouterWithLimiters(defaultLoginLimiter, defaultRegisterLimiter);
module.exports.createAuthRouter = createAuthRouter;



