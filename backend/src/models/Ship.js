const mongoose = require('mongoose');

const shipSchema = new mongoose.Schema({
  slug: {
    type: String,
    trim: true,
    sparse: true,
    unique: true
  },
  name: {
    type: String,
    required: [true, 'Ship name is required'],
    unique: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['Ferry', 'Cruise', 'Cargo'],
    default: 'Ferry'
  },
  capacity: {
    type: Number,
    required: [true, 'Capacity is required'],
    min: [0, 'Capacity cannot be negative']
  },
  capacityVehicles: { type: Number, min: 0 },
  capacityCabins: { type: Number, min: 0 },
  passengers: {
    type: Number,
    default: 0,
    min: [0, 'Passengers cannot be negative']
  },
  crew: {
    type: Number,
    default: 0,
    min: [0, 'Crew cannot be negative']
  },
  length: {
    type: String
  },
  width: {
    type: String
  },
  speed: {
    type: String
  },
  year: {
    type: Number,
    min: [1900, 'Year must be after 1900']
  },
  status: {
    type: String,
    enum: ['En service', 'En maintenance', 'Hors service'],
    default: 'En service'
  },
  route: {
    type: String
  },
  image: {
    type: String
  },
  description: {
    type: String
  },
  facilities: [{
    type: String,
    trim: true
  }],
  decks: [{
    id: Number,
    name: String,
    facilities: [String],
    restaurants: [String]
  }],
  restaurants: [{
    id: Number,
    name: String,
    deck: String,
    type: String,
    capacity: Number,
    openingHours: String,
    cuisine: String,
    image: String
  }],
  technicalInfo: {
    tonnage: String,
    engines: String,
    power: String,
    fuel: String,
    flag: String,
    operator: String
  },
  routes: [{
    from: String,
    to: String,
    duration: String,
    frequency: String
  }],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

shipSchema.index({ name: 1 });
shipSchema.index({ slug: 1 });
shipSchema.index({ status: 1, isActive: 1 });

module.exports = mongoose.model('Ship', shipSchema);

