/**
 * Corrige les articles existants : ajoute translations.fr à partir de title/excerpt/content
 * si manquant, et assure une structure multilingue cohérente (sans traduction en ligne).
 * Usage: node scripts/fix-articles-translations.js (depuis le dossier backend)
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'config.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Article = require('../src/models/Article');

const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/gnv_onboard';
const LANG_CODES = ['fr', 'en', 'es', 'it', 'de', 'ar'];

async function fixArticlesTranslations() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connecté:', mongoose.connection.name);

    const articles = await Article.find({}).lean();
    console.log(`📄 ${articles.length} article(s) trouvé(s).`);

    let updated = 0;
    for (const doc of articles) {
      const translations = doc.translations && typeof doc.translations === 'object' ? { ...doc.translations } : {};

      // Compléter translations.fr à partir des champs principaux (toujours à jour)
      const fr = translations.fr || {};
      translations.fr = {
        title: (fr.title || doc.title || '').slice(0, 200),
        excerpt: (fr.excerpt || doc.excerpt || '').slice(0, 500),
        content: fr.content || doc.content || '',
      };

      // Conserver les autres langues existantes, ajouter des objets vides pour les manquantes
      for (const code of LANG_CODES) {
        if (code === 'fr') {
          continue;
        }
        const t = translations[code];
        if (t && typeof t === 'object' && (t.title || t.excerpt || t.content)) {
          translations[code] = {
            title: (t.title || '').slice(0, 200),
            excerpt: (t.excerpt || '').slice(0, 500),
            content: t.content || '',
          };
        } else if (!translations[code] || typeof translations[code] !== 'object') {
          translations[code] = { title: '', excerpt: '', content: '' };
        }
      }

      await Article.updateOne({ _id: doc._id }, { $set: { translations } });
      updated++;
      console.log(`  ✓ ${doc._id} — "${(doc.title || '').slice(0, 50)}..."`);
    }

    console.log(`\n✅ Correction terminée : ${updated} article(s) mis à jour.`);
  } catch (err) {
    console.error('❌ Erreur:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

fixArticlesTranslations();
