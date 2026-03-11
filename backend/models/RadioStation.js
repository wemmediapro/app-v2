const mongoose = require('mongoose');

const radioStationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Station name is required'],
    trim: true,
    maxlength: [100, 'Station name cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  genre: {
    type: String,
    required: [true, 'Genre is required'],
    enum: ['pop', 'rock', 'jazz', 'classical', 'news', 'talk', 'sports', 'children', 'other']
  },
  streamUrl: {
    type: String,
    required: [true, 'Stream URL is required'],
    match: [/^https?:\/\/.+/, 'Please enter a valid URL']
  },
  imageUrl: {
    type: String,
    match: [/^https?:\/\/.+/, 'Please enter a valid URL']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isLive: {
    type: Boolean,
    default: false
  },
  currentListeners: {
    type: Number,
    default: 0,
    min: [0, 'Listeners count cannot be negative']
  },
  maxListeners: {
    type: Number,
    default: 1000
  },
  quality: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  language: {
    type: String,
    default: 'fr',
    enum: ['fr', 'en', 'it', 'es']
  },
  schedule: [{
    day: {
      type: String,
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    },
    startTime: String,
    endTime: String,
    program: String
  }],
  metadata: {
    currentSong: String,
    artist: String,
    album: String,
    duration: Number,
    lastUpdated: Date
  },
  statistics: {
    totalPlays: { type: Number, default: 0 },
    totalListeners: { type: Number, default: 0 },
    averageListenTime: { type: Number, default: 0 }
  }
}, {
  timestamps: true
});

// Indexes
radioStationSchema.index({ genre: 1, isActive: 1 });
radioStationSchema.index({ isLive: 1 });
radioStationSchema.index({ language: 1 });

module.exports = mongoose.model('RadioStation', radioStationSchema);

