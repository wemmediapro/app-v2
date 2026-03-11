/**
 * Seed : ajout de promotions générées par OpenAI, multilingues (FR, EN, ES, IT, DE, AR),
 * intégrées dans la base de données (restaurants existants).
 * Usage: cd backend && node scripts/seed-promo-openai-multilingual.js
 * Prérequis: OPENAI_API_KEY dans backend/.env et MongoDB accessible.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'config.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const OpenAI = require('openai').default;
const Restaurant = require('../src/models/Restaurant');

const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/gnv_onboard';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const LANGS = ['fr', 'en', 'es', 'it', 'de', 'ar'];
const PROMOS_PER_RESTAURANT = 3;

async function generatePromotionsForRestaurant(openai, restaurantName, restaurantType, count) {
  const systemPrompt = `Tu es responsable des offres promotionnelles à bord des ferries GNV (GNV OnBoard). Tu génères des promotions attractives pour les restaurants à bord, avec titres et descriptions traduits dans 6 langues : français (fr), anglais (en), espagnol (es), italien (it), allemand (de), arabe (ar).

Contexte : restaurant "${restaurantName}" (${restaurantType}). Les promotions peuvent être : menu à prix réduit, formule déjeuner/dîner, offre famille, plat du jour à -20%, dessert offert, etc.

Renvoie UNIQUEMENT un objet JSON valide, sans texte avant ou après, avec la structure exacte :
{
  "promotions": [
    {
      "title": "Titre de la promo en français",
      "description": "Description courte en français (1-2 phrases)",
      "price": 12.5,
      "originalPrice": 15.9,
      "discount": 20,
      "validUntilDays": 30,
      "translations": {
        "fr": { "title": "Titre FR", "description": "Description FR" },
        "en": { "title": "Title EN", "description": "Description EN" },
        "es": { "title": "Título ES", "description": "Descripción ES" },
        "it": { "title": "Titolo IT", "description": "Descrizione IT" },
        "de": { "title": "Titel DE", "description": "Beschreibung DE" },
        "ar": { "title": "العنوان بالعربية", "description": "الوصف بالعربية" }
      }
    }
  ]
}

Règles :
- Génère exactement ${count} promotions variées et réalistes.
- price = prix après réduction, originalPrice = prix avant, discount = pourcentage (ex: 20 pour -20%).
- validUntilDays = nombre de jours à partir d’aujourd’hui pour la date de fin de validité.
- Pour chaque langue dans translations, fournis title et description.`;

  const userPrompt = `Génère ${count} promotions pour le restaurant "${restaurantName}" (${restaurantType}), avec traductions complètes en fr, en, es, it, de, ar. Réponse : uniquement l'objet JSON avec la clé "promotions".`;

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
  if (!raw) throw new Error('Réponse OpenAI vide');
  const data = JSON.parse(raw);
  const list = data.promotions || (Array.isArray(data) ? data : []);
  return Array.isArray(list) ? list : [];
}

function nextPromoId(restaurant) {
  const existing = (restaurant.promotions || []).map(p => p.id).filter(n => typeof n === 'number');
  return existing.length ? Math.max(...existing) + 1 : 1;
}

async function seedPromosMultilingual() {
  if (!OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY manquant (backend/.env)');
    process.exit(1);
  }
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  try {
    console.log('🔌 Connexion MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connecté:', mongoose.connection.name);

    const restaurants = await Restaurant.find({ isActive: true }).limit(10).lean();
    if (!restaurants.length) {
      console.log('⚠️  Aucun restaurant actif trouvé. Créez d’abord des restaurants (ex: seed:restaurant-excellence-multilingual).');
      await mongoose.disconnect();
      process.exit(0);
      return;
    }

    console.log(`🤖 Génération de ${PROMOS_PER_RESTAURANT} promotions multilingues par restaurant (OpenAI)...`);
    let totalAdded = 0;

    for (const rest of restaurants) {
      const name = rest.name || 'Restaurant';
      const type = rest.type || 'Restaurant à la carte';
      try {
        const generated = await generatePromotionsForRestaurant(openai, name, type, PROMOS_PER_RESTAURANT);
        if (!generated.length) {
          console.log(`   ⚠️  Aucune promo générée pour ${name}`);
          continue;
        }

        const doc = await Restaurant.findById(rest._id);
        let nextId = nextPromoId(doc);

        for (const p of generated) {
          const validUntil = new Date();
          validUntil.setDate(validUntil.getDate() + (p.validUntilDays || 30));

          const promo = {
            id: nextId++,
            title: (p.title || p.translations?.fr?.title || 'Offre spéciale').trim().slice(0, 200),
            description: (p.description || p.translations?.fr?.description || 'Promotion à bord').trim().slice(0, 1000),
            price: typeof p.price === 'number' ? Math.max(0, p.price) : 9.9,
            originalPrice: typeof p.originalPrice === 'number' ? Math.max(0, p.originalPrice) : 12.9,
            discount: typeof p.discount === 'number' ? Math.min(100, Math.max(0, p.discount)) : 20,
            validUntil,
            translations: null,
          };

          const trans = p.translations || {};
          const translations = {};
          for (const lang of LANGS) {
            const t = trans[lang];
            if (t && (t.title || t.description)) {
              translations[lang] = {
                title: (t.title || promo.title).trim().slice(0, 200),
                description: (t.description || promo.description).trim().slice(0, 1000),
              };
            }
          }
          if (Object.keys(translations).length) promo.translations = translations;

          doc.promotions = doc.promotions || [];
          doc.promotions.push(promo);
          totalAdded++;
        }

        await doc.save();
        console.log(`   ✅ ${name}: ${generated.length} promotion(s) ajoutée(s) (${Object.keys(generated[0]?.translations || {}).length} langues)`);
      } catch (err) {
        console.error(`   ❌ ${name}:`, err.message);
      }
    }

    console.log('\n✅ Seed promotions multilingues terminé. Total ajouté:', totalAdded);
  } catch (err) {
    console.error('❌ Erreur:', err.message);
    if (err.response?.data) console.error(err.response.data);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seedPromosMultilingual();
