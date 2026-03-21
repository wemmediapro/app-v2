/**
 * Remplit les traductions (titre, résumé, contenu) pour tous les articles magazine déjà en base,
 * en 6 langues (fr, en, es, it, de, ar) via OpenAI.
 *
 * Usage: depuis backend/ : node scripts/seed-magazine-translations-openai.js
 * Prérequis: OPENAI_API_KEY dans backend/.env, MongoDB accessible.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'config.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const OpenAI = require('openai').default;
const Article = require('../src/models/Article');
const { generateTranslationsForArticle } = require('../src/lib/article-translations-openai');

const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/gnv_onboard';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SKIP_IF_TRANSLATED = process.env.SKIP_IF_TRANSLATED !== '0';
const LANGS = ['fr', 'en', 'es', 'it', 'de', 'ar'];
function hasAllTranslations(doc) {
  if (!doc.translations || typeof doc.translations !== 'object') {
    return false;
  }
  return LANGS.every((l) => doc.translations[l] && doc.translations[l].title);
}

async function run() {
  if (!OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY manquant. Définissez-le dans backend/.env');
    process.exit(1);
  }

  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  try {
    console.log('🔌 Connexion MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connecté:', mongoose.connection.name);

    const list = await Article.find({ isActive: { $ne: false } }).lean();
    if (!list.length) {
      console.log('ℹ️ Aucun article actif à traiter.');
      await mongoose.disconnect();
      process.exit(0);
      return;
    }

    const toProcess = SKIP_IF_TRANSLATED ? list.filter((doc) => !hasAllTranslations(doc)) : list;
    if (SKIP_IF_TRANSLATED && toProcess.length < list.length) {
      console.log(`ℹ️ ${list.length - toProcess.length} article(s) ont déjà les 6 langues (ignorés).`);
    }
    if (!toProcess.length) {
      console.log('✅ Tous les articles ont déjà des traductions complètes.');
      await mongoose.disconnect();
      process.exit(0);
      return;
    }

    console.log(`\n📰 ${toProcess.length} article(s) à traduire (fr, en, es, it, de, ar).\n`);

    let updated = 0;
    for (let i = 0; i < toProcess.length; i++) {
      const doc = toProcess[i];
      const id = doc._id;
      const titleFr = (doc.title || '').trim();
      const excerptFr = (doc.excerpt || '').trim();
      const contentFr = (doc.content || '').trim();
      const category = doc.category || 'Voyage';

      try {
        console.log(`   [${i + 1}/${toProcess.length}] 🌐 ${titleFr.slice(0, 50)}...`);
        const translations = await generateTranslationsForArticle(openai, titleFr, excerptFr, contentFr, category);
        await Article.updateOne({ _id: id }, { $set: { translations } });
        updated++;
        console.log('      ✅ Traductions enregistrées.');
      } catch (err) {
        console.error(`   ❌ ${titleFr.slice(0, 40)}:`, err.message);
      }
    }

    console.log(`\n✅ Terminé. ${updated}/${toProcess.length} article(s) mis à jour avec les traductions.`);
  } catch (err) {
    console.error('❌ Erreur:', err.message);
    if (err.response?.data) {
      console.error(err.response.data);
    }
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
