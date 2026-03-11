const express = require('express');
const User = require('../models/User');
const RadioStation = require('../models/RadioStation');
const Movie = require('../models/Movie');
const Restaurant = require('../models/Restaurant');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { validatePagination } = require('../middleware/validation');

const router = express.Router();

// All admin routes require authentication and admin role
router.use(authenticateToken);
router.use(requireRole('admin'));

// Dashboard statistics
router.get('/dashboard', async (req, res) => {
  try {
    const [
      totalUsers,
      activeUsers,
      totalStations,
      activeStations,
      totalMovies,
      activeMovies,
      totalRestaurants,
      activeRestaurants,
      recentUsers,
      recentActivity
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isActive: true }),
      RadioStation.countDocuments(),
      RadioStation.countDocuments({ isActive: true }),
      Movie.countDocuments(),
      Movie.countDocuments({ isActive: true }),
      Restaurant.countDocuments(),
      Restaurant.countDocuments({ isActive: true }),
      User.find().sort({ createdAt: -1 }).limit(5).select('firstName lastName email createdAt'),
      // Recent activity would be from logs or activity collection
      []
    ]);

    const stats = {
      users: {
        total: totalUsers,
        active: activeUsers,
        inactive: totalUsers - activeUsers
      },
      radio: {
        total: totalStations,
        active: activeStations,
        inactive: totalStations - activeStations
      },
      movies: {
        total: totalMovies,
        active: activeMovies,
        inactive: totalMovies - activeMovies
      },
      restaurants: {
        total: totalRestaurants,
        active: activeRestaurants,
        inactive: totalRestaurants - activeRestaurants
      }
    };

    res.json({
      stats,
      recentUsers,
      recentActivity
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({
      message: 'Failed to get dashboard statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// User management
router.get('/users', validatePagination, async (req, res) => {
  try {
    const { page = 1, limit = 20, search, role, isActive } = req.query;
    const filter = {};

    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    if (role) {
      filter.role = role;
    }

    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const users = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(filter);

    res.json({
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      message: 'Failed to get users',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Update user status
router.patch('/users/:id/status', async (req, res) => {
  try {
    const { isActive } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        message: 'User not found'
      });
    }

    res.json({
      message: 'User status updated successfully',
      user
    });
  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({
      message: 'Failed to update user status',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Update user role
router.patch('/users/:id/role', async (req, res) => {
  try {
    const { role } = req.body;
    
    if (!['passenger', 'crew', 'admin'].includes(role)) {
      return res.status(400).json({
        message: 'Invalid role'
      });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        message: 'User not found'
      });
    }

    res.json({
      message: 'User role updated successfully',
      user
    });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({
      message: 'Failed to update user role',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Content management - Radio stations
router.get('/content/radio', validatePagination, async (req, res) => {
  try {
    const { page = 1, limit = 20, genre, isActive } = req.query;
    const filter = {};

    if (genre && genre !== 'all') {
      filter.genre = genre;
    }

    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const stations = await RadioStation.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await RadioStation.countDocuments(filter);

    res.json({
      stations,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get radio stations error:', error);
    res.status(500).json({
      message: 'Failed to get radio stations',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Content management - Movies
router.get('/content/movies', validatePagination, async (req, res) => {
  try {
    const { page = 1, limit = 20, genre, isActive } = req.query;
    const filter = {};

    if (genre && genre !== 'all') {
      filter.genre = { $in: [genre] };
    }

    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const movies = await Movie.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Movie.countDocuments(filter);

    res.json({
      movies,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get movies error:', error);
    res.status(500).json({
      message: 'Failed to get movies',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Content management - Restaurants
router.get('/content/restaurants', validatePagination, async (req, res) => {
  try {
    const { page = 1, limit = 20, type, category, isActive } = req.query;
    const filter = {};

    if (type) {
      filter.type = type;
    }

    if (category) {
      filter.category = category;
    }

    if (isActive !== undefined) {
      filter.isOpen = isActive === 'true';
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const restaurants = await Restaurant.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Restaurant.countDocuments(filter);

    res.json({
      restaurants,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get restaurants error:', error);
    res.status(500).json({
      message: 'Failed to get restaurants',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// System settings
router.get('/settings', (req, res) => {
  const settings = {
    app: {
      name: 'GNV OnBoard',
      version: '1.0.0',
      environment: process.env.NODE_ENV
    },
    features: {
      radio: true,
      movies: true,
      restaurants: true,
      messaging: true,
      shop: true,
      feedback: true
    },
    limits: {
      maxFileSize: process.env.MAX_FILE_SIZE || '5242880',
      maxUsers: 10000,
      maxStations: 100,
      maxMovies: 1000,
      maxRestaurants: 50
    }
  };

  res.json({ settings });
});

// Update system settings
router.put('/settings', async (req, res) => {
  try {
    // In a real application, you would save settings to a database
    // For now, we'll just return the updated settings
    const settings = req.body;
    
    res.json({
      message: 'Settings updated successfully',
      settings
    });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({
      message: 'Failed to update settings',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Analytics and reports
router.get('/analytics/overview', async (req, res) => {
  try {
    const { period = '7d' } = req.query;
    
    // This would typically query analytics data
    // For now, we'll return mock data
    const analytics = {
      period,
      users: {
        total: 1250,
        new: 45,
        active: 890,
        retention: 85.2
      },
      content: {
        radioPlays: 15420,
        movieViews: 3240,
        restaurantOrders: 890,
        messagesSent: 2340
      },
      engagement: {
        averageSessionTime: '12m 34s',
        mostPopularStation: 'GNV Hits',
        mostWatchedMovie: 'The Great Adventure',
        mostOrderedRestaurant: 'The Swordfish'
      }
    };

    res.json({ analytics });
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({
      message: 'Failed to get analytics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;



