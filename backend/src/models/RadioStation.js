const mongoose = require('mongoose');

const radioStationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Station name is required'],
      trim: true,
    },
    frequency: {
      type: String,
      trim: true,
    },
    genre: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    streamUrl: {
      type: String,
    },
    /** Pour diffusion 100% offline : id de la playlist locale (localStorage) */
    playlistId: {
      type: String,
      trim: true,
    },
    isLive: {
      type: Boolean,
      default: true,
    },
    currentSong: {
      type: String,
      trim: true,
    },
    listeners: {
      type: Number,
      default: 0,
      min: 0,
    },
    logo: {
      type: String,
    },
    countries: [
      {
        type: String,
        trim: true,
      },
    ],
    shipId: { type: Number },
    destination: { type: String },
    isActive: {
      type: Boolean,
      default: true,
    },
    // Programmation (même principe que WebTV) : nom, heure début/fin, ordre, description, upload MP3 direct
    programs: [
      {
        id: { type: String, trim: true },
        title: { type: String, trim: true },
        description: { type: String, trim: true },
        artist: { type: String, trim: true },
        streamUrl: { type: String },
        duration: { type: Number, default: 0 },
        order: { type: Number, default: 0 },
        type: { type: String, enum: ['music', 'ad', 'jingle', 'program'], default: 'music' },
        isActive: { type: Boolean, default: true },
        libraryId: { type: String, trim: true },
        // Planification horaire (comme WebTV)
        startTime: { type: String, trim: true },
        endTime: { type: String, trim: true },
        daysOfWeek: [{ type: String }],
        isRepeating: { type: Boolean, default: false },
        fileName: { type: String, trim: true },
      },
    ],
    // Ancien format (conservé pour compat)
    translations: { type: mongoose.Schema.Types.Mixed },
    schedule: [
      {
        title: { type: String, trim: true },
        description: { type: String, trim: true },
        startTime: { type: String, trim: true },
        endTime: { type: String, trim: true },
        duration: { type: Number, default: 0 },
        type: { type: String, enum: ['music', 'ad', 'jingle', 'program'], default: 'program' },
        streamUrl: { type: String },
        isActive: { type: Boolean, default: true },
        daysOfWeek: [{ type: String }],
        order: { type: Number, default: 0 },
      },
    ],
  },
  {
    timestamps: true,
  }
);

radioStationSchema.index({ genre: 1, isActive: 1 });
radioStationSchema.index({ isActive: 1, createdAt: -1 });
radioStationSchema.index({ isLive: 1 });
radioStationSchema.index({ name: 'text', description: 'text' });

module.exports = mongoose.model('RadioStation', radioStationSchema);
