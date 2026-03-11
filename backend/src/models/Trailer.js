const mongoose = require('mongoose');

/**
 * Bande d'annonce (film ou série) : affiche, titre, description multilingue, vidéo par URL.
 */
const trailerSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    trim: true
  },
  poster: {
    type: String,
    trim: true
  },
  videoUrl: {
    type: String,
    trim: true
  },
  type: {
    type: String,
    enum: ['movie', 'series'],
    default: 'movie'
  },
  order: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  translations: { type: mongoose.Schema.Types.Mixed }
}, {
  timestamps: true
});

trailerSchema.index({ type: 1, isActive: 1 });
trailerSchema.index({ order: 1 });

module.exports = mongoose.model('Trailer', trailerSchema);
