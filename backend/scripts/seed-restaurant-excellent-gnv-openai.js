/**
 * Seed : restaurant(s) du bateau GNV Excellent avec menus générés par OpenAI.
 * Usage: cd backend && node scripts/seed-restaurant-excellent-gnv-openai.js
 * Prérequis: OPENAI_API_KEY dans backend/.env et MongoDB accessible.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'config.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const OpenAI = require('openai').default;
const Restaurant = require('../src/models/Restaurant');

const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/gnv_onboard';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const SHIP_ID = '7';
const SHIP_NAME = 'GNV Excellent';

const RESTAURANT_TYPES = [
  'Restaurant à la carte',
  'Restaurant Self-Service',
  'Café & Snacks',
  'Pizzeria saisonnière',
  'Steakhouse',
  'Room Service',
];
const CATEGORIES = ['french', 'fastfood', 'dessert', 'seafood'];
const IMG = 'https://picsum.photos/seed/gnv-restaurant/800/400';

function imageForRestaurant(name) {
  const seed = `gnv-excellent-${(name || 'resto').replace(/\s+/g, '-').toLowerCase().slice(0, 25)}`;
  return `https://picsum.photos/seed/${seed}/800/400`;
}

async function generateRestaurantsWithMenus(openai) {
  const systemPrompt = `Tu es responsable des restaurants à bord des ferries GNV (GNV Excellent, ligne Gênes - Palerme). Tu génères des restaurants avec des menus complets.
Renvoie UNIQUEMENT un objet JSON: { "restaurants": [ ... ] }, sans texte avant ou après.

Génère 2 restaurants pour le bateau "GNV Excellent", avec des styles différents (ex: un restaurant à la carte raffiné, un self-service ou café). Chaque restaurant doit avoir:
- name (string, français, nom du restaurant)
- type (string, une parmi: ${RESTAURANT_TYPES.join(', ')})
- category (string, une parmi: ${CATEGORIES.join(', ')})
- location (string, ex: "Pont 7 - Babor", "Pont 8 - Self")
- description (string, 1-3 phrases, ambiance et style)
- rating (number, 4.0 à 4.8)
- priceRange (string, une parmi: "€", "€€", "€€€", "€€€€")
- openingHours (string, ex: "07h00 - 22h00" ou "19h00 - 23h00")
- specialties (array de 3-5 strings, ex: ["Entrecôte", "Fruits de mer"])
- menu (array d'au moins 8 plats). Chaque plat: id (number, 1, 2, 3...), name (string), description (string courte), price (number en euros), category (string: "Entrées", "Plats", "Desserts", "Boissons", "Snacks", "Formules"), isPopular (boolean), allergens (array de strings ou vide, ex: ["gluten", "lactose"])

Les plats doivent être variés (entrées, plats principaux, desserts, boissons), adaptés à un ferry Méditerranée (influences italiennes, françaises, fruits de mer).`;

  const userPrompt =
    'Génère 2 restaurants pour le ferry GNV Excellent (traversée Gênes - Palerme), avec des menus complets (au moins 8 plats par restaurant). Réponse: uniquement l\'objet JSON avec la clé "restaurants".';

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
  if (!raw) {
    throw new Error('Réponse OpenAI vide');
  }
  const data = JSON.parse(raw);
  const list = data.restaurants || (Array.isArray(data) ? data : []);
  return Array.isArray(list) ? list : [];
}

async function seedRestaurantExcellent() {
  if (!OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY manquant (backend/.env)');
    process.exit(1);
  }
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  try {
    console.log('🔌 Connexion MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connecté:', mongoose.connection.name);

    console.log('🤖 Génération des restaurants GNV Excellent + menus via OpenAI...');
    const generated = await generateRestaurantsWithMenus(openai);
    if (!generated.length) {
      throw new Error('Aucun restaurant généré par OpenAI');
    }
    console.log(`   Reçu ${generated.length} restaurant(s).`);

    for (let i = 0; i < generated.length; i++) {
      const r = generated[i];
      const name = (r.name || `Restaurant GNV Excellent ${i + 1}`).trim().slice(0, 100);
      const type = RESTAURANT_TYPES.includes(r.type) ? r.type : RESTAURANT_TYPES[i % RESTAURANT_TYPES.length];
      const category = CATEGORIES.includes(r.category) ? r.category : CATEGORIES[i % CATEGORIES.length];
      const location = (r.location || `Pont ${7 + i} - GNV Excellent`).trim();
      const description = (r.description || 'Restaurant à bord du GNV Excellent.').trim().slice(0, 500);
      const rating = typeof r.rating === 'number' ? Math.min(5, Math.max(0, r.rating)) : 4.5;
      const priceRange = ['€', '€€', '€€€', '€€€€'].includes(r.priceRange) ? r.priceRange : '€€';
      const openingHours = (r.openingHours || '08h00 - 22h00').trim();
      const specialties = Array.isArray(r.specialties) ? r.specialties.slice(0, 8).map((s) => String(s).trim()) : [];

      const menu = (r.menu || [])
        .map((item, idx) => ({
          id: typeof item.id === 'number' ? item.id : idx + 1,
          name: (item.name || `Plat ${idx + 1}`).trim(),
          description: (item.description || '').trim() || 'Délicieuse préparation maison.',
          price: typeof item.price === 'number' ? Math.max(0, item.price) : 12.9,
          category: (item.category || 'Plats').trim(),
          isPopular: Boolean(item.isPopular),
          allergens: Array.isArray(item.allergens) ? item.allergens.map(String) : [],
          image: IMG,
        }))
        .filter((m) => m.name);

      if (menu.length === 0) {
        console.warn(`⚠️  Restaurant "${name}" sans menu valide, ajout de plats par défaut.`);
        menu.push(
          {
            id: 1,
            name: 'Plat du jour',
            description: 'Selon arrivage',
            price: 14.9,
            category: 'Plats',
            isPopular: true,
            allergens: [],
            image: IMG,
          },
          {
            id: 2,
            name: 'Salade méditerranéenne',
            description: 'Quinoa, feta, olives',
            price: 10.5,
            category: 'Entrées',
            isPopular: false,
            allergens: ['lactose'],
            image: IMG,
          },
          {
            id: 3,
            name: 'Dessert du chef',
            description: 'Sélection du jour',
            price: 6.5,
            category: 'Desserts',
            isPopular: true,
            allergens: [],
            image: IMG,
          }
        );
      }

      await Restaurant.create({
        name,
        type,
        category,
        location,
        description,
        rating,
        priceRange,
        image: imageForRestaurant(name),
        isOpen: true,
        openingHours,
        specialties,
        menu,
        promotions: [],
        isActive: true,
        shipId: SHIP_ID,
        shipName: SHIP_NAME,
      });
      console.log(`✅ Restaurant créé: ${name} (${menu.length} plats)`);
    }

    const total = await Restaurant.countDocuments({ shipId: SHIP_ID });
    console.log('\n✅ Seed restaurant GNV Excellent terminé. Restaurants sur ce bateau:', total);
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

seedRestaurantExcellent();
