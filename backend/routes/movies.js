const express = require('express');
const Movie = require('../models/Movie');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { validateMovie, validateObjectId, validatePagination } = require('../middleware/validation');

const router = express.Router();

// Get all movies
router.get('/', optionalAuth, validatePagination, async (req, res) => {
  try {
    const { genre, language, year, isFeatured, isNewRelease, page = 1, limit = 20 } = req.query;
    const filter = { isActive: true };

    if (genre && genre !== 'all') {
      filter.genre = { $in: [genre] };
    }

    if (language) {
      filter.language = language;
    }

    if (year) {
      filter.year = parseInt(year);
    }

    if (isFeatured === 'true') {
      filter.isFeatured = true;
    }

    if (isNewRelease === 'true') {
      filter.isNewRelease = true;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const movies = await Movie.find(filter)
      .sort({ isFeatured: -1, isNewRelease: -1, rating: -1, year: -1 })
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

// Get movie by ID
router.get('/:id', optionalAuth, validateObjectId('id'), async (req, res) => {
  try {
    const movie = await Movie.findById(req.params.id);
    
    if (!movie) {
      return res.status(404).json({
        message: 'Movie not found'
      });
    }

    // Increment view count
    movie.statistics.views += 1;
    await movie.save();

    res.json({ movie });
  } catch (error) {
    console.error('Get movie error:', error);
    res.status(500).json({
      message: 'Failed to get movie',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get movie genres
router.get('/genres/list', (req, res) => {
  const genres = [
    { id: 'action', name: 'Action', icon: '💥' },
    { id: 'comedy', name: 'Comedy', icon: '😂' },
    { id: 'drama', name: 'Drama', icon: '🎭' },
    { id: 'horror', name: 'Horror', icon: '👻' },
    { id: 'romance', name: 'Romance', icon: '💕' },
    { id: 'thriller', name: 'Thriller', icon: '🔪' },
    { id: 'sci-fi', name: 'Sci-Fi', icon: '🚀' },
    { id: 'fantasy', name: 'Fantasy', icon: '🧙' },
    { id: 'documentary', name: 'Documentary', icon: '📽️' },
    { id: 'animation', name: 'Animation', icon: '🎨' },
    { id: 'other', name: 'Other', icon: '🎬' }
  ];

  res.json({ genres });
});

// Search movies
router.get('/search/query', optionalAuth, async (req, res) => {
  try {
    const { q, genre, language, year } = req.query;
    
    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        message: 'Search query must be at least 2 characters long'
      });
    }

    const filter = {
      isActive: true,
      $or: [
        { title: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { director: { $regex: q, $options: 'i' } },
        { 'cast.name': { $regex: q, $options: 'i' } }
      ]
    };

    if (genre && genre !== 'all') {
      filter.genre = { $in: [genre] };
    }

    if (language) {
      filter.language = language;
    }

    if (year) {
      filter.year = parseInt(year);
    }

    const movies = await Movie.find(filter)
      .sort({ rating: -1, year: -1 })
      .limit(20);

    res.json({ movies });
  } catch (error) {
    console.error('Search movies error:', error);
    res.status(500).json({
      message: 'Failed to search movies',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get featured movies
router.get('/featured/now', optionalAuth, async (req, res) => {
  try {
    const featuredMovies = await Movie.find({
      isActive: true,
      isFeatured: true
    }).sort({ rating: -1 }).limit(10);

    res.json({ movies: featuredMovies });
  } catch (error) {
    console.error('Get featured movies error:', error);
    res.status(500).json({
      message: 'Failed to get featured movies',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get new releases
router.get('/new/releases', optionalAuth, async (req, res) => {
  try {
    const newReleases = await Movie.find({
      isActive: true,
      isNewRelease: true
    }).sort({ createdAt: -1 }).limit(10);

    res.json({ movies: newReleases });
  } catch (error) {
    console.error('Get new releases error:', error);
    res.status(500).json({
      message: 'Failed to get new releases',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Rate a movie
router.post('/:id/rate', authenticateToken, async (req, res) => {
  try {
    const { rating } = req.body;
    
    if (!rating || rating < 1 || rating > 10) {
      return res.status(400).json({
        message: 'Rating must be between 1 and 10'
      });
    }

    const movie = await Movie.findById(req.params.id);
    if (!movie) {
      return res.status(404).json({
        message: 'Movie not found'
      });
    }

    // Update movie rating (simplified - in real app, you'd have a separate ratings collection)
    const newRating = (movie.rating + rating) / 2;
    movie.rating = Math.round(newRating * 10) / 10;
    await movie.save();

    res.json({
      message: 'Movie rated successfully',
      rating: movie.rating
    });
  } catch (error) {
    console.error('Rate movie error:', error);
    res.status(500).json({
      message: 'Failed to rate movie',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Admin routes
router.post('/', authenticateToken, requireRole('admin'), validateMovie, async (req, res) => {
  try {
    const movie = new Movie(req.body);
    await movie.save();

    res.status(201).json({
      message: 'Movie created successfully',
      movie
    });
  } catch (error) {
    console.error('Create movie error:', error);
    res.status(500).json({
      message: 'Failed to create movie',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

router.put('/:id', authenticateToken, requireRole('admin'), validateObjectId('id'), validateMovie, async (req, res) => {
  try {
    const movie = await Movie.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!movie) {
      return res.status(404).json({
        message: 'Movie not found'
      });
    }

    res.json({
      message: 'Movie updated successfully',
      movie
    });
  } catch (error) {
    console.error('Update movie error:', error);
    res.status(500).json({
      message: 'Failed to update movie',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

router.delete('/:id', authenticateToken, requireRole('admin'), validateObjectId('id'), async (req, res) => {
  try {
    const movie = await Movie.findByIdAndDelete(req.params.id);

    if (!movie) {
      return res.status(404).json({
        message: 'Movie not found'
      });
    }

    res.json({
      message: 'Movie deleted successfully'
    });
  } catch (error) {
    console.error('Delete movie error:', error);
    res.status(500).json({
      message: 'Failed to delete movie',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;



