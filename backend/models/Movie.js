const mongoose = require('mongoose');

const movieSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Movie title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters'],
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters'],
  },
  genre: {
    type: [String],
    required: [true, 'At least one genre is required'],
    enum: ['action', 'comedy', 'drama', 'horror', 'romance', 'thriller', 'sci-fi', 'fantasy', 'documentary', 'animation', 'other'],
  },
  year: {
    type: Number,
    required: [true, 'Release year is required'],
    min: [1900, 'Year must be after 1900'],
    max: [new Date().getFullYear() + 2, 'Year cannot be more than 2 years in the future'],
  },
  duration: {
    type: Number,
    required: [true, 'Duration is required'],
    min: [1, 'Duration must be at least 1 minute'],
  },
  rating: {
    type: Number,
    min: [0, 'Rating cannot be negative'],
    max: [10, 'Rating cannot exceed 10'],
  },
  imdbRating: {
    type: Number,
    min: [0, 'IMDB rating cannot be negative'],
    max: [10, 'IMDB rating cannot exceed 10'],
  },
  posterUrl: {
    type: String,
    match: [/^https?:\/\/.+/, 'Please enter a valid URL'],
  },
  trailerUrl: {
    type: String,
    match: [/^https?:\/\/.+/, 'Please enter a valid URL'],
  },
  streamUrl: {
    type: String,
    required: [true, 'Stream URL is required'],
    match: [/^https?:\/\/.+/, 'Please enter a valid URL'],
  },
  language: {
    type: String,
    required: [true, 'Language is required'],
    enum: ['fr', 'en', 'it', 'es', 'de', 'other'],
  },
  subtitles: [{
    language: String,
    url: String,
  }],
  ageRating: {
    type: String,
    enum: ['G', 'PG', 'PG-13', 'R', 'NC-17', 'Not Rated'],
    default: 'Not Rated',
  },
  director: {
    type: String,
    trim: true,
    maxlength: [100, 'Director name cannot exceed 100 characters'],
  },
  cast: [{
    name: String,
    character: String,
  }],
  isActive: {
    type: Boolean,
    default: true,
  },
  isFeatured: {
    type: Boolean,
    default: false,
  },
  isNewRelease: {
    type: Boolean,
    default: false,
  },
  categories: [{
    type: String,
    enum: ['trending', 'popular', 'new', 'classic', 'recommended'],
  }],
  statistics: {
    views: { type: Number, default: 0 },
    likes: { type: Number, default: 0 },
    dislikes: { type: Number, default: 0 },
    averageWatchTime: { type: Number, default: 0 },
  },
  metadata: {
    fileSize: Number,
    quality: {
      type: String,
      enum: ['SD', 'HD', 'FHD', '4K'],
      default: 'HD',
    },
    format: {
      type: String,
      enum: ['mp4', 'mkv', 'avi', 'mov'],
      default: 'mp4',
    },
  },
}, {
  timestamps: true,
});

// Indexes
movieSchema.index({ genre: 1, isActive: 1 });
movieSchema.index({ year: -1 });
movieSchema.index({ rating: -1 });
movieSchema.index({ isFeatured: 1, isActive: 1 });
movieSchema.index({ language: 1 });
movieSchema.index({ title: 'text', description: 'text' });

module.exports = mongoose.model('Movie', movieSchema);

