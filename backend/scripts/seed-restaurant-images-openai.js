/**
 * Script : générer des images (DALL-E 3) et les UPLOADER via l’API du backend.
 * Les images passent par POST /api/upload/image-from-base64 et sont enregistrées comme les uploads manuels.
 *
 * Usage:
 *   1. Démarrer le backend : npm run start (ou node server.js)
 *   2. Dans un autre terminal : cd backend && node scripts/seed-restaurant-images-openai.js
 *
 * Option: --menu-images  pour générer aussi des images pour plus de plats (jusqu’à 6).
 *
 * Prérequis: OPENAI_API_KEY, MongoDB, et backend lancé (pour l’upload).
 * Optionnel: SEED_SCRIPT_SECRET dans .env si vous avez sécurisé la route image-from-base64.
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
const RESTO_ONLY = process.argv.includes('--resto-only');
// Sans --menu-images et sans --resto-only : 4 images menu. Avec --menu-images : tous les plats/boissons.
const MAX_DISH_IMAGES = RESTO_ONLY ? 0 : (WITH_MENU_IMAGES ? 999 : 4);

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
  const cat = String(category || 'main').toLowerCase();
  let style;
  if (cat.includes('dessert') || cat.includes('desserts')) {
    style = 'elegant dessert on a plate, sweet, appetizing';
  } else if (cat.includes('entrée') || cat.includes('appetizer') || cat.includes('starter')) {
    style = 'appetizer starter dish on a plate, fresh';
  } else if (cat.includes('boisson') || cat.includes('beverage') || cat.includes('cocktail') || cat.includes('drink') || cat.includes('café') || cat.includes('soda') || cat.includes('vin') || cat.includes('wine') || cat.includes('jus') || cat.includes('juice')) {
    style = 'professional photo of a drink in a glass, beverage, refreshing, clean background, no text';
  } else {
    style = 'main course dish on a plate, restaurant quality, savory';
  }
  return `Professional food photography: ${dishName}. ${style}, soft lighting, appetizing, no text. Single item, centered.`;
}

/** Génère une image avec DALL-E et l’uploade via l’API backend. Retourne { url, path }. */
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
  const headers = {
    'Content-Type': 'application/json',
  };
  if (SEED_SECRET) {headers['X-Seed-Secret'] = SEED_SECRET;}

  const res = await fetch(uploadUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      base64: img.b64_json,
      filename,
    }),
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

async function main() {
  if (!OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY manquant. Définissez-le dans backend/.env ou config.env');
    process.exit(1);
  }

  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  console.log('🔌 Connexion MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connecté:', mongoose.connection.name);

  console.log('🖼️  Upload des images via', API_BASE_URL + '/api/upload/image-from-base64');
  const testRes = await fetch(`${API_BASE_URL}/api/health`, { method: 'GET' }).catch(() => null);
  if (!testRes?.ok) {
    console.error('❌ Le backend ne répond pas à', API_BASE_URL);
    console.error('   Démarrez le backend (npm run start) puis relancez ce script.');
    await mongoose.disconnect();
    process.exit(1);
  }

  const restaurants = await Restaurant.find({ isActive: { $ne: false } }).lean();
  console.log(`\n🍽️  ${restaurants.length} restaurant(s). Génération + upload des images...\n`);

  for (let i = 0; i < restaurants.length; i++) {
    const r = restaurants[i];
    const label = r.name || `Restaurant ${i + 1}`;
    try {
      const safeName = slug(r.name) || `restaurant-${i + 1}`;
      const filenameResto = `restaurant-${(r._id || safeName).toString().slice(-8)}-${safeName}.png`;
      console.log(`   [${i + 1}/${restaurants.length}] ${label} — génération image...`);
      const promptResto = buildRestaurantImagePrompt(r);
      const { url } = await generateAndUploadImage(openai, promptResto, filenameResto);
      await Restaurant.updateOne({ _id: r._id }, { $set: { image: url } });
      console.log('      ✅ Image restaurant uploadée et lien enregistré.');

      if (MAX_DISH_IMAGES > 0 && Array.isArray(r.menu) && r.menu.length > 0) {
        const menuToProcess = r.menu.slice(0, MAX_DISH_IMAGES);
        console.log(`      📋 ${menuToProcess.length} plat(s)/boisson(s) à illustrer...`);
        for (let j = 0; j < menuToProcess.length; j++) {
          const item = menuToProcess[j];
          if (!item.name) {continue;}
          try {
            const dishPrompt = buildDishImagePrompt(item.name, item.category);
            const dishSlug = slug(item.name) || `plat-${j + 1}`;
            const dishFilename = `dish-${(r._id || '').toString().slice(-6)}-${j + 1}-${dishSlug}.png`;
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
      if (err.response?.data) {console.error('      ', err.response.data);}
    }
  }

  console.log('\n✅ Terminé. Les images ont été uploadées via l’API et les restaurants mis à jour.');
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Erreur:', err);
  process.exit(1);
});
