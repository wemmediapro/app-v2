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
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, 'Please enter a valid email']
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
    match: [/^[+]?[\d\s\-\(\)]+$/, 'Please enter a valid phone number']
  },
  cabinNumber: {
    type: String,
    trim: true
  },
  country: {
    type: String,
    trim: true,
    maxlength: [100, 'Country name cannot exceed 100 characters']
  },
  dateOfBirth: {
    type: Date
  },
  role: {
    type: String,
    enum: ['passenger', 'crew', 'admin'],
    default: 'passenger'
  },
  preferences: {
    language: {
      type: String,
      enum: ['fr', 'en', 'it', 'es'],
      default: 'fr'
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
  mustChangePassword: {
    type: Boolean,
    default: false
  },
  /** Secret TOTP (base32) — jamais exposé en JSON ; select: false */
  twoFactorSecret: {
    type: String,
    default: null,
    select: false,
  },
  /** Secret en attente de confirmation (POST /2fa/verify) */
  twoFactorPendingSecret: {
    type: String,
    default: null,
    select: false,
  },
  twoFactorEnabled: {
    type: Boolean,
    default: false,
  },
  /** Codes de secours (bcrypt hash chacun) */
  twoFactorBackupCodes: {
    type: [String],
    default: undefined,
    select: false,
  },
  /** Hashes des codes de secours en attente (avant verify) */
  twoFactorPendingBackupHashes: {
    type: [String],
    default: undefined,
    select: false,
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

// Hash password before saving — try/catch pour éviter un crash si bcrypt échoue sous charge
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

// Get full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Remove password from JSON output
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  delete user.twoFactorSecret;
  delete user.twoFactorPendingSecret;
  delete user.twoFactorBackupCodes;
  delete user.twoFactorPendingBackupHashes;
  return user;
};

// Indexes pour performance (queries admin, filtres par cabine/rôle)
userSchema.index({ cabinNumber: 1 });
userSchema.index({ role: 1 });
userSchema.index({ twoFactorEnabled: 1 });

module.exports = mongoose.model('User', userSchema);



