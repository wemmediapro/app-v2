/**
 * Routes API Shipmap - Plan du navire (ponts) (MongoDB)
 */

const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const Shipmap = require('../models/Shipmap');
const { logRouteError } = require('../lib/route-logger');

const SUPPORTED_LANGS = ['fr', 'en', 'es', 'it', 'de', 'ar'];

function getRequestLang(req) {
  const q = (req.query.lang || '').toLowerCase();
  if (SUPPORTED_LANGS.includes(q)) {
    return q;
  }
  const r = (req.language || 'fr').toLowerCase();
  return SUPPORTED_LANGS.includes(r) ? r : 'fr';
}

/** Applique la langue demandée : name/description depuis nameByLocale/descriptionByLocale si présents. */
function localizeDeck(doc, lang) {
  const out = { ...doc };
  if (doc.nameByLocale && doc.nameByLocale[lang]) {
    out.name = doc.nameByLocale[lang];
  }
  if (doc.descriptionByLocale && doc.descriptionByLocale[lang]) {
    out.description = doc.descriptionByLocale[lang];
  }
  return out;
}

function normalizeServices(services) {
  if (!Array.isArray(services)) {
    return [];
  }
  return services.map((s) => {
    if (typeof s === 'string') {
      return { name: s.trim(), icon: '', openingHours: '', nameByLocale: {} };
    }
    const name = s && s.name ? String(s.name).trim() : '';
    const nameByLocale = s && s.nameByLocale && typeof s.nameByLocale === 'object' ? s.nameByLocale : {};
    return {
      name,
      icon: s && s.icon ? String(s.icon).trim() : '',
      openingHours: s && s.openingHours ? String(s.openingHours).trim() : '',
      nameByLocale,
    };
  });
}

/** Retourne les services avec le nom localisé selon lang (name = nameByLocale[lang] || name). Inclut nameByLocale pour le dashboard. */
function localizeServices(services, lang) {
  if (!Array.isArray(services)) {
    return [];
  }
  return services.map((s) => {
    const base =
      typeof s === 'string'
        ? { name: s.trim(), icon: '', openingHours: '', nameByLocale: {} }
        : {
            name: s && s.name ? String(s.name).trim() : '',
            icon: s && s.icon ? String(s.icon).trim() : '',
            openingHours: s && s.openingHours ? String(s.openingHours).trim() : '',
            nameByLocale: s && s.nameByLocale && typeof s.nameByLocale === 'object' ? s.nameByLocale : {},
          };
    const nameByLocale = base.nameByLocale;
    const localizedName =
      nameByLocale[lang] && String(nameByLocale[lang]).trim() ? String(nameByLocale[lang]).trim() : base.name;
    return { name: localizedName, icon: base.icon, openingHours: base.openingHours, nameByLocale };
  });
}

// @route   GET /api/shipmap/decks
// @desc    Liste tous les ponts (tous navires ou filtrés). ?lang=fr|en|es|it|de|ar pour nom/description localisés.
router.get('/decks', async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const lang = getRequestLang(req);
      const query = {};
      const shipIdParam = req.query.shipId;
      if (shipIdParam != null && shipIdParam !== '' && String(shipIdParam) !== 'undefined') {
        const n = Number(shipIdParam);
        if (!Number.isNaN(n) && n >= 1) {
          query.shipId = n;
        }
      }
      let decks = await Shipmap.find(query).lean().sort({ name: 1 });
      // Si aucun pont pour ce navire, proposer ceux du navire 7 (GNV Excellent / seed)
      if (decks.length === 0 && query.shipId && query.shipId !== 7) {
        decks = await Shipmap.find({ shipId: 7 }).lean().sort({ name: 1 });
      }
      return res.json(
        decks.map((doc) => {
          const localized = localizeDeck(doc, lang);
          return {
            ...localized,
            _id: (localized._id || doc._id)?.toString(),
            services: localizeServices(localized.services || doc.services, lang),
          };
        })
      );
    }
    res.json([]);
  } catch (error) {
    logRouteError(req, 'shipmap_decks_list_failed', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/shipmap
// @desc    Données shipmap (format compatible démo: { decks, services }). ?lang= pour nom/description localisés.
router.get('/', async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const lang = getRequestLang(req);
      const decks = await Shipmap.find({ isActive: true }).lean().sort({ name: 1 });
      const normalizedDecks = decks.map((d) => {
        const localized = localizeDeck(d, lang);
        return {
          id: (d._id || localized._id)?.toString(),
          _id: (d._id || localized._id)?.toString(),
          name: localized.name ?? d.name,
          type: localized.type ?? d.type,
          services: localizeServices(localized.services || d.services, lang),
          description: localized.description ?? d.description,
          capacity: localized.capacity ?? d.capacity,
          shipId: localized.shipId ?? d.shipId,
          shipName: localized.shipName ?? d.shipName,
        };
      });
      const services = [
        ...new Set(normalizedDecks.flatMap((d) => (d.services || []).map((s) => s.name).filter(Boolean))),
      ];
      return res.json({ decks: normalizedDecks, services });
    }
    res.json({ decks: [], services: [] });
  } catch (error) {
    logRouteError(req, 'shipmap_get_failed', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/shipmap/decks/:id
// @desc    Détail d'un pont. ?lang= pour nom/description localisés.
router.get('/decks/:id', async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const lang = getRequestLang(req);
      const deck = await Shipmap.findById(req.params.id).lean();
      if (!deck) {
        return res.status(404).json({ message: 'Pont non trouvé' });
      }
      const localized = localizeDeck(deck, lang);
      return res.json({
        ...localized,
        _id: (localized._id || deck._id)?.toString(),
        services: localizeServices(localized.services || deck.services, lang),
      });
    }
    return res.status(404).json({ message: 'Pont non trouvé' });
  } catch (error) {
    logRouteError(req, 'shipmap_deck_get_failed', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/shipmap/decks
// @desc    Créer un pont
router.post('/decks', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: 'Base de données indisponible. Mode démo actif.' });
    }
    const body = req.body;
    const deck = new Shipmap({
      name: body.name,
      type: body.type || 'passenger',
      description: body.description,
      area: body.area,
      capacity: body.capacity || 0,
      shipId: body.shipId,
      shipName: body.shipName,
      services: normalizeServices(body.services || []),
      accessPoints: body.accessPoints || [],
      facilities: body.facilities || [],
      zones: body.zones || [],
      cabinTypes: body.cabinTypes || [],
      restaurants: body.restaurants || [],
      poolInfo: body.poolInfo,
      isActive: body.isActive !== false,
      nameByLocale: body.nameByLocale || {},
      descriptionByLocale: body.descriptionByLocale || {},
    });
    await deck.save();
    const doc = deck.toObject();
    res.status(201).json({ ...doc, _id: doc._id?.toString() });
  } catch (error) {
    logRouteError(req, 'shipmap_deck_create_failed', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
});

// @route   PUT /api/shipmap/decks/:id
// @desc    Modifier un pont
router.put('/decks/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: 'Base de données indisponible. Mode démo actif.' });
    }
    const updates = { ...req.body };
    delete updates._id;
    if (Array.isArray(updates.services)) {
      updates.services = normalizeServices(updates.services);
    }
    const deck = await Shipmap.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true });
    if (!deck) {
      return res.status(404).json({ message: 'Pont non trouvé' });
    }
    const doc = deck.toObject();
    res.json({ ...doc, _id: doc._id?.toString() });
  } catch (error) {
    logRouteError(req, 'shipmap_deck_update_failed', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
});

// @route   PUT /api/shipmap
// @desc    Mise à jour globale des ponts
router.put('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: 'Base de données indisponible. Mode démo actif.' });
    }
    const { decks } = req.body;
    if (!Array.isArray(decks)) {
      return res.status(400).json({ message: 'decks array required' });
    }
    for (const d of decks) {
      const payload = { ...d };
      if (Array.isArray(payload.services)) {
        payload.services = normalizeServices(payload.services);
      }
      if (d._id) {
        await Shipmap.findByIdAndUpdate(d._id, { $set: payload });
      } else {
        await new Shipmap(payload).save();
      }
    }
    const allDecks = await Shipmap.find({}).lean();
    const normalized = allDecks.map((d) => ({
      ...d,
      id: d._id?.toString(),
      _id: d._id?.toString(),
      services: normalizeServices(d.services),
    }));
    res.json({
      decks: normalized,
      services: [...new Set(normalized.flatMap((d) => (d.services || []).map((s) => s.name).filter(Boolean)))],
    });
  } catch (error) {
    logRouteError(req, 'shipmap_update_failed', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
});

// @route   DELETE /api/shipmap/decks/:id
// @desc    Supprimer un pont
router.delete('/decks/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: 'Base de données indisponible. Mode démo actif.' });
    }
    const deck = await Shipmap.findByIdAndDelete(req.params.id);
    if (!deck) {
      return res.status(404).json({ message: 'Pont non trouvé' });
    }
    res.json({ message: 'Pont supprimé' });
  } catch (error) {
    logRouteError(req, 'shipmap_deck_delete_failed', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
