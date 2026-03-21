const mongoose = require('mongoose');

const deckSchema = new mongoose.Schema({
  deckNumber: {
    type: String,
    required: [true, 'Deck number is required'],
  },
  name: {
    type: String,
    required: [true, 'Deck name is required'],
  },
  level: {
    type: Number,
    required: [true, 'Deck level is required'],
  },
  facilities: [{
    type: {
      type: String,
      enum: ['restaurant', 'cafe', 'bar', 'shop', 'cinema', 'pool', 'gym', 'spa', 'cabin', 'deck', 'elevator', 'stairs', 'restroom', 'other'],
    },
    name: String,
    coordinates: {
      x: Number,
      y: Number,
    },
    description: String,
  }],
  imageUrl: {
    type: String,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

// Indexes
deckSchema.index({ level: 1 });
deckSchema.index({ deckNumber: 1 }, { unique: true });

module.exports = mongoose.model('Deck', deckSchema);

