/**
 * Vide tous les articles du magazine en base MongoDB.
 * Usage: node scripts/clear-magazine.js (depuis le dossier backend)
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'config.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Article = require('../src/models/Article');

const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/gnv_onboard';

async function clearMagazine() {
  try {
    await mongoose.connect(MONGODB_URI);
    const result = await Article.deleteMany({});
    console.log('✅ Articles du magazine supprimés:', result.deletedCount);
  } catch (err) {
    console.error('❌ Erreur:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

clearMagazine();
