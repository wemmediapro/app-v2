const mongoose = require('mongoose');

const restaurantSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Restaurant name is required'],
      trim: true,
    },
    type: {
      type: String,
      required: [true, 'Restaurant type is required'],
      trim: true,
    },
    category: {
      type: String,
      default: '',
      trim: true,
    },
    location: {
      type: String,
      default: '',
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
    },
    rating: {
      type: Number,
      min: 0,
      max: 5,
      default: 0,
    },
    priceRange: {
      type: String,
      enum: ['€', '€€', '€€€', '€€€€'],
      default: '€€',
    },
    image: {
      type: String,
      default: '',
    },
    isOpen: {
      type: Boolean,
      default: true,
    },
    openingHours: {
      type: String,
      default: '',
    },
    specialties: [
      {
        type: String,
        trim: true,
      },
    ],
    menu: [
      {
        id: Number,
        name: {
          type: String,
          required: true,
        },
        description: {
          type: String,
          default: '',
        },
        price: {
          type: Number,
          required: true,
          min: 0,
        },
        category: {
          type: String,
          required: true,
        },
        isPopular: {
          type: Boolean,
          default: false,
        },
        allergens: [String],
        image: String,
      },
    ],
    promotions: [
      {
        id: Number,
        title: {
          type: String,
          required: true,
        },
        description: {
          type: String,
          required: true,
        },
        price: {
          type: Number,
          required: true,
        },
        originalPrice: {
          type: Number,
          required: true,
        },
        discount: {
          type: Number,
          required: true,
        },
        validUntil: {
          type: Date,
          required: true,
        },
        translations: { type: mongoose.Schema.Types.Mixed },
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
    shipId: { type: String, trim: true },
    shipName: { type: String, trim: true },
    translations: { type: mongoose.Schema.Types.Mixed },
  },
  {
    timestamps: true,
  }
);

// GET /api/restaurants : { isActive: true } [, category] + sort({ name: 1 })
restaurantSchema.index({ isActive: 1, name: 1 });
restaurantSchema.index({ isActive: 1, category: 1, name: 1 });

module.exports = mongoose.model('Restaurant', restaurantSchema);
