/**
 * Vérifie les images des restaurants et de tous les plats du menu (présence en base + fichier sur disque).
 * Usage: cd backend && node scripts/verify-restaurant-menu-images.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'config.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const Restaurant = require('../src/models/Restaurant');
const config = require('../src/config');

const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/gnv_onboard';
const IMAGES_DIR = config.paths?.images || path.join(__dirname, '..', 'public', 'uploads', 'images');

function filenameFromImagePath(imagePath) {
  if (!imagePath || typeof imagePath !== 'string') return null;
  const p = String(imagePath).replace(/\\/g, '/').trim();
  const match = p.match(/\/uploads\/images\/([^/]+)$/i) || p.match(/\/([^/]+)$/);
  return match ? match[1] : null;
}

function imageFileExists(imagePath) {
  const name = filenameFromImagePath(imagePath);
  if (!name) return false;
  const fullPath = path.join(IMAGES_DIR, name);
  return fs.existsSync(fullPath);
}

async function main() {
  console.log('🔌 Connexion MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connecté:', mongoose.connection.name);
  console.log('📁 Dossier images:', IMAGES_DIR);
  console.log('   Existe:', fs.existsSync(IMAGES_DIR) ? 'oui' : 'NON');
  console.log('');

  const restaurants = await Restaurant.find({ isActive: { $ne: false } }).lean();
  let totalRestoOk = 0;
  let totalRestoMissing = 0;
  let totalDishesOk = 0;
  let totalDishesNoPath = 0;
  let totalDishesPathNoFile = 0;

  for (const r of restaurants) {
    const name = r.name || 'Sans nom';
    const menu = r.menu || [];

    // Image du restaurant
    const restoImagePath = r.image || '';
    const restoHasPath = !!restoImagePath && String(restoImagePath).includes('/uploads/');
    const restoFileExists = restoHasPath && imageFileExists(restoImagePath);
    if (restoFileExists) totalRestoOk++;
    else if (restoHasPath) totalRestoMissing++;

    console.log(`\n🍽️  ${name}`);
    console.log(`   Image restaurant: ${restoHasPath ? restoImagePath : '(aucun chemin)'} ${restoFileExists ? '✅' : restoHasPath ? '❌ fichier absent' : '⚠️'}`);

    if (menu.length === 0) {
      console.log('   Menu: (vide)');
      continue;
    }

    console.log(`   Menu (${menu.length} entrées):`);
    for (let i = 0; i < menu.length; i++) {
      const item = menu[i];
      const dishName = item.name || `#${i + 1}`;
      const imgPath = item.image || '';
      const hasPath = !!imgPath && String(imgPath).includes('/uploads/');
      const fileExists = hasPath && imageFileExists(imgPath);

      if (fileExists) totalDishesOk++;
      else if (hasPath) totalDishesPathNoFile++;
      else totalDishesNoPath++;

      const status = fileExists ? '✅' : hasPath ? '❌ fichier absent' : '⚠️ pas d\'image';
      console.log(`      - ${dishName}: ${status}${hasPath ? ` (${filenameFromImagePath(imgPath)})` : ''}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('RÉSUMÉ');
  console.log('='.repeat(60));
  console.log(`Restaurants: ${totalRestoOk} avec image OK, ${totalRestoMissing} avec chemin mais fichier absent`);
  console.log(`Plats: ${totalDishesOk} avec image OK, ${totalDishesPathNoFile} avec chemin mais fichier absent, ${totalDishesNoPath} sans image`);
  console.log('');

  await mongoose.disconnect();
  const hasMissing = totalRestoMissing > 0 || totalDishesPathNoFile > 0;
  if (hasMissing) {
    console.error('❌ Des images sont référencées en base mais absentes du disque. Corrigez ou exécutez les seeds.');
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Erreur:', err);
  process.exit(1);
});
