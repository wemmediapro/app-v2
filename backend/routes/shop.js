const express = require('express');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { validatePagination } = require('../middleware/validation');

const router = express.Router();

// Mock data for shop products
const products = [
  {
    id: '1',
    name: 'Mug GNV Excelsior',
    description: 'Mug en céramique avec logo GNV Excelsior',
    price: 12.90,
    originalPrice: 15.90,
    discount: 19,
    category: 'souvenirs',
    imageUrl: 'https://images.unsplash.com/photo-1514228742587-6b1558fcf93a?w=400&h=400&fit=crop',
    stock: 25,
    isAvailable: true,
    tags: ['souvenir', 'officiel', 'cadeau']
  },
  {
    id: '2',
    name: 'T-shirt GNV',
    description: 'T-shirt en coton bio avec logo GNV',
    price: 24.90,
    originalPrice: 29.90,
    discount: 17,
    category: 'fashion',
    imageUrl: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=400&fit=crop',
    stock: 15,
    isAvailable: true,
    tags: ['vêtement', 'bio', 'logo']
  }
];

// Get all products
router.get('/', optionalAuth, validatePagination, async (req, res) => {
  try {
    const { category, page = 1, limit = 20 } = req.query;
    let filteredProducts = products;

    if (category && category !== 'all') {
      filteredProducts = products.filter(product => product.category === category);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const paginatedProducts = filteredProducts.slice(skip, skip + parseInt(limit));

    res.json({
      products: paginatedProducts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: filteredProducts.length,
        pages: Math.ceil(filteredProducts.length / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({
      message: 'Failed to get products',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get product by ID
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const product = products.find(p => p.id === req.params.id);
    
    if (!product) {
      return res.status(404).json({
        message: 'Product not found'
      });
    }

    res.json({ product });
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({
      message: 'Failed to get product',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get product categories
router.get('/categories/list', (req, res) => {
  const categories = [
    { id: 'souvenirs', name: 'Souvenirs', icon: '🎁' },
    { id: 'fashion', name: 'Mode', icon: '👕' },
    { id: 'dutyfree', name: 'Duty Free', icon: '🍷' },
    { id: 'electronics', name: 'Électronique', icon: '📱' },
    { id: 'food', name: 'Gastronomie', icon: '🍯' }
  ];

  res.json({ categories });
});

// Search products
router.get('/search/query', optionalAuth, async (req, res) => {
  try {
    const { q, category } = req.query;
    
    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        message: 'Search query must be at least 2 characters long'
      });
    }

    let filteredProducts = products.filter(product => 
      product.name.toLowerCase().includes(q.toLowerCase()) ||
      product.description.toLowerCase().includes(q.toLowerCase()) ||
      product.tags.some(tag => tag.toLowerCase().includes(q.toLowerCase()))
    );

    if (category && category !== 'all') {
      filteredProducts = filteredProducts.filter(product => product.category === category);
    }

    res.json({ products: filteredProducts });
  } catch (error) {
    console.error('Search products error:', error);
    res.status(500).json({
      message: 'Failed to search products',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get cart (requires authentication)
router.get('/cart/items', authenticateToken, async (req, res) => {
  try {
    // Mock cart data
    const cart = [
      {
        productId: '1',
        quantity: 2,
        product: products.find(p => p.id === '1')
      }
    ];

    const total = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);

    res.json({
      items: cart,
      total: Math.round(total * 100) / 100,
      itemCount: cart.reduce((sum, item) => sum + item.quantity, 0)
    });
  } catch (error) {
    console.error('Get cart error:', error);
    res.status(500).json({
      message: 'Failed to get cart',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Add item to cart
router.post('/cart/add', authenticateToken, async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;

    if (!productId) {
      return res.status(400).json({
        message: 'Product ID is required'
      });
    }

    const product = products.find(p => p.id === productId);
    if (!product) {
      return res.status(404).json({
        message: 'Product not found'
      });
    }

    if (!product.isAvailable) {
      return res.status(400).json({
        message: 'Product is not available'
      });
    }

    // Mock adding to cart
    res.json({
      message: 'Item added to cart successfully',
      product,
      quantity
    });
  } catch (error) {
    console.error('Add to cart error:', error);
    res.status(500).json({
      message: 'Failed to add item to cart',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Remove item from cart
router.delete('/cart/remove/:productId', authenticateToken, async (req, res) => {
  try {
    const { productId } = req.params;

    // Mock removing from cart
    res.json({
      message: 'Item removed from cart successfully'
    });
  } catch (error) {
    console.error('Remove from cart error:', error);
    res.status(500).json({
      message: 'Failed to remove item from cart',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Create order
router.post('/orders/create', authenticateToken, async (req, res) => {
  try {
    const { items, shippingAddress, paymentMethod } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({
        message: 'Order must contain at least one item'
      });
    }

    // Mock order creation
    const order = {
      id: Date.now().toString(),
      userId: req.user._id,
      items,
      total: items.reduce((sum, item) => sum + (item.price * item.quantity), 0),
      status: 'pending',
      createdAt: new Date(),
      shippingAddress,
      paymentMethod
    };

    res.status(201).json({
      message: 'Order created successfully',
      order
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({
      message: 'Failed to create order',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;



