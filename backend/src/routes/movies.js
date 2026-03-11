/**
 * Routes API Films / Séries — MongoDB si connecté, sinon fallback fichier backend/data/movies.json
 */

const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const config = require('../config');
const Movie = require('../models/Movie');
const moviesFallback = require('../lib/movies-fallback');
const { fetchPosterUrlFromGoogle } = require('../lib/google-poster-search');
const { buildPosterPrompt, DALLE3_POSTER_OPTIONS } = require('../lib/openai-poster-config');

function normalizeEpisodes(episodes) {
  if (!Array.isArray(episodes)) return [];
  return episodes.map((ep, i) => ({
    title: ep && (ep.title != null) ? String(ep.title).trim() : '',
    duration: ep && (ep.duration != null) ? String(ep.duration).trim() : '',
    description: ep && (ep.description != null) ? String(ep.description).trim() : '',
    videoUrl: ep && (ep.videoUrl != null) ? String(ep.videoUrl).trim() : '',
    order: typeof ep?.order === 'number' ? ep.order : i,
    translations: ep && ep.translations && typeof ep.translations === 'object' ? ep.translations : undefined
  }));
}

function localizeEpisodes(episodes, lang) {
  if (!Array.isArray(episodes) || !lang) return normalizeEpisodes(episodes);
  return episodes.map((ep) => {
    const normalized = normalizeEpisodes([ep])[0];
    if (ep.translations && typeof ep.translations === 'object') {
      const t = ep.translations[lang] || ep.translations.fr;
      if (t) {
        if (t.title) normalized.title = t.title;
        if (t.description !== undefined) normalized.description = t.description;
      }
    }
    return normalized;
  });
}

function formatMovie(doc) {
  if (!doc) return null;
  const o = doc.toObject ? doc.toObject() : { ...doc };
  o.id = o._id?.toString();
  if (Array.isArray(o.episodes)) o.episodes = normalizeEpisodes(o.episodes);
  return o;
}

const TMDB_POSTER_BASE = 'https://image.tmdb.org/t/p/w500';

function localizeMovie(doc, lang) {
  if (!doc) return doc;
  const o = { ...doc, id: doc._id?.toString() };
  if (lang && doc.translations && typeof doc.translations === 'object') {
    const t = doc.translations[lang] || doc.translations.fr;
    if (t) {
      if (t.title) o.title = t.title;
      if (t.description !== undefined) o.description = t.description;
    }
  }
  // Affiche réelle : si pas d'URL poster mais tmdbPosterPath fourni, construire l'URL TMDB
  if (!o.poster && doc.tmdbPosterPath) {
    const path = String(doc.tmdbPosterPath).startsWith('/') ? doc.tmdbPosterPath : `/${doc.tmdbPosterPath}`;
    o.poster = TMDB_POSTER_BASE + path;
  }
  if (Array.isArray(o.episodes)) o.episodes = localizeEpisodes(o.episodes, lang);
  return o;
}

function formatFallbackMovie(m, lang) {
  const o = { ...m, id: String(m._id || m.id) };
  if (lang && m.translations && typeof m.translations === 'object') {
    const t = m.translations[lang] || m.translations.fr;
    if (t) {
      if (t.title) o.title = t.title;
      if (t.description !== undefined) o.description = t.description;
    }
  }
  if (!o.poster && m.tmdbPosterPath) {
    const path = String(m.tmdbPosterPath).startsWith('/') ? m.tmdbPosterPath : `/${m.tmdbPosterPath}`;
    o.poster = TMDB_POSTER_BASE + path;
  }
  if (Array.isArray(o.episodes)) o.episodes = localizeEpisodes(o.episodes, lang);
  return o;
}

const useMongo = () => mongoose.connection.readyState === 1;

// @route   GET /api/movies/poster-search?q=titre+film — recherche Google Images, retourne { url }
router.get('/poster-search', async (req, res) => {
  try {
    const q = req.query.q;
    const url = await fetchPosterUrlFromGoogle(q || '');
    return res.json({ url: url || null });
  } catch (err) {
    console.error('poster-search error:', err);
    return res.status(500).json({ url: null, error: err.message });
  }
});

// @route   POST /api/movies/:id/fetch-poster — récupère l'affiche via Google et met à jour le film (admin)
router.post('/:id/fetch-poster', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const id = req.params.id;
    let movie = null;
    if (useMongo()) {
      movie = await Movie.findById(id).lean();
    } else {
      movie = moviesFallback.getById(id);
    }
    if (!movie) return res.status(404).json({ message: 'Film/série non trouvé' });
    const title = movie.title || movie.translations?.fr?.title || '';
    const posterUrl = await fetchPosterUrlFromGoogle(title);
    if (!posterUrl) {
      return res.status(422).json({ message: 'Aucune affiche trouvée pour ce titre (vérifiez GOOGLE_CSE_API_KEY et GOOGLE_CSE_CX)', url: null });
    }
    if (useMongo()) {
      await Movie.findByIdAndUpdate(id, { $set: { poster: posterUrl } });
      const updated = await Movie.findById(id).lean();
      return res.json(localizeMovie(updated));
    }
    moviesFallback.update(id, { poster: posterUrl });
    const updated = moviesFallback.getById(id);
    return res.json(formatFallbackMovie(updated));
  } catch (err) {
    console.error('fetch-poster error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// @route   POST /api/movies/:id/generate-poster — génère une affiche via OpenAI (DALL-E 3, même taille 1024x1792) et met à jour le film (admin)
router.post('/:id/generate-poster', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const id = req.params.id;
    let movie = null;
    if (useMongo()) {
      movie = await Movie.findById(id).lean();
    } else {
      movie = moviesFallback.getById(id);
    }
    if (!movie) return res.status(404).json({ message: 'Film/série non trouvé' });
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({
        message: 'OPENAI_API_KEY manquant. Définissez-le dans backend/.env pour générer des affiches avec OpenAI.',
      });
    }
    const OpenAI = require('openai').default;
    const openai = new OpenAI({ apiKey });
    const prompt = buildPosterPrompt({
      title: movie.title,
      type: movie.type,
      genre: movie.genre,
      year: movie.year,
      description: movie.description,
    });
    const response = await openai.images.generate({
      ...DALLE3_POSTER_OPTIONS,
      prompt,
    });
    const img = response.data?.[0];
    if (!img?.b64_json) {
      return res.status(502).json({ message: 'OpenAI n’a pas retourné d’image.' });
    }
    const slug = (s) =>
      String(s || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/gi, '-')
        .replace(/(^-|-$)/g, '')
        .toLowerCase()
        .slice(0, 30);
    const safeName = slug(movie.title) || (movie.type === 'series' ? 'series' : 'movie');
    const filename = `movie-${String(movie._id || id).slice(-8)}-${safeName}.png`;
    const IMAGES_DIR = config.paths?.images || path.join(__dirname, '..', '..', 'public', 'uploads', 'images');
    if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });
    const fullPath = path.join(IMAGES_DIR, filename);
    fs.writeFileSync(fullPath, Buffer.from(img.b64_json, 'base64'));
    const posterPath = `/uploads/images/${filename}`;
    if (useMongo()) {
      await Movie.findByIdAndUpdate(id, { $set: { poster: posterPath, tmdbPosterPath: '' } });
      const updated = await Movie.findById(id).lean();
      return res.json(localizeMovie(updated));
    }
    moviesFallback.update(id, { poster: posterPath });
    const updated = moviesFallback.getById(id);
    return res.json(formatFallbackMovie(updated));
  } catch (err) {
    console.error('generate-poster error:', err);
    return res.status(500).json({ message: err.message || 'Erreur lors de la génération de l’affiche.' });
  }
});

// @route   GET /api/movies — ?lang= pour contenu localisé
router.get('/', async (req, res) => {
  try {
    const { lang } = req.query;
    if (useMongo()) {
      const movies = await Movie.find({ isActive: true }).lean().sort({ createdAt: -1 });
      return res.json(movies.map(doc => localizeMovie(doc, lang)));
    }
    const list = moviesFallback.getAll();
    res.json(list.map(m => formatFallbackMovie(m, lang)));
  } catch (error) {
    console.error('Get movies error:', error);
    res.json([]);
  }
});

// @route   GET /api/movies/:id — ?lang=
router.get('/:id', async (req, res) => {
  try {
    const { lang } = req.query;
    if (useMongo()) {
      const doc = await Movie.findById(req.params.id).lean();
      if (!doc) return res.status(404).json({ message: 'Film/série non trouvé' });
      return res.json(localizeMovie(doc, lang));
    }
    const movie = moviesFallback.getById(req.params.id);
    if (!movie) return res.status(404).json({ message: 'Film/série non trouvé' });
    res.json(formatFallbackMovie(movie, lang));
  } catch (error) {
    console.error('Get movie error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/movies
router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const body = req.body;
    const title = (body.title && String(body.title).trim());
    if (!title) return res.status(400).json({ message: 'Le titre est requis' });

    if (useMongo()) {
      const movie = new Movie({
        title,
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
        translations: body.translations && typeof body.translations === 'object' ? body.translations : undefined,
        episodes: (body.type === 'series' && Array.isArray(body.episodes))
          ? body.episodes.map((ep, i) => ({
              title: ep.title,
              duration: ep.duration || '',
              description: ep.description || '',
              videoUrl: ep.videoUrl || '',
              order: ep.order ?? i,
              translations: ep.translations && typeof ep.translations === 'object' ? ep.translations : undefined
            }))
          : []
      });
      await movie.save();
      return res.status(201).json(formatMovie(movie));
    }

    const movie = moviesFallback.create(body);
    res.status(201).json(formatFallbackMovie(movie));
  } catch (error) {
    console.error('Create movie error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/movies/:id
router.put('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const body = req.body;

    if (useMongo()) {
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
        destination: body.destination
      };
      if (body.translations && typeof body.translations === 'object') updates.translations = body.translations;
      if (body.type === 'series' && Array.isArray(body.episodes)) {
        updates.episodes = body.episodes.map((ep, i) => ({
          title: ep.title,
          duration: ep.duration || '',
          description: ep.description || '',
          videoUrl: ep.videoUrl || '',
          order: ep.order ?? i,
          translations: ep.translations && typeof ep.translations === 'object' ? ep.translations : undefined
        }));
      }
      Object.keys(updates).forEach(k => updates[k] === undefined && delete updates[k]);
      const doc = await Movie.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true }).lean();
      if (!doc) return res.status(404).json({ message: 'Film/série non trouvé' });
      const out = { ...doc, id: doc._id?.toString() };
      if (Array.isArray(out.episodes)) out.episodes = normalizeEpisodes(out.episodes);
      return res.json(out);
    }

    const movie = moviesFallback.update(req.params.id, body);
    if (!movie) return res.status(404).json({ message: 'Film/série non trouvé' });
    res.json(formatFallbackMovie(movie));
  } catch (error) {
    console.error('Update movie error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   DELETE /api/movies/:id
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    if (useMongo()) {
      const doc = await Movie.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
      if (!doc) return res.status(404).json({ message: 'Film/série non trouvé' });
      return res.json({ message: 'Contenu désactivé' });
    }
    const movie = moviesFallback.remove(req.params.id);
    if (!movie) return res.status(404).json({ message: 'Film/série non trouvé' });
    res.json({ message: 'Contenu désactivé' });
  } catch (error) {
    console.error('Delete movie error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
