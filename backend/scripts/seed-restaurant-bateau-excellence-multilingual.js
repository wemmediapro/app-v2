/**
 * Seed : restaurant(s) du Bateau Excellence (GNV Excellent) avec menus et traductions
 * multilingues (FR, EN, ES, IT, DE, AR) générés par OpenAI.
 * Contexte réel : infos GNV (à la carte, self-service, pizzeria, snack bar).
 * Usage: cd backend && node scripts/seed-restaurant-bateau-excellence-multilingual.js
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
const LANGS = ['fr', 'en', 'es', 'it', 'de', 'ar'];

// Contexte réel récupéré sur les restaurants à bord du GNV Excellent
const CONTEXTE_GNV_EXCELLENT = `
Contexte réel GNV Excellent (Grandi Navi Veloci) :
- Restaurant à la carte : entrées, premiers plats, viande/poisson, plats du jour préparés par les chefs. Exemples : mozzarella buffala millefeuille tomate, caponata de légumes, pizza blanche ; spaghettone crème de tomates datterino, burger Angus scamorza et oignon caramélisé ; millefeuille crème, gâteau chocolat cœur fondant.
- Restaurant Self-Service : petit-déjeuner, déjeuner, dîner, ingrédients frais, entrées, premiers plats, plats principaux, fruits, desserts.
- Pizzeria et Snack Bar à bord. Menu enfants disponible.
- Options végétariennes, sans gluten, sans lactose. Style méditerranéen et italien.
`;

function imageForRestaurant(name) {
  const seed = `gnv-excellence-${(name || 'resto').replace(/\s+/g, '-').toLowerCase().slice(0, 25)}`;
  return `https://picsum.photos/seed/${seed}/800/400`;
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
        "en": { "name": "Name EN", "description": "Description EN", "menu": [ { "name": "Dish name", "description": "Description" }, ... ] },
        "es": { "name": "Nombre ES", "description": "Descripción ES", "menu": [ ... ] },
        "it": { "name": "Nome IT", "description": "Descrizione IT", "menu": [ ... ] },
        "de": { "name": "Name DE", "description": "Beschreibung DE", "menu": [ ... ] },
        "ar": { "name": "الاسم بالعربية", "description": "الوصف بالعربية", "menu": [ ... ] }
      }
    }
  ]
}

Règles :
- Génère 2 restaurants (ex : un à la carte raffiné, un self-service ou café/pizzeria).
- Chaque restaurant a au moins 8 plats (entrées, plats, desserts, boissons). Le tableau "menu" dans translations doit avoir exactement le même nombre d’éléments que "menu" du restaurant, dans le même ordre.
- Pour chaque langue (fr, en, es, it, de, ar), fournis name, description du restaurant et menu = tableau de { name, description } pour chaque plat.`;

  const userPrompt =
    'Génère 2 restaurants pour le Bateau GNV Excellent avec des menus complets et les traductions dans les 6 langues (fr, en, es, it, de, ar). Utilise le contexte réel GNV (à la carte, self-service, pizzeria, style italien/méditerranéen). Réponse : uniquement l\'objet JSON avec la clé "restaurants".';

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

async function seedRestaurantBateauExcellence() {
  if (!OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY manquant (backend/.env)');
    process.exit(1);
  }
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  try {
    console.log('🔌 Connexion MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connecté:', mongoose.connection.name);

    console.log('🤖 Génération des restaurants Bateau Excellence + menus multilingues (OpenAI)...');
    const generated = await generateRestaurantsWithTranslations(openai);
    if (!generated.length) {
      throw new Error('Aucun restaurant généré par OpenAI');
    }
    console.log(`   Reçu ${generated.length} restaurant(s).`);

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
          image: `https://picsum.photos/seed/gnv-menu-${i}-${idx}/400/300`,
        }))
        .filter((m) => m.name);

      if (menu.length === 0) {
        menu.push(
          {
            id: 1,
            name: 'Plat du jour',
            description: 'Selon arrivage',
            price: 14.9,
            category: 'Plats',
            isPopular: true,
            allergens: [],
            image: 'https://picsum.photos/seed/gnv-menu/400/300',
          },
          {
            id: 2,
            name: 'Salade méditerranéenne',
            description: 'Quinoa, feta, olives',
            price: 10.5,
            category: 'Entrées',
            isPopular: false,
            allergens: ['lactose'],
            image: 'https://picsum.photos/seed/gnv-menu/400/300',
          },
          {
            id: 3,
            name: 'Dessert du chef',
            description: 'Sélection du jour',
            price: 6.5,
            category: 'Desserts',
            isPopular: true,
            allergens: [],
            image: 'https://picsum.photos/seed/gnv-menu/400/300',
          }
        );
      }

      // Construire l'objet translations pour la BDD (fr, en, es, it, de, ar)
      const translations = {};
      const rawTranslations = r.translations || {};
      for (const lang of LANGS) {
        const t = rawTranslations[lang];
        if (!t) {
          continue;
        }
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
            name: t.menu[idx] && t.menu[idx].name ? t.menu[idx].name.trim().slice(0, 200) : m.name,
            description:
              t.menu[idx] && t.menu[idx].description ? t.menu[idx].description.trim().slice(0, 500) : m.description,
          }));
        }
        translations[lang] = entry;
      }
      // S'assurer que le français est présent (valeurs par défaut)
      if (!translations.fr) {
        translations.fr = {
          name: name.slice(0, 200),
          description: description.slice(0, 2000),
          menu: menu.map((m) => ({ name: m.name, description: m.description })),
        };
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
        translations: Object.keys(translations).length ? translations : undefined,
      });
      console.log(`✅ Restaurant créé: ${name} (${menu.length} plats, ${Object.keys(translations).length} langues)`);
    }

    const total = await Restaurant.countDocuments({ shipId: SHIP_ID });
    console.log('\n✅ Seed restaurant Bateau Excellence (multilingue) terminé. Restaurants sur ce bateau:', total);
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

seedRestaurantBateauExcellence();
