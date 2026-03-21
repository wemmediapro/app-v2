/**
 * Réinitialise le mot de passe de l’administrateur identifié par ADMIN_EMAIL.
 * Usage: ADMIN_PASSWORD_RESET='NouveauMotDePasseSecurise!' node scripts/reset-admin-password.js
 *
 * Aucun mot de passe par défaut — ADMIN_EMAIL et ADMIN_PASSWORD_RESET sont obligatoires.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'config.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const User = require('../src/models/User');

const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/gnv_onboard';
const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const NEW_PASSWORD = process.env.ADMIN_PASSWORD_RESET;

async function resetAdminPassword() {
  try {
    if (!adminEmail) {
      console.error('❌ ADMIN_EMAIL doit être défini dans config.env.');
      process.exit(1);
    }
    if (!NEW_PASSWORD || String(NEW_PASSWORD).trim().length < 8) {
      console.error(
        "❌ ADMIN_PASSWORD_RESET doit être défini (min. 8 caractères), ex. : ADMIN_PASSWORD_RESET='VotreMotDePasse' node scripts/reset-admin-password.js"
      );
      process.exit(1);
    }

    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connecté à MongoDB');

    const admin = await User.findOne({ email: adminEmail });
    if (!admin) {
      console.log(`❌ Aucun utilisateur avec l’email ${adminEmail} en base.`);
      process.exit(1);
      return;
    }

    if (admin.role !== 'admin') {
      console.log('❌ L’utilisateur trouvé n’est pas un administrateur (role !== admin).');
      process.exit(1);
      return;
    }

    admin.password = String(NEW_PASSWORD).trim();
    admin.mustChangePassword = false;
    await admin.save(); // pre('save') hash le mot de passe
    console.log('✅ Mot de passe administrateur réinitialisé (ne pas logger le secret).');
    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
}

resetAdminPassword();
