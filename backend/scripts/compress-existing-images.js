/**
 * Compresse les images déjà présentes dans public/uploads/images/
 * Mode normal : PNG niveau 9, JPEG qualité 85, même format.
 * Mode --app : dimensions adaptées à l'app (max 1200px), JPEG qualité 78, même nom/extension.
 *   Images >500 Ko : compression renforcée (max 1000px, JPEG/WebP qualité 72).
 * Mode --aggressive : essaie aussi PNG→JPEG (qualité 78) ; si plus léger, remplace et met à jour la base.
 *
 * Usage:
 *   cd backend && node scripts/compress-existing-images.js           # mode normal
 *   cd backend && node scripts/compress-existing-images.js --app     # dimensions + compression pour l'app
 *   cd backend && node scripts/compress-existing-images.js --aggressive  # mode max + mise à jour DB
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', 'config.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const path = require('path');
const fs = require('fs');
const config = require('../src/config');
const { optimizeImageInPlace, optimizeImageInPlaceAggressive } = require('../src/services/imageOptimization');

const IMAGES_DIR = config.paths?.images || path.join(__dirname, '..', 'public', 'uploads', 'images');
const EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const AGGRESSIVE = process.argv.includes('--aggressive');
/** Mode app : max 1200px (adapté mobile/tablet), compression renforcée, même nom/extension */
const APP_MODE = process.argv.includes('--app');
const APP_MAX_WIDTH = 1200;
const APP_JPEG_QUALITY = 78;
/** Seuil 500 Ko : au-dessus, compression plus forte (max 1000px, qualité 72) */
const SIZE_THRESHOLD_LARGE = 500 * 1024;
const LARGE_MAX_WIDTH = 800;
const LARGE_JPEG_QUALITY = 68;
/** Qualité WebP pour les images >500 Ko */
const LARGE_WEBP_QUALITY = 68;

function formatBytes(n) {
  if (n >= 1024 * 1024) return (n / (1024 * 1024)).toFixed(2) + ' Mo';
  if (n >= 1024) return (n / 1024).toFixed(1) + ' Ko';
  return n + ' o';
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function updateDbRenames(renames) {
  if (renames.length === 0) return;
  const mongoose = require('mongoose');
  const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/gnv_onboard';
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;

  const updates = [
    { collection: 'movies', field: 'poster' },
    { collection: 'articles', field: 'imageUrl' },
    { collection: 'enfantactivities', field: 'imageUrl' },
    { collection: 'webtvchannels', field: 'imageUrl' },
    { collection: 'restaurants', field: 'image' },
    { collection: 'banners', field: 'image' },
    { collection: 'banners', field: 'imageMobile' },
    { collection: 'banners', field: 'imageTablet' },
    { collection: 'ships', field: 'image' },
    { collection: 'destinations', field: 'image' },
  ];

  for (const { oldName, newName } of renames) {
    const escaped = escapeRegex(oldName);
    for (const { collection: collName, field } of updates) {
      try {
        const coll = db.collection(collName);
        const r = await coll.updateMany(
          { [field]: { $regex: escaped } },
          [{ $set: { [field]: { $replaceAll: { input: `$${field}`, find: oldName, replacement: newName } } } }]
        );
        if (r.modifiedCount > 0) {
          console.log(`    DB: ${collName}.${field} → ${r.modifiedCount} doc(s) mis à jour (${oldName} → ${newName})`);
        }
      } catch (e) {
        if (e.codeName !== 'NamespaceNotFound') console.warn(`    DB ${collName}.${field}:`, e.message);
      }
    }
    const products = db.collection('products');
    try {
      const docs = await products.find({ 'images.url': { $regex: escapeRegex(oldName) } }).toArray();
      for (const doc of docs) {
        const images = (doc.images || []).map((img) =>
          typeof img === 'string' ? (img.includes(oldName) ? img.replace(oldName, newName) : img)
          : { ...img, url: (img.url || '').includes(oldName) ? img.url.replace(oldName, newName) : img.url }
        );
        await products.updateOne({ _id: doc._id }, { $set: { images } });
      }
      if (docs.length > 0) console.log(`    DB: products.images → ${docs.length} doc(s) mis à jour`);
    } catch (e) {
      if (e.codeName !== 'NamespaceNotFound') console.warn('    DB products.images:', e.message);
    }
  }

  await mongoose.disconnect();
}

async function main() {
  if (!fs.existsSync(IMAGES_DIR)) {
    console.log('Dossier images introuvable:', IMAGES_DIR);
    process.exit(1);
  }

  const files = fs.readdirSync(IMAGES_DIR)
    .map((name) => path.join(IMAGES_DIR, name))
    .filter((p) => fs.statSync(p).isFile())
    .filter((p) => EXTENSIONS.has(path.extname(p).toLowerCase()));

  if (files.length === 0) {
    console.log('Aucune image à compresser dans', IMAGES_DIR);
    process.exit(0);
  }

  console.log('Compression des images déjà uploadées' + (APP_MODE ? ' (mode app: max ' + APP_MAX_WIDTH + 'px, qualité ' + APP_JPEG_QUALITY + ' ; >500 Ko: max ' + LARGE_MAX_WIDTH + 'px, qualité ' + LARGE_JPEG_QUALITY + ')' : AGGRESSIVE ? ' (mode agressif: PNG→JPEG si plus léger)' : ''));
  console.log('Dossier:', IMAGES_DIR);
  console.log('Fichiers trouvés:', files.length);
  console.log('');

  let ok = 0;
  let fail = 0;
  let totalBefore = 0;
  let totalAfter = 0;
  const renames = [];

  for (const filePath of files) {
    const name = path.basename(filePath);
    const sizeBeforeFile = fs.statSync(filePath).size;
    const isLarge = APP_MODE && sizeBeforeFile > SIZE_THRESHOLD_LARGE;
    const inPlaceOptions = APP_MODE
      ? {
          keepFormat: true,
          maxWidth: isLarge ? LARGE_MAX_WIDTH : APP_MAX_WIDTH,
          jpegQuality: isLarge ? LARGE_JPEG_QUALITY : APP_JPEG_QUALITY,
          webpQuality: isLarge ? LARGE_WEBP_QUALITY : undefined,
        }
      : { keepFormat: true };

    try {
      const result = AGGRESSIVE
        ? await optimizeImageInPlaceAggressive(filePath, { tryConvertPngToJpeg: true, maxWidth: APP_MODE ? (isLarge ? LARGE_MAX_WIDTH : APP_MAX_WIDTH) : undefined })
        : await optimizeImageInPlace(filePath, inPlaceOptions);

      const { sizeBefore, sizeAfter, skipped, newFilename } = result;
      if (skipped) {
        console.log(`  − ${name}  (déjà optimisé, ignoré)`);
        totalBefore += sizeBefore;
        totalAfter += sizeBefore;
        ok++;
        continue;
      }
      if (newFilename && newFilename !== name) {
        renames.push({ oldName: name, newName: newFilename });
        console.log(`  ✓ ${name} → ${newFilename}  ${formatBytes(sizeBefore)} → ${formatBytes(sizeAfter)}  (PNG→JPEG)`);
      } else {
        const saved = sizeBefore - sizeAfter;
        const pct = sizeBefore > 0 ? ((saved / sizeBefore) * 100).toFixed(0) : 0;
        const label = APP_MODE && sizeBeforeFile > SIZE_THRESHOLD_LARGE ? ' [>500 Ko]' : '';
        console.log(`  ✓ ${name}${label}  ${formatBytes(sizeBefore)} → ${formatBytes(sizeAfter)}  (-${pct}%)`);
      }
      totalBefore += sizeBefore;
      totalAfter += sizeAfter;
      ok++;
    } catch (err) {
      console.error(`  ✗ ${name}  ${err.message}`);
      fail++;
    }
  }

  if (AGGRESSIVE && renames.length > 0) {
    console.log('');
    console.log('Mise à jour de la base (références .png → .jpg)...');
    await updateDbRenames(renames);
  }

  const totalSaved = totalBefore - totalAfter;
  const pctSaved = totalBefore > 0 ? ((totalSaved / totalBefore) * 100).toFixed(1) : 0;
  console.log('');
  console.log(`Terminé. ${ok} traité(s), ${fail} erreur(s).`);
  console.log(`Poids total: ${formatBytes(totalBefore)} → ${formatBytes(totalAfter)}  (économie: ${formatBytes(totalSaved)}, -${pctSaved}%)`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
