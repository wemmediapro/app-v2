const express = require('express');
const rateLimit = require('express-rate-limit');
const { registerValidation, loginValidation } = require('../middleware/validation');
const { generateToken, generateAccessToken, authMiddleware } = require('../middleware/auth');
const User = require('../models/User');
const { logFailedLogin, logApiError } = require('../lib/logger');

// Limite : 15 tentatives de login par 15 min par IP (évite 429 en dev tout en limitant le brute-force)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.LOGIN_RATE_LIMIT_MAX, 10) || 15,
  message: { message: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const router = express.Router();

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', registerValidation, async (req, res) => {
  try {
    const { firstName, lastName, email, password, phone, cabinNumber, country, dateOfBirth } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    // Create new user
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

    // Generate token
    const token = generateToken({
      id: user._id,
      email: user.email,
      role: user.role
    });

    res.status(201).json({
      message: 'User registered successfully',
      token,
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

    // Find user by email
    let user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) {
      // Fallback : identifiants admin depuis la config (création de l'admin à la première connexion)
      if (email.trim().toLowerCase() === effectiveAdminEmail && password === effectiveAdminPassword) {
        user = await User.create({
          firstName: 'Admin',
          lastName: 'GNV',
          email: effectiveAdminEmail,
          password: effectiveAdminPassword,
          role: 'admin',
          isActive: true
        });
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

      // Check password (allow env admin password for admin role if set)
      const isPasswordValid = await user.comparePassword(password);
      const envPasswordMatch = (user.role === 'admin' && effectiveAdminPassword && password === effectiveAdminPassword);
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

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 jours
      path: '/',
    };
    res.cookie('adminToken', token, cookieOptions);

    res.json({
      message: 'Login successful',
      token,
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
// @desc    Invalide la session (supprime le cookie adminToken)
// @access  Public
router.post('/logout', (req, res) => {
  res.clearCookie('adminToken', { path: '/', httpOnly: true });
  res.json({ message: 'Logged out successfully' });
});

// @route   POST /api/auth/refresh
// @desc    Renvoie un nouveau token (cookie + body) pour prolonger la session
// @access  Private (token valide requis)
router.post('/refresh', authMiddleware, (req, res) => {
  const newToken = generateToken({
    id: req.user.id,
    email: req.user.email,
    role: req.user.role
  });
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  };
  res.cookie('adminToken', newToken, cookieOptions);
  res.json({ token: newToken, message: 'Token refreshed' });
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
router.put('/profile', authMiddleware, async (req, res) => {
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
    if (favorites !== undefined) {
      user.userData.favorites = {
        magazineIds: Array.isArray(favorites.magazineIds) ? favorites.magazineIds : (user.userData.favorites && user.userData.favorites.magazineIds) || [],
        restaurantIds: Array.isArray(favorites.restaurantIds) ? favorites.restaurantIds : (user.userData.favorites && user.userData.favorites.restaurantIds) || [],
        enfantIds: Array.isArray(favorites.enfantIds) ? favorites.enfantIds : (user.userData.favorites && user.userData.favorites.enfantIds) || [],
        watchlist: Array.isArray(favorites.watchlist) ? favorites.watchlist : (user.userData.favorites && user.userData.favorites.watchlist) || [],
        shopItems: Array.isArray(favorites.shopItems) ? favorites.shopItems : (user.userData.favorites && user.userData.favorites.shopItems) || []
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

module.exports = router;



