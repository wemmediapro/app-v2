const express = require('express');
const mongoose = require('mongoose');
const { authMiddleware } = require('../middleware/auth');
const User = require('../models/User');
const {
  validatePagination,
  validateMongoId,
  sanitizeSearchString,
  handleValidationErrors,
} = require('../middleware/validateInput');

const router = express.Router();

// @route   GET /api/users
// @desc    Get all users (for messaging) — pagination (défaut 20, max 100, page max 10000)
// @access  Private
router.get('/', authMiddleware, validatePagination, handleValidationErrors, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({ data: [], total: 0, page: req.pagination.page, limit: req.pagination.limit });
    }

    const { search } = req.query;
    const { skip, limit, page } = req.pagination;

    const query = { isActive: true };
    if (search) {
      const safe = sanitizeSearchString(search);
      if (safe) {
        query.$or = [
          { firstName: { $regex: safe, $options: 'i' } },
          { lastName: { $regex: safe, $options: 'i' } },
          { email: { $regex: safe, $options: 'i' } },
          { cabinNumber: { $regex: safe, $options: 'i' } },
        ];
      }
    }

    const [data, total] = await Promise.all([
      User.find(query)
        .select('firstName lastName email cabinNumber avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(query),
    ]);

    res.json({ data, total, page, limit });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/users/:id
// @desc    Get user profile
// @access  Private
router.get('/:id', authMiddleware, validateMongoId('id'), handleValidationErrors, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
