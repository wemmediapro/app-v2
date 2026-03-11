/**
 * Seed Espace Enfant : activités pour enfants générées par OpenAI, insérées en base.
 * Usage: depuis backend/ : node scripts/seed-enfant-openai.js
 *
 * Prérequis: OPENAI_API_KEY dans backend/.env et MongoDB accessible (MONGODB_URI ou DATABASE_URL).
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'config.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const OpenAI = require('openai').default;
const EnfantActivity = require('../src/models/EnfantActivity');

const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/gnv_onboard';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const MAX_ITEMS = 12;
const CATEGORIES = ['Jeux', 'Arts & Créativité', 'Sport', 'Éducation', 'Divertissement', 'Musique', 'Danse', 'Lecture', 'Créatif'];

function slug(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/(^-|-$)/g, '')
    .toLowerCase()
    .slice(0, 40);
}

/** URL d'image placeholder cohérente par activité */
function imageUrlFor(name, index) {
  const seed = `enfant-${index}-${slug(name) || 'activity'}`;
  return `https://picsum.photos/seed/${seed}/800/500`;
}

async function generateActivitiesWithOpenAI() {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY manquant. Ajoutez-le dans backend/.env');
  }
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  const systemPrompt = `Tu es un expert en activités enfants pour le portail GNV OnBoard (ferry, traversées Méditerranée, zone familles à bord).
Tu dois renvoyer UNIQUEMENT un objet JSON valide de la forme : { "items": [ ... ] }, sans texte avant ou après.
Génère exactement ${MAX_ITEMS} activités (en français), variées et adaptées à un espace enfants sur un ferry.

Chaque élément du tableau "items" doit avoir exactement :
- name (string, nom de l'activité, max 80 caractères)
- category (string, une parmi : ${CATEGORIES.join(', ')})
- description (string, résumé en 2-4 phrases, max 400 caractères)
- ageRange (string, ex: "3-6 ans", "6-12 ans", "4-10 ans")
- duration (string, ex: "45 min", "1h", "30 min")
- location (string, ex: "Pont 5 - Zone Familles", "Espace Kids")
- capacity (string, ex: "15 enfants", "20")
- schedule (string, ex: "09h00-12h00 et 14h00-18h00", "Tous les jours 10h-19h")
- features (array de 3 à 6 strings : équipements ou points forts, ex: "Jeux de société", "Table à dessin", "Animatrice", "Espace sécurisé")
- instructor (string, optionnel, ex: "Équipe animation GNV" ou vide)

Répartis les activités sur plusieurs catégories. Thèmes : jeux de groupe, dessin, sport ludique, contes, musique, ateliers créatifs, lecture, activités manuelles, jeux de société.`;

  const userPrompt = `Génère les ${MAX_ITEMS} activités au format JSON : { "items": [ ... ] }. Réponse : uniquement le JSON, pas de \`\`\`json.`;

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

  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) data = JSON.parse(match[0]);
    else throw new Error('Impossible de parser le JSON OpenAI: ' + raw.slice(0, 300));
  }

  let list = Array.isArray(data.items) ? data.items : null;
  if (!list && Array.isArray(data)) list = data;
  if (!list || list.length === 0) throw new Error('Aucune activité dans la réponse');
  return list.slice(0, MAX_ITEMS);
}

async function seedEnfant() {
  try {
    if (!OPENAI_API_KEY) {
      console.error('❌ OPENAI_API_KEY manquant. Définissez-le dans backend/.env');
      process.exit(1);
    }

    console.log('🔌 Connexion MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connecté:', mongoose.connection.name);

    console.log(`🤖 Génération de ${MAX_ITEMS} activités Enfant via OpenAI...`);
    const generated = await generateActivitiesWithOpenAI();
    console.log(`✅ ${generated.length} activités générées`);

    let created = 0;
    for (let i = 0; i < generated.length; i++) {
      const item = generated[i];
      const name = (item.name || `Activité ${i + 1}`).trim().slice(0, 200);
      const existing = await EnfantActivity.findOne({ name }).lean();
      if (existing) {
        console.log('⏭️  Déjà présent:', name);
        continue;
      }

      const category = CATEGORIES.includes(item.category) ? item.category : CATEGORIES[i % CATEGORIES.length];
      const description = (item.description || '').trim().slice(0, 2000);
      const ageRange = (item.ageRange || '3-12 ans').trim().slice(0, 30);
      const duration = (item.duration || '45 min').trim().slice(0, 50);
      const location = (item.location || 'Pont 5 - Zone Familles').trim().slice(0, 100);
      const capacity = (item.capacity || '20').toString().trim().slice(0, 20);
      const schedule = (item.schedule || '09h00 - 21h00').trim().slice(0, 100);
      const features = Array.isArray(item.features) ? item.features.slice(0, 8).map(String).filter(Boolean) : [];
      const instructor = (item.instructor || '').trim().slice(0, 100) || undefined;
      const imageUrl = imageUrlFor(name, i + 1);

      const doc = {
        name,
        category,
        description,
        ageRange,
        duration,
        location,
        capacity,
        price: 0,
        schedule,
        instructor,
        features,
        imageUrl,
        isActive: true,
        isFeatured: i < 3, // Les 3 premières en "À la une"
        countries: ['MA', 'IT', 'ES', 'TN', 'FR'],
      };

      await EnfantActivity.create(doc);
      created++;
      console.log('✅ Créé:', name, `(${category})`);
    }

    const total = await EnfantActivity.countDocuments({ isActive: true });
    console.log('\n✅ Seed Espace Enfant OpenAI terminé. Créés:', created, '| Total actifs en base:', total);
  } catch (err) {
    console.error('❌ Erreur:', err.message);
    if (err.response?.data) console.error(err.response.data);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seedEnfant();
