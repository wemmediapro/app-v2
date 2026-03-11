const mongoose = require('mongoose');

const destinationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Destination name is required'],
    trim: true
  },
  country: {
    type: String,
    required: [true, 'Country is required']
  },
  countryCode: {
    type: String,
    required: [true, 'Country code is required'],
    uppercase: true,
    length: [2, 'Country code must be 2 characters']
  },
  type: {
    type: String,
    enum: ['Port', 'Ville', 'Aéroport'],
    default: 'Port'
  },
  description: {
    type: String,
    required: [true, 'Description is required']
  },
  image: {
    type: String,
    required: [true, 'Image URL is required']
  },
  coordinates: {
    lat: {
      type: Number,
      required: true
    },
    lng: {
      type: Number,
      required: true
    }
  },
  facilities: [{
    type: String,
    trim: true
  }],
  routes: [{
    to: String,
    ship: String,
    duration: String,
    frequency: String
  }],
  content: {
    articles: { type: Number, default: 0 },
    movies: { type: Number, default: 0 },
    restaurants: { type: Number, default: 0 },
    shops: { type: Number, default: 0 },
    radio: { type: Number, default: 0 }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // Contenu par langue (name, description). Pour fr ou non fourni : champs principaux ; autres : translations[code]
  translations: { type: mongoose.Schema.Types.Mixed }
}, {
  timestamps: true
});

destinationSchema.index({ country: 1, isActive: 1 });
destinationSchema.index({ countryCode: 1 });
destinationSchema.index({ name: 'text', description: 'text' });

module.exports = mongoose.model('Destination', destinationSchema);

