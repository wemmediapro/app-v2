/**
 * Routes API Banners - Bannières promotionnelles (MongoDB ou fallback JSON)
 */

const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { bannerValidation } = require('../middleware/validation');
const Banner = require('../models/Banner');
const bannersFallback = require('../lib/banners-fallback');

function localizeBanner(doc, lang) {
  if (!doc) return doc;
  const out = { ...doc, _id: doc._id?.toString() };
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

// @route   GET /api/banners — ?lang= pour contenu localisé, ?page= pour filtrer par page (home, shop, etc.)
router.get('/', async (req, res) => {
  try {
    const { lang, page } = req.query;
    const langStr = typeof lang === 'string' ? lang.trim() : (Array.isArray(lang) && lang[0] != null) ? String(lang[0]).trim() : undefined;
    if (mongoose.connection.readyState !== 1) {
      return res.json(bannersFallback.getAll(langStr, page));
    }
    if (mongoose.connection.readyState === 1) {
      let query = { isActive: { $ne: false } };
      if (page && String(page).trim()) {
        const pageId = String(page).trim().toLowerCase();
        query.$or = [
          { pages: { $size: 0 } },
          { pages: pageId }
        ];
      }
      const banners = await Banner.find(query).read('secondaryPreferred').sort({ order: 1, createdAt: -1 }).lean();
      return res.json(banners.map(doc => localizeBanner(doc, langStr)));
    }
    return res.json([]);
  } catch (error) {
    console.error('Get banners error:', error);
    return res.json([]);
  }
});

// GET /api/banners/all — liste complète (admin, avec stats impressions/clics)
router.get('/all', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: 'Base de données indisponible' });
    }
    const banners = await Banner.find().sort({ order: 1, createdAt: -1 }).lean();
    return res.json(banners.map(doc => ({ ...doc, _id: doc._id?.toString() })));
  } catch (error) {
    console.error('Get all banners error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/banners/:id/impression — enregistrer un affichage (app, sans auth)
router.post('/:id/impression', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: 'Base de données indisponible' });
    }
    const banner = await Banner.findByIdAndUpdate(
      req.params.id,
      { $inc: { impressions: 1 } },
      { new: true }
    ).lean();
    if (!banner) return res.status(404).json({ message: 'Bannière non trouvée' });
    res.json({ ok: true, impressions: (banner.impressions || 0) });
  } catch (error) {
    console.error('Banner impression error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/banners/:id/click — enregistrer un clic (app, sans auth)
router.post('/:id/click', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: 'Base de données indisponible' });
    }
    const banner = await Banner.findByIdAndUpdate(
      req.params.id,
      { $inc: { clicks: 1 } },
      { new: true }
    ).lean();
    if (!banner) return res.status(404).json({ message: 'Bannière non trouvée' });
    res.json({ ok: true, clicks: (banner.clicks || 0) });
  } catch (error) {
    console.error('Banner click error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/banners/:id — ?lang=
router.get('/:id', async (req, res) => {
  try {
    const { lang } = req.query;
    if (mongoose.connection.readyState !== 1) {
      const banner = bannersFallback.getById(req.params.id, lang);
      if (!banner) return res.status(404).json({ message: 'Bannière non trouvée' });
      return res.json(banner);
    }
    if (mongoose.connection.readyState === 1) {
      const banner = await Banner.findById(req.params.id).lean();
      if (!banner) return res.status(404).json({ message: 'Bannière non trouvée' });
      return res.json(localizeBanner(banner, lang));
    }
    return res.status(404).json({ message: 'Bannière non trouvée' });
  } catch (error) {
    console.error('Get banner error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/banners
router.post('/', authMiddleware, adminMiddleware, bannerValidation, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: 'Base de données indisponible. Mode démo actif.' });
    }
    const body = req.body;
    const banner = new Banner({
      title: body.title,
      description: body.description,
      translations: body.translations && typeof body.translations === 'object' ? body.translations : undefined,
      position: body.position || 'home-top',
      order: body.order ?? 0,
      image: body.image,
      imageMobile: body.imageMobile || undefined,
      imageTablet: body.imageTablet || undefined,
      link: body.link,
      startDate: body.startDate ? new Date(body.startDate) : undefined,
      endDate: body.endDate ? new Date(body.endDate) : undefined,
      isActive: body.isActive !== false,
      countries: body.countries || [],
      ships: body.ships || [],
      pages: body.pages || [],
      clicks: body.clicks || 0,
      impressions: body.impressions || 0
    });
    await banner.save();
    const doc = banner.toObject();
    res.status(201).json({ ...doc, _id: doc._id?.toString() });
  } catch (error) {
    console.error('Create banner error:', error);
    res.status(500).json({ message: process.env.NODE_ENV === 'development' ? (error.message || 'Server error') : 'Server error' });
  }
});

// @route   PUT /api/banners/:id
// @desc    Modifier une bannière
router.put('/:id', authMiddleware, adminMiddleware, bannerValidation, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: 'Base de données indisponible. Mode démo actif.' });
    }
    const updates = { ...req.body };
    delete updates._id;
    if (updates.startDate) updates.startDate = new Date(updates.startDate);
    if (updates.endDate) updates.endDate = new Date(updates.endDate);
    if (updates.translations && typeof updates.translations !== 'object') delete updates.translations;
    const banner = await Banner.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true });
    if (!banner) return res.status(404).json({ message: 'Bannière non trouvée' });
    const doc = banner.toObject();
    res.json({ ...doc, _id: doc._id?.toString() });
  } catch (error) {
    console.error('Update banner error:', error);
    res.status(500).json({ message: process.env.NODE_ENV === 'development' ? (error.message || 'Server error') : 'Server error' });
  }
});

// @route   DELETE /api/banners/:id
// @desc    Supprimer une bannière
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: 'Base de données indisponible. Mode démo actif.' });
    }
    const banner = await Banner.findByIdAndDelete(req.params.id);
    if (!banner) return res.status(404).json({ message: 'Bannière non trouvée' });
    res.json({ message: 'Bannière supprimée' });
  } catch (error) {
    console.error('Delete banner error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
