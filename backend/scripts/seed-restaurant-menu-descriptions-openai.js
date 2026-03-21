/**
 * Script : compléter les descriptions (et noms) manquants des plats dans toutes les langues
 * via OpenAI. Lit les restaurants en base, pour chaque langue manquante génère la traduction
 * des noms/descriptions des plats, puis met à jour la base.
 *
 * Usage: cd backend && OPENAI_API_KEY=votre_clé node scripts/seed-restaurant-menu-descriptions-openai.js
 * Ou définir OPENAI_API_KEY dans backend/.env ou backend/config.env
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'config.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const OpenAI = require('openai').default;

const Restaurant = require('../src/models/Restaurant');

const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/gnv_onboard';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const LANGS = ['fr', 'en', 'es', 'it', 'de', 'ar'];
const LANG_NAMES = { fr: 'French', en: 'English', es: 'Spanish', it: 'Italian', de: 'German', ar: 'Arabic' };

function needFill(translations, lang, menu, idx) {
  const t = translations && translations[lang] && translations[lang].menu;
  const entry = Array.isArray(t) && t[idx] ? t[idx] : null;
  const name = entry && entry.name ? String(entry.name).trim() : '';
  const description = entry && entry.description ? String(entry.description).trim() : '';
  const baseName = menu[idx] && menu[idx].name ? String(menu[idx].name).trim() : '';
  const baseDesc = menu[idx] && menu[idx].description ? String(menu[idx].description).trim() : '';
  return {
    needName: !name && baseName,
    needDesc: !description && (baseDesc || baseName),
    baseName,
    baseDesc: baseDesc || baseName,
  };
}

async function generateMenuTranslationsForLang(openai, menu, lang, existingTranslations) {
  const sourceItems = menu.map((item, idx) => {
    const t = existingTranslations && existingTranslations[lang] && existingTranslations[lang].menu;
    const entry = Array.isArray(t) && t[idx] ? t[idx] : null;
    return {
      name: (entry && entry.name) || item.name || '',
      description: (entry && entry.description) || item.description || '',
    };
  });

  const hasMissing = sourceItems.some((s, i) => {
    const n = needFill({ [lang]: { menu: existingTranslations?.[lang]?.menu } }, lang, menu, i);
    return n.needName || n.needDesc;
  });
  if (!hasMissing) {
    return null;
  }

  const langName = LANG_NAMES[lang] || lang;
  const systemPrompt = `Tu es un traducteur professionnel pour des menus de restaurant (ferry / bateau). Tu traduis UNIQUEMENT en ${langName}. Pour chaque plat, renvoie un nom et une description courts et appétissants dans cette langue. Réponse : un objet JSON avec une clé "menu" qui est un tableau. Chaque élément du tableau = { "name": "Nom du plat en ${langName}", "description": "Description courte en ${langName}" }. Le nombre d'éléments doit être exactement le même que le menu fourni.`;

  const userContent = `Menu à traduire en ${langName} (nom et description pour chaque plat) :\n${JSON.stringify(sourceItems, null, 0)}`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
  });

  const raw = completion.choices[0]?.message?.content?.trim();
  if (!raw) {
    return null;
  }
  try {
    const data = JSON.parse(raw);
    const arr = data.menu || data.items || (Array.isArray(data) ? data : []);
    return Array.isArray(arr) ? arr : null;
  } catch {
    return null;
  }
}

async function run() {
  if (!OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY manquant. Définissez-le dans backend/.env ou :');
    console.error('   OPENAI_API_KEY=votre_clé node scripts/seed-restaurant-menu-descriptions-openai.js');
    process.exit(1);
  }

  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  try {
    console.log('🔌 Connexion MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connecté:', mongoose.connection.name);

    const restaurants = await Restaurant.find({ isActive: true }).lean();
    console.log(`📋 ${restaurants.length} restaurant(s) actif(s) à traiter.\n`);

    for (const rest of restaurants) {
      const menu = rest.menu || [];
      if (menu.length === 0) {
        console.log(`⏭️  ${rest.name} : pas de menu, ignoré.`);
        continue;
      }

      const translations = rest.translations && typeof rest.translations === 'object' ? { ...rest.translations } : {};
      let updated = false;

      for (const lang of LANGS) {
        if (lang === 'fr') {
          continue;
        }
        const filled = await generateMenuTranslationsForLang(openai, menu, lang, rest.translations);
        if (!filled || filled.length !== menu.length) {
          continue;
        }

        if (!translations[lang]) {
          translations[lang] = { name: rest.name, description: rest.description || '' };
        }
        if (!translations[lang].menu) {
          translations[lang].menu = menu.map((m, i) => ({ name: m.name, description: m.description || '' }));
        }

        for (let i = 0; i < menu.length; i++) {
          const n = needFill(rest.translations, lang, menu, i);
          const gen = filled[i];
          if (!gen || typeof gen !== 'object') {
            continue;
          }
          if (n.needName && gen.name) {
            translations[lang].menu[i].name = String(gen.name).trim().slice(0, 200);
            updated = true;
          }
          if (n.needDesc && gen.description) {
            translations[lang].menu[i].description = String(gen.description).trim().slice(0, 500);
            updated = true;
          }
        }
      }

      if (updated) {
        await Restaurant.updateOne({ _id: rest._id }, { $set: { translations } });
        console.log(`✅ ${rest.name} : descriptions/noms complétés pour les langues manquantes.`);
      } else {
        console.log(`⏭️  ${rest.name} : rien à compléter.`);
      }
    }

    console.log('\n✅ Script terminé.');
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
