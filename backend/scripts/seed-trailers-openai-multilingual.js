/**
 * Seed : 20 bandes d'annonces (films et séries) générées par OpenAI,
 * avec titre + description en 6 langues (FR, EN, ES, IT, DE, AR), affiche (poster URL) et vidéo par URL.
 * Usage: cd backend && node scripts/seed-trailers-openai-multilingual.js
 * Prérequis: OPENAI_API_KEY dans backend/.env et MongoDB accessible.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'config.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const OpenAI = require('openai').default;
const Trailer = require('../src/models/Trailer');

const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/gnv_onboard';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const LANGS = ['fr', 'en', 'es', 'it', 'de', 'ar'];
const TOTAL_TRAILERS = 20;

async function generateTrailers(openai) {
  const systemPrompt = `Tu es responsable du catalogue de bandes d'annonces pour une application de divertissement à bord des ferries GNV (GNV OnBoard). Tu génères des bandes d'annonces pour des films et séries populaires récents ou classiques.

Pour chaque bande d'annonce, fournis :
- title : titre du film ou de la série en français
- description : courte description accrocheuse (1-2 phrases) en français
- type : "movie" ou "series"
- poster : une URL d'affiche réelle si tu en connais une (format https://image.tmdb.org/t/p/w500/xxx.jpg ou autre CDN d'affiches). Sinon utilise un placeholder : "https://via.placeholder.com/500x750/1a1a2e/eee?text=POSTER"
- videoUrl : une URL de bande-annonce (YouTube embed ou direct). Format préféré : "https://www.youtube.com/embed/VIDEO_ID" ou "https://player.vimeo.com/video/XXX". Si tu ne connais pas l'ID exact, utilise un placeholder : "https://www.youtube.com/embed/dQw4w9WgXcQ" (à remplacer plus tard par l'admin)
- translations : pour CHAQUE langue fr, en, es, it, de, ar : { "title": "...", "description": "..." }

Génère exactement ${TOTAL_TRAILERS} bandes d'annonces : mélange de films et de séries (environ 12 films et 8 séries). Choisis des titres variés et connus (ex: Dune, Stranger Things, Oppenheimer, The Last of Us, Avatar, Squid Game, etc.).

Renvoie UNIQUEMENT un objet JSON valide avec la structure :
{
  "trailers": [
    {
      "title": "Titre en français",
      "description": "Description courte en français",
      "type": "movie",
      "poster": "https://...",
      "videoUrl": "https://www.youtube.com/embed/...",
      "translations": {
        "fr": { "title": "...", "description": "..." },
        "en": { "title": "...", "description": "..." },
        "es": { "title": "...", "description": "..." },
        "it": { "title": "...", "description": "..." },
        "de": { "title": "...", "description": "..." },
        "ar": { "title": "...", "description": "..." }
      }
    }
  ]
}`;

  const userPrompt = `Génère exactement ${TOTAL_TRAILERS} bandes d'annonces de films et séries avec titres et descriptions en 6 langues (fr, en, es, it, de, ar). Inclus pour chaque entrée : poster (URL d'affiche), videoUrl (URL de la bande-annonce, de préférence YouTube embed). Réponse : uniquement l'objet JSON avec la clé "trailers".`;

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
  const data = JSON.parse(raw);
  const list = data.trailers || (Array.isArray(data) ? data : []);
  return Array.isArray(list) ? list.slice(0, TOTAL_TRAILERS) : [];
}

async function seedTrailers() {
  if (!OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY manquant (backend/.env)');
    process.exit(1);
  }
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  try {
    console.log('🔌 Connexion MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connecté:', mongoose.connection.name);

    console.log(`🤖 Génération de ${TOTAL_TRAILERS} bandes d'annonces multilingues (OpenAI)...`);
    const generated = await generateTrailers(openai);
    if (!generated.length) {
      console.log('⚠️ Aucune bande générée.');
      await mongoose.disconnect();
      process.exit(0);
      return;
    }

    const existingCount = await Trailer.countDocuments({ isActive: true });
    if (existingCount >= TOTAL_TRAILERS) {
      console.log(`ℹ️ Déjà ${existingCount} bandes d'annonces actives. Pour réinsérer, désactivez les anciennes ou supprimez la collection.`);
      await mongoose.disconnect();
      process.exit(0);
      return;
    }

    let inserted = 0;
    for (let i = 0; i < generated.length; i++) {
      const t = generated[i];
      const trailer = new Trailer({
        title: (t.title || t.translations?.fr?.title || 'Sans titre').trim().slice(0, 200),
        description: (t.description || t.translations?.fr?.description || '').trim().slice(0, 2000),
        poster: (t.poster || '').trim().slice(0, 2000),
        videoUrl: (t.videoUrl || '').trim().slice(0, 2000),
        type: t.type === 'series' ? 'series' : 'movie',
        order: i + 1,
        isActive: true,
        translations: null,
      });

      const trans = t.translations || {};
      const translations = {};
      for (const lang of LANGS) {
        const tr = trans[lang];
        if (tr && (tr.title || tr.description)) {
          translations[lang] = {
            title: (tr.title || trailer.title).trim().slice(0, 200),
            description: (tr.description || trailer.description || '').trim().slice(0, 2000),
          };
        }
      }
      if (Object.keys(translations).length) {trailer.translations = translations;}

      await trailer.save();
      inserted++;
      console.log(`   ✅ ${trailer.type === 'series' ? 'Série' : 'Film'} : ${trailer.title}`);
    }

    console.log(`\n✅ Seed terminé. ${inserted} bande(s) d'annonce(s) ajoutée(s).`);
  } catch (err) {
    console.error('❌ Erreur:', err.message);
    if (err.response?.data) {console.error(err.response.data);}
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seedTrailers();
