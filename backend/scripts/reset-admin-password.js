/**
 * Réinitialise le mot de passe de l'admin (admin@gnv.com) vers Admin123!
 * Usage: node scripts/reset-admin-password.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'config.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const User = require('../src/models/User');

const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/gnv_onboard';
const NEW_PASSWORD = process.env.ADMIN_PASSWORD_RESET || 'Admin123!';

async function resetAdminPassword() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connecté à MongoDB');

    const admin = await User.findOne({ email: 'admin@gnv.com' });
    if (!admin) {
      console.log('❌ Aucun utilisateur admin@gnv.com en base.');
      process.exit(1);
      return;
    }

    admin.password = NEW_PASSWORD;
    await admin.save(); // pre('save') hash le mot de passe
    console.log('✅ Mot de passe admin réinitialisé (ne pas logger le secret — voir ADMIN_PASSWORD_RESET / config).');
    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

resetAdminPassword();
