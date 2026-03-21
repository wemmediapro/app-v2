/**
 * Export snapshot pour mode 100 % offline.
 * GET /api/export/snapshot?lang=fr — agrège toutes les données (DB ou fallbacks JSON).
 *
 * Sécurité : rate limit strict (5 exports / heure / utilisateur ou par IP / clé d’export).
 * Les exports très volumineux sont logués ; un export asynchrone type Bull (cf. admin audit)
 * peut être branché plus tard si besoin.
 */

const crypto = require('crypto');
const express = require('express');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const router = express.Router();

const { optionalAuth } = require('../middleware/auth');
const logger = require('../lib/logger');
const moviesFallback = require('../lib/movies-fallback');
const radioFallback = require('../lib/radio-fallback');
const magazineFallback = require('../lib/magazine-fallback');
const webtvFallback = require('../lib/webtv-fallback');
const bannersFallback = require('../lib/banners-fallback');
const restaurantsFallback = require('../lib/restaurants-fallback');
const shopFallback = require('../lib/shop-fallback');
const { logRouteError } = require('../lib/route-logger');

const EXPORT_SNAPSHOT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_EXPORT_SNAPSHOT_WINDOW_MS, 10) || 60 * 60 * 1000;
const EXPORT_SNAPSHOT_MAX = parseInt(process.env.RATE_LIMIT_EXPORT_SNAPSHOT_MAX, 10) || 5;
const EXPORT_SNAPSHOT_LARGE_THRESHOLD = parseInt(process.env.EXPORT_SNAPSHOT_LARGE_THRESHOLD, 10) || 8000;

/**
 * Clé de quota : utilisateur JWT si présent, sinon empreinte de clé d’export + IP, sinon IP seule.
 * @param {import('express').Request} req
 */
function exportSnapshotRateLimitKey(req) {
  const uid = req.user?.id || req.user?._id;
  if (uid != null) {
    return `export-snapshot:user:${String(uid)}`;
  }
  const exportKey = process.env.EXPORT_SNAPSHOT_KEY;
  const provided = req.query?.key || req.get('X-Export-Key');
  if (exportKey && provided) {
    const h = crypto.createHash('sha256').update(String(provided), 'utf8').digest('hex').slice(0, 16);
    return `export-snapshot:key:${h}:ip:${req.ip || 'unknown'}`;
  }
  return `export-snapshot:ip:${req.ip || 'unknown'}`;
}

/**
 * @param {{ windowMs?: number, max?: number, skip?: () => boolean }} [overrides]
 */
function createExportSnapshotLimiter(overrides = {}) {
  const windowMs = overrides.windowMs ?? EXPORT_SNAPSHOT_WINDOW_MS;
  const max = overrides.max ?? EXPORT_SNAPSHOT_MAX;
  const skipFn =
    overrides.skip ?? (() => process.env.NODE_ENV !== 'production' && process.env.RATE_LIMIT_LOAD_TEST === '1');

  return rateLimit({
    windowMs,
    max,
    keyGenerator: (req) => exportSnapshotRateLimitKey(req),
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message: "Trop d'exports. Réessayez plus tard.",
      code: 'EXPORT_RATE_LIMIT',
    },
    skip: skipFn,
    handler: (req, res, _next, options) => {
      logger.warn({
        event: 'export_snapshot_rate_limited',
        key: exportSnapshotRateLimitKey(req),
        userId: req.user?.id ? String(req.user.id) : null,
        ip: req.ip,
      });
      res.status(options.statusCode).json(options.message);
    },
  });
}

const exportSnapshotLimiter = createExportSnapshotLimiter();

/**
 * @param {object} payload
 */
function approxExportItemCount(payload) {
  if (!payload || typeof payload !== 'object') {
    return 0;
  }
  let n = 0;
  const add = (x) => {
    n += Array.isArray(x) ? x.length : 0;
  };
  add(payload.movies);
  if (payload.magazine && Array.isArray(payload.magazine.data)) {
    add(payload.magazine.data);
  }
  add(payload.radio);
  add(payload.banners);
  add(payload.restaurants);
  add(payload.shop);
  add(payload.shopPromotions);
  add(payload.webtv);
  add(payload.enfant);
  if (payload.shipmap && Array.isArray(payload.shipmap.decks)) {
    add(payload.shipmap.decks);
  }
  add(payload.notifications);
  return n;
}

/**
 * @param {import('express').Request} req
 * @param {{ lang: string, source: string }} meta
 * @param {object} payload
 */
function logExportSnapshotSuccess(req, meta, payload) {
  const approxItemCount = approxExportItemCount(payload);
  logger.info({
    event: 'export_snapshot_completed',
    approxItemCount,
    lang: meta.lang,
    source: meta.source,
    userId: req.user?.id ? String(req.user.id) : null,
    ip: req.ip,
  });
  if (approxItemCount >= EXPORT_SNAPSHOT_LARGE_THRESHOLD) {
    logger.warn({
      event: 'export_snapshot_large',
      approxItemCount,
      threshold: EXPORT_SNAPSHOT_LARGE_THRESHOLD,
      message:
        'Export snapshot volumineux (bande passante / charge). Prévoir export asynchrone (file Bull) si la croissance continue.',
      lang: meta.lang,
      source: meta.source,
      userId: req.user?.id ? String(req.user.id) : null,
    });
  }
}

// @route   GET /api/export/snapshot
// @query   lang=fr|en|es|it|de|ar  — optionnel : key=<EXPORT_SNAPSHOT_KEY> ou header X-Export-Key
// @desc    Retourne un JSON avec movies, magazine, radio, etc. Si EXPORT_SNAPSHOT_KEY est défini, la clé (query ou header) est requise.
router.get('/snapshot', optionalAuth, exportSnapshotLimiter, async (req, res) => {
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

      const payload = {
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
      };

      logExportSnapshotSuccess(req, { lang, source: 'mongodb' }, payload);

      res.setHeader('Cache-Control', 'private, max-age=60');
      return res.json(payload);
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

    const payload = {
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
    };

    logExportSnapshotSuccess(req, { lang, source: 'fallback' }, payload);

    res.setHeader('Cache-Control', 'private, max-age=60');
    res.json(payload);
  } catch (error) {
    logRouteError(req, 'export_snapshot_failed', error);
    res.status(500).json({
      message: 'Server error',
      ...(process.env.NODE_ENV === 'development' && { error: error.message }),
    });
  }
});

module.exports = router;
module.exports.createExportSnapshotLimiter = createExportSnapshotLimiter;
module.exports.exportSnapshotRateLimitKey = exportSnapshotRateLimitKey;
module.exports.approxExportItemCount = approxExportItemCount;
