/**
 * Crée un utilisateur admin par défaut pour le dashboard.
 * Usage: depuis backend/ : node scripts/seed-admin.js
 *
 * Identifiants par défaut :
 *   Email: admin@gnv.com
 *   Mot de passe: Admin123!
 *
 * À utiliser pour la première connexion au dashboard. Changez le mot de passe en production.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'config.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const User = require('../src/models/User');

const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/gnv_onboard';

const DEFAULT_ADMIN = {
  firstName: 'Admin',
  lastName: 'GNV',
  email: 'admin@gnv.com',
  password: 'Admin123!',
  role: 'admin',
  isActive: true
};

async function seedAdmin() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connecté à MongoDB');

    const existing = await User.findOne({ email: DEFAULT_ADMIN.email });
    if (existing) {
      console.log('ℹ️  Un admin existe déjà avec l\'email:', DEFAULT_ADMIN.email);
      console.log('   Pour réinitialiser le mot de passe, supprimez l\'utilisateur en base puis relancez ce script.');
      process.exit(0);
      return;
    }

    await User.create(DEFAULT_ADMIN);
    console.log('✅ Utilisateur admin créé.');
    console.log('');
    console.log('   Connexion dashboard :');
    console.log('   Email    :', DEFAULT_ADMIN.email);
    console.log('   Password:', DEFAULT_ADMIN.password);
    console.log('');
    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

seedAdmin();
