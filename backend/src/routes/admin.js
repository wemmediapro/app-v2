const express = require('express');
const mongoose = require('mongoose');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const {
  registerValidation,
  strongPassword,
  adminUserUpdateValidation,
  settingsAccessValidation,
  adminDeleteUserQueryValidation,
} = require('../middleware/validation');
const User = require('../models/User');
const Restaurant = require('../models/Restaurant');
const Message = require('../models/Message');
const Feedback = require('../models/Feedback');
const Article = require('../models/Article');
const cacheManager = require('../lib/cache-manager');
const {
  validatePagination,
  validateMongoId,
  sanitizeSearchString,
  handleValidationErrors,
} = require('../middleware/validateInput');
const WebTVChannel = require('../models/WebTVChannel');
const RadioStation = require('../models/RadioStation');
const Movie = require('../models/Movie');
const EnfantActivity = require('../models/EnfantActivity');
const Product = require('../models/Product');
const LocalServerConfig = require('../models/LocalServerConfig');

const router = express.Router();

// Toutes les routes admin exigent auth + rôle admin
router.use(authMiddleware, adminMiddleware);

/** Formate une taille en octets en chaîne lisible (Ko, Mo, Go) */
function formatBytes(bytes) {
  if (bytes === 0) return '0 o';
  const k = 1024;
  const sizes = ['o', 'Ko', 'Mo', 'Go', 'To'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

// @route   GET /api/admin/databases
// @desc    Liste des bases MongoDB et leur poids (taille disque)
// @access  Private (Admin)
router.get('/databases', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        message: 'MongoDB non connecté',
        databases: [],
        totalSize: 0,
        totalSizeFormatted: '0 o'
      });
    }
    const admin = mongoose.connection.db.admin();
    const { databases: list, totalSize } = await admin.listDatabases();
    const databases = (list || []).map((db) => ({
      name: db.name,
      sizeOnDisk: db.sizeOnDisk || 0,
      sizeFormatted: formatBytes(db.sizeOnDisk || 0)
    })).sort((a, b) => (b.sizeOnDisk || 0) - (a.sizeOnDisk || 0));
    res.json({
      databases,
      totalSize: totalSize || 0,
      totalSizeFormatted: formatBytes(totalSize || 0)
    });
  } catch (error) {
    console.error('List databases error:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des bases', error: error.message });
  }
});

const DASHBOARD_CACHE_KEY = 'admin:dashboard:stats';
const DASHBOARD_CACHE_TTL = 60; // S7 : cache 60s pour éviter 15+ requêtes MongoDB à chaque chargement /dashboard

// @route   GET /api/admin/dashboard
// @desc    Get dashboard statistics
// @access  Private (Admin)
router.get('/dashboard', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({
        statistics: { totalUsers: 0, activeUsers: 0, totalRestaurants: 0, totalMessages: 0, totalFeedback: 0, totalViewers: 0, totalArticles: 0, totalRadioStations: 0, totalMovies: 0, totalActivities: 0, totalProducts: 0 },
        charts: { feedbackByStatus: [], usersByRole: [] },
        recent: { users: [], feedback: [] }
      });
    }

    if (cacheManager.isConnected) {
      const cached = await cacheManager.get(DASHBOARD_CACHE_KEY);
      if (cached) return res.json(cached);
    }

    // Get statistics (toutes les valeurs depuis la base de données)
    const [
      totalUsers,
      activeUsers,
      totalRestaurants,
      totalMessages,
      totalFeedback,
      totalViewersResult,
      totalArticles,
      totalRadioStations,
      totalMovies,
      totalActivities,
      totalProducts,
      recentUsers,
      recentFeedback
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isActive: true }),
      Restaurant.countDocuments({ isActive: true }),
      Message.countDocuments(),
      Feedback.countDocuments(),
      WebTVChannel.aggregate([{ $group: { _id: null, total: { $sum: '$viewers' } } }]),
      typeof Article.countDocuments === 'function' ? Article.countDocuments().catch(() => 0) : Promise.resolve(0),
      RadioStation.countDocuments().catch(() => 0),
      Movie.countDocuments().catch(() => 0),
      EnfantActivity.countDocuments().catch(() => 0),
      Product.countDocuments().catch(() => 0),
      User.find().sort({ createdAt: -1 }).limit(5).select('firstName lastName email createdAt'),
      Feedback.find().sort({ createdAt: -1 }).limit(5).populate('user', 'firstName lastName email')
    ]);

    const totalViewers = (totalViewersResult && totalViewersResult[0] && totalViewersResult[0].total) || 0;

    // Get feedback by status
    const feedbackByStatus = await Feedback.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get users by role
    const usersByRole = await User.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 }
        }
      }
    ]);

    const payload = {
      statistics: {
        totalUsers,
        activeUsers,
        totalRestaurants,
        totalMessages,
        totalFeedback,
        totalViewers,
        totalArticles: totalArticles ?? 0,
        totalRadioStations: totalRadioStations ?? 0,
        totalMovies: totalMovies ?? 0,
        totalActivities: totalActivities ?? 0,
        totalProducts: totalProducts ?? 0
      },
      charts: {
        feedbackByStatus,
        usersByRole
      },
      recent: {
        users: recentUsers,
        feedback: recentFeedback
      }
    };
    if (cacheManager.isConnected) await cacheManager.set(DASHBOARD_CACHE_KEY, payload, DASHBOARD_CACHE_TTL);
    res.json(payload);
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/admin/users
// @desc    Get all users
// @access  Private (Admin)
router.get('/users', validatePagination, handleValidationErrors, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({ users: [], totalPages: 0, currentPage: 1, total: 0 });
    }

    const { page, limit, skip } = req.pagination;
    const { search, role, status } = req.query;

    let query = {};

    if (search) {
      const safe = sanitizeSearchString(search);
      if (safe) {
        query.$or = [
          { firstName: { $regex: safe, $options: 'i' } },
          { lastName: { $regex: safe, $options: 'i' } },
          { email: { $regex: safe, $options: 'i' } },
          { cabinNumber: { $regex: safe, $options: 'i' } }
        ];
      }
    }

    if (role) query.role = role;
    if (status !== undefined) query.isActive = status === 'active';

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);

    const total = await User.countDocuments(query);

    res.json({
      users,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/admin/users
// @desc    Create a new user (admin only)
// @access  Private (Admin)
router.post('/users', registerValidation, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: 'Database unavailable' });
    }

    const { firstName, lastName, email, password, phone, cabinNumber, role } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Un utilisateur existe déjà avec cet email' });
    }

    const userRole = role && ['passenger', 'crew', 'admin'].includes(role) ? role : 'passenger';

    const user = new User({
      firstName,
      lastName,
      email,
      password,
      phone: phone || undefined,
      cabinNumber: cabinNumber || undefined,
      role: userRole
    });

    await user.save();

    res.status(201).json({
      message: 'Utilisateur créé avec succès',
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        cabinNumber: user.cabinNumber,
        isActive: user.isActive
      }
    });
  } catch (error) {
    console.error('Create user error:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/admin/users/:id
// @desc    Update user
// @access  Private (Admin)
router.put('/users/:id', validateMongoId('id'), ...adminUserUpdateValidation, async (req, res) => {
  try {
    const { firstName, lastName, email, phone, cabinNumber, password, role, isActive, allowedModules } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (email !== undefined) {
      const normalized = email.trim().toLowerCase();
      const existing = await User.findOne({ email: normalized });
      if (existing && existing._id.toString() !== req.params.id) {
        return res.status(400).json({ message: 'Un utilisateur existe déjà avec cet email' });
      }
      user.email = normalized;
    }
    if (firstName !== undefined) user.firstName = firstName;
    if (lastName !== undefined) user.lastName = lastName;
    if (phone !== undefined) user.phone = phone;
    if (cabinNumber !== undefined) user.cabinNumber = cabinNumber;
    if (role && ['passenger', 'crew', 'admin'].includes(role)) user.role = role;
    if (isActive !== undefined) user.isActive = !!isActive;
    if (password && String(password).length >= 8) {
      const effectiveRole = role || user.role;
      if (effectiveRole === 'admin' && !strongPassword(password)) {
        return res.status(400).json({
          message: 'Le mot de passe admin doit contenir au moins 8 caractères, une majuscule, une minuscule, un chiffre et un symbole.',
        });
      }
      user.password = password;
    }
    if (allowedModules !== undefined) user.allowedModules = allowedModules && typeof allowedModules === 'object' ? allowedModules : null;

    await user.save();

    const updated = await User.findById(user._id).select('-password');
    res.json({
      message: 'User updated successfully',
      user: updated
    });
  } catch (error) {
    console.error('Update user error:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/admin/users/:id
// @desc    Deactivate user (soft) or delete permanently (hard=true)
// @access  Private (Admin)
router.delete('/users/:id', validateMongoId('id'), ...adminDeleteUserQueryValidation, async (req, res) => {
  try {
    const hard = req.query.hard === 'true' || req.query.hard === '1';
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (hard) {
      await User.findByIdAndDelete(req.params.id);
      return res.json({ message: 'User deleted permanently' });
    }

    user.isActive = false;
    await user.save();
    res.json({ message: 'User deactivated successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/admin/conversations/unread-count
// @desc    Nombre de messages non lus reçus par l'admin (pour le point rouge sur la cloche)
// @access  Private (Admin)
router.get('/conversations/unread-count', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({ count: 0 });
    }
    const count = await Message.countDocuments({
      receiver: req.user._id,
      isRead: false
    });
    res.json({ count });
  } catch (error) {
    console.error('Unread count error:', error);
    res.status(500).json({ count: 0 });
  }
});

// @route   GET /api/admin/conversations
// @desc    Get all conversations (Admin), pagination via req.pagination (max limit 100, page max 10000)
// @access  Private (Admin)
router.get('/conversations', validatePagination, handleValidationErrors, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json([]);
    }
    const { skip, limit } = req.pagination;
    const messages = await Message.find().sort({ createdAt: -1 }).limit(500)
      .populate('sender', 'firstName lastName email avatar cabinNumber')
      .populate('receiver', 'firstName lastName email avatar cabinNumber');
    const seen = new Set();
    const conversations = [];
    const adminId = req.user?._id?.toString();
    for (const m of messages) {
      const key = [m.sender?._id, m.receiver?._id].sort().join('-');
      if (!seen.has(key)) {
        seen.add(key);
        conversations.push({
          _id: m._id,
          user: m.sender?._id?.toString() === adminId ? m.receiver : m.sender,
          lastMessage: { content: m.content, createdAt: m.createdAt, isRead: m.isRead },
          unreadCount: 0
        });
      }
    }
    const pageSlice = conversations.slice(skip, skip + limit);
    res.json(pageSlice);
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/admin/cache/clear
// @desc    Vide le cache serveur (Redis si connecté)
// @access  Private (Admin)
router.post('/cache/clear', async (req, res) => {
  try {
    const redisCleared = await cacheManager.flush();
    res.json({
      message: 'Cache vidé',
      redis: redisCleared
    });
  } catch (error) {
    console.error('Cache clear error:', error);
    res.status(500).json({ message: 'Erreur lors du vidage du cache' });
  }
});

// GET /api/admin/settings/access — Droits d'accès par rôle (admin, crew, passenger)
router.get('/settings/access', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Base de données indisponible' });
    }
    const config = await LocalServerConfig.findOne({ id: 'local' }).lean();
    const access = config?.accessByRole || null;
    res.json({ success: true, data: access });
  } catch (error) {
    console.error('GET settings/access error:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la récupération des droits' });
  }
});

// PUT /api/admin/settings/access — Enregistrer les droits par rôle en base. Corps : { admin: {...}, crew: {...}, passenger: {...} }
router.put('/settings/access', ...settingsAccessValidation, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Base de données indisponible' });
    }
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const { admin, crew, passenger } = body;
    const accessByRole = {
      ...(admin != null && typeof admin === 'object' ? { admin } : {}),
      ...(crew != null && typeof crew === 'object' ? { crew } : {}),
      ...(passenger != null && typeof passenger === 'object' ? { passenger } : {})
    };
    if (Object.keys(accessByRole).length === 0) {
      return res.status(400).json({ success: false, message: 'Corps invalide : fournir admin, crew et/ou passenger (objets)' });
    }
    const config = await LocalServerConfig.findOne({ id: 'local' }).lean();
    const merged = { ...(config?.accessByRole || {}), ...accessByRole };
    await LocalServerConfig.findOneAndUpdate(
      { id: 'local' },
      { $set: { accessByRole: merged } },
      { new: true, upsert: true }
    );
    res.json({ success: true, message: 'Droits enregistrés' });
  } catch (error) {
    console.error('PUT settings/access error:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de l\'enregistrement des droits' });
  }
});

module.exports = router;


