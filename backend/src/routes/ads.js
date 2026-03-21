/**
 * Routes API Publicités (preroll / midroll) — calendrier, vidéo, skip
 */

const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const Ad = require('../models/Ad');

function toResponse(doc) {
  if (!doc) {return doc;}
  const d = doc.toObject ? doc.toObject() : doc;
  return { ...d, id: (d._id || d.id)?.toString() };
}

// GET /api/ads — liste (admin)
router.get('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: 'Base de données indisponible' });
    }
    const ads = await Ad.find().lean().sort({ order: 1, startDate: -1 });
    return res.json(ads.map(doc => {
      const raw = doc.skipAfterPercent;
      const skipAfterPercent = (typeof raw === 'number' || (typeof raw === 'string' && String(raw).trim() !== ''))
        ? Math.min(100, Math.max(0, Number(raw)))
        : 0;
      const rawTrigger = doc.triggerAtPercent;
      const triggerAtPercent =
        doc.type === 'midroll' &&
        rawTrigger !== undefined &&
        rawTrigger !== null &&
        Number(rawTrigger) === Number(rawTrigger)
          ? Math.min(100, Math.max(0, Number(rawTrigger)))
          : 50;
      return { ...doc, skipAfterPercent, triggerAtPercent, id: (doc._id || doc.id)?.toString() };
    }));
  } catch (error) {
    console.error('Get ads error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/ads/next?type=preroll|midroll&atPercent=50 — prochaine pub éligible (app)
router.get('/next', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({ videoUrl: null });
    }
    const type = (req.query.type === 'midroll' ? 'midroll' : 'preroll').toLowerCase();
    const now = new Date();
    const query = {
      type,
      active: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
    };
    if (type === 'midroll' && req.query.atPercent != null && req.query.atPercent !== '') {
      const atPercent = Math.min(100, Math.max(0, Number(req.query.atPercent)));
      if (!Number.isNaN(atPercent)) {
        query.triggerAtPercent = atPercent;
      }
    }
    let ad = await Ad.findOne(query).sort({ order: 1, startDate: -1 }).lean();
    if (!ad && type === 'midroll' && req.query.atPercent != null && req.query.atPercent !== '') {
      const atPercent = Math.min(100, Math.max(0, Number(req.query.atPercent)));
      if (!Number.isNaN(atPercent)) {
        ad = await Ad.findOne({
          type: 'midroll',
          active: true,
          startDate: { $lte: now },
          endDate: { $gte: now },
        })
          .sort({ order: 1, startDate: -1 })
          .lean();
      }
    }
    if (!ad || !ad.videoUrl) {
      return res.json({ videoUrl: null });
    }
    const skipAfterPercent =
      type === 'midroll' && ad.skipAfterPercent != null
        ? Math.min(100, Math.max(0, ad.skipAfterPercent))
        : 0;
    return res.json({
      id: (ad._id || ad.id)?.toString(),
      videoUrl: ad.videoUrl,
      skipAfterPercent,
    });
  } catch (error) {
    console.error('Get next ad error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

const config = require('../config');
// GET /api/ads/config — cue points mid-roll = % distincts des pubs mid-roll actives (sinon config env)
router.get('/config', async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const now = new Date();
      const percents = await Ad.distinct('triggerAtPercent', {
        type: 'midroll',
        active: true,
        startDate: { $lte: now },
        endDate: { $gte: now },
      });
      const sorted = [...new Set(percents)]
        .filter((p) => p != null && !Number.isNaN(p) && p >= 0 && p <= 100)
        .map((p) => Math.min(100, Math.max(0, Number(p))))
        .sort((a, b) => a - b);
      if (sorted.length > 0) {
        return res.json({
          midrollCuePointsSeconds: [],
          midrollCuePointsPercent: sorted,
        });
      }
    }
  } catch (e) {
    // fallback to config
  }
  const adsConfig = config.ads || {};
  res.json({
    midrollCuePointsSeconds: [],
    midrollCuePointsPercent: Array.isArray(adsConfig.midrollCuePointsPercent) ? adsConfig.midrollCuePointsPercent : [50],
  });
});

// POST /api/ads/:id/impression — enregistrer un affichage (app, sans auth)
router.post('/:id/impression', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: 'Base de données indisponible' });
    }
    const doc = await Ad.findByIdAndUpdate(
      req.params.id,
      { $inc: { impressions: 1 } },
      { new: true },
    ).lean();
    if (!doc) {return res.status(404).json({ message: 'Pub non trouvée' });}
    res.json({ ok: true, impressions: (doc.impressions || 0) });
  } catch (error) {
    console.error('Ad impression error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/ads/:id
router.get('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: 'Base de données indisponible' });
    }
    const doc = await Ad.findById(req.params.id).lean();
    if (!doc) {return res.status(404).json({ message: 'Pub non trouvée' });}
    const raw = doc.skipAfterPercent;
    const skipAfterPercent = (typeof raw === 'number' || (typeof raw === 'string' && String(raw).trim() !== ''))
      ? Math.min(100, Math.max(0, Number(raw)))
      : 0;
    const rawTrigger = doc.triggerAtPercent;
    const triggerAtPercent =
      doc.type === 'midroll' &&
      rawTrigger !== undefined &&
      rawTrigger !== null &&
      Number(rawTrigger) === Number(rawTrigger) // not NaN
        ? Math.min(100, Math.max(0, Number(rawTrigger)))
        : 50;
    return res.json({ ...doc, skipAfterPercent, triggerAtPercent, id: (doc._id || doc.id)?.toString() });
  } catch (error) {
    console.error('Get ad error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/ads
router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: 'Base de données indisponible' });
    }
    const body = req.body;
    const videoUrl = body.videoUrl && String(body.videoUrl).trim();
    if (!videoUrl) {return res.status(400).json({ message: 'videoUrl est requis' });}
    const type = body.type === 'midroll' ? 'midroll' : 'preroll';
    const startDate = body.startDate ? new Date(body.startDate) : new Date();
    const endDate = body.endDate ? new Date(body.endDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const skipAfterPercent =
      type === 'midroll' &&
      (typeof body.skipAfterPercent === 'number' || (typeof body.skipAfterPercent === 'string' && body.skipAfterPercent !== ''))
        ? Math.min(100, Math.max(0, Number(body.skipAfterPercent)))
        : 0;
    const rawTrigger = body.triggerAtPercent ?? body.trigger_at_percent;
    const triggerAtPercent =
      type === 'midroll' &&
      (rawTrigger !== undefined && rawTrigger !== null && rawTrigger !== '' && !Number.isNaN(Number(rawTrigger)))
        ? Math.min(100, Math.max(0, Number(rawTrigger)))
        : 50;
    const ad = new Ad({
      name: body.name ? String(body.name).trim() : '',
      videoUrl,
      type,
      startDate,
      endDate,
      skipAfterPercent,
      triggerAtPercent,
      order: typeof body.order === 'number' ? body.order : 0,
      active: body.active !== false,
    });
    await ad.save();
    if (type === 'midroll') {
      await Ad.updateOne({ _id: ad._id }, { $set: { triggerAtPercent } });
    }
    const saved = await Ad.findById(ad._id).lean();
    res.status(201).json({ ...saved, id: (saved._id || saved.id)?.toString() });
  } catch (error) {
    console.error('Create ad error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
});

// PUT /api/ads/:id
router.put('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: 'Base de données indisponible' });
    }
    const updates = { ...req.body };
    delete updates._id;
    if (updates.videoUrl !== undefined) {updates.videoUrl = String(updates.videoUrl).trim();}
    if (updates.type !== undefined) {updates.type = updates.type === 'midroll' ? 'midroll' : 'preroll';}
    if (updates.type === 'preroll') {updates.skipAfterPercent = 0;}
    if (updates.startDate !== undefined) {updates.startDate = new Date(updates.startDate);}
    if (updates.endDate !== undefined) {updates.endDate = new Date(updates.endDate);}
    // Toujours lire triggerAtPercent depuis le body pour la mise à jour (mid-roll)
    const rawTriggerBody = req.body.triggerAtPercent ?? req.body.trigger_at_percent ?? updates.triggerAtPercent;
    let typeIsMidroll = updates.type === 'midroll';
    let docBefore = null;
    if (updates.type === undefined) {
      docBefore = await Ad.findById(req.params.id).select('type').lean();
      typeIsMidroll = docBefore?.type === 'midroll';
    } else if (updates.type === 'preroll') {typeIsMidroll = false;}
    if (typeIsMidroll) {
      updates.triggerAtPercent =
        rawTriggerBody !== undefined && rawTriggerBody !== null && rawTriggerBody !== '' && !Number.isNaN(Number(rawTriggerBody))
          ? Math.min(100, Math.max(0, Number(rawTriggerBody)))
          : 50;
    } else {
      updates.triggerAtPercent = 50;
    }
    if (updates.skipAfterPercent !== undefined) {
      const raw = updates.skipAfterPercent;
      const typeIsMidrollSkip = updates.type !== undefined ? updates.type === 'midroll' : (docBefore?.type === 'midroll');
      updates.skipAfterPercent =
        typeIsMidrollSkip && (typeof raw === 'number' || (typeof raw === 'string' && raw !== ''))
          ? Math.min(100, Math.max(0, Number(raw)))
          : 0;
    }
    const doc = await Ad.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true }).lean();
    if (!doc) {return res.status(404).json({ message: 'Pub non trouvée' });}
    return res.json({ ...doc, id: doc._id?.toString() });
  } catch (error) {
    console.error('Update ad error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
});

// DELETE /api/ads/:id
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: 'Base de données indisponible' });
    }
    const doc = await Ad.findByIdAndDelete(req.params.id);
    if (!doc) {return res.status(404).json({ message: 'Pub non trouvée' });}
    res.json({ message: 'Pub supprimée' });
  } catch (error) {
    console.error('Delete ad error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
