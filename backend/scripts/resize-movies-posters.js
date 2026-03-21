/**
 * Redimensionne les affiches films/séries existantes en 1024x1792 (même taille)
 * pour un affichage harmonieux sur le front. Sans appel à OpenAI.
 *
 * - Affiches locales (/uploads/images/...) : lecture + resize + écriture nouveau fichier
 * - Affiches externes (URL) : téléchargement + resize + écriture dans uploads/images
 *
 * Usage: cd backend && node scripts/resize-movies-posters.js
 * Prérequis: npm install sharp (dépendance ajoutée au projet)
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'config.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const sharp = require('sharp');
const Movie = require('../src/models/Movie');
const config = require('../src/config');

const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/gnv_onboard';

const TARGET_WIDTH = 1024;
const TARGET_HEIGHT = 1792;
const IMAGES_DIR = config.paths?.images || path.join(__dirname, '..', 'public', 'uploads', 'images');

function slug(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/(^-|-$)/g, '')
    .toLowerCase()
    .slice(0, 30);
}

/**
 * Récupère le buffer d'une image : fichier local ou URL.
 */
async function getImageBuffer(poster) {
  const p = (poster || '').trim();
  if (!p) {return null;}

  if (p.startsWith('http://') || p.startsWith('https://')) {
    const res = await fetch(p, { headers: { 'User-Agent': 'GNV-OnBoard/1.0' } });
    if (!res.ok) {throw new Error(`HTTP ${res.status}`);}
    const buf = Buffer.from(await res.arrayBuffer());
    return buf;
  }

  const relativePath = p.replace(/^\/+/, '');
  const localPath = path.join(IMAGES_DIR, path.basename(relativePath));
  if (!fs.existsSync(localPath)) {
    const altPath = path.join(path.dirname(IMAGES_DIR), relativePath);
    if (fs.existsSync(altPath)) {return fs.readFileSync(altPath);}
    throw new Error(`Fichier introuvable: ${localPath}`);
  }
  return fs.readFileSync(localPath);
}

/**
 * Redimensionne l'image en 1024x1792 (cover = remplir et recadrer au centre).
 * Retourne le chemin relatif /uploads/images/xxx
 */
async function resizeToPosterFormat(inputBuffer, movieId, title) {
  const safeName = slug(title) || 'poster';
  const filename = `movie-${String(movieId).slice(-8)}-${safeName}-${TARGET_WIDTH}x${TARGET_HEIGHT}.png`;
  const outputPath = path.join(IMAGES_DIR, filename);

  await sharp(inputBuffer)
    .resize(TARGET_WIDTH, TARGET_HEIGHT, { fit: 'cover', position: 'center' })
    .png({ quality: 90 })
    .toFile(outputPath);

  return `/uploads/images/${filename}`;
}

async function main() {
  if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
    console.log('📁 Dossier créé:', IMAGES_DIR);
  }

  console.log('🔌 Connexion MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connecté:', mongoose.connection.name);
  console.log(`\n🎬 Redimensionnement des affiches en ${TARGET_WIDTH}x${TARGET_HEIGHT}...\n`);

  const movies = await Movie.find({
    isActive: { $ne: false },
    poster: { $exists: true, $ne: '' },
  }).lean();

  if (movies.length === 0) {
    console.log('   Aucun film/série avec une affiche (poster) à redimensionner.');
    await mongoose.disconnect();
    process.exit(0);
    return;
  }

  let ok = 0;
  let fail = 0;

  for (let i = 0; i < movies.length; i++) {
    const m = movies[i];
    const label = (m.title || `Film ${i + 1}`).slice(0, 50);
    const id = (m._id || '').toString();
    try {
      const buffer = await getImageBuffer(m.poster);
      if (!buffer || buffer.length === 0) {
        console.log(`   [${i + 1}/${movies.length}] ${label} — pas d'image, ignoré`);
        continue;
      }
      const newPath = await resizeToPosterFormat(buffer, id, m.title);
      await Movie.updateOne({ _id: m._id }, { $set: { poster: newPath } });
      console.log(`   [${i + 1}/${movies.length}] ${label} → ${path.basename(newPath)}`);
      ok++;
    } catch (err) {
      console.error(`   [${i + 1}/${movies.length}] ${label} — ❌ ${err.message}`);
      fail++;
    }
  }

  console.log(`\n✅ Terminé. ${ok} affiche(s) redimensionnée(s), ${fail} erreur(s).`);
  await mongoose.disconnect();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
