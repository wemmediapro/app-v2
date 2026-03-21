/**
 * Script : repérer les plats dont l'image est manquante sur le disque,
 * générer les images avec DALL-E 3 (taille réduite 1024x1024), les uploader via l'API.
 *
 * Usage:
 *   1. Backend démarré : npm run start (ou node server.js)
 *   2. cd backend && node scripts/seed-dish-missing-images-openai.js
 *
 * Prérequis: OPENAI_API_KEY, MongoDB, backend lancé, SEED_SCRIPT_SECRET (ou SEED_SECRET) dans .env/config.env.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'config.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const OpenAI = require('openai').default;
const Restaurant = require('../src/models/Restaurant');
const config = require('../src/config');

const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/gnv_onboard';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const API_BASE_URL = (process.env.API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const SEED_SECRET =
  process.env.SEED_SCRIPT_SECRET ||
  process.env.SEED_SECRET ||
  (process.env.NODE_ENV !== 'production' ? 'dev-seed' : '');
const IMAGES_DIR = config.paths.images;

function slug(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/(^-|-$)/g, '')
    .toLowerCase()
    .slice(0, 25);
}

/** Extrait le nom de fichier d'un path type /uploads/images/dish-xxx.png */
function filenameFromImagePath(imagePath) {
  if (!imagePath || typeof imagePath !== 'string') {
    return null;
  }
  const p = imagePath.replace(/\\/g, '/').trim();
  const match = p.match(/\/uploads\/images\/([^/]+)$/i) || p.match(/\/([^/]+)$/);
  return match ? match[1] : null;
}

/** Vérifie si le fichier image existe sur le disque */
function imageFileExists(imagePath) {
  const name = filenameFromImagePath(imagePath);
  if (!name) {
    return false;
  }
  const fullPath = path.join(IMAGES_DIR, name);
  return fs.existsSync(fullPath);
}

/** Prompt DALL-E pour un plat (petite image appétissante) */
function buildDishImagePrompt(dishName, category, description) {
  const cat = String(category || 'main').toLowerCase();
  let style;
  if (cat.includes('dessert') || cat.includes('desserts')) {
    style = 'elegant dessert on a plate, sweet, appetizing';
  } else if (cat.includes('entrée') || cat.includes('appetizer') || cat.includes('starter') || cat.includes('entree')) {
    style = 'appetizer starter dish on a plate, fresh';
  } else if (
    cat.includes('boisson') ||
    cat.includes('beverage') ||
    cat.includes('cocktail') ||
    cat.includes('drink') ||
    cat.includes('café') ||
    cat.includes('cafe') ||
    cat.includes('soda') ||
    cat.includes('vin') ||
    cat.includes('wine') ||
    cat.includes('jus') ||
    cat.includes('juice')
  ) {
    style = 'professional photo of a drink in a glass, beverage, refreshing, clean background, no text';
  } else {
    style = 'main course dish on a plate, restaurant quality, savory';
  }
  const desc = (description || '').slice(0, 80);
  return `Professional food photography: ${dishName}. ${style}, soft lighting, appetizing, no text. Single item, centered.${desc ? ` Dish: ${desc}.` : ''}`;
}

/** Génère une image DALL-E 3 en petite taille et l'uploade via l'API. Retourne le path relatif. */
async function generateAndUploadDishImage(openai, prompt, filename) {
  const response = await openai.images.generate({
    model: 'dall-e-3',
    prompt,
    n: 1,
    size: '1024x1024', // petite taille pour plats (moins cher, suffisant pour vignettes)
    quality: 'standard',
    response_format: 'b64_json',
    style: 'natural',
  });
  const img = response.data?.[0];
  if (!img?.b64_json) {
    throw new Error("Pas d'image retournée par OpenAI");
  }

  const uploadUrl = `${API_BASE_URL}/api/upload/image-from-base64`;
  const headers = { 'Content-Type': 'application/json' };
  if (SEED_SECRET) {
    headers['X-Seed-Secret'] = SEED_SECRET;
  }

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
  if (!url) {
    throw new Error('Réponse upload sans image.url/path');
  }
  let pathRel = data.image.path || url.replace(/^https?:\/\/[^/]+/, '');
  if (!pathRel.startsWith('/')) {
    pathRel = '/' + pathRel;
  }
  return pathRel;
}

async function main() {
  if (!OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY manquant. Définissez-le dans backend/.env ou config.env');
    process.exit(1);
  }
  if (!SEED_SECRET && process.env.NODE_ENV === 'production') {
    console.error(
      '❌ SEED_SCRIPT_SECRET (ou SEED_SECRET) manquant en production pour POST /api/upload/image-from-base64.'
    );
    process.exit(1);
  }

  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  console.log('🔌 Connexion MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connecté:', mongoose.connection.name);

  const healthRes = await fetch(`${API_BASE_URL}/api/health`, { method: 'GET' }).catch(() => null);
  if (!healthRes?.ok) {
    console.error('❌ Le backend ne répond pas à', API_BASE_URL);
    console.error('   Démarrez le backend (npm run start) puis relancez ce script.');
    await mongoose.disconnect();
    process.exit(1);
  }
  console.log('🖼️  Backend OK, upload via', API_BASE_URL + '/api/upload/image-from-base64\n');

  const restaurants = await Restaurant.find({ isActive: { $ne: false } }).lean();
  const missing = [];

  for (const r of restaurants) {
    const menu = r.menu || [];
    for (let j = 0; j < menu.length; j++) {
      const item = menu[j];
      const imgPath = item.image || '';
      if (!imgPath || !imgPath.includes('/uploads/')) {
        continue;
      }
      if (imageFileExists(imgPath)) {
        continue;
      }
      missing.push({
        restaurantId: r._id,
        restaurantName: r.name,
        menuIndex: j,
        itemId: item.id,
        itemName: item.name,
        itemCategory: item.category,
        itemDescription: item.description,
        expectedFilename:
          filenameFromImagePath(imgPath) || `dish-${r._id.toString().slice(-6)}-${j + 1}-${slug(item.name)}.png`,
      });
    }
  }

  if (missing.length === 0) {
    console.log('✅ Aucune image de plat manquante. Tous les fichiers sont présents.');
    await mongoose.disconnect();
    process.exit(0);
    return;
  }

  console.log(`📋 ${missing.length} plat(s) sans fichier image. Génération DALL-E 3 (1024x1024) + upload...\n`);

  let ok = 0;
  let err = 0;

  for (let i = 0; i < missing.length; i++) {
    const m = missing[i];
    const label = `${m.restaurantName} — ${m.itemName}`;
    try {
      const prompt = buildDishImagePrompt(m.itemName, m.itemCategory, m.itemDescription);
      const dishFilename = m.expectedFilename;
      console.log(`   [${i + 1}/${missing.length}] ${label} ...`);
      const pathRel = await generateAndUploadDishImage(openai, prompt, dishFilename);
      await Restaurant.updateOne({ _id: m.restaurantId, 'menu.id': m.itemId }, { $set: { 'menu.$.image': pathRel } });
      console.log(`      ✅ Enregistré: ${pathRel}`);
      ok++;
    } catch (e) {
      console.warn(`      ⚠️ ${e.message}`);
      err++;
    }
  }

  console.log(`\n✅ Terminé. ${ok} image(s) générée(s) et uploadée(s), ${err} erreur(s).`);
  await mongoose.disconnect();
  process.exit(err > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('❌ Erreur:', err);
  process.exit(1);
});
