/**
 * Seed Films & Séries : max 12 contenus générés par OpenAI (titre, description, affiche, URL bande-annonce).
 * Usage: depuis backend/ : node scripts/seed-movies-openai.js
 *
 * Prérequis: OPENAI_API_KEY dans backend/.env et MongoDB accessible (MONGODB_URI ou DATABASE_URL).
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'config.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const OpenAI = require('openai').default;
const Movie = require('../src/models/Movie');

const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/gnv_onboard';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const MAX_ITEMS = 12;

function slug(str) {
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/(^-|-$)/g, '')
    .toLowerCase()
    .slice(0, 40);
}

/** URL d'affiche placeholder (image cohérente par titre) */
function posterUrlFor(title, index) {
  const seed = `movie-${index}-${slug(title) || 'film'}`;
  return `https://picsum.photos/seed/${seed}/400/600`;
}

async function generateMoviesWithOpenAI() {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY manquant. Ajoutez-le dans backend/.env');
  }
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  const systemPrompt = `Tu es un expert cinéma pour le portail GNV OnBoard (films et séries à bord des ferries).
Tu dois renvoyer UNIQUEMENT un objet JSON valide de la forme : { "items": [ ... ] }, sans texte avant ou après.
Génère exactement ${MAX_ITEMS} contenus (mélange de films et de séries, en français).
Chaque élément du tableau "items" doit avoir exactement :
- title (string, titre en français, max 150 caractères)
- description (string, résumé accrocheur en 2-4 phrases, max 600 caractères)
- type (string, soit "movie" soit "series")
- genre (string, ex: Comédie, Drame, Action, Animation, Thriller, Science-fiction, Aventure)
- year (number, année de sortie entre 2015 et 2026)
- trailerUrl (string, URL réelle d'une bande-annonce YouTube pour ce film/série, format https://www.youtube.com/watch?v=... ou https://youtu.be/...)
- duration (string, ex: "2h 15min" pour un film, "45min" pour un épisode)

Choisis des films et séries populaires et récents (ex: Dune 2, Oppenheimer, The Last of Us, Stranger Things, Avatar 2, etc.).
Répartis environ 7 films et 5 séries. Les trailerUrl doivent être des vrais liens YouTube de bandes-annonces officielles.`;

  const userPrompt = `Génère les ${MAX_ITEMS} films/séries au format JSON : { "items": [ ... ] }. Réponse : uniquement le JSON, pas de \`\`\`json.`;

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
  if (!raw) throw new Error('Réponse OpenAI vide');

  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) data = JSON.parse(match[0]);
    else throw new Error('Impossible de parser le JSON OpenAI: ' + raw.slice(0, 300));
  }

  let list = Array.isArray(data.items) ? data.items : null;
  if (!list && Array.isArray(data)) list = data;
  if (!list || list.length === 0) throw new Error('Aucun film/série dans la réponse');
  return list.slice(0, MAX_ITEMS);
}

async function seedMovies() {
  try {
    if (!OPENAI_API_KEY) {
      console.error('❌ OPENAI_API_KEY manquant. Définissez-le dans backend/.env');
      process.exit(1);
    }

    console.log('🔌 Connexion MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connecté:', mongoose.connection.name);

    console.log(`🤖 Génération de ${MAX_ITEMS} films/séries via OpenAI...`);
    const generated = await generateMoviesWithOpenAI();
    console.log(`✅ ${generated.length} contenus générés`);

    let created = 0;
    for (let i = 0; i < generated.length; i++) {
      const item = generated[i];
      const title = (item.title || `Film ${i + 1}`).trim().slice(0, 200);
      const existing = await Movie.findOne({ title }).lean();
      if (existing) {
        console.log('⏭️  Déjà présent:', title);
        continue;
      }

      const type = item.type === 'series' ? 'series' : 'movie';
      const poster = posterUrlFor(title, i + 1);
      const videoUrl = (item.trailerUrl || item.videoUrl || '').trim().slice(0, 500) || undefined;
      const description = (item.description || '').trim().slice(0, 2000);
      const year = Math.min(2026, Math.max(2015, parseInt(item.year, 10) || new Date().getFullYear()));
      const duration = (item.duration || (type === 'movie' ? '1h 45min' : '45min')).slice(0, 50);
      const genre = (item.genre || 'Divers').trim().slice(0, 100);

      const doc = {
        title,
        type,
        genre,
        year,
        duration,
        rating: 4,
        description,
        poster,
        videoUrl: videoUrl || '',
        isPopular: i < 4,
        countries: ['MA', 'IT', 'ES', 'TN', 'FR'],
        isActive: true,
      };

      await Movie.create(doc);
      created++;
      console.log('✅ Créé:', title, `(${type})`);
    }

    const total = await Movie.countDocuments({ isActive: true });
    console.log('\n✅ Seed films/séries OpenAI terminé. Créés:', created, '| Total actifs en base:', total);
  } catch (err) {
    console.error('❌ Erreur:', err.message);
    if (err.response?.data) console.error(err.response.data);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seedMovies();
