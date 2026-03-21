/**
 * Script : compléter titres, descriptions, noms des plats, spécialités et promotions
 * dans toutes les langues (fr, en, es, it, de, ar) via OpenAI.
 * Lit les restaurants en base et met à jour les traductions manquantes.
 *
 * Usage: cd backend && OPENAI_API_KEY=votre_clé node scripts/seed-restaurant-full-translations-openai.js
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

// --- 1) Traductions restaurant : name, description ---
async function generateRestaurantNameDescriptionForLang(openai, nameFr, descriptionFr, lang) {
  if (lang === 'fr') {
    return { name: nameFr, description: descriptionFr };
  }
  const langName = LANG_NAMES[lang] || lang;
  const systemPrompt = `Tu es un traducteur professionnel pour un site de restaurants (ferry / bateau). Traduis UNIQUEMENT en ${langName}. Réponse : un objet JSON avec exactement { "name": "Nom du restaurant en ${langName}", "description": "Description courte en ${langName}" }.`;
  const userContent = `Traduire en ${langName} :\nNom : ${nameFr}\nDescription : ${descriptionFr || nameFr}`;
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
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// --- 2) Traductions menu (noms et descriptions des plats) ---
async function generateMenuTranslationsForLang(openai, menu, lang, existingTranslations) {
  const sourceItems = menu.map((item, idx) => {
    const t = existingTranslations && existingTranslations[lang] && existingTranslations[lang].menu;
    const entry = Array.isArray(t) && t[idx] ? t[idx] : null;
    return {
      name: (entry && entry.name) || item.name || '',
      description: (entry && entry.description) || item.description || '',
    };
  });

  const langName = LANG_NAMES[lang] || lang;
  const systemPrompt = `Tu es un traducteur professionnel pour des menus de restaurant (ferry / bateau). Tu traduis UNIQUEMENT en ${langName}. Pour chaque plat, renvoie un nom et une description courts et appétissants. Réponse : un objet JSON avec une clé "menu" qui est un tableau. Chaque élément = { "name": "Nom du plat en ${langName}", "description": "Description courte en ${langName}" }. Le nombre d'éléments doit être exactement le même que le menu fourni.`;
  const userContent = `Menu à traduire en ${langName} :\n${JSON.stringify(sourceItems, null, 0)}`;

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

// --- 3) Traductions spécialités (tableau de strings) ---
async function generateSpecialtiesForLang(openai, specialtiesFr, lang, restaurantName) {
  if (!Array.isArray(specialtiesFr) || specialtiesFr.length === 0) {
    return [];
  }
  if (lang === 'fr') {
    return specialtiesFr.map((s) => String(s).trim());
  }
  const langName = LANG_NAMES[lang] || lang;
  const systemPrompt = `Tu es un traducteur pour un menu de restaurant (ferry). Traduis la liste de spécialités UNIQUEMENT en ${langName}. Réponse : un objet JSON avec une clé "specialties" qui est un tableau de chaînes, dans le même ordre et la même longueur.`;
  const userContent = `Restaurant : ${restaurantName}. Spécialités à traduire en ${langName} : ${JSON.stringify(specialtiesFr)}`;
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
    return [];
  }
  try {
    const data = JSON.parse(raw);
    const arr = data.specialties || (Array.isArray(data) ? data : []);
    return Array.isArray(arr) ? arr.map((s) => String(s).trim()).slice(0, specialtiesFr.length) : [];
  } catch {
    return [];
  }
}

// --- 4) Traductions promotions (title, description par promo) ---
async function generatePromotionsTranslationsForLang(openai, promotions, lang) {
  if (!Array.isArray(promotions) || promotions.length === 0) {
    return [];
  }
  if (lang === 'fr') {
    return promotions.map((p) => ({
      title: (p.title || '').trim().slice(0, 200),
      description: (p.description || '').trim().slice(0, 1000),
    }));
  }
  const langName = LANG_NAMES[lang] || lang;
  const source = promotions.map((p) => ({ title: p.title || '', description: p.description || '' }));
  const systemPrompt = `Tu es un traducteur pour des offres promotionnelles de restaurant (ferry). Traduis titres et descriptions UNIQUEMENT en ${langName}. Réponse : un objet JSON avec une clé "promotions" = tableau de { "title": "...", "description": "..." }, même ordre et même longueur.`;
  const userContent = `Traduire en ${langName} :\n${JSON.stringify(source)}`;
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
    return [];
  }
  try {
    const data = JSON.parse(raw);
    const arr = data.promotions || (Array.isArray(data) ? data : []);
    if (!Array.isArray(arr) || arr.length !== promotions.length) {
      return [];
    }
    return arr.map((p, i) => ({
      title: String(p.title || promotions[i].title || '')
        .trim()
        .slice(0, 200),
      description: String(p.description || promotions[i].description || '')
        .trim()
        .slice(0, 1000),
    }));
  } catch {
    return [];
  }
}

async function run() {
  if (!OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY manquant. Définissez-le dans backend/.env ou :');
    console.error('   OPENAI_API_KEY=votre_clé node scripts/seed-restaurant-full-translations-openai.js');
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
      const nameFr = (rest.name || '').trim();
      const descriptionFr = (rest.description || '').trim();
      const menu = rest.menu || [];
      const specialtiesFr = Array.isArray(rest.specialties)
        ? rest.specialties.map((s) => String(s).trim()).filter(Boolean)
        : [];
      const promotions = rest.promotions || [];

      const translations = rest.translations && typeof rest.translations === 'object' ? { ...rest.translations } : {};
      let updated = false;

      for (const lang of LANGS) {
        if (!translations[lang]) {
          translations[lang] = {};
        }

        // 1) Nom et description du restaurant
        const needNameDesc = !translations[lang].name || !translations[lang].description;
        if (needNameDesc && (nameFr || descriptionFr)) {
          const gen = await generateRestaurantNameDescriptionForLang(openai, nameFr, descriptionFr, lang);
          if (gen) {
            if (gen.name) {
              translations[lang].name = gen.name.trim().slice(0, 200);
            }
            if (gen.description) {
              translations[lang].description = gen.description.trim().slice(0, 2000);
            }
            updated = true;
          }
        }

        // 2) Menu (plats)
        if (menu.length > 0) {
          const filled = await generateMenuTranslationsForLang(openai, menu, lang, rest.translations);
          if (filled && filled.length === menu.length) {
            if (!translations[lang].menu) {
              translations[lang].menu = menu.map((m, i) => ({ name: m.name, description: m.description || '' }));
            }
            for (let i = 0; i < menu.length; i++) {
              const gen = filled[i];
              if (gen && typeof gen === 'object') {
                const cur = translations[lang].menu[i] || {};
                if (gen.name) {
                  translations[lang].menu[i] = { ...cur, name: String(gen.name).trim().slice(0, 200) };
                  updated = true;
                }
                if (gen.description) {
                  translations[lang].menu[i] = {
                    ...(translations[lang].menu[i] || {}),
                    description: String(gen.description).trim().slice(0, 500),
                  };
                  updated = true;
                }
              }
            }
          }
        }

        // 3) Spécialités
        if (specialtiesFr.length > 0) {
          const needSpec =
            !Array.isArray(translations[lang].specialties) ||
            translations[lang].specialties.length !== specialtiesFr.length;
          if (needSpec) {
            const gen = await generateSpecialtiesForLang(openai, specialtiesFr, lang, nameFr);
            if (gen.length > 0) {
              translations[lang].specialties = gen;
              updated = true;
            }
          }
        }

        // 4) Promotions (translations au niveau restaurant + par promo pour le dashboard)
        if (promotions.length > 0) {
          const needPromo =
            !Array.isArray(translations[lang].promotions) || translations[lang].promotions.length !== promotions.length;
          if (needPromo) {
            const gen = await generatePromotionsTranslationsForLang(openai, promotions, lang);
            if (gen.length === promotions.length) {
              translations[lang].promotions = gen;
              updated = true;
            }
          }
        }
      }

      // Mettre à jour aussi promotions[].translations pour le dashboard
      let promotionsArray = null;
      if (promotions.length > 0 && translations) {
        promotionsArray = rest.promotions ? rest.promotions.map((p) => ({ ...p })) : [];
        for (let k = 0; k < promotionsArray.length; k++) {
          const p = promotionsArray[k];
          if (!p.translations) {
            p.translations = {};
          }
          for (const lang of LANGS) {
            const t = translations[lang] && translations[lang].promotions && translations[lang].promotions[k];
            if (t) {
              p.translations[lang] = { title: t.title, description: t.description };
            }
          }
        }
      }

      if (updated) {
        const update = { $set: { translations } };
        if (promotionsArray && promotionsArray.length > 0) {
          update.$set.promotions = promotionsArray;
        }
        await Restaurant.updateOne({ _id: rest._id }, update);
        console.log(
          `✅ ${rest.name} : titres, descriptions, plats, spécialités et promos complétés en ${LANGS.length} langues.`
        );
      } else if (promotionsArray && promotionsArray.length > 0) {
        // Seulement promo.translations à mettre à jour
        await Restaurant.updateOne({ _id: rest._id }, { $set: { promotions: promotionsArray } });
        console.log(`✅ ${rest.name} : traductions des promos (promotions[].translations) mises à jour.`);
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
