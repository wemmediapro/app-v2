/**
 * Remplit les traductions (titre + description) pour tous les films et séries déjà en base,
 * en 6 langues (fr, en, es, it, de, ar) via OpenAI.
 * Usage: depuis backend/ : node scripts/seed-movies-translations-openai.js
 *
 * Prérequis: OPENAI_API_KEY dans backend/.env. MongoDB ou fallback (data/movies.json).
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'config.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const OpenAI = require('openai').default;
const Movie = require('../src/models/Movie');
const moviesFallback = require('../src/lib/movies-fallback');
const { generateTranslationsForMovie } = require('../src/lib/movies-translations-openai');

const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/gnv_onboard';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const useMongo = () => mongoose.connection.readyState === 1;

async function run() {
  if (!OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY manquant. Définissez-le dans backend/.env');
    process.exit(1);
  }

  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  try {
    console.log('🔌 Connexion MongoDB...');
    await mongoose.connect(MONGODB_URI).catch(() => {});
    const connected = useMongo();
    if (connected) {
      console.log('✅ Connecté:', mongoose.connection.name);
    } else {
      console.log('ℹ️ MongoDB non disponible, utilisation du fichier data/movies.json');
    }

    const list = connected ? await Movie.find({ isActive: true }).lean() : moviesFallback.getAll();

    if (!list.length) {
      console.log('ℹ️ Aucun film/série actif à traiter.');
      await mongoose.disconnect().catch(() => {});
      process.exit(0);
      return;
    }

    console.log(`📽️ ${list.length} film(s)/série(s) à traiter. Génération des traductions par OpenAI...\n`);

    let updated = 0;
    for (let i = 0; i < list.length; i++) {
      const doc = list[i];
      const id = doc._id?.toString() || doc.id;
      const titleFr = (doc.title || doc.translations?.fr?.title || 'Sans titre').trim();
      const descriptionFr = (doc.description || doc.translations?.fr?.description || '').trim();
      const typeLabel = doc.type === 'series' ? 'série' : 'film';

      try {
        const translations = await generateTranslationsForMovie(openai, titleFr, descriptionFr, typeLabel);

        if (connected) {
          await Movie.findByIdAndUpdate(id, { $set: { translations } });
        } else {
          moviesFallback.update(id, { translations });
        }

        updated++;
        console.log(`   ✅ [${i + 1}/${list.length}] ${typeLabel}: ${titleFr}`);
      } catch (err) {
        console.error(`   ❌ [${i + 1}/${list.length}] ${titleFr}: ${err.message}`);
      }
    }

    console.log(`\n✅ Terminé. ${updated}/${list.length} contenu(s) mis à jour avec le contenu par langue.`);
  } catch (err) {
    console.error('❌ Erreur:', err.message);
    if (err.response?.data) {
      console.error(err.response.data);
    }
    process.exit(1);
  } finally {
    await mongoose.disconnect().catch(() => {});
    process.exit(0);
  }
}

run();
