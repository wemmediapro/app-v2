/**
 * Configuration du serveur local (instance où tourne le backend/dashboard).
 * Un seul document : limite de connexions Socket.io pour ce serveur.
 */
const mongoose = require('mongoose');

const localServerConfigSchema = new mongoose.Schema({
  /** Identifiant unique du document (singleton) */
  id: { type: String, default: 'local', unique: true },
  /** Limite max de connexions simultanées sur ce serveur. null = illimité. */
  maxConnections: { type: Number, min: 0, default: null },
  /** Informations du bateau unique (utilisées dans restaurant, shop, plan du bateau) */
  shipName: { type: String, trim: true, default: '' },
  shipCapacity: { type: Number, min: 0, default: null },
  shipInfo: { type: String, trim: true, default: '' },
  /** ID navire GNV pour Shipmap (ex: 7 = GNV Excellent). Public pour l'app. */
  shipId: { type: Number, min: 1, default: 7 },
  /** Droits d'accès par rôle (dashboard) : { admin: { moduleId: true }, crew: {...}, passenger: {...} } */
  accessByRole: { type: mongoose.Schema.Types.Mixed, default: null }
}, { timestamps: true });

module.exports = mongoose.model('LocalServerConfig', localServerConfigSchema);
