const express = require('express');
const mongoose = require('mongoose');
const { authMiddleware } = require('../middleware/auth');
const User = require('../models/User');
const { safeRegexSearch } = require('../utils/regex-escape');

const router = express.Router();

// @route   GET /api/users
// @desc    Get all users (for messaging)
// @access  Public (Demo mode)
router.get('/', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.json([]);

    const { search } = req.query;
    
    let query = { 
      isActive: true 
    };
    
    if (search) {
      const safe = safeRegexSearch(search);
      if (safe) {
        query.$or = [
          { firstName: { $regex: safe, $options: 'i' } },
          { lastName: { $regex: safe, $options: 'i' } },
          { email: { $regex: safe, $options: 'i' } },
          { cabinNumber: { $regex: safe, $options: 'i' } }
        ];
      }
    }
    
    const users = await User.find(query)
      .select('firstName lastName email cabinNumber avatar')
      .limit(20);
    
    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/users/:id
// @desc    Get user profile
// @access  Public (Demo mode)
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password');
    
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


