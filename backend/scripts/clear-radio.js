/**
 * Supprime toutes les stations radio de la base MongoDB.
 * Usage: node scripts/clear-radio.js (depuis le dossier backend)
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'config.env') });
const mongoose = require('mongoose');
const RadioStation = require('../src/models/RadioStation');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gnv_onboard';

async function clearRadio() {
  try {
    await mongoose.connect(MONGODB_URI);
    const deleted = await RadioStation.deleteMany({});
    console.log('✅ Stations radio supprimées:', deleted.deletedCount);
  } catch (err) {
    console.error('❌ Erreur:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

clearRadio();
