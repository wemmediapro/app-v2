const express = require('express');
const mongoose = require('mongoose');
const { authenticateToken, optionalAuth, authMiddleware, adminMiddleware } = require('../middleware/auth');
const { validatePagination, productCreateValidation, productUpdateValidation } = require('../middleware/validation');
const Product = require('../models/Product');
const Promotion = require('../models/Promotion');
const { safeRegexSearch } = require('../utils/regex-escape');
const shopFallback = require('../lib/shop-fallback');
const cacheManager = require('../lib/cache-manager');
const { logRouteError } = require('../lib/route-logger');

const router = express.Router();

async function invalidateShopListCache() {
  if (cacheManager.isConnected) {
    await cacheManager.delPattern('list:shop:*');
  }
}

const PRODUCT_TYPE_ENUM = ['physical', 'digital', 'service'];
function normalizeProductType(v) {
  if (!v || typeof v !== 'string') {
    return 'physical';
  }
  const t = v.trim().toLowerCase();
  return PRODUCT_TYPE_ENUM.includes(t) ? t : 'physical';
}

// Applique la langue demandée (name, description). Langues: en, es, it, de, ar. Pour fr ou non fourni, champs principaux renvoyés.
function localizeProduct(doc, lang) {
  if (!doc) {
    return doc;
  }
  const code = (lang && String(lang).trim().toLowerCase()) || null;
  const out = {
    ...doc,
    id: doc._id?.toString(),
    imageUrl: doc.images?.[0]?.url || doc.images?.[0] || '',
    image: doc.images?.[0]?.url || doc.images?.[0] || '',
  };
  if (code && doc.translations && doc.translations[code]) {
    const t = doc.translations[code];
    if (t.name) {
      out.name = t.name;
    }
    if (t.description) {
      out.description = t.description;
    }
  }
  return out;
}

// Get all products (MongoDB) — ?lang= pour contenu localisé
// Cache Redis 120s pour listes publiques (sans Authorization) — voir cache-manager TTL list:shop:
router.get('/', optionalAuth, validatePagination, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      const items = shopFallback.getProducts(req.query.lang);
      return res.status(200).json(items);
    }
    const { category, page = 1, limit = 20, lang, all } = req.query;
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const langNorm = (lang && String(lang).trim()) || '';
    const catNorm = (category && String(category).trim()) || '';
    const allNorm = all === '1' ? '1' : '0';

    if (!req.get('Authorization')) {
      const cacheKey = `list:shop:${catNorm}:${pageNum}:${limitNum}:${langNorm}:${allNorm}`;
      const cached = await cacheManager.get(cacheKey);
      if (cached) {
        return res.json(cached);
      }
    }

    const query = all === '1' ? {} : { isActive: true };
    if (category && category !== 'all') {
      query.category = category;
    }
    const skip = (pageNum - 1) * limitNum;
    const list = await Product.find(query).sort({ isFeatured: -1, createdAt: -1 }).skip(skip).limit(limitNum).lean();
    const items = list.map((doc) => localizeProduct(doc, lang));
    if (!req.get('Authorization')) {
      const cacheKey = `list:shop:${catNorm}:${pageNum}:${limitNum}:${langNorm}:${allNorm}`;
      await cacheManager.set(cacheKey, items);
    }
    res.json(items);
  } catch (error) {
    logRouteError(req, 'shop_products_list_failed', error);
    res.status(500).json({
      message: 'Failed to get products',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
});

// Create product (MongoDB) — images[] avec URL uploadée, translations optionnel
router.post('/', authMiddleware, adminMiddleware, productCreateValidation, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: 'Base de données indisponible' });
    }
    const body = { ...req.body };
    if (!body.name || !body.description || body.category === undefined) {
      return res.status(400).json({ message: 'name, description et category requis' });
    }
    if (body.images && Array.isArray(body.images) && body.images.length > 0) {
      body.images = body.images.map((img, i) => ({
        url: typeof img === 'string' ? img : img.url,
        alt: typeof img === 'object' && img.alt ? img.alt : body.name,
        isPrimary: i === 0,
      }));
    } else if (body.imageUrl) {
      body.images = [{ url: body.imageUrl, alt: body.name, isPrimary: true }];
    }
    if (body.translations && typeof body.translations !== 'object') {
      delete body.translations;
    }
    body.type = normalizeProductType(body.type);
    const product = await Product.create(body);
    const doc = product.toObject ? product.toObject() : product;
    await invalidateShopListCache();
    return res.status(201).json(localizeProduct(doc));
  } catch (error) {
    logRouteError(req, 'shop_product_create_failed', error);
    res.status(500).json({
      message: 'Failed to create product',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
});

// Update product (MongoDB)
router.put('/:id', authMiddleware, adminMiddleware, productUpdateValidation, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: 'Base de données indisponible' });
    }
    const { id } = req.params;
    const body = { ...req.body };
    delete body._id;
    delete body.createdAt;
    if (body.images && Array.isArray(body.images) && body.images.length > 0) {
      body.images = body.images.map((img, i) => ({
        url: typeof img === 'string' ? img : img.url,
        alt: typeof img === 'object' && img.alt ? img.alt : body.name || '',
        isPrimary: i === 0,
      }));
    } else if (body.imageUrl) {
      body.images = [{ url: body.imageUrl, alt: body.name || '', isPrimary: true }];
    }
    if (body.translations && typeof body.translations !== 'object') {
      delete body.translations;
    }
    body.type = normalizeProductType(body.type);
    const updated = await Product.findByIdAndUpdate(id, { $set: body }, { new: true }).lean();
    if (!updated) {
      return res.status(404).json({ message: 'Product not found' });
    }
    await invalidateShopListCache();
    return res.json(localizeProduct(updated));
  } catch (error) {
    logRouteError(req, 'shop_product_update_failed', error);
    res.status(500).json({
      message: 'Failed to update product',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
});

// Delete product (MongoDB)
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: 'Base de données indisponible' });
    }
    const deleted = await Product.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: 'Product not found' });
    }
    await invalidateShopListCache();
    return res.json({ message: 'Product deleted' });
  } catch (error) {
    logRouteError(req, 'shop_product_delete_failed', error);
    res.status(500).json({
      message: 'Failed to delete product',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
});

// Get product categories (doit être avant /:id pour que /categories/list soit bien pris)
router.get('/categories/list', (req, res) => {
  const categories = [
    { id: 'souvenirs', name: 'Souvenirs', icon: '🎁' },
    { id: 'fashion', name: 'Mode', icon: '👕' },
    { id: 'dutyfree', name: 'Duty Free', icon: '🍷' },
    { id: 'electronics', name: 'Électronique', icon: '📱' },
    { id: 'food', name: 'Gastronomie', icon: '🍯' },
  ];

  res.json({ categories });
});

// Search products
router.get('/search/query', optionalAuth, async (req, res) => {
  try {
    const { q, category } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        message: 'Search query must be at least 2 characters long',
      });
    }

    if (mongoose.connection.readyState !== 1) {
      return res.json({ products: [] });
    }

    const safe = safeRegexSearch(q);
    const query = { isActive: true };
    if (safe) {
      query.$or = [
        { name: { $regex: safe, $options: 'i' } },
        { description: { $regex: safe, $options: 'i' } },
        { tags: { $regex: safe, $options: 'i' } },
      ];
    } else {
      return res.json({ products: [] });
    }
    if (category && category !== 'all') {
      query.category = category;
    }
    const list = await Product.find(query).limit(50).lean();
    const products_result = list.map((doc) => ({
      ...doc,
      id: doc._id?.toString(),
      imageUrl: doc.images?.[0]?.url || '',
      image: doc.images?.[0]?.url || '',
    }));
    res.json({ products: products_result });
  } catch (error) {
    logRouteError(req, 'shop_products_search_failed', error);
    res.status(500).json({
      message: 'Failed to search products',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
});

// --- Promotions (avant GET /:id) ---
// Liste des promotions (admin / dashboard)
router.get('/promotions', optionalAuth, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(200).json(shopFallback.getPromotions());
    }
    const list = await Promotion.find({}).sort({ createdAt: -1 }).lean();
    const items = list.map((doc) => {
      const d = { ...doc, id: doc._id?.toString() };
      if (doc.validFrom) {
        d.validFrom =
          typeof doc.validFrom === 'string'
            ? doc.validFrom
            : doc.validFrom.toISOString?.()?.slice(0, 10) || doc.validFrom;
      }
      if (doc.validUntil) {
        d.validUntil =
          typeof doc.validUntil === 'string'
            ? doc.validUntil
            : doc.validUntil.toISOString?.()?.slice(0, 10) || doc.validUntil;
      }
      return d;
    });
    res.json(items);
  } catch (error) {
    logRouteError(req, 'shop_promotions_list_failed', error);
    res.status(500).json({
      message: 'Failed to get promotions',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
});

// Créer une promotion (admin)
router.post('/promotions', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: 'Base de données indisponible' });
    }
    const body = { ...req.body };
    if (body.validFrom && typeof body.validFrom === 'string') {
      body.validFrom = new Date(body.validFrom);
    }
    if (body.validUntil && typeof body.validUntil === 'string') {
      body.validUntil = new Date(body.validUntil);
    }
    const promo = await Promotion.create(body);
    const doc = promo.toObject ? promo.toObject() : promo;
    const out = { ...doc, id: doc._id?.toString() };
    if (out.validFrom) {
      out.validFrom = typeof out.validFrom === 'string' ? out.validFrom : out.validFrom.toISOString?.()?.slice(0, 10);
    }
    if (out.validUntil) {
      out.validUntil =
        typeof out.validUntil === 'string' ? out.validUntil : out.validUntil.toISOString?.()?.slice(0, 10);
    }
    await invalidateShopListCache();
    return res.status(201).json(out);
  } catch (error) {
    logRouteError(req, 'shop_promotion_create_failed', error);
    res.status(500).json({
      message: error.message || 'Failed to create promotion',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
});

// Modifier une promotion (admin)
router.put('/promotions/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: 'Base de données indisponible' });
    }
    const { id } = req.params;
    const body = { ...req.body };
    delete body._id;
    delete body.id;
    delete body.createdAt;
    if (body.validFrom && typeof body.validFrom === 'string') {
      body.validFrom = new Date(body.validFrom);
    }
    if (body.validUntil && typeof body.validUntil === 'string') {
      body.validUntil = new Date(body.validUntil);
    }
    const updated = await Promotion.findByIdAndUpdate(id, { $set: body }, { new: true }).lean();
    if (!updated) {
      return res.status(404).json({ message: 'Promotion not found' });
    }
    const out = { ...updated, id: updated._id?.toString() };
    if (out.validFrom) {
      out.validFrom = typeof out.validFrom === 'string' ? out.validFrom : out.validFrom.toISOString?.()?.slice(0, 10);
    }
    if (out.validUntil) {
      out.validUntil =
        typeof out.validUntil === 'string' ? out.validUntil : out.validUntil.toISOString?.()?.slice(0, 10);
    }
    await invalidateShopListCache();
    return res.json(out);
  } catch (error) {
    logRouteError(req, 'shop_promotion_update_failed', error);
    res.status(500).json({
      message: error.message || 'Failed to update promotion',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
});

// Supprimer une promotion (admin)
router.delete('/promotions/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: 'Base de données indisponible' });
    }
    const deleted = await Promotion.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: 'Promotion not found' });
    }
    await invalidateShopListCache();
    return res.json({ message: 'Promotion deleted' });
  } catch (error) {
    logRouteError(req, 'shop_promotion_delete_failed', error);
    res.status(500).json({
      message: 'Failed to delete promotion',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
});

// Get product by ID (MongoDB) — ?lang= pour contenu localisé
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      const doc = shopFallback.getProductById(req.params.id, req.query.lang);
      if (!doc) {
        return res.status(404).json({ message: 'Product not found' });
      }
      return res.json(doc);
    }
    const { lang } = req.query;
    const doc = await Product.findOne({ _id: req.params.id }).lean();
    if (!doc) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json(localizeProduct(doc, lang));
  } catch (error) {
    logRouteError(req, 'shop_product_get_failed', error);
    res.status(500).json({
      message: 'Failed to get product',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
});

// Get cart (requires authentication)
router.get('/cart/items', authenticateToken, async (req, res) => {
  try {
    res.json({
      items: [],
      total: 0,
      itemCount: 0,
    });
  } catch (error) {
    logRouteError(req, 'shop_cart_get_failed', error);
    res.status(500).json({
      message: 'Failed to get cart',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
});

// Add item to cart
router.post('/cart/add', authenticateToken, async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;

    if (!productId) {
      return res.status(400).json({
        message: 'Product ID is required',
      });
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: 'Base de données indisponible' });
    }
    const product = await Product.findOne({ _id: productId, isActive: true }).lean();
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    if (!product.isAvailable) {
      return res.status(400).json({ message: 'Product is not available' });
    }

    res.json({
      message: 'Item added to cart successfully',
      product: { ...product, id: product._id?.toString() },
      quantity,
    });
  } catch (error) {
    logRouteError(req, 'shop_cart_add_failed', error);
    res.status(500).json({
      message: 'Failed to add item to cart',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
});

// Remove item from cart
router.delete('/cart/remove/:productId', authenticateToken, async (req, res) => {
  try {
    const { productId } = req.params;

    // Mock removing from cart
    res.json({
      message: 'Item removed from cart successfully',
    });
  } catch (error) {
    logRouteError(req, 'shop_cart_remove_failed', error);
    res.status(500).json({
      message: 'Failed to remove item from cart',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
});

// Create order
router.post('/orders/create', authenticateToken, async (req, res) => {
  try {
    const { items, shippingAddress, paymentMethod } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({
        message: 'Order must contain at least one item',
      });
    }

    // Mock order creation
    const order = {
      id: Date.now().toString(),
      userId: req.user._id,
      items,
      total: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
      status: 'pending',
      createdAt: new Date(),
      shippingAddress,
      paymentMethod,
    };

    res.status(201).json({
      message: 'Order created successfully',
      order,
    });
  } catch (error) {
    logRouteError(req, 'shop_order_create_failed', error);
    res.status(500).json({
      message: 'Failed to create order',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
});

module.exports = router;
