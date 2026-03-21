const mongoose = require('mongoose');

const hostingServerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Hosting server name is required'],
      trim: true,
    },
    /** Limite max de connexions simultanées (Socket.io / app passagers) pour ce serveur d'hébergement. */
    maxConnections: {
      type: Number,
      min: [0, 'maxConnections cannot be negative'],
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

hostingServerSchema.index({ name: 1 });

module.exports = mongoose.model('HostingServer', hostingServerSchema);
