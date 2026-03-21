/**
 * Service de compression vidéo - Convertit toutes les vidéos en 480p
 * Requiert ffmpeg installé sur le système
 */

const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');

// Résolution 480p (854x480 pour 16:9)
const TARGET_HEIGHT = 480;
const TARGET_WIDTH = 854;
const OUTPUT_FORMAT = 'mp4';
const VIDEO_BITRATE = '800k';
const AUDIO_BITRATE = '128k';
// Preset FFmpeg : ultrafast < superfast < veryfast < faster < fast < medium < slow. veryfast = ~3x plus rapide que medium.
const ENCODING_PRESET = process.env.VIDEO_COMPRESSION_PRESET || 'veryfast';

/**
 * Vérifie si ffmpeg est disponible (avec timeout 3s pour éviter blocage)
 */
function checkFfmpegAvailable() {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(false), 3000);
    ffmpeg.getAvailableFormats((err) => {
      clearTimeout(t);
      resolve(!err);
    });
  });
}

/**
 * Compresse une vidéo à 480p
 * @param {string} inputPath - Chemin du fichier source
 * @param {string} outputPath - Chemin du fichier de sortie
 * @returns {Promise<string>} - Chemin du fichier compressé
 */
function compressTo480p(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    // S'assurer que le dossier de sortie existe
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    ffmpeg(inputPath)
      .outputOptions([
        '-vf',
        `scale=${TARGET_WIDTH}:${TARGET_HEIGHT}:force_original_aspect_ratio=decrease,pad=${TARGET_WIDTH}:${TARGET_HEIGHT}:(ow-iw)/2:(oh-ih)/2`,
        '-c:v',
        'libx264',
        '-preset',
        ENCODING_PRESET,
        '-crf',
        '23',
        '-maxrate',
        VIDEO_BITRATE,
        '-bufsize',
        '1600k',
        '-c:a',
        'aac',
        '-b:a',
        AUDIO_BITRATE,
        '-movflags',
        '+faststart', // Optimisation pour le streaming web
      ])
      .output(outputPath)
      .on('start', (cmd) => {
        console.log('🎬 Compression vidéo démarrée:', path.basename(inputPath));
      })
      .on('progress', (progress) => {
        if (progress.percent) {
          process.stdout.write(`\r   Progression: ${Math.round(progress.percent)}%`);
        }
      })
      .on('end', () => {
        console.log('\n   ✓ Compression terminée');
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error('   ✗ Erreur compression:', err.message);
        reject(err);
      })
      .run();
  });
}

/**
 * Traite un fichier vidéo : compression à 480p
 * @param {string} inputPath - Chemin du fichier uploadé
 * @param {string} [outputFilename] - Nom du fichier de sortie (sans extension)
 * @returns {Promise<{path: string, url: string}>} - Chemin et URL de la vidéo compressée
 */
const BACKEND_ROOT = path.join(__dirname, '..', '..');
const OUTPUT_DIR = path.join(BACKEND_ROOT, 'public', 'uploads', 'videos');

async function processVideo(inputPath, outputFilename) {
  const ext = path.extname(inputPath) || '.mp4';
  const baseName = outputFilename || `${path.basename(inputPath, ext)}_${Date.now()}`;
  const outputDir = OUTPUT_DIR;
  const outputPathMp4 = path.join(outputDir, `${baseName}.${OUTPUT_FORMAT}`);
  const outputPathSameExt = path.join(outputDir, `${baseName}${ext}`);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  let ffmpegAvailable = false;
  try {
    ffmpegAvailable = await checkFfmpegAvailable();
  } catch (e) {
    console.warn('⚠️ Vérification FFmpeg:', e.message);
  }

  const copyWithoutCompression = (targetPath) => {
    fs.copyFileSync(inputPath, targetPath);
    try {
      if (fs.existsSync(inputPath)) {
        fs.unlinkSync(inputPath);
      }
    } catch (e) {}
    const filename = path.basename(targetPath);
    return { path: targetPath, url: `/uploads/videos/${filename}` };
  };

  if (!ffmpegAvailable) {
    console.warn('⚠️ FFmpeg non trouvé - La vidéo sera copiée sans compression');
    return copyWithoutCompression(outputPathSameExt);
  }

  try {
    await compressTo480p(inputPath, outputPathMp4);
  } catch (compressErr) {
    console.warn('⚠️ Compression échouée, copie sans compression:', compressErr.message);
    return copyWithoutCompression(outputPathSameExt);
  }

  try {
    if (fs.existsSync(inputPath)) {
      fs.unlinkSync(inputPath);
    }
  } catch (e) {
    console.warn('Impossible de supprimer le fichier temporaire:', inputPath);
  }

  return { path: outputPathMp4, url: `/uploads/videos/${path.basename(outputPathMp4)}` };
}

module.exports = {
  compressTo480p,
  processVideo,
  checkFfmpegAvailable,
  TARGET_HEIGHT,
  TARGET_WIDTH,
};
