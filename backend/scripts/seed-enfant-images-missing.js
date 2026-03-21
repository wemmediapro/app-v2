/**
 * Génère uniquement les images manquantes pour les activités Enfant (DALL-E 3).
 * Ignore les activités qui ont déjà une imageUrl.
 * Usage: backend démarré puis cd backend && node scripts/seed-enfant-images-missing.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'config.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const OpenAI = require('openai').default;
const EnfantActivity = require('../src/models/EnfantActivity');

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
    console.error('❌ OPENAI_API_KEY manquant (backend/.env)');
    process.exit(1);
  }
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  console.log('🔌 Connexion MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connecté:', mongoose.connection.name);

  const health = await fetch(`${API_BASE_URL}/api/health`).catch(() => null);
  if (!health?.ok) {
    console.error('❌ Backend non disponible à', API_BASE_URL, '(démarrez-le avec npm run dev)');
    await mongoose.disconnect();
    process.exit(1);
  }

  const activities = await EnfantActivity.find({
    isActive: { $ne: false },
    $or: [
      { imageUrl: { $exists: false } },
      { imageUrl: null },
      { imageUrl: '' },
      { imageUrl: { $regex: /^https:\/\/picsum\.photos/, $options: 'i' } },
    ],
  }).lean();

  if (activities.length === 0) {
    console.log('✅ Aucune activité sans image. Toutes les images sont déjà générées.');
    await mongoose.disconnect();
    process.exit(0);
    return;
  }

  console.log(`\n🖼️  ${activities.length} activité(s) sans image à traiter.\n`);

  for (let i = 0; i < activities.length; i++) {
    const a = activities[i];
    const id = a._id;
    const label = a.name || `Activité ${i + 1}`;

    try {
      console.log(`   [${i + 1}/${activities.length}] ${label.slice(0, 50)}...`);
      const safeName = slug(a.name) || `enfant-${id.toString().slice(-8)}`;
      const filename = `enfant-${id.toString().slice(-8)}-${safeName}.png`;
      const prompt = buildImagePrompt(a);
      const imagePath = await generateAndUploadImage(openai, prompt, filename);
      await EnfantActivity.updateOne({ _id: id }, { $set: { imageUrl: imagePath } });
      console.log('      ✅ Image uploadée.');
    } catch (err) {
      console.error(`   ❌ ${label.slice(0, 40)}:`, err.message);
    }
  }

  console.log('\n✅ Génération des images manquantes terminée.');
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
