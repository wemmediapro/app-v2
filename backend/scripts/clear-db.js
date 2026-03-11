/**
 * Vide la base de données MongoDB (toutes les collections).
 * Usage: node scripts/clear-db.js
 * (depuis le dossier backend, ou avec NODE_PATH)
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'config.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/gnv_onboard';

async function clearDatabase() {
  try {
    await mongoose.connect(MONGODB_URI);
    const db = mongoose.connection.db;
    const name = db.databaseName;
    await db.dropDatabase();
    console.log('✅ Base de données vidée:', name);
  } catch (err) {
    console.error('❌ Erreur:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

clearDatabase();
