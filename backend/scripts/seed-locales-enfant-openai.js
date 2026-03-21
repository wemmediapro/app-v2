/**
 * Finalise les traductions de la section "enfant" des locales (UI) via OpenAI.
 * Lit la section enfant en français, génère les traductions pour en, es, it, de, ar,
 * et met à jour les fichiers src/locales/*.json.
 *
 * Usage: depuis la racine du projet :
 *   OPENAI_API_KEY=votre_clé node backend/scripts/seed-locales-enfant-openai.js
 * Ou depuis backend/ :
 *   OPENAI_API_KEY=votre_clé node scripts/seed-locales-enfant-openai.js
 *
 * Prérequis: OPENAI_API_KEY dans .env ou en variable d'environnement.
 */

const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: path.join(__dirname, '..', 'config.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const projectRoot = path.resolve(__dirname, '../..');
const localesDir = path.join(projectRoot, 'src', 'locales');

const TARGET_LANGS = [
  { code: 'en', name: 'anglais' },
  { code: 'es', name: 'espagnol' },
  { code: 'it', name: 'italien' },
  { code: 'de', name: 'allemand' },
  { code: 'ar', name: 'arabe' },
];

function loadJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function saveJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

async function translateEnfantSectionWithOpenAI(openai, enfantFr, targetLang) {
  const systemPrompt = `Tu es un traducteur pour une application maritime (GNV OnBoard, ferries).
Tu reçois un objet JSON dont les clés sont des identifiants et les valeurs sont des textes en français.
Traduis UNIQUEMENT les valeurs (chaînes de caractères) dans la langue cible : ${targetLang.name}.
Conserve exactement les mêmes clés. Pour les objets imbriqués (ex: categories), traduis aussi les valeurs à l'intérieur.
Ne pas traduire les clés (title, favoris, activities, etc.).
Réponds UNIQUEMENT avec l'objet JSON complet, sans texte avant ou après.`;

  const userPrompt = `Langue cible : ${targetLang.name} (code ${targetLang.code}).\n\nObjet français à traduire :\n${JSON.stringify(enfantFr, null, 2)}`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
  });

  const raw = completion.choices[0]?.message?.content?.trim();
  if (!raw) {throw new Error('Réponse OpenAI vide');}

  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {data = JSON.parse(match[0]);} else {throw new Error('JSON invalide: ' + raw.slice(0, 200));}
  }

  return data;
}

async function main() {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY manquant. Définissez-le ou ajoutez-le dans backend/.env');
    console.error('   Exemple: OPENAI_API_KEY=sk-... node backend/scripts/seed-locales-enfant-openai.js');
    process.exit(1);
  }

  const OpenAI = require('openai').default;
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  const frPath = path.join(localesDir, 'fr.json');
  if (!fs.existsSync(frPath)) {
    console.error('❌ Fichier non trouvé:', frPath);
    process.exit(1);
  }

  const fr = loadJson(frPath);
  const enfantFr = fr.enfant;
  if (!enfantFr) {
    console.error('❌ Section "enfant" absente dans fr.json');
    process.exit(1);
  }

  console.log('📂 Source: section enfant de fr.json');
  console.log('🌐 Langues cibles:', TARGET_LANGS.map((l) => l.code).join(', '));
  console.log('');

  for (const target of TARGET_LANGS) {
    const localePath = path.join(localesDir, `${target.code}.json`);
    if (!fs.existsSync(localePath)) {
      console.warn('⚠️ Fichier ignoré (absent):', localePath);
      continue;
    }

    try {
      console.log(`🔄 Traduction vers ${target.name} (${target.code})...`);
      const translated = await translateEnfantSectionWithOpenAI(openai, enfantFr, target);
      const locale = loadJson(localePath);
      locale.enfant = translated;
      saveJson(localePath, locale);
      console.log(`   ✅ ${localePath}`);
    } catch (err) {
      console.error(`   ❌ ${target.code}:`, err.message);
    }
  }

  console.log('');
  console.log('✅ Terminé. Vérifiez la page http://localhost:5173/enfant en changeant la langue.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
