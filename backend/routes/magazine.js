const express = require('express');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { validatePagination } = require('../middleware/validation');

const router = express.Router();

// Mock data for magazine articles
const articles = [
  {
    id: '1',
    title: 'Découvrez les merveilles de la Méditerranée',
    excerpt: 'Un voyage à travers les plus belles destinations de la Méditerranée...',
    content: 'Contenu complet de l\'article...',
    author: 'Marie Dubois',
    category: 'voyage',
    imageUrl: 'https://images.unsplash.com/photo-1506905925346-14bda5d4c4ad?w=800&h=400&fit=crop',
    publishedAt: new Date('2024-01-15'),
    readTime: 5,
    tags: ['voyage', 'méditerranée', 'découverte']
  },
  {
    id: '2',
    title: 'Les spécialités culinaires à bord',
    excerpt: 'Découvrez les délices gastronomiques préparés par nos chefs...',
    content: 'Contenu complet de l\'article...',
    author: 'Chef Antoine',
    category: 'gastronomie',
    imageUrl: 'https://images.unsplash.com/photo-1551218808-94e220e084d2?w=800&h=400&fit=crop',
    publishedAt: new Date('2024-01-14'),
    readTime: 3,
    tags: ['cuisine', 'gastronomie', 'chef']
  }
];

// Get all articles
router.get('/', optionalAuth, validatePagination, async (req, res) => {
  try {
    const { category, page = 1, limit = 20 } = req.query;
    let filteredArticles = articles;

    if (category && category !== 'all') {
      filteredArticles = articles.filter(article => article.category === category);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const paginatedArticles = filteredArticles.slice(skip, skip + parseInt(limit));

    res.json({
      articles: paginatedArticles,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: filteredArticles.length,
        pages: Math.ceil(filteredArticles.length / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get articles error:', error);
    res.status(500).json({
      message: 'Failed to get articles',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get article by ID
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const article = articles.find(a => a.id === req.params.id);
    
    if (!article) {
      return res.status(404).json({
        message: 'Article not found'
      });
    }

    res.json({ article });
  } catch (error) {
    console.error('Get article error:', error);
    res.status(500).json({
      message: 'Failed to get article',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get categories
router.get('/categories/list', (req, res) => {
  const categories = [
    { id: 'voyage', name: 'Voyage', icon: '✈️' },
    { id: 'gastronomie', name: 'Gastronomie', icon: '🍽️' },
    { id: 'culture', name: 'Culture', icon: '🎭' },
    { id: 'sport', name: 'Sport', icon: '⚽' },
    { id: 'actualites', name: 'Actualités', icon: '📰' }
  ];

  res.json({ categories });
});

module.exports = router;



