/**
 * HLS statique — spécifications :
 * - HLS statique (une seule playlist, pas de variantes multiples)
 * - Vidéo encodée en 480p (854×480)
 * - Segments 6 secondes
 * - Pas d'adaptive bitrate (inutile offline)
 * - Cache disque : prévoir SSD NVMe pour public/uploads/videos_hls (déploiement)
 *
 * Sortie : playlist.m3u8 + segment_000.ts, segment_001.ts, ...
 */

const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const { promisify } = require('util');
const logger = require('../lib/logger');

const execFileAsync = promisify(execFile);

const HLS_SEGMENT_DURATION = 6; // secondes
const HLS_HEIGHT = 480;
const HLS_WIDTH = 854;
const VIDEO_BITRATE = '800k';
const AUDIO_BITRATE = '128k';

const BACKEND_ROOT = path.join(__dirname, '..', '..');
const HLS_BASE_DIR = path.join(BACKEND_ROOT, 'public', 'uploads', 'videos_hls');

/**
 * Vérifie que ffmpeg est disponible.
 */
async function checkFfmpeg() {
  try {
    await execFileAsync('ffmpeg', ['-version'], { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Encode un fichier vidéo (MP4 ou autre) en HLS statique.
 * @param {string} inputPath - Chemin du fichier source (ex. .../videos/film.mp4)
 * @returns {Promise<{ hlsUrl: string, playlistPath: string }|null>} - URL relative et chemin de la playlist, ou null si échec
 */
async function encodeToHls(inputPath) {
  if (!fs.existsSync(inputPath)) {
    return null;
  }

  const available = await checkFfmpeg();
  if (!available) {
    logger.warn({ event: 'hls_ffmpeg_unavailable', message: 'ffmpeg non disponible' });
    return null;
  }

  const basename = path.basename(inputPath, path.extname(inputPath));
  const safeName = basename.replace(/[^a-zA-Z0-9_-]/g, '_');
  const outputDir = path.join(HLS_BASE_DIR, safeName);
  const playlistPath = path.join(outputDir, 'playlist.m3u8');

  if (!fs.existsSync(HLS_BASE_DIR)) {
    fs.mkdirSync(HLS_BASE_DIR, { recursive: true });
  }
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const segmentPattern = path.join(outputDir, 'segment_%03d.ts');

  const args = [
    '-i',
    inputPath,
    '-vf',
    `scale=${HLS_WIDTH}:${HLS_HEIGHT}:force_original_aspect_ratio=decrease,pad=${HLS_WIDTH}:${HLS_HEIGHT}:(ow-iw)/2:(oh-ih)/2`,
    '-c:v',
    'libx264',
    '-preset',
    'fast',
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
    '-hls_time',
    String(HLS_SEGMENT_DURATION),
    '-hls_list_size',
    '0',
    '-hls_segment_filename',
    segmentPattern,
    '-f',
    'hls',
    '-y',
    playlistPath,
  ];

  try {
    await execFileAsync('ffmpeg', args, { timeout: 0, maxBuffer: 1024 * 1024 });
    const hlsUrl = `/uploads/videos_hls/${safeName}/playlist.m3u8`;
    return { hlsUrl, playlistPath };
  } catch (err) {
    logger.error({
      event: 'hls_encode_failed',
      err: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    return null;
  }
}

/**
 * Retourne l'URL HLS dérivée à partir d'une URL vidéo MP4 (sans vérifier l'existence).
 * Convention : /uploads/videos/foo.mp4 → /uploads/videos_hls/foo/playlist.m3u8
 * Le nom du dossier HLS est le basename du fichier (sans extension), caractères spéciaux remplacés par _.
 */
function getHlsUrlFromVideoUrl(videoUrl) {
  if (!videoUrl || typeof videoUrl !== 'string') {
    return null;
  }
  const trimmed = videoUrl.trim();
  const match = trimmed.match(/\/uploads\/videos\/([^/]+?)(\.\w+)?$/i) || trimmed.match(/\/videos\/([^/]+?)(\.\w+)?$/i);
  if (!match) {
    return null;
  }
  const filename = match[1];
  const base = path.basename(filename, path.extname(filename));
  const safeName = base.replace(/[^a-zA-Z0-9_-]/g, '_');
  const origin = trimmed.startsWith('http') ? new URL(trimmed).origin : '';
  return `${origin}/uploads/videos_hls/${safeName}/playlist.m3u8`;
}

module.exports = {
  encodeToHls,
  getHlsUrlFromVideoUrl,
  checkFfmpeg,
  HLS_BASE_DIR,
  HLS_SEGMENT_DURATION,
  HLS_HEIGHT,
  HLS_WIDTH,
};
