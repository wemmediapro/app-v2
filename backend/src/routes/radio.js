/**
 * Routes API Radio - Stations (MongoDB si connecté, sinon fichier backend/data/radio.json)
 */

const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const RadioStation = require('../models/RadioStation');
const radioFallback = require('../lib/radio-fallback');

const DB_UNAVAILABLE_MSG = 'Base de données indisponible. Démarrez MongoDB (ex: docker run -d -p 27017:27017 mongo) ou vérifiez MONGODB_URI dans backend/config.env.';

function toResponse(doc) {
  if (!doc) return null;
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  obj.id = obj._id?.toString();
  return obj;
}

function localizeStation(doc, lang) {
  if (!doc) return doc;
  const obj = { ...doc, id: doc._id?.toString() };
  if (lang && doc.translations && doc.translations[lang]) {
    const t = doc.translations[lang];
    if (t.name) obj.name = t.name;
    if (t.description !== undefined) obj.description = t.description;
  }
  return obj;
}

function formatFallbackStation(s) {
  return { ...s, id: String(s._id || s.id), listeners: Number(s.listeners) || 0 };
}

const useMongo = () => mongoose.connection.readyState === 1;

// @route   GET /api/radio — ?lang= pour contenu localisé, ?all=1 pour dashboard
router.get('/', async (req, res) => {
  try {
    const { lang } = req.query;
    if (useMongo()) {
      const onlyActive = req.query.all !== '1';
      const filter = onlyActive ? { isActive: true } : {};
      const stations = await RadioStation.find(filter).lean().sort({ createdAt: -1 });
      return res.json(stations.map(doc => localizeStation(doc, lang)));
    }
    const all = radioFallback.getStationsForApi();
    const list = req.query.all === '1' ? all : all.filter(s => s.isActive !== false);
    res.json(list.map(formatFallbackStation));
  } catch (error) {
    console.error('Get radio stations error:', error);
    res.json([]);
  }
});

// @route   PATCH /api/radio/:id/listeners — body: { action: 'join' | 'leave' }
router.patch('/:id/listeners', async (req, res) => {
  try {
    const { action } = req.body || {};
    if (action !== 'join' && action !== 'leave') {
      return res.status(400).json({ message: 'action doit être "join" ou "leave"' });
    }
    if (useMongo()) {
      const station = await RadioStation.findById(req.params.id);
      if (!station) return res.status(404).json({ message: 'Station non trouvée' });
      const current = Number(station.listeners) || 0;
      station.listeners = action === 'join' ? current + 1 : Math.max(0, current - 1);
      await station.save();
      return res.json({ listeners: station.listeners });
    }
    const updated = radioFallback.updateListeners(req.params.id, action);
    if (!updated) return res.status(404).json({ message: 'Station non trouvée' });
    res.json({ listeners: updated.listeners ?? 0 });
  } catch (error) {
    console.error('Update listeners error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
});

// @route   GET /api/radio/:id — ?lang=
router.get('/:id', async (req, res) => {
  try {
    const { lang } = req.query;
    if (useMongo()) {
      const station = await RadioStation.findById(req.params.id).lean();
      if (!station) return res.status(404).json({ message: 'Station non trouvée' });
      return res.json(localizeStation(station, lang));
    }
    const station = radioFallback.getById(req.params.id);
    if (!station) return res.status(404).json({ message: 'Station non trouvée' });
    res.json(formatFallbackStation(station));
  } catch (error) {
    console.error('Get radio station error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/radio
router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    if (useMongo()) {
      const { name, description, genre, streamUrl, logo, isActive, schedule, playlistId, programs } = req.body;
      if (!name || !name.trim()) return res.status(400).json({ message: 'Le nom de la station est requis' });
      const station = new RadioStation({
        name: name.trim(),
        description: description || '',
        genre: genre || '',
        streamUrl: (streamUrl && streamUrl.trim()) ? streamUrl.trim() : '',
        logo: logo || '',
        isActive: isActive !== false,
        schedule: Array.isArray(schedule) ? schedule : [],
        programs: Array.isArray(programs) ? programs : [],
        playlistId: (playlistId && playlistId.trim()) ? playlistId.trim() : undefined,
        translations: req.body.translations && typeof req.body.translations === 'object' ? req.body.translations : undefined
      });
      await station.save();
      return res.status(201).json(toResponse(station));
    }
    const { name, streamUrl, playlistId } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: 'Le nom de la station est requis' });
    const station = radioFallback.create(req.body);
    if (!station) return res.status(400).json({ message: 'Données invalides' });
    res.status(201).json(formatFallbackStation(station));
  } catch (error) {
    console.error('Create radio station error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
});

// @route   PUT /api/radio/:id
router.put('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    if (useMongo()) {
      const { name, description, genre, streamUrl, logo, isActive, schedule, playlistId, programs } = req.body;
      const updates = {};
      if (name !== undefined) updates.name = name.trim();
      if (description !== undefined) updates.description = description;
      if (genre !== undefined) updates.genre = genre;
      if (streamUrl !== undefined) updates.streamUrl = streamUrl;
      if (logo !== undefined) updates.logo = logo;
      if (isActive !== undefined) updates.isActive = isActive;
      if (Array.isArray(schedule)) updates.schedule = schedule;
      if (Array.isArray(programs)) updates.programs = programs;
      if (playlistId !== undefined) updates.playlistId = playlistId && playlistId.trim() ? playlistId.trim() : '';
      if (req.body.translations && typeof req.body.translations === 'object') updates.translations = req.body.translations;
      const station = await RadioStation.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true });
      if (!station) return res.status(404).json({ message: 'Station non trouvée' });
      return res.json(toResponse(station));
    }
    const station = radioFallback.update(req.params.id, req.body);
    if (!station) return res.status(404).json({ message: 'Station non trouvée' });
    res.json(formatFallbackStation(station));
  } catch (error) {
    console.error('Update radio station error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
});

// @route   DELETE /api/radio/:id
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    if (useMongo()) {
      const station = await RadioStation.findByIdAndDelete(req.params.id);
      if (!station) return res.status(404).json({ message: 'Station non trouvée' });
      return res.json({ message: 'Station supprimée définitivement' });
    }
    const station = radioFallback.remove(req.params.id);
    if (!station) return res.status(404).json({ message: 'Station non trouvée' });
    res.json({ message: 'Station supprimée définitivement' });
  } catch (error) {
    console.error('Delete radio station error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
