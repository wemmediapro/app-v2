/**
 * Optimisation des images à l'upload : redimensionnement et compression pour réduire le poids.
 * Utilise sharp pour ne pas dégrader la qualité perçue tout en réduisant la bande passante.
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

/** Largeur max (px) pour les images (bande passante / affichage mobile). */
const MAX_WIDTH = 1920;
/** Qualité JPEG (1-100). 82-85 bon compromis taille/qualité. */
const JPEG_QUALITY = 85;
/** Qualité WebP (1-100). */
const WEBP_QUALITY = 82;

/**
 * Optimise une image fichier : redimensionne si trop grande, compresse.
 * @param {string} inputPath - Chemin absolu du fichier image
 * @param {object} [options] - { maxWidth, jpegQuality }
 * @returns {Promise<{ path: string, filename: string, sizeBefore?: number, sizeAfter?: number }>}
 */
async function optimizeImage(inputPath, options = {}) {
  const maxWidth = options.maxWidth ?? MAX_WIDTH;
  const jpegQuality = options.jpegQuality ?? JPEG_QUALITY;

  if (!inputPath || !fs.existsSync(inputPath)) {
    throw new Error('Fichier image introuvable');
  }

  const statBefore = fs.statSync(inputPath);
  const sizeBefore = statBefore.size;
  const ext = (path.extname(inputPath) || '').toLowerCase();
  const isPng = ext === '.png';

  let pipeline = sharp(inputPath);
  const meta = await pipeline.metadata();
  const width = meta.width || 0;
  const height = meta.height || 0;

  const shouldResize = width > maxWidth || height > maxWidth;
  if (shouldResize) {
    pipeline = pipeline.resize(maxWidth, null, { fit: 'inside', withoutEnlargement: true });
  }

  const dir = path.dirname(inputPath);
  const base = path.basename(inputPath, ext);
  const outputExt = isPng && (width > maxWidth || height > maxWidth) ? '.jpg' : ext;
  const outputFilename = `${base}-opt${outputExt}`;
  const outputPath = path.join(dir, outputFilename);

  if (outputExt === '.jpg' || outputExt === '.jpeg') {
    pipeline = pipeline.jpeg({ quality: jpegQuality, mozjpeg: true });
  } else if (outputExt === '.webp') {
    pipeline = pipeline.webp({ quality: WEBP_QUALITY });
  } else if (outputExt === '.png') {
    pipeline = pipeline.png({ compressionLevel: 6 });
  }

  await pipeline.toFile(outputPath);
  const statAfter = fs.statSync(outputPath);
  const sizeAfter = statAfter.size;

  if (outputPath !== inputPath) {
    try {
      fs.unlinkSync(inputPath);
    } catch (e) {
      console.warn('imageOptimization: could not remove original', inputPath, e.message);
    }
  }

  return {
    path: outputPath,
    filename: outputFilename,
    sizeBefore,
    sizeAfter,
  };
}

/**
 * Optimise un buffer image (ex: base64 upload). Retourne le buffer optimisé et le nom de fichier conseillé.
 * @param {Buffer} buffer
 * @param {string} [suggestedFilename] - ex: "photo.png"
 * @returns {Promise<{ buffer: Buffer, filename: string }>}
 */
async function optimizeImageBuffer(buffer, suggestedFilename = 'image.jpg') {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('Buffer image invalide');
  }

  const ext = (path.extname(suggestedFilename) || '.jpg').toLowerCase();
  let pipeline = sharp(buffer);
  const meta = await pipeline.metadata();
  const width = meta.width || 0;
  const height = meta.height || 0;
  const shouldResize = width > MAX_WIDTH || height > MAX_WIDTH;
  if (shouldResize) {
    pipeline = pipeline.resize(MAX_WIDTH, null, { fit: 'inside', withoutEnlargement: true });
  }

  const base = path.basename(suggestedFilename, ext);
  const outputExt = ext === '.png' && (width > MAX_WIDTH || height > MAX_WIDTH) ? '.jpg' : ext;
  const filename = `${base}-opt${outputExt}`;

  if (outputExt === '.jpg' || outputExt === '.jpeg') {
    pipeline = pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true });
  } else if (outputExt === '.webp') {
    pipeline = pipeline.webp({ quality: WEBP_QUALITY });
  } else if (outputExt === '.png') {
    pipeline = pipeline.png({ compressionLevel: 6 });
  }

  const outBuffer = await pipeline.toBuffer();
  return { buffer: outBuffer, filename };
}

/**
 * Optimise une image déjà sur disque en l'écrasant (même chemin, même extension).
 * Utile pour compresser les images déjà uploadées sans casser les URLs en base.
 * @param {string} inputPath - Chemin absolu du fichier
 * @param {object} [options] - { maxWidth, jpegQuality, keepFormat, webpQuality }
 * @returns {Promise<{ sizeBefore: number, sizeAfter: number }>}
 */
async function optimizeImageInPlace(inputPath, options = {}) {
  const maxWidth = options.maxWidth ?? MAX_WIDTH;
  const jpegQuality = options.jpegQuality ?? JPEG_QUALITY;
  const webpQuality = options.webpQuality ?? WEBP_QUALITY;
  const keepFormat = options.keepFormat !== false;

  if (!inputPath || !fs.existsSync(inputPath)) {
    throw new Error('Fichier image introuvable');
  }

  const sizeBefore = fs.statSync(inputPath).size;
  const ext = (path.extname(inputPath) || '').toLowerCase();
  const validExt = ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext);
  if (!validExt) {
    throw new Error('Format non supporté: ' + ext);
  }

  let pipeline = sharp(inputPath);
  const meta = await pipeline.metadata();
  const width = meta.width || 0;
  const height = meta.height || 0;
  const shouldResize = width > maxWidth || height > maxWidth;
  if (shouldResize) {
    pipeline = pipeline.resize(maxWidth, null, { fit: 'inside', withoutEnlargement: true });
  }

  if (ext === '.jpg' || ext === '.jpeg') {
    pipeline = pipeline.jpeg({ quality: jpegQuality, mozjpeg: true });
  } else if (ext === '.webp') {
    pipeline = pipeline.webp({ quality: webpQuality });
  } else if (ext === '.png') {
    pipeline = pipeline.png({ compressionLevel: 9 });
  } else if (ext === '.gif') {
    pipeline = pipeline.gif({ effort: 6 });
  }

  const buffer = await pipeline.toBuffer();
  const sizeAfter = buffer.length;
  if (sizeAfter >= sizeBefore && keepFormat) {
    return { sizeBefore, sizeAfter: sizeBefore, skipped: true };
  }
  fs.writeFileSync(inputPath, buffer);
  return { sizeBefore, sizeAfter: fs.statSync(inputPath).size };
}

/** Qualité JPEG en mode agressif (plus de compression). */
const JPEG_QUALITY_AGGRESSIVE = 78;

/**
 * Optimisation maximale : essaie PNG niveau 9, puis JPEG qualité 78 pour les PNG.
 * Si le JPEG est plus léger, remplace le fichier par .jpg et retourne le nouveau nom (pour mise à jour DB).
 * @param {string} inputPath - Chemin absolu
 * @param {object} [options] - { maxWidth, tryConvertPngToJpeg }
 * @returns {Promise<{ sizeBefore, sizeAfter, skipped?, newFilename? }>}
 */
async function optimizeImageInPlaceAggressive(inputPath, options = {}) {
  const maxWidth = options.maxWidth ?? MAX_WIDTH;
  const tryConvertPngToJpeg = options.tryConvertPngToJpeg !== false;

  if (!inputPath || !fs.existsSync(inputPath)) {
    throw new Error('Fichier image introuvable');
  }

  const sizeBefore = fs.statSync(inputPath).size;
  const ext = (path.extname(inputPath) || '').toLowerCase();
  const dir = path.dirname(inputPath);
  const base = path.basename(inputPath, ext);
  const validExt = ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext);
  if (!validExt) {
    throw new Error('Format non supporté: ' + ext);
  }

  let pipeline = sharp(inputPath);
  const meta = await pipeline.metadata();
  const width = meta.width || 0;
  const height = meta.height || 0;
  const hasAlpha = meta.hasAlpha;
  const shouldResize = width > maxWidth || height > maxWidth;
  if (shouldResize) {
    pipeline = pipeline.resize(maxWidth, null, { fit: 'inside', withoutEnlargement: true });
  }

  let bestBuffer = null;
  let bestSize = Infinity;
  let bestExt = ext;
  const jpegQuality = JPEG_QUALITY_AGGRESSIVE;

  if (ext === '.png' && tryConvertPngToJpeg) {
    try {
      let p = sharp(inputPath);
      if (shouldResize) {
        p = p.resize(maxWidth, null, { fit: 'inside', withoutEnlargement: true });
      }
      const jpegBuffer = await p.jpeg({ quality: jpegQuality, mozjpeg: true }).toBuffer();
      if (jpegBuffer.length < bestSize && jpegBuffer.length < sizeBefore) {
        bestSize = jpegBuffer.length;
        bestBuffer = jpegBuffer;
        bestExt = '.jpg';
      }
    } catch (e) {
      // ignore
    }
  }

  if (ext === '.jpg' || ext === '.jpeg') {
    let p = sharp(inputPath);
    if (shouldResize) {
      p = p.resize(maxWidth, null, { fit: 'inside', withoutEnlargement: true });
    }
    const buf = await p.jpeg({ quality: jpegQuality, mozjpeg: true }).toBuffer();
    if (buf.length < bestSize) {
      bestSize = buf.length;
      bestBuffer = buf;
      bestExt = ext;
    }
  }

  pipeline = sharp(inputPath);
  if (shouldResize) {
    pipeline = pipeline.resize(maxWidth, null, { fit: 'inside', withoutEnlargement: true });
  }
  if (ext === '.png') {
    const pngOpts = { compressionLevel: 9 };
    try {
      pipeline = pipeline.png(pngOpts);
    } catch (e) {
      pipeline = pipeline.png({ compressionLevel: 9 });
    }
    const pngBuffer = await pipeline.toBuffer();
    if (pngBuffer.length < bestSize) {
      bestSize = pngBuffer.length;
      bestBuffer = pngBuffer;
      bestExt = '.png';
    }
  } else if (ext === '.webp') {
    const buf = await pipeline.webp({ quality: 75 }).toBuffer();
    if (buf.length < bestSize) {
      bestSize = buf.length;
      bestBuffer = buf;
    }
  } else if (ext === '.gif') {
    const buf = await pipeline.gif({ effort: 8 }).toBuffer();
    if (buf.length < bestSize) {
      bestSize = buf.length;
      bestBuffer = buf;
    }
  }

  if (!bestBuffer || bestSize >= sizeBefore) {
    return { sizeBefore, sizeAfter: sizeBefore, skipped: true };
  }

  const newFilename = base + bestExt;
  const newPath = path.join(dir, newFilename);

  if (bestExt !== ext) {
    fs.writeFileSync(newPath, bestBuffer);
    try {
      fs.unlinkSync(inputPath);
    } catch (e) {}
    return { sizeBefore, sizeAfter: bestSize, newFilename };
  }

  fs.writeFileSync(inputPath, bestBuffer);
  return { sizeBefore, sizeAfter: bestSize };
}

/**
 * Génère un fichier .webp à côté d’une image JPEG/PNG (même nom de base).
 * @param {string} absolutePath - Chemin absolu du fichier optimisé (.jpg / .jpeg / .png)
 * @returns {Promise<string|null>} basename du .webp ou null si ignoré / échec
 */
async function writeWebpSibling(absolutePath) {
  if (!absolutePath || !fs.existsSync(absolutePath)) {
    return null;
  }
  const ext = (path.extname(absolutePath) || '').toLowerCase();
  if (!['.jpg', '.jpeg', '.png'].includes(ext)) {
    return null;
  }
  const webpPath = path.join(path.dirname(absolutePath), `${path.basename(absolutePath, ext)}.webp`);
  try {
    await sharp(absolutePath).webp({ quality: WEBP_QUALITY }).toFile(webpPath);
    return path.basename(webpPath);
  } catch (e) {
    console.warn('writeWebpSibling:', e.message);
    return null;
  }
}

module.exports = {
  optimizeImage,
  optimizeImageBuffer,
  optimizeImageInPlace,
  optimizeImageInPlaceAggressive,
  writeWebpSibling,
  MAX_WIDTH,
  JPEG_QUALITY,
  JPEG_QUALITY_AGGRESSIVE,
};
