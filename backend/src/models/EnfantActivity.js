const mongoose = require('mongoose');

const enfantActivitySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Activity name is required'],
    trim: true
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: ['Jeux', 'Arts & Créativité', 'Sport', 'Éducation', 'Divertissement', 'Musique', 'Danse', 'Lecture', 'Créatif']
  },
  description: {
    type: String,
    required: [true, 'Description is required']
  },
  ageRange: {
    type: String,
    required: [true, 'Age range is required']
  },
  duration: {
    type: String,
    required: [true, 'Duration is required']
  },
  location: {
    type: String,
    required: [true, 'Location is required']
  },
  capacity: {
    type: String,
    required: [true, 'Capacity is required']
  },
  price: {
    type: Number,
    default: 0,
    min: [0, 'Price cannot be negative']
  },
  schedule: {
    type: String,
    required: [true, 'Schedule is required']
  },
  instructor: {
    type: String
  },
  features: [{
    type: String,
    trim: true
  }],
  imageUrl: {
    type: String
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  countries: [{
    type: String
  }],
  shipId: {
    type: Number
  },
  destination: {
    type: String
  },
  participants: {
    type: Number,
    default: 0
  },
  maxParticipants: {
    type: Number
  },
  translations: { type: mongoose.Schema.Types.Mixed }
}, {
  timestamps: true
});

enfantActivitySchema.index({ category: 1, isActive: 1 });
enfantActivitySchema.index({ ageRange: 1 });

module.exports = mongoose.model('EnfantActivity', enfantActivitySchema);

