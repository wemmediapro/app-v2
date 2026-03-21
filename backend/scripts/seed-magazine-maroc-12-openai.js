/**
 * Seed magazine : 12 articles sur le Maroc, OpenAI, multilingues (FR + EN, ES, IT, DE, AR), avec images.
 * Usage: cd backend && node scripts/seed-magazine-maroc-12-openai.js
 * Prérequis: OPENAI_API_KEY dans backend/.env, MongoDB (MONGODB_URI).
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'config.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const OpenAI = require('openai').default;
const Article = require('../src/models/Article');

const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/gnv_onboard';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const CATEGORIES = ['Actualités', 'Voyage', 'Culture', 'Gastronomie', 'Divertissement', 'Sport', 'Lifestyle'];
const LANGS = ['en', 'es', 'it', 'de', 'ar'];

function slug(str) {
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/(^-|-$)/g, '')
    .toLowerCase()
    .slice(0, 30);
}

function imageUrlForArticle(index, title) {
  const seed = `maroc12-${index}-${slug(title) || 'article'}`;
  return `https://picsum.photos/seed/${seed}/800/600`;
}

function estimateReadingTime(content) {
  const words = (content || '').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(2, Math.min(15, Math.round(words / 180)));
}

async function generateMaroc12(openai) {
  const systemPrompt = `Tu es rédacteur pour le magazine GNV OnBoard (ferry, Méditerranée, Maroc).
Réponds UNIQUEMENT par un objet JSON: { "articles": [ ... ] }, sans texte avant ou après.
Génère exactement 12 articles sur LE MAROC, variés (villes, gastronomie, culture, voyage, désert, côte, ferry).
Chaque article doit avoir en français :
- title (string, max 200 car.)
- excerpt (string, résumé 1-2 phrases, max 500 car.)
- content (string, 2-4 paragraphes)
- category (une parmi: ${CATEGORIES.join(', ')})
- author (string)
- tags (array de 3-5 strings)
- translations (object) avec clés "en", "es", "it", "de", "ar", chaque valeur = { title, excerpt, content } dans cette langue.`;

  const userPrompt = 'Génère 12 articles sur le Maroc (Marrakech, Fès, Tanger, gastronomie, désert, ferry GNV, culture, etc.), en français avec traductions en, es, it, de, ar. Réponse : uniquement le JSON avec la clé "articles".';

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.8,
  });

  const raw = completion.choices[0]?.message?.content?.trim();
  if (!raw) {throw new Error('Réponse OpenAI vide');}
  const data = JSON.parse(raw);
  const list = data.articles || data.items || (Array.isArray(data) ? data : []);
  return Array.isArray(list) ? list.slice(0, 12) : [];
}

async function run() {
  try {
    if (!OPENAI_API_KEY) {
      console.error('❌ OPENAI_API_KEY manquant dans backend/.env');
      process.exit(1);
    }

    console.log('🔌 Connexion MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connecté:', mongoose.connection.name);

    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
    console.log('🤖 Génération de 12 articles Maroc (multilingue + images)...');
    const allArticles = await generateMaroc12(openai);
    console.log(`   → ${allArticles.length} articles reçus`);

    let created = 0;
    for (let i = 0; i < allArticles.length; i++) {
      const a = allArticles[i];
      const title = (a.title || `Maroc – Article ${i + 1}`).slice(0, 200);
      const excerpt = (a.excerpt || '').slice(0, 500);
      const content = a.content || '';
      const category = CATEGORIES.includes(a.category) ? a.category : CATEGORIES[i % CATEGORIES.length];
      const author = a.author || 'Rédaction GNV';
      const tags = Array.isArray(a.tags) ? a.tags.slice(0, 5).map(String) : ['Maroc', 'voyage', 'GNV'];

      const translations = {};
      if (a.translations && typeof a.translations === 'object') {
        for (const code of LANGS) {
          const t = a.translations[code];
          if (t && (t.title || t.excerpt || t.content)) {
            translations[code] = {
              title: (t.title || title).slice(0, 200),
              excerpt: (t.excerpt || excerpt).slice(0, 500),
              content: t.content || content,
            };
          }
        }
      }

      const imageUrl = imageUrlForArticle(i + 1, title);

      const existing = await Article.findOne({ title });
      if (existing) {
        console.log('⏭️  Déjà en base:', title);
        continue;
      }

      await Article.create({
        title,
        excerpt,
        content,
        category,
        author,
        imageUrl,
        tags,
        isPublished: true,
        status: 'published',
        publishedAt: new Date(),
        featured: i < 3,
        readingTime: estimateReadingTime(content),
        views: 0,
        likes: 0,
        isActive: true,
        allowComments: true,
        translations: Object.keys(translations).length ? translations : undefined,
      });
      created++;
      console.log('✅ Créé:', title);
    }

    const total = await Article.countDocuments({});
    console.log('\n✅ Terminé. Nouveaux articles:', created, '| Total en base:', total);
  } catch (err) {
    console.error('❌ Erreur:', err.message);
    if (err.response?.data) {console.error(err.response.data);}
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
