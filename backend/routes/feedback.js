const express = require('express');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Mock data for feedback
const feedbacks = [
  {
    id: '1',
    userId: 'user1',
    type: 'complaint',
    category: 'service',
    title: 'Problème avec le service de chambre',
    description: 'Le service de chambre n\'est pas venu nettoyer ma cabine...',
    status: 'open',
    priority: 'medium',
    createdAt: new Date('2024-01-15T10:30:00Z'),
    updatedAt: new Date('2024-01-15T10:30:00Z')
  }
];

// Submit feedback
router.post('/submit', optionalAuth, async (req, res) => {
  try {
    const { type, category, title, description, priority = 'low' } = req.body;

    if (!type || !category || !title || !description) {
      return res.status(400).json({
        message: 'Type, category, title, and description are required'
      });
    }

    // Mock feedback creation
    const feedback = {
      id: Date.now().toString(),
      userId: req.user ? req.user._id : null,
      type,
      category,
      title,
      description,
      status: 'open',
      priority,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    feedbacks.push(feedback);

    res.status(201).json({
      message: 'Feedback submitted successfully',
      feedback
    });
  } catch (error) {
    console.error('Submit feedback error:', error);
    res.status(500).json({
      message: 'Failed to submit feedback',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get user's feedback (requires authentication)
router.get('/my-feedback', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const userFeedbacks = feedbacks.filter(f => f.userId === userId);

    res.json({ feedbacks: userFeedbacks });
  } catch (error) {
    console.error('Get user feedback error:', error);
    res.status(500).json({
      message: 'Failed to get user feedback',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get feedback categories
router.get('/categories/list', (req, res) => {
  const categories = [
    { id: 'service', name: 'Service', icon: '🛎️' },
    { id: 'food', name: 'Nourriture', icon: '🍽️' },
    { id: 'entertainment', name: 'Divertissement', icon: '🎬' },
    { id: 'technical', name: 'Technique', icon: '🔧' },
    { id: 'other', name: 'Autre', icon: '📝' }
  ];

  res.json({ categories });
});

// Get feedback types
router.get('/types/list', (req, res) => {
  const types = [
    { id: 'complaint', name: 'Réclamation', icon: '😞' },
    { id: 'suggestion', name: 'Suggestion', icon: '💡' },
    { id: 'compliment', name: 'Compliment', icon: '😊' },
    { id: 'question', name: 'Question', icon: '❓' }
  ];

  res.json({ types });
});

module.exports = router;



