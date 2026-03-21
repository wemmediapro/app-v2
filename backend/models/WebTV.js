const mongoose = require('mongoose');

const webTVChannelSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Channel name is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: ['news', 'sports', 'entertainment', 'movies', 'kids', 'documentary', 'other'],
    },
    streamUrl: {
      type: String,
      required: [true, 'Stream URL is required'],
      match: [/^https?:\/\/.+/, 'Please enter a valid URL'],
    },
    imageUrl: {
      type: String,
      match: [/^https?:\/\/.+/, 'Please enter a valid URL'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isLive: {
      type: Boolean,
      default: false,
    },
    language: {
      type: String,
      default: 'fr',
      enum: ['fr', 'en', 'it', 'es', 'ar'],
    },
    quality: {
      type: String,
      enum: ['SD', 'HD', 'FHD', '4K'],
      default: 'HD',
    },
    currentProgram: {
      title: String,
      startTime: Date,
      endTime: Date,
      description: String,
    },
    schedule: [
      {
        day: {
          type: String,
          enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
        },
        programs: [
          {
            title: String,
            startTime: String,
            endTime: String,
            description: String,
          },
        ],
      },
    ],
    statistics: {
      totalViews: { type: Number, default: 0 },
      currentViewers: { type: Number, default: 0 },
      averageWatchTime: { type: Number, default: 0 },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
webTVChannelSchema.index({ category: 1, isActive: 1 });
webTVChannelSchema.index({ isLive: 1 });
webTVChannelSchema.index({ language: 1 });

module.exports = mongoose.model('WebTVChannel', webTVChannelSchema);
