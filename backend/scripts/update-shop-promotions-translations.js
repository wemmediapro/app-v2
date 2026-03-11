/**
 * Met à jour les traductions des promotions shop existantes en base (MongoDB).
 * - Si le titre correspond à une des 3 promos connues → applique les traductions complètes (fr, en, es, it, de, ar).
 * - Sinon → remplit translations.fr à partir de title/description et recopie en fallback pour les autres langues.
 * Usage: depuis backend/ : node scripts/update-shop-promotions-translations.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'config.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const Promotion = require('../src/models/Promotion');

const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/gnv_onboard';

const LANGS = ['fr', 'en', 'es', 'it', 'de', 'ar'];

/** Traductions prédéfinies pour les 3 promos connues (clé = titre FR normalisé pour matching) */
const KNOWN_TRANSLATIONS = {
  'reduction ete 2026': {
    fr: { title: 'Réduction été 2026', description: 'Profitez de -20% sur tous les souvenirs' },
    en: { title: 'Summer discount 2026', description: 'Enjoy -20% on all souvenirs' },
    es: { title: 'Descuento de verano 2026', description: 'Disfruta de -20% en todos los recuerdos' },
    it: { title: 'Sconto estate 2026', description: 'Approfitta del -20% su tutti i souvenir' },
    de: { title: 'Sommerrabatt 2026', description: '-20% auf alle Souvenirs' },
    ar: { title: 'خصم الصيف 2026', description: 'استمتع بخصم 20٪ على جميع الهدايا التذكارية' }
  },
  'reduction ete 2024': {
    fr: { title: 'Réduction été 2024', description: 'Profitez de -20% sur tous les souvenirs' },
    en: { title: 'Summer discount 2024', description: 'Enjoy -20% on all souvenirs' },
    es: { title: 'Descuento de verano 2024', description: 'Disfruta de -20% en todos los recuerdos' },
    it: { title: 'Sconto estate 2024', description: 'Approfitta del -20% su tutti i souvenir' },
    de: { title: 'Sommerrabatt 2024', description: '-20% auf alle Souvenirs' },
    ar: { title: 'خصم الصيف 2024', description: 'استمتع بخصم 20٪ على جميع الهدايا التذكارية' }
  },
  'offre duty free -10€': {
    fr: { title: 'Offre Duty Free -10€', description: '10€ de réduction sur une sélection de produits duty free à partir de 50€ d\'achat' },
    en: { title: 'Duty Free -10€ offer', description: '€10 off a selection of duty free products for purchases over €50' },
    es: { title: 'Oferta Duty Free -10€', description: '10€ de descuento en una selección de productos duty free a partir de 50€ de compra' },
    it: { title: 'Offerta Duty Free -10€', description: '10€ di sconto su una selezione di prodotti duty free per acquisti oltre 50€' },
    de: { title: 'Duty-Free-Angebot -10€', description: '10€ Rabatt auf eine Auswahl an Duty-Free-Produkten ab 50€ Einkaufswert' },
    ar: { title: 'عرض الديوتي فري -10 يورو', description: 'خصم 10 يورو على مجموعة مختارة من منتجات الديوتي فري عند الشراء بقيمة 50 يورو فأكثر' }
  },
  'black friday boutique': {
    fr: { title: 'Black Friday Boutique', description: 'Jusqu\'à -30% sur la mode et l\'électronique à bord' },
    en: { title: 'Black Friday Shop', description: 'Up to -30% on fashion and electronics on board' },
    es: { title: 'Black Friday Boutique', description: 'Hasta -30% en moda y electrónica a bordo' },
    it: { title: 'Black Friday Boutique', description: 'Fino a -30% su moda ed elettronica a bordo' },
    de: { title: 'Black Friday Boutique', description: 'Bis zu -30% auf Mode und Elektronik an Bord' },
    ar: { title: 'بلاك فرايداي بوتيك', description: 'حتى -30٪ على الأزياء والإلكترونيات على متن السفينة' }
  }
};

function normalizeTitle(s) {
  if (!s || typeof s !== 'string') return '';
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function run() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connecté à MongoDB');

    const promos = await Promotion.find({}).lean();
    if (promos.length === 0) {
      console.log('ℹ️  Aucune promotion en base. Exécutez d\'abord: node scripts/seed-shop-promotions.js');
      process.exit(0);
      return;
    }

    let updated = 0;
    for (const promo of promos) {
      const title = promo.title || '';
      const description = promo.description || '';
      const key = normalizeTitle(title);
      const predefined = KNOWN_TRANSLATIONS[key];

      let translations = promo.translations && typeof promo.translations === 'object' ? { ...promo.translations } : {};

      if (predefined) {
        translations = { ...predefined };
        console.log('  → Promo reconnue:', title);
      } else {
        const frTitle = title || (translations.fr && translations.fr.title) || '';
        const frDesc = description || (translations.fr && translations.fr.description) || '';
        translations.fr = { title: frTitle, description: frDesc };
        for (const lang of LANGS) {
          if (lang === 'fr') continue;
          if (!translations[lang] || !translations[lang].title) {
            translations[lang] = { title: frTitle, description: frDesc };
          }
        }
        console.log('  → Promo générique (fallback FR):', title || '(sans titre)');
      }

      await Promotion.updateOne(
        { _id: promo._id },
        { $set: { translations } }
      );
      updated++;
    }

    console.log('✅', updated, 'promotion(s) mise(s) à jour avec les traductions.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

run();
