/**
 * Seed : plan du navire Excellence (GNV Excellent) généré par OpenAI, inséré en base.
 * Usage: cd backend && node scripts/seed-shipmap-excellence-openai.js
 * Prérequis: OPENAI_API_KEY et MONGODB_URI dans backend/.env
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'config.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const OpenAI = require('openai').default;
const Shipmap = require('../src/models/Shipmap');

const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/gnv_onboard';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const SHIP_ID = 7;
const SHIP_NAME = 'GNV Excellent';

const BACKEND_TYPES = ['passenger', 'vehicle', 'cabin', 'service', 'public'];

function mapTypeToBackend(label) {
  const l = (label || '').toLowerCase();
  if (l.includes('garage') || l.includes('véhicule') || l.includes('vehicle')) {return 'vehicle';}
  if (l.includes('cabine') || l.includes('cabin') || l.includes('chambre')) {return 'cabin';}
  if (l.includes('restaurant') || l.includes('bar') || l.includes('service')) {return 'service';}
  if (l.includes('pont') || l.includes('sun') || l.includes('public')) {return 'public';}
  return 'passenger';
}

async function generateShipPlanWithOpenAI(openai) {
  const systemPrompt = `Tu es expert des plans de navires ferry GNV (traversées Méditerranée). Tu génères un plan de ponts réaliste pour le navire "GNV Excellent" (ligne Gênes - Palerme).

Renvoie UNIQUEMENT un objet JSON valide, sans texte avant ou après, de la forme:
{
  "decks": [
    {
      "name": "Nom du pont (ex: Pont 1)",
      "typeLabel": "Garage inférieur | Garage principal | Cabines | Restaurants & services | Pont soleil (une courte étiquette)",
      "description": "Résumé en 1-2 phrases de ce qu'on trouve sur ce pont.",
      "services": ["Service 1", "Service 2", ...]
    }
  ]
}

Règles:
- Génère 6 à 8 ponts typiques d'un ferry: garages (1-3), cabines (4-5), restaurants & services (6), pont soleil/lounge (7). Tu peux ajouter un pont technique ou supplémentaire si pertinent.
- Chaque "services" doit contenir 2 à 6 intitulés courts (ex: "Zone poids lourds", "Ascenseurs passagers", "Cabines standard", "Ristorante Allegra", "Piscine adultes").
- Tout en français. Pas de markdown, pas de commentaire.`;

  const userPrompt = 'Génère le plan complet des ponts pour le ferry GNV Excellent (Gênes - Palerme). Réponse: uniquement l\'objet JSON avec la clé "decks".';

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.6,
  });

  const raw = completion.choices[0]?.message?.content?.trim();
  if (!raw) {throw new Error('Réponse OpenAI vide');}
  const data = JSON.parse(raw);
  const decks = data.decks || (Array.isArray(data) ? data : []);
  return Array.isArray(decks) ? decks : [];
}

async function seedShipmapExcellence() {
  if (!OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY manquant (backend/.env)');
    process.exit(1);
  }
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  try {
    console.log('🔌 Connexion MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connecté:', mongoose.connection.name);

    const existing = await Shipmap.countDocuments({ shipId: SHIP_ID });
    if (existing > 0) {
      console.log(`🗑️  Suppression de ${existing} pont(s) existant(s) pour ${SHIP_NAME}...`);
      await Shipmap.deleteMany({ shipId: SHIP_ID });
    }

    console.log('🤖 Génération du plan des ponts GNV Excellent via OpenAI...');
    const generated = await generateShipPlanWithOpenAI(openai);
    if (!generated.length) {
      throw new Error('Aucun pont généré par OpenAI');
    }
    console.log(`   Reçu ${generated.length} pont(s).`);

    for (let i = 0; i < generated.length; i++) {
      const d = generated[i];
      const name = (d.name || `Pont ${i + 1}`).trim().slice(0, 80);
      const typeLabel = (d.typeLabel || '').trim();
      const type = BACKEND_TYPES.includes(d.type) ? d.type : mapTypeToBackend(typeLabel);
      const description = (d.description || '').trim().slice(0, 500);
      const services = Array.isArray(d.services)
        ? d.services.slice(0, 12).map(s => String(s).trim()).filter(Boolean)
        : [];

      await Shipmap.create({
        name,
        type,
        description: description || undefined,
        area: undefined,
        capacity: type === 'cabin' ? 200 : type === 'vehicle' ? 100 : 0,
        shipId: SHIP_ID,
        shipName: SHIP_NAME,
        services,
        accessPoints: [],
        facilities: [],
        zones: [],
        cabinTypes: [],
        restaurants: [],
        poolInfo: type === 'public' ? { hasPool: true, poolType: 'Piscine', capacity: 50, openingHours: '10h-19h' } : undefined,
        isActive: true,
      });
      console.log(`✅ Pont créé: ${name} (${services.length} services)`);
    }

    const total = await Shipmap.countDocuments({ shipId: SHIP_ID });
    console.log('\n✅ Seed plan navire Excellence (GNV Excellent) terminé. Ponts en base:', total);
  } catch (err) {
    console.error('❌ Erreur:', err.message);
    if (err.response?.data) {console.error(err.response.data);}
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seedShipmapExcellence();
