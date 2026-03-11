const mongoose = require('mongoose');

const articleSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  excerpt: {
    type: String,
    required: [true, 'Excerpt is required'],
    maxlength: [500, 'Excerpt cannot exceed 500 characters']
  },
  content: {
    type: String,
    required: [true, 'Content is required']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: ['Actualités', 'Voyage', 'Culture', 'Gastronomie', 'Divertissement', 'Sport', 'Lifestyle']
  },
  author: {
    type: String,
    required: [true, 'Author is required']
  },
  imageUrl: {
    type: String,
    required: [true, 'Image URL is required']
  },
  gallery: [{
    url: String,
    caption: String
  }],
  isPublished: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'scheduled'],
    default: 'draft'
  },
  publishedAt: {
    type: Date
  },
  countries: [{
    type: String
  }],
  tags: [{
    type: String,
    trim: true
  }],
  metaDescription: {
    type: String,
    maxlength: [160, 'Meta description cannot exceed 160 characters']
  },
  metaKeywords: [String],
  featured: {
    type: Boolean,
    default: false
  },
  allowComments: {
    type: Boolean,
    default: true
  },
  readingTime: {
    type: Number,
    default: 0
  },
  views: {
    type: Number,
    default: 0
  },
  likes: {
    type: Number,
    default: 0
  },
  shipId: {
    type: Number
  },
  destination: {
    type: String
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // Contenu multilingue stocké en base uniquement (aucune traduction en ligne).
  // Clés : fr, en, es, it, de, ar. Chaque clé : { title?, excerpt?, content? }.
  // Pour lang=fr (ou non fourni), l'API utilise title/excerpt/content du document ; pour les autres langues, translations[code].
  translations: {
    type: mongoose.Schema.Types.Mixed,
    default: undefined
  }
}, {
  timestamps: true
});

articleSchema.index({ category: 1, isPublished: 1 });
articleSchema.index({ status: 1, publishedAt: -1 });
articleSchema.index({ featured: 1, isPublished: 1 });
articleSchema.index({ tags: 1 });
articleSchema.index({ title: 'text', content: 'text' });

module.exports = mongoose.model('Article', articleSchema);

