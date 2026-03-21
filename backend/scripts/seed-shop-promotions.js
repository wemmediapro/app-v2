/**
 * Insère 3 promotions shop en base (MongoDB).
 * Usage: depuis backend/ : node scripts/seed-shop-promotions.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'config.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const Promotion = require('../src/models/Promotion');

const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/gnv_onboard';

const PROMOTIONS = [
  {
    title: 'Réduction été 2026',
    description: 'Profitez de -20% sur tous les souvenirs',
    translations: {
      fr: { title: 'Réduction été 2026', description: 'Profitez de -20% sur tous les souvenirs' },
      en: { title: 'Summer discount 2026', description: 'Enjoy -20% on all souvenirs' },
      es: { title: 'Descuento de verano 2026', description: 'Disfruta de -20% en todos los recuerdos' },
      it: { title: 'Sconto estate 2026', description: 'Approfitta del -20% su tutti i souvenir' },
      de: { title: 'Sommerrabatt 2026', description: '-20% auf alle Souvenirs' },
      ar: { title: 'خصم الصيف 2026', description: 'استمتع بخصم 20٪ على جميع الهدايا التذكارية' },
    },
    discountType: 'percentage',
    discountValue: 20,
    productIds: [],
    countries: ['Maroc', 'Tunisie', 'Italie'],
    validFrom: new Date('2024-06-01'),
    validUntil: new Date('2024-08-31'),
    isActive: true,
  },
  {
    title: 'Offre Duty Free -10€',
    description: '10€ de réduction sur une sélection de produits duty free à partir de 50€ d\'achat',
    translations: {
      fr: { title: 'Offre Duty Free -10€', description: '10€ de réduction sur une sélection de produits duty free à partir de 50€ d\'achat' },
      en: { title: 'Duty Free -10€ offer', description: '€10 off a selection of duty free products for purchases over €50' },
      es: { title: 'Oferta Duty Free -10€', description: '10€ de descuento en una selección de productos duty free a partir de 50€ de compra' },
      it: { title: 'Offerta Duty Free -10€', description: '10€ di sconto su una selezione di prodotti duty free per acquisti oltre 50€' },
      de: { title: 'Duty-Free-Angebot -10€', description: '10€ Rabatt auf eine Auswahl an Duty-Free-Produkten ab 50€ Einkaufswert' },
      ar: { title: 'عرض الديوتي فري -10 يورو', description: 'خصم 10 يورو على مجموعة مختارة من منتجات الديوتي فري عند الشراء بقيمة 50 يورو فأكثر' },
    },
    discountType: 'fixed',
    discountValue: 10,
    productIds: [],
    countries: ['Maroc', 'Tunisie', 'Algérie', 'Italie', 'Espagne'],
    validFrom: new Date('2025-01-01'),
    validUntil: new Date('2025-12-31'),
    isActive: true,
  },
  {
    title: 'Black Friday Boutique',
    description: 'Jusqu\'à -30% sur la mode et l\'électronique à bord',
    translations: {
      fr: { title: 'Black Friday Boutique', description: 'Jusqu\'à -30% sur la mode et l\'électronique à bord' },
      en: { title: 'Black Friday Shop', description: 'Up to -30% on fashion and electronics on board' },
      es: { title: 'Black Friday Boutique', description: 'Hasta -30% en moda y electrónica a bordo' },
      it: { title: 'Black Friday Boutique', description: 'Fino a -30% su moda ed elettronica a bordo' },
      de: { title: 'Black Friday Boutique', description: 'Bis zu -30% auf Mode und Elektronik an Bord' },
      ar: { title: 'بلاك فرايداي بوتيك', description: 'حتى -30٪ على الأزياء والإلكترونيات على متن السفينة' },
    },
    discountType: 'percentage',
    discountValue: 30,
    productIds: [],
    countries: ['Maroc', 'Tunisie', 'Italie', 'Espagne'],
    validFrom: new Date('2025-11-28'),
    validUntil: new Date('2025-11-30'),
    isActive: true,
  },
];

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connecté à MongoDB');

    const count = await Promotion.countDocuments();
    if (count >= 3) {
      console.log('ℹ️  Des promotions existent déjà. Pour réinsérer, supprimez la collection promotions puis relancez.');
      process.exit(0);
      return;
    }

    await Promotion.insertMany(PROMOTIONS);
    console.log('✅', PROMOTIONS.length, 'promotion(s) shop insérée(s).');
    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

seed();
