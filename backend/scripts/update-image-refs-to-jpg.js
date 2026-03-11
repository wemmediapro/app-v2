/**
 * Met à jour toutes les références d'images .png en .jpg dans la base
 * (articles, movies, restaurants, etc.) pour correspondre aux fichiers convertis.
 *
 * Usage: cd backend && node scripts/update-image-refs-to-jpg.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', 'config.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/gnv_onboard';

const COLLECTIONS = [
  { name: 'articles', field: 'imageUrl' },
  { name: 'movies', field: 'poster' },
  { name: 'enfantactivities', field: 'imageUrl' },
  { name: 'webtvchannels', field: 'imageUrl' },
  { name: 'restaurants', field: 'image' },
  { name: 'banners', field: 'image' },
  { name: 'banners', field: 'imageMobile' },
  { name: 'banners', field: 'imageTablet' },
  { name: 'ships', field: 'image' },
  { name: 'destinations', field: 'image' },
];

async function run() {
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;

  let totalUpdated = 0;

  for (const { name, field } of COLLECTIONS) {
    try {
      const coll = db.collection(name);
      const r = await coll.updateMany(
        { [field]: { $regex: '\\.png$', $options: 'i' } },
        [{ $set: { [field]: { $replaceAll: { input: `$${field}`, find: '.png', replacement: '.jpg' } } } }]
      );
      if (r.modifiedCount > 0) {
        console.log(`  ${name}.${field}: ${r.modifiedCount} doc(s) mis à jour (.png → .jpg)`);
        totalUpdated += r.modifiedCount;
      }
    } catch (e) {
      if (e.codeName !== 'NamespaceNotFound') console.warn(`  ${name}.${field}:`, e.message);
    }
  }

  const products = db.collection('products');
  try {
    const docs = await products.find({}).toArray();
    let productsUpdated = 0;
    for (const doc of docs) {
      const images = doc.images || [];
      let changed = false;
      const newImages = images.map((img) => {
        if (typeof img === 'string') {
          if (img.endsWith('.png')) {
            changed = true;
            return img.replace(/\.png$/i, '.jpg');
          }
          return img;
        }
        const url = img.url || '';
        if (url.endsWith('.png')) {
          changed = true;
          return { ...img, url: url.replace(/\.png$/i, '.jpg') };
        }
        return img;
      });
      if (changed) {
        await products.updateOne({ _id: doc._id }, { $set: { images: newImages } });
        productsUpdated++;
      }
    }
    if (productsUpdated > 0) {
      console.log(`  products.images: ${productsUpdated} doc(s) mis à jour`);
      totalUpdated += productsUpdated;
    }
  } catch (e) {
    if (e.codeName !== 'NamespaceNotFound') console.warn('  products.images:', e.message);
  }

  await mongoose.disconnect();
  console.log('\nTotal:', totalUpdated, 'document(s) mis à jour.');
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
