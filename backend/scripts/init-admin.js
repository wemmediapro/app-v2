/**
 * Crée un admin avec mot de passe temporaire aléatoire (aucun identifiant hardcodé).
 * Usage: node scripts/init-admin.js
 * Prérequis: MONGODB_URI dans config.env. Le mot de passe est affiché une seule fois.
 * ⚠️ Changez le mot de passe immédiatement après la première connexion.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'config.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const crypto = require('crypto');
const mongoose = require('mongoose');
const User = require('../src/models/User');

const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/gnv_onboard';

async function initAdmin() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connecté à MongoDB');

    const existingAdmin = await User.findOne({ role: 'admin' }).lean();
    if (existingAdmin) {
      console.log('ℹ️  Un admin existe déjà:', existingAdmin.email);
      process.exit(0);
      return;
    }

    const email = (process.env.ADMIN_EMAIL || '').trim() || 'admin@gnv.local';
    const randomPassword = crypto.randomBytes(16).toString('hex');

    const admin = await User.create({
      firstName: 'Admin',
      lastName: 'GNV',
      email,
      password: randomPassword,
      role: 'admin',
      isActive: true,
      mustChangePassword: true,
    });

    console.log('');
    console.log('✅ Admin créé');
    console.log('   Email:', admin.email);
    console.log('   Password (temporaire):', randomPassword);
    console.log('');
    console.log('⚠️  CHANGEZ LE MOT DE PASSE IMMÉDIATEMENT après la première connexion.');
    console.log('');
    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

initAdmin();
