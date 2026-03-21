const mongoose = require('mongoose');

const restaurantSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Restaurant name is required'],
    trim: true,
    maxlength: [100, 'Restaurant name cannot exceed 100 characters'],
  },
  type: {
    type: String,
    required: [true, 'Restaurant type is required'],
    enum: ['restaurant', 'cafe', 'bar', 'snack', 'pizzeria', 'steakhouse', 'buffet', 'room-service'],
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: ['french', 'italian', 'international', 'fast-food', 'seafood', 'vegetarian', 'dessert', 'beverage'],
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters'],
  },
  location: {
    deck: {
      type: String,
      required: [true, 'Deck location is required'],
    },
    area: {
      type: String,
      trim: true,
    },
    coordinates: {
      x: Number,
      y: Number,
    },
  },
  rating: {
    type: Number,
    min: [0, 'Rating cannot be negative'],
    max: [5, 'Rating cannot exceed 5'],
    default: 0,
  },
  priceRange: {
    type: String,
    enum: ['€', '€€', '€€€', '€€€€'],
    required: [true, 'Price range is required'],
  },
  imageUrl: {
    type: String,
    match: [/^https?:\/\/.+/, 'Please enter a valid URL'],
  },
  isOpen: {
    type: Boolean,
    default: true,
  },
  openingHours: [{
    day: {
      type: String,
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    },
    openTime: String,
    closeTime: String,
    isClosed: { type: Boolean, default: false },
  }],
  specialties: [String],
  menu: [{
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: [0, 'Price cannot be negative'],
    },
    category: {
      type: String,
      enum: ['appetizer', 'main', 'dessert', 'beverage', 'wine', 'cocktail', 'other'],
    },
    isPopular: {
      type: Boolean,
      default: false,
    },
    isVegetarian: {
      type: Boolean,
      default: false,
    },
    isVegan: {
      type: Boolean,
      default: false,
    },
    allergens: [String],
    imageUrl: String,
    availability: {
      type: String,
      enum: ['available', 'limited', 'unavailable'],
      default: 'available',
    },
  }],
  promotions: [{
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    discount: {
      type: Number,
      min: [0, 'Discount cannot be negative'],
      max: [100, 'Discount cannot exceed 100%'],
    },
    originalPrice: Number,
    discountedPrice: Number,
    validFrom: Date,
    validUntil: Date,
    isActive: {
      type: Boolean,
      default: true,
    },
  }],
  capacity: {
    total: Number,
    available: Number,
  },
  features: [{
    type: String,
    enum: ['wifi', 'outdoor', 'private-dining', 'live-music', 'kids-menu', 'wheelchair-accessible', 'pet-friendly'],
  }],
  contact: {
    phone: String,
    extension: String,
  },
  statistics: {
    totalOrders: { type: Number, default: 0 },
    averageOrderValue: { type: Number, default: 0 },
    customerSatisfaction: { type: Number, default: 0 },
  },
}, {
  timestamps: true,
});

// Indexes
restaurantSchema.index({ type: 1, isOpen: 1 });
restaurantSchema.index({ category: 1 });
restaurantSchema.index({ 'location.deck': 1 });
restaurantSchema.index({ rating: -1 });

module.exports = mongoose.model('Restaurant', restaurantSchema);



