/**
 * Seed magazine : 10 articles sur le Maroc, multilingues (FR, EN, ES, IT, DE, AR).
 * Chaque langue est stockée en base (pas de traduction en ligne).
 * Usage: node scripts/seed-magazine-maroc-10-openai.js (depuis backend/)
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
const LANGS = ['fr', 'en', 'es', 'it', 'de', 'ar'];

function slug(str) {
  return String(str).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/(^-|-$)/g, '').toLowerCase().slice(0, 30);
}

function imageUrlForArticle(index, title) {
  const seed = `maroc-${index}-${slug(title) || 'article'}`;
  return `https://picsum.photos/seed/${seed}/800/600`;
}

function estimateReadingTime(content) {
  const words = (content || '').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(2, Math.min(15, Math.round(words / 180)));
}

async function generateMarocArticles(openai, count) {
  const systemPrompt = `Tu es rédacteur pour le magazine GNV OnBoard (ferry vers le Maroc, traversées Méditerranée).
Tu dois renvoyer UNIQUEMENT un objet JSON de la forme: { "articles": [ ... ] }, sans texte avant ou après.
Génère exactement ${count} articles. Tous les articles doivent parler du MAROC (destinations, culture, gastronomie, villes, désert, côte, ferry GNV vers le Maroc, etc.).
Chaque article doit avoir:
- title (string, français, titre accrocheur, max 200 caractères)
- excerpt (string, français, résumé 1-2 phrases, max 500 caractères)
- content (string, français, corps 2-4 paragraphes)
- category (string, une parmi: ${CATEGORIES.join(', ')})
- author (string, ex: Rédaction GNV)
- tags (array de 3-5 strings, ex: maroc, voyage, ferry, ...)
- translations (object) avec pour chaque clé "fr", "en", "es", "it", "de", "ar" un objet { title, excerpt, content } dans CETTE langue. Donc translations.fr en français, translations.en en anglais, translations.ar en arabe, etc.`;

  const userPrompt = `Génère ${count} articles sur le MAROC, multilingues. Chaque article doit avoir translations.fr (français), translations.en (anglais), translations.es (espagnol), translations.it (italien), translations.de (allemand), translations.ar (arabe). Thèmes variés: Marrakech, Fès, Tanger, Casablanca, gastronomie marocaine, désert du Sahara, côte atlantique, ferry GNV vers le Maroc, culture, souks, médinas, etc. Réponse: uniquement l'objet JSON avec la clé "articles".`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.75,
  });

  const raw = completion.choices[0]?.message?.content?.trim();
  if (!raw) throw new Error('Réponse OpenAI vide');
  const data = JSON.parse(raw);
  const list = data.articles || data.items || (Array.isArray(data) ? data : []);
  return Array.isArray(list) ? list.slice(0, count) : [];
}

async function seedMarocMagazine() {
  if (!OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY manquant (backend/.env)');
    process.exit(1);
  }
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  try {
    console.log('🔌 Connexion MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connecté:', mongoose.connection.name);

    let articles = [];
    for (let b = 0; b < 5; b++) {
      const size = b < 4 ? 2 : 2;
      console.log(`🤖 Génération batch ${b + 1}/5 (${size} article(s) sur le Maroc, multilingue)...`);
      const batch = await generateMarocArticles(openai, size);
      articles = articles.concat(batch);
    }

    if (articles.length === 0) {
      throw new Error('Aucun article généré par OpenAI');
    }
    console.log(`   Reçu ${articles.length} article(s).`);

    for (let i = 0; i < articles.length; i++) {
      const a = articles[i];
      const title = (a.title || a.translations?.fr?.title || `Maroc ${i + 1}`).slice(0, 200);
      const excerpt = (a.excerpt || a.translations?.fr?.excerpt || '').slice(0, 500);
      const content = a.content || a.translations?.fr?.content || '';
      const category = CATEGORIES.includes(a.category) ? a.category : CATEGORIES[i % CATEGORIES.length];
      const author = a.author || 'Rédaction GNV';
      const tags = Array.isArray(a.tags) ? a.tags.slice(0, 5).map(String) : ['maroc', 'voyage', 'ferry', 'GNV'];

      const translations = {};
      for (const code of LANGS) {
        const t = a.translations?.[code] || (code === 'fr' ? { title: a.title, excerpt: a.excerpt, content: a.content } : null);
        if (t && (t.title || t.excerpt || t.content)) {
          translations[code] = {
            title: (t.title || title).slice(0, 200),
            excerpt: (t.excerpt || excerpt).slice(0, 500),
            content: (t.content || content).slice(0, 50000),
          };
        } else {
          translations[code] = { title: title.slice(0, 200), excerpt: excerpt.slice(0, 500), content };
        }
      }
      if (!translations.fr) {
        translations.fr = { title, excerpt, content };
      }

      const doc = {
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
        featured: i < 2,
        readingTime: estimateReadingTime(content),
        views: 0,
        likes: 0,
        isActive: true,
        allowComments: true,
        translations,
      };
      await Article.create(doc);
      console.log(`✅ ${i + 1}/10 — ${title.slice(0, 50)}...`);
    }

    const total = await Article.countDocuments({});
    console.log('\n✅ Seed terminé : 10 articles sur le Maroc insérés (chaque langue en base). Total articles:', total);
  } catch (err) {
    console.error('❌ Erreur:', err.message);
    if (err.response?.data) console.error(err.response.data);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seedMarocMagazine();
