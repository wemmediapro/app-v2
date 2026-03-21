/**
 * Script tout-en-un : Restaurants du Bateau Excellence (GNV Excellent)
 * - Génère les restaurants + menus en 6 langues (FR, EN, ES, IT, DE, AR) via OpenAI
 * - Génère des images DALL-E 3 pour chaque restaurant et optionnellement pour les plats
 *
 * Usage:
 *   cd backend && node scripts/seed-restaurant-excellence-openai-all.js
 *   cd backend && node scripts/seed-restaurant-excellence-openai-all.js --menu-images
 *
 * Option --replace : supprime d'abord les restaurants existants du bateau Excellence (shipId 7)
 *
 * Prérequis: OPENAI_API_KEY dans backend/.env, MongoDB.
 * Pour les images: backend lancé (npm run start) car upload via /api/upload/image-from-base64
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'config.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const OpenAI = require('openai').default;
const Restaurant = require('../src/models/Restaurant');

const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/gnv_onboard';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const API_BASE_URL = (process.env.API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const SEED_SECRET = process.env.SEED_SCRIPT_SECRET || process.env.SEED_SECRET || '';

const WITH_MENU_IMAGES = process.argv.includes('--menu-images');
const REPLACE_EXISTING = process.argv.includes('--replace');
const MAX_DISH_IMAGES = WITH_MENU_IMAGES ? 6 : 0;

const SHIP_ID = '7';
const SHIP_NAME = 'GNV Excellent';

const RESTAURANT_TYPES = ['Restaurant à la carte', 'Restaurant Self-Service', 'Café & Snacks', 'Pizzeria saisonnière', 'Steakhouse', 'Room Service'];
const CATEGORIES = ['french', 'fastfood', 'dessert', 'seafood'];
const LANGS = ['fr', 'en', 'es', 'it', 'de', 'ar'];

const CONTEXTE_GNV_EXCELLENT = `
Contexte réel GNV Excellent (Grandi Navi Veloci) :
- Restaurant à la carte : entrées, premiers plats, viande/poisson, plats du jour préparés par les chefs. Exemples : mozzarella buffala millefeuille tomate, caponata de légumes, pizza blanche ; spaghettone crème de tomates datterino, burger Angus scamorza et oignon caramélisé ; millefeuille crème, gâteau chocolat cœur fondant.
- Restaurant Self-Service : petit-déjeuner, déjeuner, dîner, ingrédients frais, entrées, premiers plats, plats principaux, fruits, desserts.
- Pizzeria et Snack Bar à bord. Menu enfants disponible.
- Options végétariennes, sans gluten, sans lactose. Style méditerranéen et italien.
`;

function slug(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/(^-|-$)/g, '')
    .toLowerCase()
    .slice(0, 25);
}

function buildRestaurantImagePrompt(restaurant) {
  const name = restaurant.name || 'Restaurant';
  const type = restaurant.type || 'Restaurant à la carte';
  const category = restaurant.category || 'french';
  const desc = (restaurant.description || '').slice(0, 200);
  const style = {
    french: 'cuisine française raffinée, ambiance bistrot élégant',
    seafood: 'fruits de mer et poissons, vue mer, décoration maritime',
    fastfood: 'espace convivial moderne, snacks et formules',
    dessert: 'pâtisserie et café, douceur et gourmandise',
  }[category] || 'restaurant confortable';
  return `Professional photo of a cruise ship / ferry restaurant interior. ${name}, ${type}. Style: ${style}. ${desc ? `Ambiance: ${desc}.` : ''} Clean, welcoming, good lighting, no text or logos. High quality, realistic, suitable for a travel app.`;
}

function buildDishImagePrompt(dishName, category) {
  const cat = (category || 'main').toLowerCase();
  const style = cat.includes('dessert') ? 'elegant dessert on a plate' : cat.includes('appetizer') || cat.includes('Entrées') ? 'appetizer starter dish' : cat.includes('beverage') || cat.includes('cocktail') || cat.includes('Boissons') ? 'glass drink' : 'main course dish';
  return `Professional food photography: ${dishName}. ${style}, restaurant quality, white plate or table, soft lighting, appetizing, no text. Single dish, centered.`;
}

async function generateAndUploadImage(openai, prompt, filename) {
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
  if (!img?.b64_json) {throw new Error('Pas d’image retournée par OpenAI');}

  const uploadUrl = `${API_BASE_URL}/api/upload/image-from-base64`;
  const headers = { 'Content-Type': 'application/json' };
  if (SEED_SECRET) {headers['X-Seed-Secret'] = SEED_SECRET;}

  const res = await fetch(uploadUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({ base64: img.b64_json, filename }),
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Upload échoué (${res.status}): ${errBody}`);
  }
  const data = await res.json();
  const url = data?.image?.url || data?.image?.path;
  if (!url) {throw new Error('Réponse upload sans image.url/path');}
  const pathRel = data.image.path || url.replace(/^https?:\/\/[^/]+/, '');
  return { url: pathRel.startsWith('/') ? pathRel : url, path: data.image.path };
}

async function generateRestaurantsWithTranslations(openai) {
  const systemPrompt = `Tu es responsable des restaurants à bord des ferries GNV (Bateau GNV Excellent, lignes Méditerranée). Tu génères des restaurants avec menus complets et traductions dans 6 langues.
${CONTEXTE_GNV_EXCELLENT}

Renvoie UNIQUEMENT un objet JSON valide, sans texte avant ou après, avec la structure exacte suivante :
{
  "restaurants": [
    {
      "name": "Nom du restaurant en français",
      "type": "une parmi: ${RESTAURANT_TYPES.join(', ')}",
      "category": "une parmi: ${CATEGORIES.join(', ')}",
      "location": "ex: Pont 7 - Babor",
      "description": "1-3 phrases, ambiance et style",
      "rating": 4.0 à 4.8,
      "priceRange": "€ ou €€ ou €€€ ou €€€€",
      "openingHours": "ex: 07h00 - 22h00",
      "specialties": ["spécialité 1", "spécialité 2", ...],
      "menu": [
        { "id": 1, "name": "Nom du plat", "description": "Description courte", "price": 12.5, "category": "Entrées|Plats|Desserts|Boissons|Snacks|Formules", "isPopular": true/false, "allergens": ["gluten"] ou [] }
      ],
      "translations": {
        "fr": { "name": "Nom FR", "description": "Description FR", "menu": [ { "name": "Nom plat", "description": "Description plat" }, ... ] },
        "en": { "name": "Name EN", "description": "Description EN", "menu": [ ... ] },
        "es": { "name": "Nombre ES", "description": "Descripción ES", "menu": [ ... ] },
        "it": { "name": "Nome IT", "description": "Descrizione IT", "menu": [ ... ] },
        "de": { "name": "Name DE", "description": "Beschreibung DE", "menu": [ ... ] },
        "ar": { "name": "الاسم بالعربية", "description": "الوصف بالعربية", "menu": [ ... ] }
      }
    }
  ]
}

Règles :
- Génère EXACTEMENT 4 restaurants différents, un de chaque type suivant : 1) "Restaurant à la carte" (category french), 2) "Restaurant Self-Service" (category fastfood), 3) "Café & Snacks" (category dessert), 4) "Pizzeria saisonnière" (category seafood). Chaque restaurant doit avoir un nom et un emplacement distincts (ex: Pont 7 - Babor, Pont 8 - Tribord, etc.).
- Chaque restaurant a au moins 8 plats (entrées, plats, desserts, boissons). Le tableau "menu" dans translations doit avoir exactement le même nombre d’éléments que "menu" du restaurant, dans le même ordre.
- Pour chaque langue (fr, en, es, it, de, ar), fournis name, description du restaurant et menu = tableau de { name, description } pour chaque plat.`;

  const userPrompt = 'Génère EXACTEMENT 4 restaurants pour le Bateau GNV Excellent : 1) Un restaurant à la carte (cuisine raffinée), 2) Un restaurant Self-Service (buffet), 3) Un Café & Snacks (sandwichs, pâtisseries, boissons), 4) Une Pizzeria saisonnière. Chaque restaurant avec un menu complet (au moins 8 plats) et les traductions dans les 6 langues (fr, en, es, it, de, ar). Style GNV Méditerranée/italien. Réponse : uniquement l\'objet JSON avec la clé "restaurants" contenant exactement 4 éléments.';

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
  const list = data.restaurants || (Array.isArray(data) ? data : []);
  return Array.isArray(list) ? list : [];
}

async function main() {
  if (!OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY manquant. Définissez-le dans backend/.env');
    process.exit(1);
  }

  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  console.log('🔌 Connexion MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connecté:', mongoose.connection.name);

  if (REPLACE_EXISTING) {
    const deleted = await Restaurant.deleteMany({ shipId: SHIP_ID });
    console.log(`🗑️  ${deleted.deletedCount} restaurant(s) existants du bateau Excellence supprimés.`);
  }

  console.log('🤖 Génération des restaurants Bateau Excellence + menus multilingues (OpenAI)...');
  const generated = await generateRestaurantsWithTranslations(openai);
  if (!generated.length) {
    console.error('❌ Aucun restaurant généré par OpenAI');
    await mongoose.disconnect();
    process.exit(1);
  }
  console.log(`   Reçu ${generated.length} restaurant(s).`);

  const createdIds = [];
  for (let i = 0; i < generated.length; i++) {
    const r = generated[i];
    const name = (r.name || `Restaurant Bateau Excellence ${i + 1}`).trim().slice(0, 100);
    const type = RESTAURANT_TYPES.includes(r.type) ? r.type : RESTAURANT_TYPES[i % RESTAURANT_TYPES.length];
    const category = CATEGORIES.includes(r.category) ? r.category : CATEGORIES[i % CATEGORIES.length];
    const location = (r.location || `Pont ${7 + i} - GNV Excellent`).trim();
    const description = (r.description || 'Restaurant à bord du Bateau Excellence.').trim().slice(0, 500);
    const rating = typeof r.rating === 'number' ? Math.min(5, Math.max(0, r.rating)) : 4.5;
    const priceRange = ['€', '€€', '€€€', '€€€€'].includes(r.priceRange) ? r.priceRange : '€€';
    const openingHours = (r.openingHours || '08h00 - 22h00').trim();
    const specialties = Array.isArray(r.specialties) ? r.specialties.slice(0, 8).map(s => String(s).trim()) : [];

    const menu = (r.menu || []).map((item, idx) => ({
      id: typeof item.id === 'number' ? item.id : idx + 1,
      name: (item.name || `Plat ${idx + 1}`).trim(),
      description: (item.description || '').trim() || 'Délicieuse préparation maison.',
      price: typeof item.price === 'number' ? Math.max(0, item.price) : 12.9,
      category: (item.category || 'Plats').trim(),
      isPopular: Boolean(item.isPopular),
      allergens: Array.isArray(item.allergens) ? item.allergens.map(String) : [],
      image: `https://picsum.photos/seed/gnv-menu-${i}-${idx}/400/300`,
    })).filter(m => m.name);

    if (menu.length === 0) {
      menu.push(
        { id: 1, name: 'Plat du jour', description: 'Selon arrivage', price: 14.9, category: 'Plats', isPopular: true, allergens: [], image: 'https://picsum.photos/seed/gnv-menu/400/300' },
        { id: 2, name: 'Salade méditerranéenne', description: 'Quinoa, feta, olives', price: 10.5, category: 'Entrées', isPopular: false, allergens: ['lactose'], image: 'https://picsum.photos/seed/gnv-menu/400/300' },
        { id: 3, name: 'Dessert du chef', description: 'Sélection du jour', price: 6.5, category: 'Desserts', isPopular: true, allergens: [], image: 'https://picsum.photos/seed/gnv-menu/400/300' },
      );
    }

    const translations = {};
    const rawTranslations = r.translations || {};
    for (const lang of LANGS) {
      const t = rawTranslations[lang];
      if (!t) {continue;}
      const entry = {
        name: (t.name || name).trim().slice(0, 200),
        description: (t.description || description).trim().slice(0, 2000),
      };
      if (Array.isArray(t.menu) && t.menu.length === menu.length) {
        entry.menu = t.menu.map((item, idx) => ({
          name: (item && item.name ? item.name : menu[idx].name).trim().slice(0, 200),
          description: (item && item.description ? item.description : menu[idx].description).trim().slice(0, 500),
        }));
      } else if (Array.isArray(t.menu)) {
        entry.menu = menu.map((m, idx) => ({
          name: (t.menu[idx] && t.menu[idx].name) ? t.menu[idx].name.trim().slice(0, 200) : m.name,
          description: (t.menu[idx] && t.menu[idx].description) ? t.menu[idx].description.trim().slice(0, 500) : m.description,
        }));
      }
      translations[lang] = entry;
    }
    if (!translations.fr) {
      translations.fr = {
        name: name.slice(0, 200),
        description: description.slice(0, 2000),
        menu: menu.map(m => ({ name: m.name, description: m.description })),
      };
    }

    const placeholderImage = `https://picsum.photos/seed/gnv-excellence-${slug(name)}/800/400`;
    const doc = await Restaurant.create({
      name,
      type,
      category,
      location,
      description,
      rating,
      priceRange,
      image: placeholderImage,
      isOpen: true,
      openingHours,
      specialties,
      menu,
      promotions: [],
      isActive: true,
      shipId: SHIP_ID,
      shipName: SHIP_NAME,
      translations: Object.keys(translations).length ? translations : undefined,
    });
    createdIds.push(doc._id);
    console.log(`✅ Restaurant créé: ${name} (${menu.length} plats, ${Object.keys(translations).length} langues)`);
  }

  // --- Génération des images DALL-E ---
  const testRes = await fetch(`${API_BASE_URL}/api/health`, { method: 'GET' }).catch(() => null);
  if (!testRes?.ok) {
    console.log('\n⚠️  Backend non disponible à', API_BASE_URL);
    console.log('   Les restaurants ont été créés avec des images placeholder (Picsum).');
    console.log('   Pour générer les images DALL-E : démarrez le backend (npm run start) puis relancez :');
    console.log('   node scripts/seed-restaurant-images-openai.js');
    console.log('   (ou relancez ce script après avoir démarré le backend).');
    await mongoose.disconnect();
    process.exit(0);
  }

  console.log('\n🖼️  Génération des images DALL-E et upload via', API_BASE_URL);
  const restaurantsToImage = await Restaurant.find({ _id: { $in: createdIds } }).lean();
  for (let i = 0; i < restaurantsToImage.length; i++) {
    const r = restaurantsToImage[i];
    const label = r.name || `Restaurant ${i + 1}`;
    try {
      const safeName = slug(r.name) || `restaurant-${i + 1}`;
      const filenameResto = `restaurant-excellence-${(r._id || safeName).toString().slice(-8)}-${safeName}.png`;
      console.log(`   [${i + 1}/${restaurantsToImage.length}] ${label} — image restaurant...`);
      const promptResto = buildRestaurantImagePrompt(r);
      const { url } = await generateAndUploadImage(openai, promptResto, filenameResto);
      await Restaurant.updateOne({ _id: r._id }, { $set: { image: url } });
      console.log('      ✅ Image restaurant uploadée.');

      if (MAX_DISH_IMAGES > 0 && Array.isArray(r.menu) && r.menu.length > 0) {
        const menuToProcess = r.menu.slice(0, MAX_DISH_IMAGES);
        for (let j = 0; j < menuToProcess.length; j++) {
          const item = menuToProcess[j];
          if (!item.name) {continue;}
          try {
            const dishPrompt = buildDishImagePrompt(item.name, item.category);
            const dishSlug = slug(item.name) || `plat-${j + 1}`;
            const dishFilename = `dish-excellence-${(r._id || '').toString().slice(-6)}-${j + 1}-${dishSlug}.png`;
            const { url: dishUrl } = await generateAndUploadImage(openai, dishPrompt, dishFilename);
            await Restaurant.updateOne(
              { _id: r._id, 'menu.id': item.id },
              { $set: { 'menu.$.image': dishUrl } },
            );
            console.log(`      ✅ Plat: ${item.name}`);
          } catch (err) {
            console.warn(`      ⚠️ Plat "${item.name}": ${err.message}`);
          }
        }
      }
    } catch (err) {
      console.error(`   ❌ ${label}: ${err.message}`);
    }
  }

  console.log('\n✅ Terminé. Restaurants Bateau Excellence + menus multilingues + images générés.');
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Erreur:', err);
  process.exit(1);
});
