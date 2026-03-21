/**
 * Génère des images produits (DALL-E 3) et les UPLOADE via l’API backend.
 * Usage: backend démarré puis cd backend && node scripts/seed-shop-images-openai.js
 * Prérequis: OPENAI_API_KEY, MongoDB, backend lancé.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'config.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const OpenAI = require('openai').default;
const Product = require('../src/models/Product');

const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/gnv_onboard';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const API_BASE_URL = (process.env.API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const SEED_SECRET = process.env.SEED_SCRIPT_SECRET || process.env.SEED_SECRET || '';

const CATEGORIES = [
  'souvenirs',
  'fashion',
  'accessories',
  'food',
  'beverages',
  'electronics',
  'books',
  'toys',
  'dutyfree',
];

function slug(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/(^-|-$)/g, '')
    .toLowerCase()
    .slice(0, 25);
}

function buildProductImagePrompt(product) {
  const name = product.name || 'Product';
  const category = product.category || 'souvenirs';
  const desc = (product.description || '').slice(0, 150);
  const style =
    {
      souvenirs: 'souvenir gift item, ferry cruise themed',
      fashion: 'fashion clothing item, clean product shot',
      accessories: 'accessory product, lifestyle',
      food: 'food product, packaged or gourmet',
      beverages: 'beverage bottle or drink, professional',
      electronics: 'electronic device, modern tech product',
      books: 'book or magazine, cover visible',
      toys: 'toy or game product, family friendly',
      dutyfree: 'duty free product, perfume or luxury',
    }[category] || 'product for cruise ferry shop';
  return `Professional product photography: ${name}. ${style}. ${desc ? desc + '.' : ''} White or neutral background, clean, high quality, no text overlay. Single product centered. Suitable for e-commerce.`;
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
  if (!img?.b64_json) {
    throw new Error('Pas d’image retournée par OpenAI');
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
    throw new Error(`Upload échoué (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  const pathRel = data?.image?.path || (data?.image?.url || '').replace(/^https?:\/\/[^/]+/, '');
  if (!pathRel) {
    throw new Error('Réponse upload sans image.path');
  }
  return pathRel.startsWith('/') ? pathRel : `/${pathRel}`;
}

async function main() {
  if (!OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY manquant (backend/.env ou config.env)');
    process.exit(1);
  }
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  console.log('🔌 Connexion MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connecté:', mongoose.connection.name);

  const health = await fetch(`${API_BASE_URL}/api/health`).catch(() => null);
  if (!health?.ok) {
    console.error('❌ Backend non disponible à', API_BASE_URL);
    await mongoose.disconnect();
    process.exit(1);
  }

  const products = await Product.find({ isActive: { $ne: false } }).lean();
  console.log(`\n🛒 ${products.length} produit(s). Génération + upload des images...\n`);

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const label = p.name || `Produit ${i + 1}`;
    try {
      const safeName = slug(p.name) || `product-${i + 1}`;
      const filename = `shop-${(p._id || '').toString().slice(-8)}-${safeName}.png`;
      console.log(`   [${i + 1}/${products.length}] ${label}...`);
      const prompt = buildProductImagePrompt(p);
      const imagePath = await generateAndUploadImage(openai, prompt, filename);
      await Product.updateOne(
        { _id: p._id },
        { $set: { images: [{ url: imagePath, alt: p.name || '', isPrimary: true }] } }
      );
      console.log('      ✅ Image uploadée et produit mis à jour.');
    } catch (err) {
      console.error(`   ❌ ${label}:`, err.message);
    }
  }

  console.log('\n✅ Shop images terminé.');
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
