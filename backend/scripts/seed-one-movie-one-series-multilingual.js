/**
 * Seed 1 film + 1 série : contenu multilingue (fr, en, es, it, de, ar) et affiches générées par OpenAI (DALL-E 3).
 * Aucune URL vidéo / bande-annonce n'est ajoutée.
 *
 * Usage: cd backend && node scripts/seed-one-movie-one-series-multilingual.js
 *
 * Prérequis: OPENAI_API_KEY dans backend/.env
 * Stockage: MongoDB si connecté, sinon backend/data/movies.json
 * Images: upload via API si backend lancé, sinon écriture dans public/uploads/images/
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'config.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const OpenAI = require('openai').default;
const Movie = require('../src/models/Movie');
const moviesFallback = require('../src/lib/movies-fallback');
const { generateTranslationsForMovie } = require('../src/lib/movies-translations-openai');
const { buildPosterPrompt, DALLE3_POSTER_OPTIONS } = require('../src/lib/openai-poster-config');

const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/gnv_onboard';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const API_BASE_URL = (process.env.API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const SEED_SECRET = process.env.SEED_SCRIPT_SECRET || process.env.SEED_SECRET || '';

const BACKEND_ROOT = path.join(__dirname, '..');
const IMAGES_DIR = path.join(BACKEND_ROOT, 'public', 'uploads', 'images');

function slug(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/(^-|-$)/g, '')
    .toLowerCase()
    .slice(0, 30);
}

/**
 * Génère 1 film et 1 série (titres + descriptions en français uniquement ici).
 * Pas de trailerUrl / videoUrl.
 */
async function generateOneMovieOneSeries(openai) {
  const systemPrompt = `Tu es un expert cinéma pour un portail de films et séries à bord des ferries.
Tu dois renvoyer UNIQUEMENT un objet JSON valide, sans texte avant ou après :
{
  "items": [
    {
      "title": "Titre en français (max 150 caractères)",
      "description": "Résumé accrocheur en 2-4 phrases, max 600 caractères",
      "type": "movie",
      "genre": "ex: Comédie, Drame, Action, Science-fiction, Thriller",
      "year": 2024,
      "duration": "2h 15min"
    },
    {
      "title": "Titre de la série en français",
      "description": "Résumé de la série en 2-4 phrases",
      "type": "series",
      "genre": "ex: Drame, Thriller, Science-fiction",
      "year": 2024,
      "duration": "50min"
    }
  ]
}

Règles :
- Exactement 2 éléments : le premier type "movie", le second type "series".
- Choisis un film et une série populaires et récents (titres français).
- NE fournis AUCUNE URL (pas de bande-annonce, pas de vidéo).`;

  const userPrompt = 'Génère 1 film et 1 série au format JSON : { "items": [ { type: "movie", ... }, { type: "series", ... } ] }. Réponse : uniquement le JSON, pas de ```json.';

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.7,
  });

  const raw = completion.choices[0]?.message?.content?.trim();
  if (!raw) {throw new Error('Réponse OpenAI vide');}

  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {data = JSON.parse(match[0]);} else {throw new Error('Impossible de parser le JSON: ' + raw.slice(0, 300));}
  }

  const list = Array.isArray(data.items) ? data.items : (Array.isArray(data) ? data : null);
  if (!list || list.length < 2) {throw new Error('Il faut au moins 1 film et 1 série dans la réponse');}
  return [
    { ...list[0], type: list[0].type === 'series' ? 'series' : 'movie' },
    { ...list[1], type: list[1].type === 'series' ? 'series' : 'movie' },
  ];
}

/**
 * Génère une affiche DALL-E 3 et la sauvegarde (API ou fichier local).
 * Retourne le chemin relatif (ex: /uploads/images/xxx.png).
 */
async function generateAndSavePoster(openai, item, index) {
  const prompt = buildPosterPrompt(item);
  const response = await openai.images.generate({
    ...DALLE3_POSTER_OPTIONS,
    prompt,
  });
  const img = response.data?.[0];
  if (!img?.b64_json) {throw new Error('Pas d’image retournée par OpenAI');}

  const safeName = slug(item.title) || (item.type === 'series' ? 'series' : 'movie');
  const filename = `${item.type === 'series' ? 'series' : 'movie'}-${index + 1}-${safeName}.png`;
  const finalName = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
  const nameWithExt = /\.(png|jpe?g|gif|webp)$/i.test(finalName) ? finalName : finalName + '.png';

  const health = await fetch(`${API_BASE_URL}/api/health`).catch(() => null);
  if (health?.ok) {
    const uploadUrl = `${API_BASE_URL}/api/upload/image-from-base64`;
    const headers = { 'Content-Type': 'application/json' };
    if (SEED_SECRET) {headers['X-Seed-Secret'] = SEED_SECRET;}
    const res = await fetch(uploadUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ base64: img.b64_json, filename: nameWithExt }),
    });
    if (res.ok) {
      const data = await res.json();
      const pathRel = data?.image?.path || (data?.image?.url || '').replace(/^https?:\/\/[^/]+/, '');
      if (pathRel) {return pathRel.startsWith('/') ? pathRel : `/${pathRel}`;}
    }
  }

  if (!fs.existsSync(IMAGES_DIR)) {fs.mkdirSync(IMAGES_DIR, { recursive: true });}
  const fullPath = path.join(IMAGES_DIR, nameWithExt);
  fs.writeFileSync(fullPath, Buffer.from(img.b64_json, 'base64'));
  return `/uploads/images/${nameWithExt}`;
}

async function run() {
  if (!OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY manquant. Définissez-le dans backend/.env');
    process.exit(1);
  }

  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
  const useMongo = () => mongoose.connection.readyState === 1;

  try {
    console.log('🔌 Connexion MongoDB...');
    await mongoose.connect(MONGODB_URI).catch(() => {});
    if (useMongo()) {console.log('✅ Connecté:', mongoose.connection.name);} else {console.log('ℹ️ MongoDB non disponible → utilisation de backend/data/movies.json\n');}

    console.log('🤖 Génération de 1 film + 1 série (OpenAI)...');
    const items = await generateOneMovieOneSeries(openai);
    console.log('   ✅', items[0].title, '|', items[1].title);

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const titleFr = (item.title || '').trim().slice(0, 200);
      const typeLabel = item.type === 'series' ? 'série' : 'film';

      if (useMongo()) {
        const existing = await Movie.findOne({ title: titleFr }).lean();
        if (existing) {
          console.log(`\n⏭️ [${i + 1}/2] Déjà en base: ${titleFr}`);
          continue;
        }
      } else {
        const all = moviesFallback.getAll();
        if (all.some((m) => m.title === titleFr)) {
          console.log(`\n⏭️ [${i + 1}/2] Déjà dans movies.json: ${titleFr}`);
          continue;
        }
      }

      console.log(`\n📽️ [${i + 1}/2] ${typeLabel}: ${titleFr}`);

      console.log('   🌐 Traductions (6 langues)...');
      const translations = await generateTranslationsForMovie(
        openai,
        titleFr,
        (item.description || '').trim().slice(0, 2000),
        typeLabel,
      );

      console.log('   🖼️ Génération de l\'affiche (DALL-E 3)...');
      const poster = await generateAndSavePoster(openai, item, i);

      const year = Math.min(2026, Math.max(2015, parseInt(item.year, 10) || new Date().getFullYear()));
      const duration = (item.duration || (item.type === 'movie' ? '1h 45min' : '45min')).slice(0, 50);
      const genre = (item.genre || 'Divers').trim().slice(0, 100);

      const doc = {
        title: titleFr,
        type: item.type === 'series' ? 'series' : 'movie',
        genre,
        year,
        duration,
        rating: 4,
        description: (item.description || '').trim().slice(0, 2000),
        poster,
        tmdbPosterPath: '',
        videoUrl: '', // pas d'URL vidéo
        isPopular: true,
        countries: ['MA', 'IT', 'ES', 'TN', 'FR'],
        isActive: true,
        translations,
        episodes: item.type === 'series' ? [] : undefined,
      };
      if (doc.episodes === undefined) {delete doc.episodes;}

      if (useMongo()) {
        await Movie.create(doc);
        console.log('   ✅ Enregistré en base MongoDB.');
      } else {
        moviesFallback.create(doc);
        console.log('   ✅ Enregistré dans data/movies.json.');
      }
    }

    const total = useMongo()
      ? await Movie.countDocuments({ isActive: true })
      : moviesFallback.getAll().length;
    console.log('\n✅ Terminé. 1 film + 1 série ajoutés (multilingue, affiches générées, sans URL vidéo). Total actifs:', total);
  } catch (err) {
    console.error('❌ Erreur:', err.message);
    if (err.response?.data) {console.error(err.response.data);}
    process.exit(1);
  } finally {
    await mongoose.disconnect().catch(() => {});
    process.exit(0);
  }
}

run();
