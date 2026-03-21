const express = require('express');
const mongoose = require('mongoose');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const Restaurant = require('../models/Restaurant');
const { safeRegexSearch } = require('../utils/regex-escape');
const restaurantsFallback = require('../lib/restaurants-fallback');
const { logRouteError } = require('../lib/route-logger');
const queryCache = require('../lib/queryCache');
const { hashQueryPart } = require('../lib/queryCache');

const router = express.Router();

function localizeRestaurant(doc, lang) {
  if (!doc) {
    return doc;
  }
  const normalizedLang = (lang && String(lang).toLowerCase()) || '';
  const out = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  if (!normalizedLang || !doc.translations || typeof doc.translations !== 'object') {
    return out;
  }
  const t = doc.translations[normalizedLang] || doc.translations.fr || {};
  if (t.name) {
    out.name = t.name;
  }
  if (t.description) {
    out.description = t.description;
  }
  if (t.type) {
    out.type = t.type;
  }
  if (t.location) {
    out.location = t.location;
  }
  if (t.openingHours) {
    out.openingHours = t.openingHours;
  }
  if (Array.isArray(t.specialties)) {
    out.specialties = t.specialties;
  }
  // Menu : appliquer les traductions par plat (même si les longueurs diffèrent)
  if (Array.isArray(out.menu) && Array.isArray(t.menu)) {
    out.menu = out.menu.map((item, idx) => {
      const tr = t.menu[idx];
      return {
        ...item,
        name: tr && tr.name ? tr.name : item.name,
        description: tr && tr.description ? tr.description : item.description,
      };
    });
  }
  if (Array.isArray(t.promotions) && Array.isArray(out.promotions) && t.promotions.length === out.promotions.length) {
    out.promotions = out.promotions.map((p, idx) => ({
      ...p,
      title: t.promotions[idx] && t.promotions[idx].title ? t.promotions[idx].title : p.title,
      description: t.promotions[idx] && t.promotions[idx].description ? t.promotions[idx].description : p.description,
    }));
  }
  return out;
}

/**
 * @swagger
 * /api/v1/restaurants/categories/list:
 *   get:
 *     summary: Catégories de restaurants (filtres UI)
 *     tags: [Restaurants]
 *     responses:
 *       200:
 *         description: Liste des catégories
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id: { type: string }
 *                   name: { type: string }
 *                   icon: { type: string }
 */
// @route   GET /api/restaurants/categories/list — doit être avant /:id
router.get('/categories/list', async (req, res) => {
  try {
    const categories = [
      { id: 'all', name: 'Tous', icon: '🍽️' },
      { id: 'french', name: 'The Swordfish & Steakhouse', icon: '🥩' },
      { id: 'fastfood', name: 'The Transatlantic', icon: '🍽️' },
      { id: 'dessert', name: 'Snack Bar / Café', icon: '☕' },
      { id: 'seafood', name: 'Pizzeria & Service', icon: '🍕' },
    ];
    res.json(categories);
  } catch (error) {
    logRouteError(req, 'restaurants_categories_failed', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @swagger
 * /api/v1/restaurants:
 *   get:
 *     summary: Liste des restaurants actifs
 *     tags: [Restaurants]
 *     parameters:
 *       - in: query
 *         name: lang
 *         schema: { type: string, example: fr }
 *         description: Code langue pour traductions (ex. fr, en)
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: OK (MongoDB ou fallback fichier si DB hors ligne)
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Restaurant'
 *       500:
 *         description: Erreur serveur
 */
// @route   GET /api/restaurants — ?lang= pour contenu localisé
router.get('/', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      const lang = (req.query.lang && String(req.query.lang).toLowerCase()) || '';
      return res.json(restaurantsFallback.getAll(lang));
    }

    const { category, search, lang: rawLang } = req.query;
    const lang = (rawLang && String(rawLang).toLowerCase()) || '';

    const query = { isActive: true };

    if (category && category !== 'all') {
      query.category = category;
    }

    if (search) {
      const safe = safeRegexSearch(search);
      if (safe) {
        query.$or = [
          { name: { $regex: safe, $options: 'i' } },
          { description: { $regex: safe, $options: 'i' } },
          { specialties: { $regex: safe, $options: 'i' } },
        ];
      }
    }

    const cacheKey = [
      'restaurants:list',
      lang || 'default',
      category && String(category) !== 'all' ? String(category) : 'all',
      hashQueryPart(search ? String(search) : ''),
    ].join(':');

    const restaurants = await queryCache.getCached(cacheKey, async () => {
      const docs = await Restaurant.find(query).read('secondaryPreferred').sort({ name: 1 }).lean();
      return docs.map((doc) => localizeRestaurant(doc, lang));
    });

    res.json(restaurants);
  } catch (error) {
    logRouteError(req, 'restaurants_list_failed', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @swagger
 * /api/v1/restaurants/{id}:
 *   get:
 *     summary: Détail d'un restaurant
 *     tags: [Restaurants]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: lang
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Restaurant'
 *       404:
 *         description: Non trouvé
 *       500:
 *         description: Erreur serveur
 */
// @route   GET /api/restaurants/:id — ?lang=
router.get('/:id', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      const restaurant = restaurantsFallback.getById(
        req.params.id,
        (req.query.lang && String(req.query.lang).toLowerCase()) || ''
      );
      if (!restaurant) {
        return res.status(404).json({ message: 'Restaurant not found' });
      }
      return res.json(restaurant);
    }
    const lang = (req.query.lang && String(req.query.lang).toLowerCase()) || '';
    const id = String(req.params.id);
    const cacheKey = `restaurants:byId:${id}:${lang || 'default'}`;

    const payload = await queryCache.getCached(cacheKey, async () => {
      const doc = await Restaurant.findById(id).read('secondaryPreferred').lean();
      if (!doc) {
        return null;
      }
      return localizeRestaurant(doc, lang);
    });

    if (!payload) {
      return res.status(404).json({ message: 'Restaurant not found' });
    }
    res.json(payload);
  } catch (error) {
    logRouteError(req, 'restaurants_get_failed', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/restaurants
router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const body = { ...req.body };
    if (body.translations && typeof body.translations !== 'object') {
      delete body.translations;
    }
    const restaurant = new Restaurant(body);
    await restaurant.save();
    void queryCache.invalidate('restaurants');
    res.status(201).json({
      message: 'Restaurant created successfully',
      restaurant,
    });
  } catch (error) {
    logRouteError(req, 'restaurants_create_failed', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors)
        .map((e) => e.message)
        .filter(Boolean);
      return res.status(400).json({
        message: messages.length ? messages.join('. ') : 'Données invalides',
        errors: error.errors,
      });
    }
    res.status(500).json({ message: error.message || 'Server error' });
  }
});

// @route   PUT /api/restaurants/:id
// @desc    Update restaurant
// @access  Private (Admin)
router.put('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const body = { ...req.body };
    if (body.translations && typeof body.translations !== 'object') {
      delete body.translations;
    }
    const restaurant = await Restaurant.findByIdAndUpdate(req.params.id, body, { new: true, runValidators: true });

    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found' });
    }

    void queryCache.invalidate('restaurants');

    res.json({
      message: 'Restaurant updated successfully',
      restaurant,
    });
  } catch (error) {
    logRouteError(req, 'restaurants_update_failed', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors)
        .map((e) => e.message)
        .filter(Boolean);
      return res.status(400).json({
        message: messages.length ? messages.join('. ') : 'Données invalides',
        errors: error.errors,
      });
    }
    res.status(500).json({ message: error.message || 'Server error' });
  }
});

// @route   DELETE /api/restaurants/:id
// @desc    Delete restaurant
// @access  Private (Admin)
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const restaurant = await Restaurant.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });

    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found' });
    }

    void queryCache.invalidate('restaurants');

    res.json({ message: 'Restaurant deactivated successfully' });
  } catch (error) {
    logRouteError(req, 'restaurants_delete_failed', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
