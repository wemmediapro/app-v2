/**
 * Route de streaming vidéo/audio avec support des requêtes Range (HTTP 206)
 * Optimisé pour un grand nombre de connexions : ETag/304, buffer 128KB, non-buffering proxy.
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const crypto = require('crypto');

const router = express.Router();
const config = require('../config');
const VIDEOS_DIR = config.paths.videos;
const AUDIO_DIR = config.paths.audio;

/** Taille de buffer pour createReadStream — 128KB pour un premier octet plus rapide (TTFB) tout en limitant les appels système */
const STREAM_HIGH_WATER_MARK = 128 * 1024;

const MIME_TYPES_VIDEO = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ogg': 'video/ogg',
  '.mov': 'video/quicktime',
};

const MIME_TYPES_AUDIO = {
  '.mp3': 'audio/mpeg',
  '.mpeg': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.webm': 'audio/webm',
};

/** Génère un ETag faible à partir de mtime + size (évite lecture fichier) */
function etagFromStat(stat) {
  const str = `${stat.mtimeMs}-${stat.size}`;
  const hash = crypto.createHash('md5').update(str).digest('hex').slice(0, 16);
  return `W/"${hash}"`;
}

function setStreamHeaders(res, contentType, options = {}) {
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=3600');
  res.setHeader('Content-Disposition', 'inline');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Accel-Buffering', 'no'); // nginx: stream direct sans buffer
  const exposeHeaders = options.exposeHeaders || 'Content-Range, Accept-Ranges, Content-Length';
  res.setHeader('Access-Control-Expose-Headers', exposeHeaders);
}

function pipeWithErrorHandling(stream, res, errMessage = 'Erreur lecture média') {
  stream.on('error', (err) => {
    if (!res.headersSent) {res.status(500).json({ message: errMessage });} else {res.destroy();}
  });
  res.on('close', () => stream.destroy());
  stream.pipe(res);
}

/**
 * Sert un fichier (vidéo ou audio) avec support Range pour le streaming (GET ou HEAD).
 * @param {object} req
 * @param {object} res
 * @param {string} filePath
 * @param {object} mimeMap - ex. MIME_TYPES_VIDEO ou MIME_TYPES_AUDIO
 * @param {function} [next] - Si fourni et fichier absent, appelle next() au lieu d'envoyer 404 (middleware).
 * @param {string} [notFoundMessage] - Message 404 si fichier absent.
 */
async function streamFile(req, res, filePath, mimeMap, next, notFoundMessage = 'Fichier non trouvé') {
  let stat;
  try {
    stat = await fsp.stat(filePath);
  } catch (e) {
    if (e.code === 'ENOENT') {
      if (typeof next === 'function') {return next();}
      return res.status(404).json({ message: notFoundMessage });
    }
    throw e;
  }

  const fileSize = stat.size;
  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeMap[ext] || (mimeMap === MIME_TYPES_VIDEO ? 'video/mp4' : 'audio/mpeg');
  const etag = etagFromStat(stat);
  const lastModified = stat.mtime.toUTCString();

  const isHead = req.method === 'HEAD';
  const range = req.headers.range;
  const hasRange = range && /^bytes=/.test(range.trim());

  setStreamHeaders(res, contentType, { exposeHeaders: 'Content-Range, Accept-Ranges, Content-Length' });
  res.setHeader('Last-Modified', lastModified);
  res.setHeader('ETag', etag);

  if (isHead) {
    res.setHeader('Content-Length', fileSize);
    return res.status(200).end();
  }

  // Sans Range : permettre 304 Not Modified pour réduire bande passante (nombreuses connexions)
  if (!hasRange) {
    const ifNoneMatch = req.headers['if-none-match'];
    const ifModifiedSince = req.headers['if-modified-since'];
    if ((ifNoneMatch && ifNoneMatch.trim() === etag) || (ifModifiedSince && new Date(ifModifiedSince).getTime() >= stat.mtimeMs)) {
      res.removeHeader('Content-Length');
      return res.status(304).end();
    }
  }

  if (hasRange) {
    const parts = range.replace(/bytes=/, '').trim().split('-');
    let start = parseInt(parts[0], 10);
    let end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    if (Number.isNaN(start)) {start = 0;}
    if (Number.isNaN(end) || end >= fileSize) {end = fileSize - 1;}
    if (start < 0) {start = 0;}
    if (start > end) {
      res.setHeader('Content-Range', `bytes */${fileSize}`);
      return res.status(416).json({ message: 'Plage demandée invalide' });
    }
    const chunkSize = end - start + 1;

    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
    res.setHeader('Content-Length', chunkSize);

    const stream = fs.createReadStream(filePath, { start, end, highWaterMark: STREAM_HIGH_WATER_MARK });
    pipeWithErrorHandling(stream, res, notFoundMessage);
  } else {
    res.setHeader('Content-Length', fileSize);
    res.status(200);
    const stream = fs.createReadStream(filePath, { highWaterMark: STREAM_HIGH_WATER_MARK });
    pipeWithErrorHandling(stream, res, notFoundMessage);
  }
}

/**
 * GET /api/stream/video/:filename
 * Lecture en streaming d'une vidéo (films, séries, webtv, kids).
 * HEAD : renvoie les en-têtes (Content-Length, Accept-Ranges) sans corps.
 */
const streamVideoHandler = async (req, res) => {
  let filename = req.params.filename;
  try {
    filename = decodeURIComponent(filename);
  } catch (_) {
    return res.status(400).json({ message: 'Nom de fichier invalide' });
  }
  filename = path.basename(filename);
  if (!filename || filename.includes('..')) {
    return res.status(400).json({ message: 'Nom de fichier invalide' });
  }
  const filePath = path.join(VIDEOS_DIR, filename);
  try {
    await streamFile(req, res, filePath, MIME_TYPES_VIDEO, null, 'Vidéo non trouvée');
  } catch (err) {
    if (!res.headersSent) {res.status(500).json({ message: 'Erreur lecture vidéo' });}
  }
};
router.get('/video/:filename', streamVideoHandler);
router.head('/video/:filename', streamVideoHandler);

/**
 * Middleware pour servir /uploads/videos/* en streaming (Range)
 * À monter sous app.use('/uploads', ...) : req.url vaut alors /videos/xxx ou /audio/xxx.
 */
async function videoStreamMiddleware(req, res, next) {
  const match = (req.url || req.path || '').match(/^\/videos\/([^/]+)$/);
  if ((req.method !== 'GET' && req.method !== 'HEAD') || !match) {return next();}
  const filename = match[1];
  if (!filename || filename.includes('..')) {return next();}
  const filePath = path.join(VIDEOS_DIR, filename);
  try {
    await streamFile(req, res, filePath, MIME_TYPES_VIDEO, next, 'Vidéo non trouvée');
  } catch (err) {
    if (!res.headersSent) {next(err);}
  }
}

/**
 * Middleware pour servir /uploads/audio/* en streaming (Range) — programmation radio 100% offline.
 */
async function audioStreamMiddleware(req, res, next) {
  const match = (req.url || req.path || '').match(/^\/audio\/([^/]+)$/);
  if ((req.method !== 'GET' && req.method !== 'HEAD') || !match) {return next();}
  const filename = match[1];
  if (!filename || filename.includes('..')) {return next();}
  const filePath = path.join(AUDIO_DIR, filename);
  try {
    await streamFile(req, res, filePath, MIME_TYPES_AUDIO, next, 'Fichier audio non trouvé');
  } catch (err) {
    if (!res.headersSent) {next(err);}
  }
}

module.exports = router;
module.exports.streamFile = streamFile;
module.exports.videoStreamMiddleware = videoStreamMiddleware;
module.exports.audioStreamMiddleware = audioStreamMiddleware;
