/**
 * Stockage de secours pour les films/séries quand MongoDB est indisponible.
 * Utilise un fichier JSON dans backend/data/movies.json
 */

const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const BACKEND_ROOT = path.join(__dirname, '..', '..');
const DATA_DIR = path.join(BACKEND_ROOT, 'data');
const MOVIES_FILE = path.join(DATA_DIR, 'movies.json');

/**
 *
 */
function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

/**
 *
 */
function readMovies() {
  ensureDir();
  if (!fs.existsSync(MOVIES_FILE)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(MOVIES_FILE, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (e) {
    logger.warn({ event: 'movies_fallback_read_failed', err: e.message });
    return [];
  }
}

/**
 *
 */
function writeMovies(movies) {
  ensureDir();
  fs.writeFileSync(MOVIES_FILE, JSON.stringify(movies, null, 2), 'utf8');
}

/**
 *
 */
function nextId(movies) {
  let max = 0;
  movies.forEach((m) => {
    const id = typeof m._id === 'string' && m._id.match(/^\d+$/) ? parseInt(m._id, 10) : 0;
    if (id > max) {
      max = id;
    }
  });
  return String(max + 1);
}

module.exports = {
  getAll() {
    return readMovies().filter((m) => m.isActive !== false);
  },
  getById(id) {
    const movies = readMovies();
    return movies.find((m) => String(m._id) === String(id) && m.isActive !== false);
  },
  create(body) {
    const movies = readMovies();
    const _id = nextId(movies);
    const movie = {
      _id,
      id: _id,
      title: body.title,
      type: body.type === 'series' ? 'series' : 'movie',
      genre: body.genre,
      year: body.year,
      duration: body.duration,
      rating: body.rating ?? 0,
      description: body.description || '',
      poster: body.poster || '',
      tmdbPosterPath: body.tmdbPosterPath || '',
      videoUrl: body.videoUrl || '',
      isPopular: body.isPopular === true,
      countries: Array.isArray(body.countries) ? body.countries : [],
      tags: Array.isArray(body.tags) ? body.tags : [],
      shipId: body.shipId,
      destination: body.destination,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      translations: body.translations && typeof body.translations === 'object' ? body.translations : {},
      episodes:
        body.type === 'series' && Array.isArray(body.episodes)
          ? body.episodes.map((ep, i) => ({
              title: ep.title,
              duration: ep.duration || '',
              description: ep.description || '',
              videoUrl: ep.videoUrl || '',
              order: ep.order ?? i,
              translations: ep.translations && typeof ep.translations === 'object' ? ep.translations : undefined,
            }))
          : [],
    };
    movies.push(movie);
    writeMovies(movies);
    return movie;
  },
  update(id, body) {
    const movies = readMovies();
    const idx = movies.findIndex((m) => String(m._id) === String(id));
    if (idx === -1) {
      return null;
    }
    const updates = {
      title: body.title,
      type: body.type === 'series' ? 'series' : 'movie',
      genre: body.genre,
      year: body.year,
      duration: body.duration,
      rating: body.rating,
      description: body.description,
      poster: body.poster,
      tmdbPosterPath: body.tmdbPosterPath,
      videoUrl: body.videoUrl,
      isPopular: body.isPopular,
      countries: body.countries,
      tags: body.tags,
      shipId: body.shipId,
      destination: body.destination,
      updatedAt: new Date().toISOString(),
    };
    if (body.type === 'series' && Array.isArray(body.episodes)) {
      updates.episodes = body.episodes.map((ep, i) => ({
        title: ep.title,
        duration: ep.duration || '',
        description: ep.description || '',
        videoUrl: ep.videoUrl || '',
        order: ep.order ?? i,
        translations: ep.translations && typeof ep.translations === 'object' ? ep.translations : undefined,
      }));
    }
    if (body.translations != null && typeof body.translations === 'object') {
      updates.translations = body.translations;
    }
    Object.keys(updates).forEach((k) => updates[k] === undefined && delete updates[k]);
    movies[idx] = { ...movies[idx], ...updates };
    writeMovies(movies);
    return movies[idx];
  },
  remove(id) {
    const movies = readMovies();
    const idx = movies.findIndex((m) => String(m._id) === String(id));
    if (idx === -1) {
      return null;
    }
    movies[idx].isActive = false;
    movies[idx].updatedAt = new Date().toISOString();
    writeMovies(movies);
    return movies[idx];
  },
};
