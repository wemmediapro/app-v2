const express = require('express');
const RadioStation = require('../models/RadioStation');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { validateRadioStation, validateObjectId, validatePagination } = require('../middleware/validation');

const router = express.Router();

// Get all radio stations
router.get('/', optionalAuth, validatePagination, async (req, res) => {
  try {
    const { genre, language, isLive, page = 1, limit = 20 } = req.query;
    const filter = { isActive: true };

    if (genre && genre !== 'all') {
      filter.genre = genre;
    }

    if (language) {
      filter.language = language;
    }

    if (isLive !== undefined) {
      filter.isLive = isLive === 'true';
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const stations = await RadioStation.find(filter)
      .sort({ isLive: -1, currentListeners: -1, name: 1 })
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

// Get radio station by ID
router.get('/:id', optionalAuth, validateObjectId('id'), async (req, res) => {
  try {
    const station = await RadioStation.findById(req.params.id);
    
    if (!station) {
      return res.status(404).json({
        message: 'Radio station not found'
      });
    }

    res.json({ station });
  } catch (error) {
    console.error('Get radio station error:', error);
    res.status(500).json({
      message: 'Failed to get radio station',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get radio station genres
router.get('/genres/list', (req, res) => {
  const genres = [
    { id: 'pop', name: 'Pop', icon: '🎵' },
    { id: 'rock', name: 'Rock', icon: '🎸' },
    { id: 'jazz', name: 'Jazz', icon: '🎷' },
    { id: 'classical', name: 'Classical', icon: '🎼' },
    { id: 'news', name: 'News', icon: '📰' },
    { id: 'talk', name: 'Talk', icon: '💬' },
    { id: 'sports', name: 'Sports', icon: '⚽' },
    { id: 'children', name: 'Children', icon: '🧸' },
    { id: 'other', name: 'Other', icon: '🎶' }
  ];

  res.json({ genres });
});

// Update station listeners count (for real-time updates)
router.patch('/:id/listeners', validateObjectId('id'), async (req, res) => {
  try {
    const { action } = req.body; // 'join' or 'leave'
    
    const station = await RadioStation.findById(req.params.id);
    if (!station) {
      return res.status(404).json({
        message: 'Radio station not found'
      });
    }

    if (action === 'join') {
      station.currentListeners = Math.min(station.currentListeners + 1, station.maxListeners);
    } else if (action === 'leave') {
      station.currentListeners = Math.max(station.currentListeners - 1, 0);
    }

    await station.save();

    res.json({
      message: 'Listeners count updated',
      currentListeners: station.currentListeners
    });
  } catch (error) {
    console.error('Update listeners error:', error);
    res.status(500).json({
      message: 'Failed to update listeners count',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get live stations
router.get('/live/now', optionalAuth, async (req, res) => {
  try {
    const liveStations = await RadioStation.find({
      isActive: true,
      isLive: true
    }).sort({ currentListeners: -1 });

    res.json({ stations: liveStations });
  } catch (error) {
    console.error('Get live stations error:', error);
    res.status(500).json({
      message: 'Failed to get live stations',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Search radio stations
router.get('/search/query', optionalAuth, async (req, res) => {
  try {
    const { q, genre, language } = req.query;
    
    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        message: 'Search query must be at least 2 characters long'
      });
    }

    const filter = {
      isActive: true,
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } }
      ]
    };

    if (genre && genre !== 'all') {
      filter.genre = genre;
    }

    if (language) {
      filter.language = language;
    }

    const stations = await RadioStation.find(filter)
      .sort({ isLive: -1, currentListeners: -1 })
      .limit(20);

    res.json({ stations });
  } catch (error) {
    console.error('Search radio stations error:', error);
    res.status(500).json({
      message: 'Failed to search radio stations',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Admin routes (require authentication and admin role)
router.post('/', authenticateToken, requireRole('admin'), validateRadioStation, async (req, res) => {
  try {
    const station = new RadioStation(req.body);
    await station.save();

    res.status(201).json({
      message: 'Radio station created successfully',
      station
    });
  } catch (error) {
    console.error('Create radio station error:', error);
    res.status(500).json({
      message: 'Failed to create radio station',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

router.put('/:id', authenticateToken, requireRole('admin'), validateObjectId('id'), validateRadioStation, async (req, res) => {
  try {
    const station = await RadioStation.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!station) {
      return res.status(404).json({
        message: 'Radio station not found'
      });
    }

    res.json({
      message: 'Radio station updated successfully',
      station
    });
  } catch (error) {
    console.error('Update radio station error:', error);
    res.status(500).json({
      message: 'Failed to update radio station',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

router.delete('/:id', authenticateToken, requireRole('admin'), validateObjectId('id'), async (req, res) => {
  try {
    const station = await RadioStation.findByIdAndDelete(req.params.id);

    if (!station) {
      return res.status(404).json({
        message: 'Radio station not found'
      });
    }

    res.json({
      message: 'Radio station deleted successfully'
    });
  } catch (error) {
    console.error('Delete radio station error:', error);
    res.status(500).json({
      message: 'Failed to delete radio station',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;



