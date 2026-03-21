/**
 * Export snapshot pour mode 100 % offline.
 * GET /api/export/snapshot?lang=fr — agrège toutes les données (DB ou fallbacks JSON).
 */

const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const moviesFallback = require('../lib/movies-fallback');
const radioFallback = require('../lib/radio-fallback');
const magazineFallback = require('../lib/magazine-fallback');
const webtvFallback = require('../lib/webtv-fallback');
const bannersFallback = require('../lib/banners-fallback');
const restaurantsFallback = require('../lib/restaurants-fallback');
const shopFallback = require('../lib/shop-fallback');

// @route   GET /api/export/snapshot
// @query   lang=fr|en|es|it|de|ar  — optionnel : key=<EXPORT_SNAPSHOT_KEY> ou header X-Export-Key
// @desc    Retourne un JSON avec movies, magazine, radio, etc. Si EXPORT_SNAPSHOT_KEY est défini, la clé (query ou header) est requise.
router.get('/snapshot', async (req, res) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const exportKey = process.env.EXPORT_SNAPSHOT_KEY;

  if (isProduction && (!exportKey || exportKey.length === 0)) {
    return res.status(503).json({
      message: 'Export snapshot non configuré. Définissez EXPORT_SNAPSHOT_KEY dans config.env.',
    });
  }

  if (exportKey && exportKey.length > 0) {
    const provided = req.query.key || req.get('X-Export-Key');
    if (provided !== exportKey) {
      return res.status(403).json({ message: "Accès refusé. Clé d'export requise." });
    }
  }
  try {
    const lang = (req.query.lang && String(req.query.lang).trim().toLowerCase()) || 'fr';

    if (mongoose.connection.readyState === 1) {
      const Movie = require('../models/Movie');
      const Article = require('../models/Article');
      const Banner = require('../models/Banner');
      const Restaurant = require('../models/Restaurant');
      const Product = require('../models/Product');
      const Promotion = require('../models/Promotion');
      const WebTVChannel = require('../models/WebTVChannel');
      const EnfantActivity = require('../models/EnfantActivity');
      const Shipmap = require('../models/Shipmap');
      const Notification = require('../models/Notification');

      const [
        movies,
        articles,
        banners,
        restaurants,
        products,
        promotions,
        webtvChannels,
        enfantActivities,
        shipmapDecks,
        notifications,
      ] = await Promise.all([
        Movie.find({ isActive: { $ne: false } }).lean(),
        Article.find({ isActive: { $ne: false }, $or: [{ isPublished: true }, { status: 'published' }] }).lean(),
        Banner.find({ isActive: { $ne: false } }).lean(),
        Restaurant.find({ isActive: true }).lean(),
        Product.find({ isActive: true }).lean(),
        Promotion.find({}).lean(),
        WebTVChannel.find({ isActive: { $ne: false } }).lean(),
        EnfantActivity.find({ isActive: { $ne: false } }).lean(),
        Shipmap.find({ isActive: true }).lean(),
        Notification.find({ isActive: true }).sort({ createdAt: -1 }).limit(50).lean(),
      ]);

      const radioStations = radioFallback.getAll();

      res.setHeader('Cache-Control', 'private, max-age=60');
      return res.json({
        movies,
        magazine: { data: articles },
        radio: radioStations,
        banners,
        restaurants,
        shop: products,
        shopPromotions: promotions,
        webtv: webtvChannels,
        enfant: enfantActivities,
        shipmap: { decks: shipmapDecks, services: [] },
        notifications,
        _meta: { lang, exportedAt: new Date().toISOString(), source: 'mongodb' },
      });
    }

    const movies = moviesFallback.getAll();
    const magazineData = magazineFallback.getAll(lang);
    const radio = radioFallback.getAll();
    const banners = bannersFallback.getAll(lang);
    const restaurants = restaurantsFallback.getAll(lang);
    const shop = shopFallback.getProducts(lang);
    const shopPromotions = shopFallback.getPromotions();
    const webtv = webtvFallback.getAll();
    const enfant = [];
    const shipmap = { decks: [], services: [] };
    const notifications = [];

    res.setHeader('Cache-Control', 'private, max-age=60');
    res.json({
      movies,
      magazine: { data: magazineData },
      radio,
      banners,
      restaurants,
      shop,
      shopPromotions,
      webtv,
      enfant,
      shipmap,
      notifications,
      _meta: { lang, exportedAt: new Date().toISOString(), source: 'fallback' },
    });
  } catch (error) {
    console.error('Export snapshot error:', error);
    res.status(500).json({
      message: 'Server error',
      ...(process.env.NODE_ENV === 'development' && { error: error.message }),
    });
  }
});

module.exports = router;
