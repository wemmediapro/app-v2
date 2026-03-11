const mongoose = require('mongoose');

const shipmapSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Deck name is required'],
    trim: true
  },
  type: {
    type: String,
    required: [true, 'Deck type is required'],
    enum: ['passenger', 'vehicle', 'cabin', 'service', 'public']
  },
  description: {
    type: String
  },
  area: {
    type: String
  },
  capacity: {
    type: Number,
    default: 0,
    min: [0, 'Capacity cannot be negative']
  },
  shipId: {
    type: Number,
    required: [true, 'Ship ID is required']
  },
  shipName: {
    type: String,
    required: [true, 'Ship name is required']
  },
  // Rétrocompat: stocke string (ancien) ou { name, icon, openingHours }
  services: [mongoose.Schema.Types.Mixed],
  accessPoints: [{
    type: String,
    trim: true
  }],
  facilities: [{
    type: String,
    trim: true
  }],
  zones: [{
    name: String,
    type: String,
    capacity: Number,
    currentOccupancy: Number,
    facilities: [String]
  }],
  cabinTypes: [{
    type: String,
    capacity: Number,
    price: Number,
    amenities: [String]
  }],
  restaurants: [{
    name: String,
    type: String,
    location: String,
    capacity: Number,
    currentOccupancy: Number
  }],
  poolInfo: {
    hasPool: Boolean,
    poolType: String,
    capacity: Number,
    openingHours: String,
    size: String,
    depth: String,
    temperature: String
  },
  isActive: {
    type: Boolean,
    default: true
  },
  nameByLocale: {
    fr: String,
    en: String,
    es: String,
    it: String,
    de: String,
    ar: String
  },
  descriptionByLocale: {
    fr: String,
    en: String,
    es: String,
    it: String,
    de: String,
    ar: String
  }
}, {
  timestamps: true
});

shipmapSchema.index({ shipId: 1, isActive: 1 });
shipmapSchema.index({ type: 1 });

module.exports = mongoose.model('Shipmap', shipmapSchema);

