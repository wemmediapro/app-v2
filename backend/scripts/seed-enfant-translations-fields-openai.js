/**
 * Complète les traductions des activités Enfant : ajoute ageRange, schedule et features
 * dans toutes les langues (fr, en, es, it, de, ar) pour les activités qui ne les ont pas encore.
 * Préserve les traductions name/description existantes.
 *
 * Usage: cd backend && node scripts/seed-enfant-translations-fields-openai.js
 * Prérequis: OPENAI_API_KEY, MongoDB.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'config.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const OpenAI = require('openai').default;
const EnfantActivity = require('../src/models/EnfantActivity');
const { generateTranslationsForEnfant } = require('../src/lib/enfant-translations-openai');

const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/gnv_onboard';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

async function main() {
  if (!OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY manquant (backend/.env ou config.env)');
    process.exit(1);
  }
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  console.log('🔌 Connexion MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connecté:', mongoose.connection.name);

  const activities = await EnfantActivity.find({ isActive: { $ne: false } }).lean();
  console.log(
    `\n👶 ${activities.length} activité(s) Enfant à traiter (compléter ageRange, schedule, features en 6 langues).\n`
  );

  for (let i = 0; i < activities.length; i++) {
    const a = activities[i];
    const id = a._id;
    const label = a.name || `Activité ${i + 1}`;

    const ageRangeFr = (a.ageRange || '').trim() || undefined;
    const scheduleFr = (a.schedule || '').trim() || undefined;
    const featuresFr = Array.isArray(a.features) && a.features.length > 0 ? a.features : undefined;
    if (!ageRangeFr && !scheduleFr && !featuresFr) {
      console.log(`   [${i + 1}/${activities.length}] ⏭️ ${label.slice(0, 40)}... (pas de ageRange/schedule/features)`);
      continue;
    }

    const existing = a.translations && typeof a.translations === 'object' ? a.translations : {};
    const hasMissing = ['en', 'es', 'it', 'de', 'ar'].some((lang) => {
      const t = existing[lang];
      return (
        !t || !t.ageRange || !t.schedule || (featuresFr && (!Array.isArray(t.features) || t.features.length === 0))
      );
    });
    if (!hasMissing && existing.fr?.ageRange) {
      console.log(`   [${i + 1}/${activities.length}] ✅ ${label.slice(0, 40)}... (déjà complets)`);
      continue;
    }

    try {
      const nameFr = (a.name || '').trim();
      const descriptionFr = (a.description || '').trim();
      console.log(`   [${i + 1}/${activities.length}] 🌐 ${label.slice(0, 45)}...`);
      const generated = await generateTranslationsForEnfant(
        openai,
        nameFr,
        descriptionFr,
        a.category,
        ageRangeFr,
        scheduleFr,
        featuresFr
      );

      const merged = {};
      for (const lang of ['fr', 'en', 'es', 'it', 'de', 'ar']) {
        merged[lang] = { ...(existing[lang] || {}), ...(generated[lang] || {}) };
        if (merged[lang].ageRange === undefined && ageRangeFr) {
          merged[lang].ageRange = ageRangeFr;
        }
        if (merged[lang].schedule === undefined && scheduleFr) {
          merged[lang].schedule = scheduleFr;
        }
        if (featuresFr && (!Array.isArray(merged[lang].features) || merged[lang].features.length === 0)) {
          merged[lang].features =
            generated[lang] && generated[lang].features && generated[lang].features.length > 0
              ? generated[lang].features
              : existing[lang]?.features || featuresFr;
        }
      }

      await EnfantActivity.updateOne({ _id: id }, { $set: { translations: merged } });
      console.log('      ✅ Traductions (ageRange, schedule, features) mises à jour.');
    } catch (err) {
      console.error(`   ❌ ${label.slice(0, 40)}:`, err.message);
    }
  }

  console.log('\n✅ Backfill traductions (ageRange, schedule, features) terminé.');
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
