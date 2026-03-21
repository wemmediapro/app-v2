const mongoose = require('mongoose');

const bannerSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    position: {
      type: String,
      required: [true, 'Position is required'],
      enum: ['home', 'home-top', 'home-middle', 'home-bottom', 'sidebar', 'header', 'footer'],
    },
    order: {
      type: Number,
      default: 0,
    },
    image: {
      type: String,
      required: [true, 'Image URL is required'],
    },
    imageMobile: { type: String },
    imageTablet: { type: String },
    link: {
      type: String,
    },
    startDate: {
      type: Date,
    },
    endDate: {
      type: Date,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    countries: [
      {
        type: String,
      },
    ],
    ships: [
      {
        type: Number, // Ship IDs
      },
    ],
    pages: [
      {
        type: String, // Page identifiers: 'home', 'restaurants', 'shop', etc.
      },
    ],
    clicks: {
      type: Number,
      default: 0,
    },
    impressions: {
      type: Number,
      default: 0,
    },
    translations: { type: mongoose.Schema.Types.Mixed },
  },
  {
    timestamps: true,
  }
);

bannerSchema.index({ position: 1, isActive: 1 });
bannerSchema.index({ startDate: 1, endDate: 1 });
// Liste publique & admin : sort({ order: 1, createdAt: -1 })
bannerSchema.index({ order: 1, createdAt: -1 });

module.exports = mongoose.model('Banner', bannerSchema);
