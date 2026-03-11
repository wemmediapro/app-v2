const mongoose = require('mongoose');

const adSchema = new mongoose.Schema({
  name: {
    type: String,
    trim: true,
    default: '',
  },
  /** URL du clip pub (MP4 ou HLS). Peut être chemin relatif /uploads/videos/... ou URL externe. */
  videoUrl: {
    type: String,
    required: [true, 'videoUrl is required'],
    trim: true,
  },
  /** preroll = avant la vidéo, midroll = pendant la vidéo */
  type: {
    type: String,
    enum: ['preroll', 'midroll'],
    required: [true, 'type is required'],
  },
  /** Date/heure de début de diffusion (la pub est éligible à partir de ce moment) */
  startDate: {
    type: Date,
    required: [true, 'startDate is required'],
  },
  /** Date/heure de fin de diffusion (la pub n'est plus éligible après) */
  endDate: {
    type: Date,
    required: [true, 'endDate is required'],
  },
  /** Pourcentage de la durée de la vidéo après lequel le bouton "Passer" est disponible (0 = dès le début, 100 = à la fin) */
  skipAfterPercent: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  /** Mid-roll uniquement : à quel % de la durée de la vidéo principale afficher cette pub (ex: 50 = à la moitié) */
  triggerAtPercent: {
    type: Number,
    default: 50,
    min: 0,
    max: 100,
  },
  /** @deprecated Utiliser skipAfterPercent. Conservé pour rétrocompat. */
  skipAfterSeconds: {
    type: Number,
    default: 5,
    min: 0,
  },
  /** Ordre d'affichage quand plusieurs pubs sont éligibles (plus petit = prioritaire) */
  order: {
    type: Number,
    default: 0,
  },
  /** Désactiver sans supprimer */
  active: {
    type: Boolean,
    default: true,
  },
  /** Nombre d'affichages (impressions) de la pub */
  impressions: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
});

adSchema.index({ type: 1, active: 1, startDate: 1, endDate: 1 });
adSchema.index({ startDate: 1, endDate: 1 });

module.exports = mongoose.model('Ad', adSchema);
