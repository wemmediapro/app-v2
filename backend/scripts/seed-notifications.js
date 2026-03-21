/**
 * Insère des exemples de notifications push GNV (restaurant ouvert, bientôt embarquement).
 * Usage: depuis backend/ : node scripts/seed-notifications.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'config.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const Notification = require('../src/models/Notification');

const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/gnv_onboard';

const EXAMPLES = [
  { title: 'Le restaurant est ouvert', message: 'Le restaurant du pont 6 est ouvert. Bon appétit !', type: 'restaurant' },
  { title: 'Bientôt l\'embarquement', message: 'L\'embarquement commencera dans 30 minutes. Merci de vous présenter à la porte d\'embarquement.', type: 'boarding' },
  { title: 'Information', message: 'Bienvenue à bord. L\'équipe GNV vous souhaite une agréable traversée.', type: 'info' },
];

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connecté à MongoDB');

    const count = await Notification.countDocuments();
    if (count > 0) {
      console.log('ℹ️  Des notifications existent déjà, rien à insérer.');
      process.exit(0);
      return;
    }

    await Notification.insertMany(EXAMPLES);
    console.log('✅', EXAMPLES.length, 'notifications exemples insérées.');
  } catch (err) {
    console.error('❌ Erreur:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seed();
