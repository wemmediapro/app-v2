/**
 * Seed magazine : 15 articles multilingues (FR + EN, ES, IT, DE, AR) générés par OpenAI.
 * Usage: node scripts/seed-magazine-multilingual.js (depuis backend/)
 * Prérequis: OPENAI_API_KEY dans backend/.env et MongoDB accessible.
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
  return String(str).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/(^-|-$)/g, '').toLowerCase().slice(0, 30);
}

function imageUrlForArticle(index, title) {
  const seed = `magazine-${index}-${slug(title) || 'article'}`;
  return `https://picsum.photos/seed/${seed}/800/600`;
}

function estimateReadingTime(content) {
  const words = (content || '').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(2, Math.min(15, Math.round(words / 180)));
}

async function generateArticlesBatch(openai, count, offset) {
  const systemPrompt = `Tu es rédacteur pour le magazine GNV OnBoard (ferry, traversées Méditerranée, voyage à bord).
Tu dois renvoyer UNIQUEMENT un objet JSON de la forme: { "articles": [ ... ] }, sans texte avant ou après.
Génère exactement ${count} articles. Chaque article doit avoir:
- title (string, français, titre accrocheur, max 200 caractères)
- excerpt (string, français, résumé 1-2 phrases, max 500 caractères)
- content (string, français, corps 2-4 paragraphes)
- category (string, une parmi: ${CATEGORIES.join(', ')})
- author (string, nom d'auteur)
- tags (array de 3-5 strings)
- translations (object) avec pour chaque clé "en", "es", "it", "de", "ar" un objet { title, excerpt, content } traduit dans cette langue. title/excerpt/content doivent être dans la langue correspondante.`;

  const userPrompt = `Génère ${count} articles multilingues (français en principal + traductions en, es, it, de, ar). Thèmes variés: traversée, escales, gastronomie à bord, activités, destinations, culture, actualités ferry, bien-être, famille. Réponse: uniquement l'objet JSON avec la clé "articles".`;

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
  const data = JSON.parse(raw);
  const list = data.articles || data.items || (Array.isArray(data) ? data : []);
  return Array.isArray(list) ? list : [];
}

async function seedMagazine() {
  if (!OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY manquant (backend/.env)');
    process.exit(1);
  }
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  try {
    console.log('🔌 Connexion MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connecté:', mongoose.connection.name);

    let allArticles = [];
    console.log('🤖 Génération batch 1/2 (8 articles multilingues)...');
    const batch1 = await generateArticlesBatch(openai, 8, 0);
    allArticles = allArticles.concat(batch1);
    console.log('🤖 Génération batch 2/2 (7 articles multilingues)...');
    const batch2 = await generateArticlesBatch(openai, 7, 8);
    allArticles = allArticles.concat(batch2);

    const toInsert = [];
    for (let i = 0; i < allArticles.length; i++) {
      const a = allArticles[i];
      const title = (a.title || `Article ${i + 1}`).slice(0, 200);
      const excerpt = (a.excerpt || '').slice(0, 500);
      const content = a.content || '';
      const category = CATEGORIES.includes(a.category) ? a.category : CATEGORIES[i % CATEGORIES.length];
      const author = a.author || 'Rédaction GNV';
      const tags = Array.isArray(a.tags) ? a.tags.slice(0, 5).map(String) : ['voyage', 'ferry', 'GNV'];

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
        translations: Object.keys(translations).length ? translations : undefined,
      });
    }

    for (const doc of toInsert) {
      await Article.create(doc);
      console.log('✅ Article créé:', doc.title);
    }

    const total = await Article.countDocuments({});
    console.log('\n✅ Seed magazine multilingue terminé. Total articles:', total);
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
