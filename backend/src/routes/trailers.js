/**
 * Routes API Bandes d'annonces (films/séries) — affiche, titre, description multilingue, vidéo par URL
 */

const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const Trailer = require('../models/Trailer');

function localizeTrailer(doc, lang) {
  if (!doc) return doc;
  const out = { ...doc, id: (doc._id || doc.id)?.toString() };
  if (lang && doc.translations && typeof doc.translations === 'object') {
    const fallbackLangs = [lang, 'fr', 'en'].filter((l, i, a) => a.indexOf(l) === i);
    for (const l of fallbackLangs) {
      const t = doc.translations[l];
      if (t) {
        if (t.title) out.title = t.title;
        if (t.description !== undefined) out.description = t.description;
        break;
      }
    }
  }
  return out;
}

// GET /api/trailers — ?lang= pour contenu localisé
router.get('/', async (req, res) => {
  try {
    const { lang } = req.query;
    if (mongoose.connection.readyState !== 1) {
      return res.json([]);
    }
    const trailers = await Trailer.find({ isActive: true }).lean().sort({ order: 1, createdAt: -1 });
    const langStr = typeof lang === 'string' ? lang.trim() : undefined;
    return res.json(trailers.map(doc => localizeTrailer(doc, langStr)));
  } catch (error) {
    console.error('Get trailers error:', error);
    res.json([]);
  }
});

// GET /api/trailers/:id — ?lang=
router.get('/:id', async (req, res) => {
  try {
    const { lang } = req.query;
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: 'Base de données indisponible' });
    }
    const doc = await Trailer.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ message: 'Bande d\'annonce non trouvée' });
    return res.json(localizeTrailer(doc, lang));
  } catch (error) {
    console.error('Get trailer error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/trailers
router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: 'Base de données indisponible' });
    }
    const body = req.body;
    const title = body.title && String(body.title).trim();
    if (!title) return res.status(400).json({ message: 'Le titre est requis' });

    const trailer = new Trailer({
      title,
      description: body.description || '',
      poster: body.poster || '',
      videoUrl: body.videoUrl || '',
      type: body.type === 'series' ? 'series' : 'movie',
      order: body.order ?? 0,
      isActive: body.isActive !== false,
      translations: body.translations && typeof body.translations === 'object' ? body.translations : undefined
    });
    await trailer.save();
    const doc = trailer.toObject();
    res.status(201).json({ ...doc, id: doc._id?.toString() });
  } catch (error) {
    console.error('Create trailer error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
});

// PUT /api/trailers/:id
router.put('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: 'Base de données indisponible' });
    }
    const updates = { ...req.body };
    delete updates._id;
    if (updates.translations && typeof updates.translations !== 'object') delete updates.translations;
    const doc = await Trailer.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true }).lean();
    if (!doc) return res.status(404).json({ message: 'Bande d\'annonce non trouvée' });
    return res.json({ ...doc, id: doc._id?.toString() });
  } catch (error) {
    console.error('Update trailer error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
});

// DELETE /api/trailers/:id
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: 'Base de données indisponible' });
    }
    const doc = await Trailer.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!doc) return res.status(404).json({ message: 'Bande d\'annonce non trouvée' });
    res.json({ message: 'Bande d\'annonce désactivée' });
  } catch (error) {
    console.error('Delete trailer error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
