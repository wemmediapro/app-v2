const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    select: false
  },
  phone: {
    type: String,
    trim: true,
    match: [/^\+?[\d\s-()]+$/, 'Please enter a valid phone number']
  },
  country: {
    type: String,
    trim: true,
    maxlength: [50, 'Country name cannot exceed 50 characters']
  },
  dateOfBirth: {
    type: Date
  },
  cabinNumber: {
    type: String,
    trim: true
  },
  role: {
    type: String,
    enum: ['passenger', 'crew', 'admin'],
    default: 'passenger'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  /** Accès par module (dashboard, radio, movies, etc.). Si null/absent, utilise les défauts du rôle. */
  allowedModules: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  lastLogin: {
    type: Date
  },
  preferences: {
    language: {
      type: String,
      default: 'fr',
      enum: ['fr', 'en', 'it', 'es']
    },
    notifications: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      sms: { type: Boolean, default: false }
    },
    dietaryRestrictions: [String],
    accessibilityNeeds: [String]
  },
  consents: {
    marketing: { type: Boolean, default: false },
    analytics: { type: Boolean, default: false },
    termsAccepted: { type: Boolean, default: false },
    privacyAccepted: { type: Boolean, default: false }
  },
  avatar: {
    type: String,
    default: null
  },
  /** Favoris et historique de lecture (persistés côté serveur, survivent au vidage du cache). */
  userData: {
    type: mongoose.Schema.Types.Mixed,
    default: () => ({
      favorites: {
        magazineIds: [],
        restaurantIds: [],
        enfantIds: [],
        watchlist: [],
        shopItems: []
      },
      playbackPositions: {}
    })
  }
}, {
  timestamps: true
});

// Index for better performance
userSchema.index({ email: 1 });
userSchema.index({ cabinNumber: 1 });
userSchema.index({ role: 1 });

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Get public profile (without sensitive data)
userSchema.methods.getPublicProfile = function() {
  const userObject = this.toObject();
  delete userObject.password;
  delete userObject.__v;
  return userObject;
};

module.exports = mongoose.model('User', userSchema);

