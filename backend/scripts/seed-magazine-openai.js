/**
 * Seed magazine : 10 articles générés par OpenAI, avec image différente par article.
 * Script dev uniquement — ne pas exécuter en production.
 * Usage: depuis backend/ : node scripts/seed-magazine-openai.js
 * Prérequis: OPENAI_API_KEY dans backend/.env et MongoDB accessible (MONGODB_URI ou DATABASE_URL).
 */
if (process.env.NODE_ENV === 'production') {
  console.error('Script seed OpenAI réservé au développement. Refus en production.');
  process.exit(1);
}
require('dotenv').config({ path: require('path').join(__dirname, '..', 'config.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const OpenAI = require('openai').default;
const Article = require('../src/models/Article');

const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/gnv_onboard';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const CATEGORIES = ['Actualités', 'Voyage', 'Culture', 'Gastronomie', 'Divertissement', 'Sport', 'Lifestyle'];

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
  const seed = `magazine-${index}-${slug(title) || 'article'}`;
  return `https://picsum.photos/seed/${seed}/800/600`;
}

function estimateReadingTime(content) {
  const words = (content || '').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(2, Math.min(15, Math.round(words / 180)));
}

async function generateArticlesWithOpenAI() {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY manquant. Ajoutez-le dans backend/.env');
  }
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  const systemPrompt = `Tu es rédacteur pour le magazine GNV OnBoard (ferry, traversées Méditerranée, voyage à bord).
Tu dois renvoyer UNIQUEMENT un tableau JSON valide de 10 articles, sans texte avant ou après.
Chaque article doit avoir exactement les champs suivants (en français) :
- title (string, titre accrocheur, max 200 caractères)
- excerpt (string, résumé en 1-2 phrases, max 500 caractères)
- content (string, corps de l'article en 2-4 paragraphes, style magazine)
- category (string, une parmi : ${CATEGORIES.join(', ')})
- author (string, nom d'auteur réaliste)
- tags (array de 3-5 strings, mots-clés)

Répartis les 10 articles sur des catégories variées. Thèmes : traversée, escales, gastronomie à bord, activités, destinations, culture, actualités ferry, bien-être, famille.`;

  const userPrompt = `Génère les 10 articles au format JSON. Réponse : uniquement le tableau JSON, pas de \`\`\`json.`;

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
  if (!raw) throw new Error('Réponse OpenAI vide');

  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    const match = raw.match(/\[[\s\S]*\]/);
    if (match) data = JSON.parse(match[0]);
    else throw new Error('Impossible de parser le JSON OpenAI: ' + raw.slice(0, 200));
  }

  let list = Array.isArray(data) ? data : null;
  if (!list && data && typeof data === 'object') {
    list = data.articles || data.items || data.list;
    if (!Array.isArray(list)) list = Object.values(data).find(Array.isArray) || [];
  }
  if (!Array.isArray(list) || list.length === 0) throw new Error('Aucun article dans la réponse');
  return list.slice(0, 10);
}

async function seedMagazine() {
  try {
    if (!OPENAI_API_KEY) {
      console.error('❌ OPENAI_API_KEY manquant. Définissez-le dans backend/.env');
      process.exit(1);
    }

    console.log('🔌 Connexion MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connecté:', mongoose.connection.name);

    console.log('🤖 Génération de 10 articles via OpenAI...');
    const generated = await generateArticlesWithOpenAI();
    console.log(`✅ ${generated.length} articles générés`);

    const toInsert = [];
    for (let i = 0; i < generated.length; i++) {
      const a = generated[i];
      const title = (a.title || `Article ${i + 1}`).slice(0, 200);
      const excerpt = (a.excerpt || a.content?.slice(0, 300) || '').slice(0, 500);
      const content = a.content || '';
      const category = CATEGORIES.includes(a.category) ? a.category : CATEGORIES[i % CATEGORIES.length];
      const author = a.author || 'Rédaction GNV';
      const tags = Array.isArray(a.tags) ? a.tags.slice(0, 5).map(String) : ['voyage', 'ferry', 'GNV'];

      toInsert.push({
        title,
        excerpt,
        content,
        category,
        author,
        imageUrl: imageUrlForArticle(i + 1, title),
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
      });
    }

    for (const doc of toInsert) {
      const existing = await Article.findOne({ title: doc.title });
      if (existing) {
        console.log('⏭️  Déjà présent:', doc.title);
        continue;
      }
      await Article.create(doc);
      console.log('✅ Créé:', doc.title);
    }

    const total = await Article.countDocuments({});
    console.log('\n✅ Seed magazine OpenAI terminé. Total articles en base:', total);
  } catch (err) {
    console.error('❌ Erreur:', err.message);
    if (err.response?.data) console.error(err.response.data);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seedMagazine();
