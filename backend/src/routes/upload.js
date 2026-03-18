/**
 * Routes d'upload avec compression vidéo automatique à 480p
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const config = require('../config');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { processVideo, checkFfmpegAvailable } = require('../services/videoCompression');
const { encodeToHls } = require('../services/hlsEncode');
const { optimizeImage, optimizeImageBuffer } = require('../services/imageOptimization');

const router = express.Router();

// [SEC-2] Validation magic-bytes (file-type)
const ALLOWED_VIDEO_MIMES = new Set(['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo', 'video/mpeg']);
const ALLOWED_IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const ALLOWED_AUDIO_MIMES = new Set(['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/x-wav']);

async function validateFileTypeFromPath(filePath, allowedMimes) {
  const { fileTypeFromFile } = await import('file-type');
  const type = await fileTypeFromFile(filePath);
  if (!type || !allowedMimes.has(type.mime)) return { valid: false, detected: type?.mime };
  return { valid: true };
}

async function validateFileTypeFromBuffer(buffer, allowedMimes) {
  const { fileTypeFromBuffer } = await import('file-type');
  const type = await fileTypeFromBuffer(buffer);
  if (!type || !allowedMimes.has(type.mime)) return { valid: false, detected: type?.mime };
  return { valid: true };
}
const { temp: UPLOAD_DIR, videos: VIDEOS_DIR, images: IMAGES_DIR, audio: AUDIO_DIR, public: PUBLIC_DIR } = config.paths;

// S'assurer que les dossiers existent
[UPLOAD_DIR, VIDEOS_DIR, IMAGES_DIR, AUDIO_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log('📁 Dossier créé:', dir);
  }
});

// Configuration Multer pour les vidéos
const videoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    const ext = path.extname(file.originalname) || '.mp4';
    cb(null, `video-${uniqueSuffix}${ext}`);
  }
});

const videoUpload = multer({
  storage: videoStorage,
  limits: { fileSize: 1000 * 1024 * 1024 }, // 1000 MB max
  fileFilter: (req, file, cb) => {
    const allowedTypes = /video\/(mp4|webm|ogg|quicktime|x-msvideo|mpeg)/;
    if (allowedTypes.test(file.mimetype) || /\.(mp4|webm|ogg|mov|avi|mpeg|mpg)$/i.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Type de fichier non autorisé. Utilisez MP4, WebM, OGG ou MOV.'));
    }
  }
});

// Stockage pour les images (logos, etc.)
const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, IMAGES_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    const base = path.basename(file.originalname || 'image', ext) || 'image';
    const safe = base.replace(/[^a-zA-Z0-9.-]/g, '_').slice(0, 30);
    cb(null, `logo-${Date.now()}-${safe}${ext}`);
  }
});
const imageUpload = multer({
  storage: imageStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    const allowed = /image\/(jpeg|jpg|png|gif|webp)/;
    if (allowed.test(file.mimetype) || /\.(jpe?g|png|gif|webp)$/i.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Type non autorisé. Utilisez JPEG, PNG, GIF ou WebP.'));
    }
  }
});

// Stockage pour les fichiers audio (MP3, etc.) — programmation radio
const audioStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, AUDIO_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.mp3';
    const safe = (file.originalname || 'audio').replace(/[^a-zA-Z0-9.-]/g, '_').slice(0, 40);
    cb(null, `audio-${Date.now()}-${safe}${ext}`);
  }
});
const audioUpload = multer({
  storage: audioStorage,
  limits: { fileSize: 1000 * 1024 * 1024 }, // 1000 MB
  fileFilter: (req, file, cb) => {
    const allowed = /audio\/(mpeg|mp3|wav|ogg|webm|x-wav)/;
    if (allowed.test(file.mimetype) || /\.(mp3|wav|ogg|m4a)$/i.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Type non autorisé. Utilisez MP3, WAV ou OGG.'));
    }
  }
});

/**
 * Gère les erreurs Multer (taille, type) pour renvoyer un JSON clair au front
 */
function handleUploadError(err, req, res, next) {
  if (!err) return next();
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      message: 'Fichier trop volumineux (maximum 1000 Mo).'
    });
  }
  if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      success: false,
      message: 'Envoyez un seul fichier vidéo avec le champ "video".'
    });
  }
  if (err.message && err.message.includes('Type de fichier')) {
    return res.status(400).json({
      success: false,
      message: err.message
    });
  }
  return next(err);
}

/**
 * POST /api/upload/video
 * Upload et compression d'une vidéo à 480p (ou copie si FFmpeg absent/échec)
 */
router.post('/video', authMiddleware, adminMiddleware, videoUpload.single('video'), handleUploadError, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Aucun fichier vidéo fourni. Utilisez le champ "video".'
      });
    }
    const { valid } = await validateFileTypeFromPath(req.file.path, ALLOWED_VIDEO_MIMES);
    if (!valid) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
      return res.status(400).json({
        success: false,
        message: 'Type de fichier non autorisé (vérification magic-bytes). Utilisez MP4, WebM, OGG ou MOV.',
      });
    }

    const inputPath = req.file.path;
    const port = process.env.PORT || 3000;
    const host = req.get('host') || `localhost:${port}`;
    const protocol = req.get('x-forwarded-proto') || req.protocol || 'http';
    const baseUrl = (process.env.API_BASE_URL || `${protocol}://${host}`).replace(/\/$/, '');

    const { url, path: outputPath } = await processVideo(inputPath);

    if (process.env.ENABLE_HLS_STATIC === 'true' && outputPath && fs.existsSync(outputPath)) {
      encodeToHls(outputPath).then((hls) => {
        if (hls) console.log('HLS généré:', hls.hlsUrl);
      }).catch((e) => console.warn('HLS encode (async):', e.message));
    }

    const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;
    res.json({
      success: true,
      message: 'Vidéo enregistrée avec succès',
      video: {
        url: fullUrl,
        path: url,
        quality: '480p'
      }
    });
  } catch (error) {
    console.error('Erreur upload vidéo:', error);

    if (req.file?.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {}
    }

    const message = process.env.NODE_ENV === 'development' ? (error.message || 'Erreur lors du traitement de la vidéo') : 'Erreur lors du traitement de la vidéo';
    res.status(500).json({
      success: false,
      message,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/upload/image
 * Upload d'une image (logo de station, etc.)
 */
router.post('/image', authMiddleware, adminMiddleware, imageUpload.single('image'), (err, req, res, next) => {
  if (err) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ success: false, message: 'Image trop volumineuse (max 5 Mo).' });
    }
    if (err.message && err.message.includes('Type')) {
      return res.status(400).json({ success: false, message: err.message });
    }
    return next(err);
  }
  next();
}, (req, res) => {
  return (async () => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Aucune image fournie. Utilisez le champ "image".'
      });
    }
    const { valid } = await validateFileTypeFromPath(req.file.path, ALLOWED_IMAGE_MIMES);
    if (!valid) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
      return res.status(400).json({
        success: false,
        message: 'Type de fichier non autorisé (vérification magic-bytes). Utilisez JPEG, PNG, GIF ou WebP.',
      });
    }
    let filePath = req.file.path;
    let filename = req.file.filename;
    try {
      const result = await optimizeImage(req.file.path);
      filePath = result.path;
      filename = result.filename;
    } catch (optErr) {
      console.warn('Optimisation image (fallback sans optimisation):', optErr.message);
    }
    const port = process.env.PORT || 3000;
    const host = req.get('host') || `localhost:${port}`;
    const protocol = req.get('x-forwarded-proto') || req.protocol || 'http';
    const baseUrl = (process.env.API_BASE_URL || `${protocol}://${host}`).replace(/\/$/, '');
    const relativePath = `/uploads/images/${filename}`;
    const fullUrl = `${baseUrl}${relativePath}`;
    res.json({
      success: true,
      message: 'Image enregistrée',
      image: {
        url: fullUrl,
        path: relativePath
      }
    });
  } catch (error) {
    console.error('Upload image error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: process.env.NODE_ENV === 'development' ? error.message : 'Erreur lors de l\'upload.',
      });
    }
  }
  })();
});

/**
 * POST /api/upload/audio
 * Upload d'un fichier audio (MP3, etc.) pour la programmation radio — sans passer par la bibliothèque
 */
router.post('/audio', authMiddleware, adminMiddleware, audioUpload.single('audio'), (err, req, res, next) => {
  if (err) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ success: false, message: 'Fichier audio trop volumineux (max 1000 Mo).' });
    }
    if (err.message && err.message.includes('Type')) {
      return res.status(400).json({ success: false, message: err.message });
    }
    return next(err);
  }
  next();
}, (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Aucun fichier audio fourni. Utilisez le champ "audio".'
      });
    }
    const { valid } = await validateFileTypeFromPath(req.file.path, ALLOWED_AUDIO_MIMES);
    if (!valid) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
      return res.status(400).json({
        success: false,
        message: 'Type de fichier non autorisé (vérification magic-bytes). Utilisez MP3, WAV ou OGG.',
      });
    }
    const port = process.env.PORT || 3000;
    const host = req.get('host') || `localhost:${port}`;
    const protocol = req.get('x-forwarded-proto') || req.protocol || 'http';
    const baseUrl = (process.env.API_BASE_URL || `${protocol}://${host}`).replace(/\/$/, '');
    const relativePath = `/uploads/audio/${req.file.filename}`;
    const fullUrl = `${baseUrl}${relativePath}`;
    res.json({
      success: true,
      message: 'Audio enregistré',
      audio: {
        url: fullUrl,
        path: relativePath,
        fileName: req.file.originalname
      }
    });
  } catch (error) {
    console.error('Upload audio error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: process.env.NODE_ENV === 'development' ? error.message : 'Erreur lors de l\'upload.'
      });
    }
  }
});

/**
 * Scanne un dossier et retourne les fichiers avec infos (nom, path relatif, taille, date)
 */
function scanUploadDir(dirPath, urlPrefix) {
  const items = [];
  if (!fs.existsSync(dirPath)) return items;
  const names = fs.readdirSync(dirPath);
  for (const name of names) {
    const fullPath = path.join(dirPath, name);
    const stat = fs.statSync(fullPath);
    if (stat.isFile()) {
      const relativePath = path.relative(PUBLIC_DIR, fullPath).replace(/\\/g, '/');
      const urlPath = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
      items.push({
        name,
        path: urlPath,
        url: urlPrefix + urlPath,
        size: stat.size,
        mtime: stat.mtime.toISOString(),
      });
    }
  }
  return items;
}

/**
 * GET /api/upload/media
 * Liste tous les médias (vidéos, images, audio) — admin
 */
router.get('/media', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const port = process.env.PORT || 3000;
    const host = req.get('host') || `localhost:${port}`;
    const protocol = req.get('x-forwarded-proto') || req.protocol || 'http';
    const baseUrl = (process.env.API_BASE_URL || `${protocol}://${host}`).replace(/\/$/, '');

    const videos = scanUploadDir(VIDEOS_DIR, baseUrl).map((f) => ({ ...f, type: 'video' }));
    const images = scanUploadDir(IMAGES_DIR, baseUrl).map((f) => ({ ...f, type: 'image' }));
    const audio = scanUploadDir(AUDIO_DIR, baseUrl).map((f) => ({ ...f, type: 'audio' }));

    res.json({
      success: true,
      media: [...videos, ...images, ...audio],
    });
  } catch (error) {
    console.error('List media error:', error);
    res.status(500).json({
      success: false,
      message: process.env.NODE_ENV === 'development' ? error.message : 'Erreur lors de la lecture des médias.',
    });
  }
});

/**
 * DELETE /api/upload/media
 * Supprime un fichier média du serveur — admin. body: { path } (ex: /uploads/videos/xxx.mp4)
 */
router.delete('/media', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const filePath = req.body?.path || req.query?.path;
    if (!filePath || typeof filePath !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Paramètre "path" requis (ex: /uploads/videos/nom.mp4).',
      });
    }
    const normalized = path.normalize(filePath).replace(/^(\.\.(\/|\\))+/, '').replace(/^\//, '');
    const allowedPrefixes = ['uploads/videos/', 'uploads/images/', 'uploads/audio/'];
    const isAllowed = allowedPrefixes.some((prefix) => normalized.startsWith(prefix));
    if (!isAllowed) {
      return res.status(403).json({
        success: false,
        message: 'Chemin non autorisé. Seuls les fichiers sous uploads/videos, uploads/images ou uploads/audio peuvent être supprimés.',
      });
    }
    const publicDirResolved = path.resolve(PUBLIC_DIR);
    const fullPath = path.resolve(PUBLIC_DIR, normalized);
    if (!fullPath.startsWith(publicDirResolved)) {
      return res.status(403).json({
        success: false,
        message: 'Chemin non autorisé.',
      });
    }
    const relative = path.relative(publicDirResolved, fullPath);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      return res.status(403).json({
        success: false,
        message: 'Chemin non autorisé.',
      });
    }
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({
        success: false,
        message: 'Fichier introuvable.',
      });
    }
    fs.unlinkSync(fullPath);
    res.json({
      success: true,
      message: 'Fichier supprimé du serveur.',
    });
  } catch (error) {
    console.error('Delete media error:', error);
    res.status(500).json({
      success: false,
      message: process.env.NODE_ENV === 'development' ? error.message : 'Erreur lors de la suppression.',
    });
  }
});

/**
 * GET /api/upload/status
 * Vérifie si le système de compression est opérationnel — réservé aux admins.
 */
router.get('/status', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const ffmpegAvailable = await checkFfmpegAvailable();
    res.json({
      videoCompression: true,
      targetQuality: '480p',
      ffmpegAvailable,
      message: ffmpegAvailable 
        ? 'Système de compression 480p opérationnel' 
        : 'FFmpeg non détecté - Les vidéos seront stockées sans compression. Installez ffmpeg pour activer la compression.'
    });
  } catch (error) {
    res.status(500).json({
      videoCompression: false,
      error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur serveur',
    });
  }
});

/**
 * POST /api/upload/image-from-base64
 * Upload d'une image à partir de données base64 (scripts seed, pas d'auth mais secret requis).
 * Body: { base64: string, filename: string } ou { image: string (base64), filename: string }
 * Header: X-Seed-Secret: <SEED_SCRIPT_SECRET>
 * Réponse: même format que POST /image → { image: { url, path } }
 */
router.post('/image-from-base64', async (req, res) => {
  try {
    let secret = process.env.SEED_SCRIPT_SECRET || process.env.SEED_SECRET;
    // En développement, accepter "dev-seed" si aucun secret n'est configuré (évite 503 pour les scripts)
    if (!secret && process.env.NODE_ENV !== 'production') {
      secret = 'dev-seed';
    }
    if (!secret) {
      return res.status(503).json({
        success: false,
        message: 'SEED_SCRIPT_SECRET (ou SEED_SECRET) doit être défini pour utiliser cet endpoint.',
      });
    }
    if (req.get('X-Seed-Secret') !== secret) {
      return res.status(403).json({ success: false, message: 'Secret invalide.' });
    }
    const base64 = req.body?.base64 || req.body?.image;
    let filename = req.body?.filename || `upload-${Date.now()}.png`;
    if (!base64 || typeof base64 !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Body doit contenir "base64" ou "image" (string base64).',
      });
    }
    const buffer = Buffer.from(base64, 'base64');
    if (buffer.length > 5 * 1024 * 1024) {
      return res.status(413).json({ success: false, message: 'Image trop volumineuse (max 5 Mo).' });
    }
    const { valid } = await validateFileTypeFromBuffer(buffer, ALLOWED_IMAGE_MIMES);
    if (!valid) {
      return res.status(400).json({
        success: false,
        message: 'Type de fichier non autorisé (vérification magic-bytes). Utilisez JPEG, PNG, GIF ou WebP.',
      });
    }
    let finalBuffer = buffer;
    try {
      const optimized = await optimizeImageBuffer(buffer, filename);
      finalBuffer = optimized.buffer;
      filename = optimized.filename;
    } catch (optErr) {
      console.warn('Optimisation image-from-base64 (fallback):', optErr.message);
    }
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
    if (!/\.(png|jpe?g|gif|webp)$/i.test(safeName)) {
      filename = safeName + '.png';
    } else {
      filename = safeName;
    }
    if (!fs.existsSync(IMAGES_DIR)) {
      fs.mkdirSync(IMAGES_DIR, { recursive: true });
    }
    const fullPath = path.join(IMAGES_DIR, filename);
    fs.writeFileSync(fullPath, finalBuffer);
    const port = process.env.PORT || 3000;
    const host = req.get('host') || `localhost:${port}`;
    const protocol = req.get('x-forwarded-proto') || req.protocol || 'http';
    const baseUrl = (process.env.API_BASE_URL || `${protocol}://${host}`).replace(/\/$/, '');
    const relativePath = `/uploads/images/${filename}`;
    const fullUrl = `${baseUrl}${relativePath}`;
    res.json({
      success: true,
      message: 'Image enregistrée (upload)',
      image: {
        url: fullUrl,
        path: relativePath,
      },
    });
  } catch (error) {
    console.error('Upload image-from-base64 error:', error);
    res.status(500).json({
      success: false,
      message: process.env.NODE_ENV === 'development' ? error.message : 'Erreur lors de l\'enregistrement de l\'image.',
    });
  }
});

module.exports = router;
