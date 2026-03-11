const mongoose = require('mongoose');

const enfantActivitySchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Activity title is required'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Description is required']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: ['jeux', 'atelier', 'spectacle', 'sport', 'creatif', 'autre']
  },
  ageRange: {
    min: {
      type: Number,
      required: true,
      min: 0,
      max: 18
    },
    max: {
      type: Number,
      required: true,
      min: 0,
      max: 18
    }
  },
  imageUrl: {
    type: String,
    match: [/^https?:\/\/.+/, 'Please enter a valid URL']
  },
  location: {
    type: String,
    required: [true, 'Location is required']
  },
  duration: {
    type: Number,
    required: [true, 'Duration is required'],
    min: 1
  },
  capacity: {
    type: Number,
    default: 20,
    min: 1
  },
  currentParticipants: {
    type: Number,
    default: 0,
    min: 0
  },
  schedule: {
    day: {
      type: String,
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    },
    startTime: String,
    endTime: String
  },
  isActive: {
    type: Boolean,
    default: true
  },
  supervisor: {
    name: String,
    contact: String
  },
  requirements: [String],
  materials: [String]
}, {
  timestamps: true
});

// Indexes
enfantActivitySchema.index({ category: 1, isActive: 1 });
enfantActivitySchema.index({ ageRange: 1 });
enfantActivitySchema.index({ schedule: 1 });

module.exports = mongoose.model('EnfantActivity', enfantActivitySchema);


