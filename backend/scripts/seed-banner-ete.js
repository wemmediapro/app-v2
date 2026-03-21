/**
 * Insère la bannière "Un été inoubliable!" pour toutes les pages de l'app.
 * Usage: depuis backend/ : node scripts/seed-banner-ete.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'config.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const Banner = require('../src/models/Banner');

const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/gnv_onboard';

// Toutes les pages de l'app (clés utilisées dans setPage)
const ALL_PAGES = [
  'home', 'radio', 'movies', 'webtv', 'magazine', 'messaging',
  'restaurant', 'enfant', 'shipmap', 'feedback', 'favorites', 'shop',
  'profile', 'signup',
];

const BANNER = {
  title: 'Un été inoubliable!',
  description: 'RÉSERVEZ MAINTENANT AVEC JUSQU\'À 30% DE RÉDUCTION',
  position: 'home-top',
  order: 0,
  image: '/public/banner-ete-inoubliable.png',
  link: '',
  isActive: true,
  pages: ALL_PAGES,
  clicks: 0,
  impressions: 0,
};

async function seedBanner() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connecté à MongoDB');

    const existing = await Banner.findOne({
      title: BANNER.title,
      image: BANNER.image,
    });

    if (existing) {
      await Banner.findByIdAndUpdate(existing._id, {
        $set: {
          pages: ALL_PAGES,
          isActive: true,
          title: BANNER.title,
          description: BANNER.description,
          image: BANNER.image,
        },
      });
      console.log('✅ Bannière existante mise à jour (toutes les pages).');
    } else {
      await Banner.create(BANNER);
      console.log('✅ Bannière "Un été inoubliable!" créée pour toutes les pages.');
    }

    console.log('   Pages:', ALL_PAGES.join(', '));
    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur:', err.message);
    process.exit(1);
  }
}

seedBanner();
