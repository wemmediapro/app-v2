/**
 * Génère des affiches films/séries (DALL-E 3) en format portrait 1024x1792 et les UPLOADE via l’API backend.
 * Même format que les cartes (ratio 2/3) pour affichage uniforme.
 * Usage: backend démarré puis cd backend && node scripts/seed-movies-images-openai.js
 * Prérequis: OPENAI_API_KEY, MongoDB, backend lancé.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'config.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const OpenAI = require('openai').default;
const Movie = require('../src/models/Movie');
const { buildPosterPrompt, DALLE3_POSTER_OPTIONS } = require('../src/lib/openai-poster-config');

const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/gnv_onboard';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const API_BASE_URL = (process.env.API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const SEED_SECRET = process.env.SEED_SCRIPT_SECRET || process.env.SEED_SECRET || '';

function slug(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/(^-|-$)/g, '')
    .toLowerCase()
    .slice(0, 30);
}

async function generateAndUploadImage(openai, prompt, filename) {
  const response = await openai.images.generate({
    ...DALLE3_POSTER_OPTIONS,
    prompt,
  });
  const img = response.data?.[0];
  if (!img?.b64_json) {
    throw new Error('Pas d’image retournée par OpenAI');
  }

  const uploadUrl = `${API_BASE_URL}/api/upload/image-from-base64`;
  const headers = { 'Content-Type': 'application/json' };
  if (SEED_SECRET) {
    headers['X-Seed-Secret'] = SEED_SECRET;
  }

  const res = await fetch(uploadUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({ base64: img.b64_json, filename }),
  });
  if (!res.ok) {
    throw new Error(`Upload échoué (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  const pathRel = data?.image?.path || (data?.image?.url || '').replace(/^https?:\/\/[^/]+/, '');
  if (!pathRel) {
    throw new Error('Réponse upload sans image.path');
  }
  return pathRel.startsWith('/') ? pathRel : `/${pathRel}`;
}

async function main() {
  if (!OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY manquant (backend/.env ou config.env)');
    process.exit(1);
  }
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  console.log('🔌 Connexion MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connecté:', mongoose.connection.name);

  const health = await fetch(`${API_BASE_URL}/api/health`).catch(() => null);
  if (!health?.ok) {
    console.error('❌ Backend non disponible à', API_BASE_URL);
    await mongoose.disconnect();
    process.exit(1);
  }

  const movies = await Movie.find({ isActive: { $ne: false } }).lean();
  console.log(`\n🎬 ${movies.length} film(s) / série(s). Génération + upload des affiches...\n`);

  for (let i = 0; i < movies.length; i++) {
    const m = movies[i];
    const label = m.title || `Film ${i + 1}`;
    try {
      const safeName = slug(m.title) || `movie-${i + 1}`;
      const filename = `movie-${(m._id || '').toString().slice(-8)}-${safeName}.png`;
      console.log(`   [${i + 1}/${movies.length}] ${label.slice(0, 50)}...`);
      const prompt = buildPosterPrompt(m);
      const posterPath = await generateAndUploadImage(openai, prompt, filename);
      await Movie.updateOne({ _id: m._id }, { $set: { poster: posterPath, tmdbPosterPath: '' } });
      console.log('      ✅ Affiche uploadée et film mis à jour.');
    } catch (err) {
      console.error(`   ❌ ${label.slice(0, 40)}:`, err.message);
    }
  }

  console.log('\n✅ Movies images terminé.');
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
