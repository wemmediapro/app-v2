const mongoose = require('mongoose');

const webTVChannelSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Channel name is required'],
      trim: true,
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: [
        'actualites',
        'sport',
        'entertainment',
        'music',
        'kids',
        'documentary',
        'divertissement',
        'enfants',
        'musique',
        'documentaire',
      ],
    },
    description: {
      type: String,
      trim: true,
    },
    streamUrl: {
      type: String,
      required: [true, 'Stream URL is required'],
    },
    logo: {
      type: String,
    },
    imageUrl: {
      type: String,
    },
    isLive: {
      type: Boolean,
      default: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    quality: {
      type: String,
      enum: ['SD', 'HD', 'FHD', '4K'],
      default: 'HD',
    },
    viewers: {
      type: Number,
      default: 0,
      min: 0,
    },
    language: {
      type: String,
      default: 'fr',
      enum: ['fr', 'en', 'it', 'es', 'ar'],
    },
    schedule: [
      {
        time: String,
        program: String,
        description: String,
      },
    ],
    programs: [
      {
        title: String,
        description: String,
        videoFile: String,
        streamUrl: String,
        duration: Number,
        uploadDate: Date,
        category: String,
        startTime: String,
        endTime: String,
        daysOfWeek: [String],
        isRepeating: Boolean,
        isActive: Boolean,
        order: Number,
        tags: [String],
      },
    ],
    countries: [
      {
        type: String,
      },
    ],
    shipId: {
      type: Number,
    },
    destination: {
      type: String,
    },
    statistics: {
      totalViews: { type: Number, default: 0 },
      totalWatchTime: { type: Number, default: 0 },
      averageViewTime: { type: Number, default: 0 },
    },
    translations: { type: mongoose.Schema.Types.Mixed },
  },
  {
    timestamps: true,
  }
);

webTVChannelSchema.index({ category: 1, isActive: 1 });
webTVChannelSchema.index({ isLive: 1 });
webTVChannelSchema.index({ language: 1 });

module.exports = mongoose.model('WebTVChannel', webTVChannelSchema);
