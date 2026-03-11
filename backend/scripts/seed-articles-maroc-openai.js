/**
 * Génère 20 articles sur le Maroc (OpenAI), en plusieurs langues (fr, en, es, it, de, ar),
 * génère une image par article (DALL-E 3) et insère le tout en base MongoDB.
 *
 * Usage: cd backend && node scripts/seed-articles-maroc-openai.js
 * Prérequis: OPENAI_API_KEY dans backend/.env, MongoDB accessible.
 * Optionnel: Backend lancé pour upload images via API ; sinon les images sont écrites dans public/uploads/images/
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'config.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const OpenAI = require('openai').default;
const Article = require('../src/models/Article');
const { generateTranslationsForArticle } = require('../src/lib/article-translations-openai');

const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/gnv_onboard';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const API_BASE_URL = (process.env.API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const SEED_SECRET = process.env.SEED_SCRIPT_SECRET || process.env.SEED_SECRET || '';

const CATEGORIES = ['Actualités', 'Voyage', 'Culture', 'Gastronomie', 'Divertissement', 'Sport', 'Lifestyle'];
const NUM_ARTICLES = parseInt(process.env.SUPPLEMENTARY_ARTICLES || process.env.NUM_ARTICLES || '20', 10) || 20;

// Dossier images : même logique que l'API (backend/public/uploads/images)
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
 * Génère les sujets et contenus des 20 articles sur le Maroc (en français).
 */
async function generateMoroccoArticles(openai) {
  const systemPrompt = `Tu es rédacteur pour un magazine voyage et lifestyle. Tu dois proposer exactement ${NUM_ARTICLES} articles sur le Maroc, variés (tourisme, culture, gastronomie, actualités, sport, lifestyle, divertissement).
Pour chaque article fournis :
- title : titre accrocheur en français (max 200 caractères)
- excerpt : résumé en 1-2 phrases (max 500 caractères)
- content : corps de l'article en 2-4 paragraphes, style magazine (max 2500 caractères)
- category : une des valeurs exactes : ${CATEGORIES.join(', ')}

Réponse : UNIQUEMENT un objet JSON valide, sans texte avant ou après :
{
  "articles": [
    { "title": "...", "excerpt": "...", "content": "...", "category": "..." },
    ...
  ]
}`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Génère exactement ${NUM_ARTICLES} articles (pas moins) sur le Maroc. Thèmes variés : villes (Marrakech, Fès, Chefchaouen, Essaouira, Casablanca), cuisine, désert du Sahara, médinas, plages, art gnawa, tapis berbère, sport (surf, randonnée), festivals, traditions mariage, souks, etc. Format JSON avec clé "articles" contenant 20 objets.` },
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
    else throw new Error('JSON invalide');
  }
  const articles = data.articles || data;
  if (!Array.isArray(articles) || articles.length === 0) throw new Error('Aucun article dans la réponse');
  let result = articles.slice(0, NUM_ARTICLES).map((a) => ({
    title: String(a.title || '').trim().slice(0, 200),
    excerpt: String(a.excerpt || '').trim().slice(0, 500),
    content: String(a.content || '').trim().slice(0, 10000),
    category: CATEGORIES.includes(a.category) ? a.category : CATEGORIES[0],
  }));
  // Si moins de 20, compléter par un second appel
  if (result.length < NUM_ARTICLES) {
    const comp = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Génère encore ${NUM_ARTICLES - result.length} articles sur le Maroc (sujets différents : Ouarzazate, vallée du Dadès, Tanger, Agadir, thé à la menthe, henné, riads, jardins Majorelle, etc.). Format JSON avec clé "articles".` },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.8,
    });
    const raw2 = comp.choices[0]?.message?.content?.trim();
    if (raw2) {
      try {
        const match2 = raw2.match(/\{[\s\S]*\}/);
        const data2 = JSON.parse(match2 ? match2[0] : raw2);
        const extra = (data2.articles || data2) || [];
        result.push(...extra.slice(0, NUM_ARTICLES - result.length).map((a) => ({
          title: String(a.title || '').trim().slice(0, 200),
          excerpt: String(a.excerpt || '').trim().slice(0, 500),
          content: String(a.content || '').trim().slice(0, 10000),
          category: CATEGORIES.includes(a.category) ? a.category : CATEGORIES[0],
        })));
      } catch (_) {}
    }
  }
  return result.slice(0, NUM_ARTICLES);
}

/**
 * Génère une image DALL-E 3 pour l'article et la sauvegarde (fichier local ou API).
 * Retourne le chemin relatif pour imageUrl (ex: /uploads/images/xxx.png).
 */
async function generateAndSaveImage(openai, article, index) {
  const title = article.title || 'Maroc';
  const category = article.category || 'Voyage';
  const prompt = `Professional editorial photo for a travel and lifestyle magazine article about Morocco. Topic: ${title}. Category: ${category}. High quality, atmospheric, no text or logos. Suitable for magazine cover or hero image.`;
  const response = await openai.images.generate({
    model: 'dall-e-3',
    prompt,
    n: 1,
    size: '1792x1024',
    quality: 'standard',
    response_format: 'b64_json',
    style: 'natural',
  });
  const img = response.data?.[0];
  if (!img?.b64_json) throw new Error('Pas d’image retournée par OpenAI');

  const filename = `maroc-article-${index + 1}-${slug(title) || index}.png`;
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
  const finalName = /\.(png|jpe?g|gif|webp)$/i.test(safeFilename) ? safeFilename : safeFilename + '.png';

  // Essayer l'upload via l'API si le backend est disponible
  const health = await fetch(`${API_BASE_URL}/api/health`).catch(() => null);
  if (health?.ok) {
    const uploadUrl = `${API_BASE_URL}/api/upload/image-from-base64`;
    const headers = { 'Content-Type': 'application/json' };
    if (SEED_SECRET) headers['X-Seed-Secret'] = SEED_SECRET;
    const res = await fetch(uploadUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ base64: img.b64_json, filename: finalName }),
    });
    if (res.ok) {
      const data = await res.json();
      const pathRel = data?.image?.path || (data?.image?.url || '').replace(/^https?:\/\/[^/]+/, '');
      if (pathRel) return pathRel.startsWith('/') ? pathRel : `/${pathRel}`;
    }
  }

  // Sinon écriture directe dans public/uploads/images/
  if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });
  const fullPath = path.join(IMAGES_DIR, finalName);
  fs.writeFileSync(fullPath, Buffer.from(img.b64_json, 'base64'));
  return `/uploads/images/${finalName}`;
}

async function run() {
  if (!OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY manquant. Définissez-le dans backend/.env');
    process.exit(1);
  }

  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  try {
    console.log('🔌 Connexion MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connecté:', mongoose.connection.name);

    console.log(`\n📝 Génération de ${NUM_ARTICLES} articles sur le Maroc (OpenAI)...`);
    const articlesFr = await generateMoroccoArticles(openai);
    console.log(`   ✅ ${articlesFr.length} articles générés.\n`);

    let created = 0;
    for (let i = 0; i < articlesFr.length; i++) {
      const art = articlesFr[i];
      console.log(`   [${i + 1}/${articlesFr.length}] ${art.title.slice(0, 50)}...`);

      try {
        // Traductions (fr, en, es, it, de, ar)
        console.log('      🌐 Traductions...');
        const translations = await generateTranslationsForArticle(
          openai,
          art.title,
          art.excerpt,
          art.content,
          art.category
        );

        // Image DALL-E 3
        console.log('      🖼️  Image...');
        const imageUrl = await generateAndSaveImage(openai, art, i);

        const readingTime = Math.max(1, Math.ceil((art.content.split(/\s+/).length || 100) / 200));

        await Article.create({
          title: art.title,
          excerpt: art.excerpt,
          content: art.content,
          category: art.category,
          author: 'Magazine Maroc',
          imageUrl,
          countries: ['Maroc'],
          tags: ['Maroc', art.category].filter(Boolean),
          metaDescription: art.excerpt.slice(0, 160),
          isPublished: true,
          status: 'published',
          publishedAt: new Date(),
          featured: i < 3,
          allowComments: true,
          readingTime,
          views: 0,
          likes: 0,
          isActive: true,
          translations,
        });
        created++;
        console.log('      ✅ Article enregistré en base.');
      } catch (err) {
        console.error('      ❌', err.message);
      }
    }

    console.log(`\n✅ Terminé. ${created}/${articlesFr.length} articles sur le Maroc ajoutés (multilingues + images).`);
  } catch (err) {
    console.error('❌ Erreur:', err.message);
    if (err.response?.data) console.error(err.response.data);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
