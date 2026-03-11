const express = require('express');
const { registerValidation, loginValidation } = require('../middleware/validation');
const { generateToken, generateAccessToken, authMiddleware } = require('../middleware/auth');
const User = require('../models/User');

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
router.post('/login', loginValidation, async (req, res) => {
  try {
    const { email, password } = req.body;
    const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    const adminPassword = process.env.ADMIN_PASSWORD;
    const isProduction = process.env.NODE_ENV === 'production';

    // En production : pas de mot de passe admin par défaut
    if (isProduction && (!adminEmail || !adminPassword)) {
      // Connexion avec identifiants admin non configurés → refus
      const emailMatch = email && email.trim().toLowerCase() === (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
      if (emailMatch) {
        return res.status(503).json({
          message: 'Admin login is not configured. Set ADMIN_EMAIL and ADMIN_PASSWORD in config.env.',
        });
      }
    }

    const effectiveAdminEmail = adminEmail || 'admin@gnv.com';
    const effectiveAdminPassword = isProduction ? adminPassword : (adminPassword || 'Admin123!');

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
        return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
      }
    } else {
      // Check if user is active
      if (!user.isActive) {
        return res.status(401).json({ message: 'Compte désactivé' });
      }

      // Check password (allow env admin password for admin role if set)
      const isPasswordValid = await user.comparePassword(password);
      const envPasswordMatch = (user.role === 'admin' && effectiveAdminPassword && password === effectiveAdminPassword);
      if (!isPasswordValid && !envPasswordMatch) {
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
        userData: user.userData || { favorites: { magazineIds: [], restaurantIds: [], enfantIds: [], watchlist: [], shopItems: [] }, playbackPositions: {} }
      }
    });
  } catch (error) {
    console.error('Login error:', error);
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
    res.json(user);
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



