/**
 * Routes API WebTV - Chaînes et programmes (MongoDB uniquement)
 */

const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const WebTVChannel = require('../models/WebTVChannel');
const { generateTranslationsForWebTV } = require('../lib/webtv-translations-openai');
const { logRouteError } = require('../lib/route-logger');

const DB_UNAVAILABLE_MSG =
  'Base de données indisponible. Démarrez MongoDB (ex: docker run -d -p 27017:27017 mongo) ou vérifiez MONGODB_URI dans backend/config.env.';

function toResponse(doc) {
  if (!doc) {
    return null;
  }
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  obj._id = obj._id?.toString();
  return obj;
}

function localizeChannel(doc, lang) {
  if (!doc) {
    return doc;
  }
  const obj = {
    ...doc,
    _id: doc._id?.toString(),
    programs: doc.programs || [],
    schedule: Array.isArray(doc.schedule) ? doc.schedule : [],
  };
  if (lang && doc.translations && doc.translations[lang]) {
    const t = doc.translations[lang];
    if (t.name) {
      obj.name = t.name;
    }
    if (t.description !== undefined) {
      obj.description = t.description;
    }
  }
  return obj;
}

// @route   GET /api/webtv/channels — ?lang= pour contenu localisé (schedule = programme du jour depuis la BDD)
router.get('/channels', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json([]);
    }
    const { lang } = req.query;
    const channels = await WebTVChannel.find({}).lean().sort({ createdAt: -1 });
    res.json(channels.map((doc) => localizeChannel(doc, lang)));
  } catch (error) {
    logRouteError(req, 'webtv_channels_list_failed', error);
    res.json([]);
  }
});

// @route   GET /api/webtv/channels/:id — ?lang= (programme du jour / schedule depuis la BDD)
router.get('/channels/:id', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: DB_UNAVAILABLE_MSG });
    }
    const { lang } = req.query;
    const channel = await WebTVChannel.findById(req.params.id).lean();
    if (!channel) {
      return res.status(404).json({ message: 'Chaîne non trouvée' });
    }
    res.json(localizeChannel(channel, lang));
  } catch (error) {
    logRouteError(req, 'webtv_channel_get_failed', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/webtv/channels/:id/translate
// @desc    Traduire titre et description de la chaîne dans toutes les langues (OpenAI)
router.post('/channels/:id/translate', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: DB_UNAVAILABLE_MSG });
    }
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({
        message: 'OPENAI_API_KEY manquant. Définissez-le dans backend/.env pour utiliser la traduction automatique.',
      });
    }
    const channel = await WebTVChannel.findById(req.params.id);
    if (!channel) {
      return res.status(404).json({ message: 'Chaîne non trouvée' });
    }
    const name = req.body.name != null ? req.body.name : channel.name || '';
    const description = req.body.description != null ? req.body.description : channel.description || '';
    const OpenAI = require('openai').default;
    const openai = new OpenAI({ apiKey });
    const translations = await generateTranslationsForWebTV(openai, name, description);
    channel.translations = translations;
    await channel.save();
    return res.json(toResponse(channel));
  } catch (error) {
    logRouteError(req, 'webtv_translate_failed', error);
    const msg = error.message || 'Erreur lors de la traduction';
    return res.status(500).json({ message: msg });
  }
});

// @route   POST /api/webtv/translate
// @desc    Traduire un titre + description (sans chaîne) — pour formulaire création
router.post('/translate', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({
        message: 'OPENAI_API_KEY manquant. Définissez-le dans backend/.env pour utiliser la traduction automatique.',
      });
    }
    const name = req.body.name || '';
    const description = req.body.description || '';
    const OpenAI = require('openai').default;
    const openai = new OpenAI({ apiKey });
    const translations = await generateTranslationsForWebTV(openai, name, description);
    return res.json({ translations });
  } catch (error) {
    logRouteError(req, 'webtv_translate_preview_failed', error);
    return res.status(500).json({ message: error.message || 'Erreur lors de la traduction' });
  }
});

// @route   POST /api/webtv/channels
// @desc    Créer une chaîne WebTV
router.post('/channels', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: DB_UNAVAILABLE_MSG });
    }
    const channel = new WebTVChannel({
      name: req.body.name,
      category: req.body.category || 'entertainment',
      description: req.body.description,
      streamUrl: req.body.streamUrl,
      logo: req.body.logo,
      imageUrl: req.body.imageUrl || req.body.logo,
      isLive: req.body.isLive !== false,
      isActive: req.body.isActive !== false,
      quality: req.body.quality || 'HD',
      viewers: req.body.viewers || 0,
      schedule: req.body.schedule || [],
      programs: req.body.programs || [],
      countries: req.body.countries || [],
      shipId: req.body.shipId,
      destination: req.body.destination,
      translations:
        req.body.translations && typeof req.body.translations === 'object' ? req.body.translations : undefined,
    });
    await channel.save();
    res.status(201).json(toResponse(channel));
  } catch (error) {
    logRouteError(req, 'webtv_channel_create_failed', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
});

// @route   PUT /api/webtv/channels/:id
// @desc    Modifier une chaîne WebTV
router.put('/channels/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: DB_UNAVAILABLE_MSG });
    }
    const updates = { ...req.body };
    delete updates._id;
    if (updates.translations && typeof updates.translations !== 'object') {
      delete updates.translations;
    }
    const channel = await WebTVChannel.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true });
    if (!channel) {
      return res.status(404).json({ message: 'Chaîne non trouvée' });
    }
    res.json(toResponse(channel));
  } catch (error) {
    logRouteError(req, 'webtv_channel_update_failed', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
});

// @route   DELETE /api/webtv/channels/:id
// @desc    Supprimer une chaîne WebTV
router.delete('/channels/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: DB_UNAVAILABLE_MSG });
    }
    const channel = await WebTVChannel.findByIdAndDelete(req.params.id);
    if (!channel) {
      return res.status(404).json({ message: 'Chaîne non trouvée' });
    }
    res.json({ message: 'Chaîne supprimée' });
  } catch (error) {
    logRouteError(req, 'webtv_channel_delete_failed', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
