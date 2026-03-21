/**
 * Crée un utilisateur admin pour le dashboard.
 * Usage: depuis backend/ : node scripts/seed-admin.js
 *
 * Requiert dans config.env : ADMIN_EMAIL, ADMIN_PASSWORD (aucun identifiant par défaut).
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'config.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const User = require('../src/models/User');

const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/gnv_onboard';

async function seedAdmin() {
  const adminEmail = (process.env.ADMIN_EMAIL || '').trim();
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) {
    console.error('❌ Définissez ADMIN_EMAIL et ADMIN_PASSWORD dans config.env (aucun identifiant par défaut).');
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connecté à MongoDB');

    const existing = await User.findOne({ email: adminEmail });
    if (existing) {
      console.log('ℹ️  Un admin existe déjà avec l\'email:', adminEmail);
      console.log('   Pour réinitialiser le mot de passe, utilisez scripts/reset-admin-password.js ou supprimez l\'utilisateur en base.');
      process.exit(0);
      return;
    }

    await User.create({
      firstName: 'Admin',
      lastName: 'GNV',
      email: adminEmail,
      password: adminPassword,
      role: 'admin',
      isActive: true,
    });
    console.log('✅ Utilisateur admin créé. Connexion avec les identifiants définis dans config.env.');
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
