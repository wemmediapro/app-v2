/**
 * Génère 20 produits shop avec OpenAI : contenu en français, traductions (fr, en, es, it, de, ar),
 * et une image par produit (DALL-E 3). Insère le tout en base MongoDB.
 *
 * Usage: cd backend && node scripts/seed-shop-products-openai-multilingual.js
 * Prérequis: OPENAI_API_KEY dans backend/.env, MongoDB accessible.
 * Optionnel: Backend lancé pour upload images via API ; sinon écriture dans public/uploads/images/
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'config.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const OpenAI = require('openai').default;
const Product = require('../src/models/Product');
const { generateTranslationsForProduct } = require('../src/lib/product-translations-openai');

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
const NUM_PRODUCTS = 20;

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
 * Génère les 20 produits (nom, description, catégorie, prix, etc.) en français.
 */
async function generateProducts(openai) {
  const systemPrompt = `Tu es responsable de la boutique à bord des ferries GNV (traversées Méditerranée). Tu dois proposer exactement ${NUM_PRODUCTS} produits variés pour la boutique à bord.
Pour chaque produit fournis :
- name : nom du produit en français (max 120 caractères)
- description : description courte et vendeuse en 1 à 3 phrases (max 400 caractères)
- category : une des valeurs exactes : ${CATEGORIES.join(', ')}
- price : prix en euros (nombre décimal, entre 2 et 120)
- originalPrice : optionnel, prix barré si promo (nombre ou null)
- tags : tableau de 2 à 5 mots-clés en français (ex: ["souvenir", "ferry", "Méditerranée"])
- brand : marque ou "GNV" ou null

Réponse : UNIQUEMENT un objet JSON valide, sans texte avant ou après :
{
  "products": [
    { "name": "...", "description": "...", "category": "...", "price": 12.99, "originalPrice": null, "tags": ["..."], "brand": "..." },
    ...
  ]
}`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Génère exactement ${NUM_PRODUCTS} produits pour la boutique ferry (souvenirs, mode, accessoires, nourriture, boissons, électronique, livres, jouets, duty-free). Variété des catégories. Format JSON avec clé "products".`,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.7,
  });

  const raw = completion.choices[0]?.message?.content?.trim();
  if (!raw) {
    throw new Error('Réponse OpenAI vide');
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      data = JSON.parse(match[0]);
    } else {
      throw new Error('JSON invalide');
    }
  }
  const products = data.products || data;
  if (!Array.isArray(products) || products.length === 0) {
    throw new Error('Aucun produit dans la réponse');
  }

  return products.slice(0, NUM_PRODUCTS).map((p) => {
    const cat = CATEGORIES.includes(p.category) ? p.category : CATEGORIES[0];
    const price = Math.max(0, parseFloat(p.price) || 9.99);
    const originalPrice = p.originalPrice != null ? Math.max(0, parseFloat(p.originalPrice)) : undefined;
    return {
      name: String(p.name || '')
        .trim()
        .slice(0, 120),
      description: String(p.description || '')
        .trim()
        .slice(0, 600),
      category: cat,
      price: Math.round(price * 100) / 100,
      originalPrice: originalPrice != null ? Math.round(originalPrice * 100) / 100 : undefined,
      tags: Array.isArray(p.tags)
        ? p.tags
            .map((t) => String(t).trim())
            .filter(Boolean)
            .slice(0, 8)
        : [],
      brand: p.brand ? String(p.brand).trim().slice(0, 50) : undefined,
    };
  });
}

function buildProductImagePrompt(product) {
  const name = product.name || 'Product';
  const category = product.category || 'souvenirs';
  const desc = (product.description || '').slice(0, 120);
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

/**
 * Génère une image DALL-E 3 pour le produit et la sauvegarde (API ou fichier local).
 * Retourne le chemin relatif pour images[].url (ex: /uploads/images/xxx.png).
 */
async function generateAndSaveImage(openai, product, index) {
  const prompt = buildProductImagePrompt(product);
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

  const safeName = slug(product.name) || `product-${index + 1}`;
  const filename = `shop-product-${index + 1}-${safeName}.png`;
  const finalName = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
  const withExt = /\.(png|jpe?g|gif|webp)$/i.test(finalName) ? finalName : finalName + '.png';

  const health = await fetch(`${API_BASE_URL}/api/health`).catch(() => null);
  if (health?.ok) {
    const uploadUrl = `${API_BASE_URL}/api/upload/image-from-base64`;
    const headers = { 'Content-Type': 'application/json' };
    if (SEED_SECRET) {
      headers['X-Seed-Secret'] = SEED_SECRET;
    }
    const res = await fetch(uploadUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ base64: img.b64_json, filename: withExt }),
    });
    if (res.ok) {
      const data = await res.json();
      const pathRel = data?.image?.path || (data?.image?.url || '').replace(/^https?:\/\/[^/]+/, '');
      if (pathRel) {
        return pathRel.startsWith('/') ? pathRel : `/${pathRel}`;
      }
    }
  }

  if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
  }
  const fullPath = path.join(IMAGES_DIR, withExt);
  fs.writeFileSync(fullPath, Buffer.from(img.b64_json, 'base64'));
  return `/uploads/images/${withExt}`;
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

    console.log(`\n📝 Génération de ${NUM_PRODUCTS} produits (OpenAI)...`);
    const productsFr = await generateProducts(openai);
    console.log(`   ✅ ${productsFr.length} produits générés.\n`);

    let created = 0;
    for (let i = 0; i < productsFr.length; i++) {
      const p = productsFr[i];
      console.log(`   [${i + 1}/${productsFr.length}] ${p.name.slice(0, 50)}...`);

      try {
        console.log('      🌐 Traductions (fr, en, es, it, de, ar)...');
        const translations = await generateTranslationsForProduct(openai, p.name, p.description, p.category);

        console.log('      🖼️  Image (DALL-E 3)...');
        const imagePath = await generateAndSaveImage(openai, p, i);

        const sku = `SHOP-${Date.now().toString(36).toUpperCase()}-${(i + 1).toString().padStart(2, '0')}`;
        await Product.create({
          name: p.name,
          description: p.description,
          category: p.category,
          price: p.price,
          originalPrice: p.originalPrice,
          stock: Math.floor(Math.random() * 50) + 5,
          sku,
          type: 'physical',
          rating: Math.round((Math.random() * 1.5 + 3.5) * 10) / 10,
          tags: p.tags,
          brand: p.brand,
          images: [{ url: imagePath, alt: p.name, isPrimary: true }],
          isActive: true,
          isFeatured: i < 4,
          translations,
        });
        created++;
        console.log('      ✅ Produit enregistré en base.');
      } catch (err) {
        console.error('      ❌', err.message);
      }
    }

    console.log(`\n✅ Terminé. ${created}/${productsFr.length} produits ajoutés (multilingues + images).`);
  } catch (err) {
    console.error('❌ Erreur:', err.message);
    if (err.response?.data) {
      console.error(err.response.data);
    }
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
