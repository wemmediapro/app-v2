/**
 * Pour les activités Enfant déjà en base :
 * 1) Génère une image par activité (DALL-E 3) et l'upload via l'API backend.
 * 2) Génère les traductions (nom + description) en 6 langues (fr, en, es, it, de, ar) via OpenAI.
 *
 * Usage: backend démarré puis cd backend && node scripts/seed-enfant-images-translations-openai.js
 * Prérequis: OPENAI_API_KEY, MongoDB, backend lancé.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'config.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const OpenAI = require('openai').default;
const EnfantActivity = require('../src/models/EnfantActivity');
const { generateTranslationsForEnfant } = require('../src/lib/enfant-translations-openai');

const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/gnv_onboard';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const API_BASE_URL = (process.env.API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const SEED_SECRET = process.env.SEED_SCRIPT_SECRET || process.env.SEED_SECRET || '';

function slug(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/(^-|-$)/g, '')
    .toLowerCase()
    .slice(0, 30);
}

function buildImagePrompt(activity) {
  const name = activity.name || 'Activité enfant';
  const category = activity.category || 'Jeux';
  const desc = (activity.description || '').slice(0, 150);
  return `Friendly, colorful illustration for a kids activity on a ferry. Activity: ${name}. Category: ${category}. ${desc ? 'Mood: ' + desc + '.' : ''} Style: cheerful, safe for children, no text or logos. Single scene, high quality, suitable for a family app.`;
}

async function generateAndUploadImage(openai, prompt, filename) {
  const response = await openai.images.generate({
    model: 'dall-e-3',
    prompt,
    n: 1,
    size: '1792x1024',
    quality: 'standard',
    response_format: 'b64_json',
    style: 'vivid',
  });
  const img = response.data?.[0];
  if (!img?.b64_json) throw new Error('Pas d’image retournée par OpenAI');

  const uploadUrl = `${API_BASE_URL}/api/upload/image-from-base64`;
  const headers = { 'Content-Type': 'application/json' };
  if (SEED_SECRET) headers['X-Seed-Secret'] = SEED_SECRET;

  const res = await fetch(uploadUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({ base64: img.b64_json, filename }),
  });
  if (!res.ok) throw new Error(`Upload échoué (${res.status}): ${await res.text()}`);
  const data = await res.json();
  const pathRel = data?.image?.path || (data?.image?.url || '').replace(/^https?:\/\/[^/]+/, '');
  if (!pathRel) throw new Error('Réponse upload sans image.path');
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

  const activities = await EnfantActivity.find({ isActive: { $ne: false } }).lean();
  console.log(`\n👶 ${activities.length} activité(s) Enfant à traiter (images + traductions).\n`);

  for (let i = 0; i < activities.length; i++) {
    const a = activities[i];
    const id = a._id;
    const label = a.name || `Activité ${i + 1}`;

    try {
      const updates = {};

      // 1) Image : générer (DALL-E 3) + upload
      console.log(`   [${i + 1}/${activities.length}] 🖼️ Image: ${label.slice(0, 45)}...`);
      const safeName = slug(a.name) || `enfant-${id.toString().slice(-8)}`;
      const filename = `enfant-${id.toString().slice(-8)}-${safeName}.png`;
      const prompt = buildImagePrompt(a);
      const imagePath = await generateAndUploadImage(openai, prompt, filename);
      updates.imageUrl = imagePath;
      console.log(`      ✅ Image uploadée.`);

      // 2) Traductions : nom + description + ageRange + schedule + features en 6 langues
      const nameFr = (a.name || '').trim();
      const descriptionFr = (a.description || '').trim();
      const ageRangeFr = (a.ageRange || '').trim() || undefined;
      const scheduleFr = (a.schedule || '').trim() || undefined;
      const featuresFr = Array.isArray(a.features) && a.features.length > 0 ? a.features : undefined;
      console.log(`   [${i + 1}/${activities.length}] 🌐 Traductions (fr, en, es, it, de, ar)...`);
      const translations = await generateTranslationsForEnfant(openai, nameFr, descriptionFr, a.category, ageRangeFr, scheduleFr, featuresFr);
      updates.translations = translations;
      console.log(`      ✅ Traductions générées.`);

      await EnfantActivity.updateOne({ _id: id }, { $set: updates });
    } catch (err) {
      console.error(`   ❌ ${label.slice(0, 40)}:`, err.message);
    }
  }

  console.log('\n✅ Seed Enfant (images + traductions) terminé.');
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
