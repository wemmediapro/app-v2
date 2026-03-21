const express = require('express');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { feedbackValidation } = require('../middleware/validation');
const Feedback = require('../models/Feedback');

const router = express.Router();

// @route   POST /api/feedback
// @desc    Submit feedback
// @access  Private
router.post('/', authMiddleware, feedbackValidation, async (req, res) => {
  try {
    const { type, category, title, description } = req.body;
    const feedback = new Feedback({
      type,
      category,
      title,
      description,
      user: req.user.id,
    });

    await feedback.save();

    res.status(201).json({
      message: 'Feedback submitted successfully',
      feedback,
    });
  } catch (error) {
    console.error('Submit feedback error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/feedback
// @desc    Get user's feedback
// @access  Private
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { status, type, page = 1, limit = 10 } = req.query;

    const query = { user: req.user.id };

    if (status) {query.status = status;}
    if (type) {query.type = type;}

    const feedback = await Feedback.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('assignedTo', 'firstName lastName email');

    const total = await Feedback.countDocuments(query);

    res.json({
      feedback,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    });
  } catch (error) {
    console.error('Get feedback error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/feedback/:id
// @desc    Get single feedback
// @access  Private
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const feedback = await Feedback.findById(req.params.id)
      .populate('user', 'firstName lastName email')
      .populate('assignedTo', 'firstName lastName email');

    if (!feedback) {
      return res.status(404).json({ message: 'Feedback not found' });
    }

    // Check if user owns this feedback or is admin
    if (feedback.user._id.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(feedback);
  } catch (error) {
    console.error('Get feedback error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/feedback/:id
// @desc    Update feedback
// @access  Private
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const feedback = await Feedback.findById(req.params.id);

    if (!feedback) {
      return res.status(404).json({ message: 'Feedback not found' });
    }

    // Check if user owns this feedback
    if (feedback.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Only allow certain fields to be updated by user
    const allowedUpdates = ['title', 'description', 'rating'];
    const updates = {};

    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    const updatedFeedback = await Feedback.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true },
    );

    res.json({
      message: 'Feedback updated successfully',
      feedback: updatedFeedback,
    });
  } catch (error) {
    console.error('Update feedback error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/feedback/admin/all
// @desc    Get all feedback (Admin)
// @access  Private (Admin)
router.get('/admin/all', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { status, priority, type, page = 1, limit = 20 } = req.query;

    const query = {};

    if (status) {query.status = status;}
    if (priority) {query.priority = priority;}
    if (type) {query.type = type;}

    const feedback = await Feedback.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('user', 'firstName lastName email cabinNumber')
      .populate('assignedTo', 'firstName lastName email');

    const total = await Feedback.countDocuments(query);

    res.json({
      feedback,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    });
  } catch (error) {
    console.error('Get all feedback error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/feedback/admin/:id
// @desc    Update feedback status (Admin)
// @access  Private (Admin)
router.put('/admin/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { status, priority, assignedTo, response } = req.body;

    const updates = {};
    if (status) {updates.status = status;}
    if (priority) {updates.priority = priority;}
    if (assignedTo) {updates.assignedTo = assignedTo;}
    if (response) {updates.response = response;}

    const feedback = await Feedback.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true },
    );

    if (!feedback) {
      return res.status(404).json({ message: 'Feedback not found' });
    }

    res.json({
      message: 'Feedback updated successfully',
      feedback,
    });
  } catch (error) {
    console.error('Admin update feedback error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;


