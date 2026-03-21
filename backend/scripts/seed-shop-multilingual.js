/**
 * Seed shop : 20 produits avec descriptions multilingues (FR, EN, ES, IT, DE, AR) générés par OpenAI.
 * Toutes les langues sont intégrées dans la base (translations.fr, .en, .es, .it, .de, .ar).
 * Usage: node scripts/seed-shop-multilingual.js (depuis backend/)
 * Prérequis: OPENAI_API_KEY dans backend/.env et MongoDB accessible.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'config.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const OpenAI = require('openai').default;
const Product = require('../src/models/Product');

const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/gnv_onboard';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const CATEGORIES = ['souvenirs', 'fashion', 'dutyfree', 'electronics', 'food', 'accessories', 'beverages', 'books', 'toys'];
const LANGS = ['fr', 'en', 'es', 'it', 'de', 'ar'];

function imageUrlForProduct(index, name) {
  const seed = `shop-${index}-${(name || 'product').replace(/\s+/g, '-').toLowerCase().slice(0, 20)}`;
  return `https://picsum.photos/seed/${seed}/600/400`;
}

async function generateProductsBatch(openai, count) {
  const systemPrompt = `Tu es responsable de la boutique à bord des ferries GNV (GNV OnBoard). Tu génères des produits vendus à bord (souvenirs, mode, duty free, électronique, gastronomie).
Renvoie UNIQUEMENT un objet JSON: { "products": [ ... ] }, sans texte avant ou après.
Génère exactement ${count} produits. Chaque produit doit avoir:
- name (string, français, nom du produit)
- description (string, français, description courte 1-3 phrases)
- category (string, une parmi: ${CATEGORIES.join(', ')})
- price (number, prix en euros, entre 5 et 150)
- originalPrice (number optionnel, prix barré si promo)
- stock (number, entre 10 et 200)
- tags (array de 2-4 strings, mots-clés)
- translations (object) avec pour CHAQUE clé "fr", "en", "es", "it", "de", "ar" un objet { name, description } dans CETTE langue (fr=français, en=anglais, es=espagnol, it=italien, de=allemand, ar=arabe). Toutes les langues doivent être présentes.`;

  const userPrompt = `Génère ${count} produits de boutique ferry (souvenirs GNV, vêtements, parfums duty free, snacks, accessoires, électronique voyage, etc.). Pour chaque produit fournis les traductions dans les 6 langues: français (fr), anglais (en), espagnol (es), italien (it), allemand (de), arabe (ar). Réponse: uniquement l'objet JSON avec la clé "products".`;

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
  const list = data.products || data.items || (Array.isArray(data) ? data : []);
  return Array.isArray(list) ? list : [];
}

async function seedShop() {
  if (!OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY manquant (backend/.env)');
    process.exit(1);
  }
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  try {
    console.log('🔌 Connexion MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connecté:', mongoose.connection.name);

    console.log('🤖 Génération de 20 produits multilingues...');
    let products = await generateProductsBatch(openai, 20);
    if (products.length < 20) {
      console.log(`⚠️  Reçu ${products.length} produits, complément par batch 2...`);
      const batch2 = await generateProductsBatch(openai, Math.min(20 - products.length, 10));
      products = products.concat(batch2);
    }
    products = products.slice(0, 20);

    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      const name = (p.name || `Produit ${i + 1}`).trim().slice(0, 200);
      const description = (p.description || '').trim();
      const category = CATEGORIES.includes(p.category) ? p.category : CATEGORIES[i % CATEGORIES.length];
      const price = typeof p.price === 'number' ? Math.max(0.01, p.price) : 9.99 + (i % 5) * 10;
      const originalPrice = typeof p.originalPrice === 'number' && p.originalPrice > price ? p.originalPrice : null;
      const stock = typeof p.stock === 'number' ? Math.max(0, p.stock) : 50 + (i % 100);
      const tags = Array.isArray(p.tags) ? p.tags.slice(0, 5).map(String) : ['boutique', 'GNV'];

      const translations = {};
      for (const code of LANGS) {
        const t = p.translations?.[code];
        if (t && (t.name || t.description)) {
          translations[code] = {
            name: (t.name || name).slice(0, 200),
            description: (t.description || description).slice(0, 2000),
          };
        } else if (code === 'fr') {
          translations.fr = { name: name.slice(0, 200), description: description.slice(0, 2000) };
        } else {
          translations[code] = { name: name.slice(0, 200), description: description.slice(0, 2000) };
        }
      }

      const sku = `GNV-SHOP-${Date.now()}-${i}`;
      const imageUrl = imageUrlForProduct(i + 1, name);

      await Product.create({
        name,
        description,
        category,
        price,
        originalPrice: originalPrice || undefined,
        stock,
        sku,
        type: 'physical',
        rating: 3.5 + (i % 3) * 0.5,
        tags,
        images: [{ url: imageUrl, alt: name, isPrimary: true }],
        isActive: true,
        isFeatured: i < 5,
        translations: Object.keys(translations).length ? translations : undefined,
      });
      console.log('✅ Produit créé:', name);
    }

    const total = await Product.countDocuments({});
    console.log('\n✅ Seed shop multilingue terminé. Total produits:', total);
  } catch (err) {
    console.error('❌ Erreur:', err.message);
    if (err.response?.data) {console.error(err.response.data);}
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seedShop();
