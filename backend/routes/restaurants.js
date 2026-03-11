const express = require('express');
const Restaurant = require('../models/Restaurant');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { validateRestaurant, validateObjectId, validatePagination } = require('../middleware/validation');

const router = express.Router();

// Get all restaurants
router.get('/', optionalAuth, validatePagination, async (req, res) => {
  try {
    const { type, category, deck, isOpen, page = 1, limit = 20 } = req.query;
    const filter = {};

    if (type) {
      filter.type = type;
    }

    if (category) {
      filter.category = category;
    }

    if (deck) {
      filter['location.deck'] = deck;
    }

    if (isOpen !== undefined) {
      filter.isOpen = isOpen === 'true';
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const restaurants = await Restaurant.find(filter)
      .sort({ rating: -1, name: 1 })
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

// Get restaurant by ID
router.get('/:id', optionalAuth, validateObjectId('id'), async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id);
    
    if (!restaurant) {
      return res.status(404).json({
        message: 'Restaurant not found'
      });
    }

    res.json({ restaurant });
  } catch (error) {
    console.error('Get restaurant error:', error);
    res.status(500).json({
      message: 'Failed to get restaurant',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get restaurant categories
router.get('/categories/list', (req, res) => {
  const categories = [
    { id: 'french', name: 'French', icon: '🥖' },
    { id: 'italian', name: 'Italian', icon: '🍝' },
    { id: 'international', name: 'International', icon: '🌍' },
    { id: 'fast-food', name: 'Fast Food', icon: '🍔' },
    { id: 'seafood', name: 'Seafood', icon: '🐟' },
    { id: 'vegetarian', name: 'Vegetarian', icon: '🥗' },
    { id: 'dessert', name: 'Dessert', icon: '🍰' },
    { id: 'beverage', name: 'Beverage', icon: '🥤' }
  ];

  res.json({ categories });
});

// Search restaurants
router.get('/search/query', optionalAuth, async (req, res) => {
  try {
    const { q, type, category, deck } = req.query;
    
    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        message: 'Search query must be at least 2 characters long'
      });
    }

    const filter = {
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { specialties: { $regex: q, $options: 'i' } }
      ]
    };

    if (type) {
      filter.type = type;
    }

    if (category) {
      filter.category = category;
    }

    if (deck) {
      filter['location.deck'] = deck;
    }

    const restaurants = await Restaurant.find(filter)
      .sort({ rating: -1 })
      .limit(20);

    res.json({ restaurants });
  } catch (error) {
    console.error('Search restaurants error:', error);
    res.status(500).json({
      message: 'Failed to search restaurants',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get active promotions
router.get('/promotions/active', optionalAuth, async (req, res) => {
  try {
    const now = new Date();
    const restaurants = await Restaurant.find({
      'promotions.isActive': true,
      'promotions.validFrom': { $lte: now },
      'promotions.validUntil': { $gte: now }
    }).select('name imageUrl promotions');

    const activePromotions = restaurants.flatMap(restaurant => 
      restaurant.promotions
        .filter(promo => promo.isActive && promo.validFrom <= now && promo.validUntil >= now)
        .map(promo => ({
          ...promo.toObject(),
          restaurantName: restaurant.name,
          restaurantImage: restaurant.imageUrl
        }))
    );

    res.json({ promotions: activePromotions });
  } catch (error) {
    console.error('Get promotions error:', error);
    res.status(500).json({
      message: 'Failed to get promotions',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Admin routes
router.post('/', authenticateToken, requireRole('admin'), validateRestaurant, async (req, res) => {
  try {
    const restaurant = new Restaurant(req.body);
    await restaurant.save();

    res.status(201).json({
      message: 'Restaurant created successfully',
      restaurant
    });
  } catch (error) {
    console.error('Create restaurant error:', error);
    res.status(500).json({
      message: 'Failed to create restaurant',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

router.put('/:id', authenticateToken, requireRole('admin'), validateObjectId('id'), validateRestaurant, async (req, res) => {
  try {
    const restaurant = await Restaurant.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!restaurant) {
      return res.status(404).json({
        message: 'Restaurant not found'
      });
    }

    res.json({
      message: 'Restaurant updated successfully',
      restaurant
    });
  } catch (error) {
    console.error('Update restaurant error:', error);
    res.status(500).json({
      message: 'Failed to update restaurant',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

router.delete('/:id', authenticateToken, requireRole('admin'), validateObjectId('id'), async (req, res) => {
  try {
    const restaurant = await Restaurant.findByIdAndDelete(req.params.id);

    if (!restaurant) {
      return res.status(404).json({
        message: 'Restaurant not found'
      });
    }

    res.json({
      message: 'Restaurant deleted successfully'
    });
  } catch (error) {
    console.error('Delete restaurant error:', error);
    res.status(500).json({
      message: 'Failed to delete restaurant',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;



