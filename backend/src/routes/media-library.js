/**
 * API Bibliothèque média : liste et suppression des fichiers uploadés.
 * Monté sur /api/media-library et /api/upload/media.
 */
const path = require('path');
const fs = require('fs');
const express = require('express');
const ffmpeg = require('fluent-ffmpeg');
const config = require('../config');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { ok, err } = require('../utils/response');

const router = express.Router();
const { paths } = config;
const PUBLIC_DIR = paths.public;
const ALLOWED_PREFIXES = ['uploads/videos/', 'uploads/images/', 'uploads/audio/'];

/** Retourne la durée en secondes (nombre) d'un fichier vidéo, ou 0 si erreur. */
function getVideoDurationSeconds(fullPath) {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(fullPath, (err, data) => {
      if (err) {
        console.warn('media-library getVideoDuration:', fullPath, err.message);
        return resolve(0);
      }
      const dur = data?.format?.duration;
      if (dur == null) {
        return resolve(0);
      }
      const sec = typeof dur === 'number' ? dur : parseFloat(dur, 10);
      resolve(Number.isFinite(sec) ? Math.round(sec) : 0);
    });
  });
}

/** Durée d'un fichier audio (ffprobe gère aussi l'audio). */
function getAudioDurationSeconds(fullPath) {
  return getVideoDurationSeconds(fullPath);
}

function scanUploadDir(dirPath, urlPrefix, type) {
  const items = [];
  if (!fs.existsSync(dirPath)) {
    return items;
  }
  try {
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
          type,
        });
      }
    }
  } catch (e) {
    console.error('media-library scanUploadDir:', e.message);
  }
  return items;
}

async function enrichVideosWithDuration(videoItems, videosDir) {
  const result = [];
  for (const item of videoItems) {
    const fullPath = path.join(videosDir, item.name);
    const duration = await getVideoDurationSeconds(fullPath);
    result.push({ ...item, duration });
  }
  return result;
}

async function enrichAudioWithDuration(audioItems, audioDir) {
  const result = [];
  for (const item of audioItems) {
    const fullPath = path.join(audioDir, item.name);
    const duration = await getAudioDurationSeconds(fullPath);
    result.push({ ...item, duration });
  }
  return result;
}

function getBaseUrl(req) {
  if (config.apiBaseUrl) {
    return config.apiBaseUrl.replace(/\/$/, '');
  }
  const port = config.port;
  const host = req.get('host') || `localhost:${port}`;
  const protocol = req.get('x-forwarded-proto') || req.protocol || 'http';
  return `${protocol}://${host}`;
}

// GET / — liste des médias (admin)
router.get('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const baseUrl = getBaseUrl(req);
    const videosRaw = scanUploadDir(paths.videos, baseUrl, 'video');
    const videos = await enrichVideosWithDuration(videosRaw, paths.videos);
    const images = scanUploadDir(paths.images, baseUrl, 'image');
    const audioRaw = scanUploadDir(paths.audio, baseUrl, 'audio');
    const audio = await enrichAudioWithDuration(audioRaw, paths.audio);
    return ok(res, { media: [...videos, ...images, ...audio] });
  } catch (e) {
    console.error('GET media-library:', e);
    return err(res, 'Erreur lors de la lecture des médias.', 500);
  }
});

// DELETE / — supprimer un fichier (admin requis)
router.delete('/', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const filePath = req.body?.path || req.query?.path;
    if (!filePath || typeof filePath !== 'string') {
      return err(res, 'Paramètre "path" requis.', 400);
    }
    const normalized = path
      .normalize(filePath)
      .replace(/^(\.\.(\/|\\))+/, '')
      .replace(/^\//, '');
    const okPath = ALLOWED_PREFIXES.some((p) => normalized.startsWith(p));
    if (!okPath) {
      return err(res, 'Chemin non autorisé.', 403);
    }
    const publicDirResolved = path.resolve(PUBLIC_DIR);
    const fullPath = path.resolve(PUBLIC_DIR, normalized);
    if (!fullPath.startsWith(publicDirResolved)) {
      return err(res, 'Chemin non autorisé.', 403);
    }
    const relative = path.relative(publicDirResolved, fullPath);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      return err(res, 'Chemin non autorisé.', 403);
    }
    if (!fs.existsSync(fullPath)) {
      return err(res, 'Fichier introuvable.', 404);
    }
    fs.unlinkSync(fullPath);
    return ok(res, { message: 'Fichier supprimé du serveur.' });
  } catch (e) {
    console.error('DELETE media-library:', e);
    return err(res, 'Erreur lors de la suppression.', 500);
  }
});

module.exports = router;
