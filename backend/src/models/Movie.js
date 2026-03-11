const mongoose = require('mongoose');

const episodeSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  duration: { type: String, trim: true },
  description: { type: String, trim: true },
  videoUrl: { type: String },
  videoFile: { type: String },
  order: { type: Number, default: 0 },
  translations: { type: mongoose.Schema.Types.Mixed }
}, { _id: true });

const movieSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  type: {
    type: String,
    enum: ['movie', 'series'],
    default: 'movie'
  },
  genre: {
    type: String,
    trim: true
  },
  year: {
    type: Number,
    min: 1900,
    max: 2100
  },
  duration: {
    type: String,
    trim: true
  },
  rating: {
    type: Number,
    min: 0,
    max: 5,
    default: 0
  },
  description: {
    type: String,
    trim: true
  },
  poster: {
    type: String
  },
  /** Chemin TMDB (ex: /abc123.jpg) pour construire l'URL affiche : https://image.tmdb.org/t/p/w500 + tmdbPosterPath */
  tmdbPosterPath: {
    type: String,
    trim: true
  },
  videoUrl: {
    type: String
  },
  isPopular: {
    type: Boolean,
    default: false
  },
  countries: [{
    type: String,
    trim: true
  }],
  episodes: [episodeSchema],
  tags: [{
    type: String,
    trim: true
  }],
  shipId: { type: Number },
  destination: { type: String },
  isActive: {
    type: Boolean,
    default: true
  },
  translations: { type: mongoose.Schema.Types.Mixed }
}, {
  timestamps: true
});

movieSchema.index({ type: 1, isActive: 1 });
movieSchema.index({ isActive: 1, createdAt: -1 });
movieSchema.index({ genre: 1 });
movieSchema.index({ isPopular: 1, isActive: 1 });
movieSchema.index({ title: 'text', description: 'text' });

module.exports = mongoose.model('Movie', movieSchema);
