const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    // Contenu par langue (fr, en, ar, es, it, de, etc.) — clé = code langue, valeur = { title, message }
    translations: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },
    // Champs legacy : titre et message uniques (si pas de translations, utilisé pour l'app)
    title: { type: String, trim: true },
    message: { type: String, trim: true },
    type: {
      type: String,
      enum: ['restaurant', 'boarding', 'info', 'alert', 'other'],
      default: 'info',
    },
    isActive: { type: Boolean, default: true },
    scheduledAt: { type: Date, default: null },
  },
  { timestamps: true }
);

notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ scheduledAt: 1 });
// GET /api/notifications : { isActive: true, $or scheduledAt } + sort({ createdAt: -1 })
notificationSchema.index({ isActive: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
