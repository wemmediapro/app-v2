#!/usr/bin/env node
/**
 * Convertit toutes les vidéos MP4 de public/uploads/videos en HLS statique (480p, segments 6 s).
 * Usage: node scripts/convert-videos-to-hls.js [--dry-run]
 * Prérequis: ffmpeg, ENABLE_HLS_STATIC non requis (script autonome).
 */

const path = require('path');
const fs = require('fs');

const BACKEND_ROOT = path.join(__dirname, '..');
const VIDEOS_DIR = path.join(BACKEND_ROOT, 'public', 'uploads', 'videos');
const { encodeToHls, checkFfmpeg } = require('../src/services/hlsEncode');

const isDryRun = process.argv.includes('--dry-run');

async function main() {
  if (!fs.existsSync(VIDEOS_DIR)) {
    console.log('Aucun dossier videos trouvé:', VIDEOS_DIR);
    process.exit(0);
  }

  const available = await checkFfmpeg();
  if (!available) {
    console.error('ffmpeg est requis. Installez-le puis relancez.');
    process.exit(1);
  }

  const files = fs.readdirSync(VIDEOS_DIR).filter((f) => /\.(mp4|webm|mov|avi|mpeg|mpg)$/i.test(f));
  if (files.length === 0) {
    console.log('Aucune vidéo à convertir.');
    process.exit(0);
  }

  console.log(`Vidéos à convertir en HLS: ${files.length} (segments 6 s, 480p)`);
  if (isDryRun) {
    files.forEach((f) => console.log('  -', f));
    process.exit(0);
  }

  for (const file of files) {
    const inputPath = path.join(VIDEOS_DIR, file);
    process.stdout.write(`${file} ... `);
    const result = await encodeToHls(inputPath);
    console.log(result ? 'OK' : 'ÉCHEC');
  }

  console.log('Terminé.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
