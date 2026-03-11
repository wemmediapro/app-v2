const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const { authMiddleware, adminMiddleware, optionalAuth } = require('../middleware/auth');
const { articleValidation } = require('../middleware/validation');
const Article = require('../models/Article');
const { safeRegexSearch } = require('../utils/regex-escape');
const magazineFallback = require('../lib/magazine-fallback');

// Localise le contenu depuis la base uniquement (aucun appel de traduction en ligne).
// Langues : fr (champs principaux), en, es, it, de, ar (translations[code]). Si une traduction manque, on garde le français.
function localizeArticle(article, lang) {
  if (!article || typeof article !== 'object') return article;
  try {
    const code = (lang && String(lang).trim().toLowerCase()) || null;
    const translations = article.translations;
    const t = code && translations && typeof translations === 'object' && !Array.isArray(translations) ? translations[code] : null;
    const out = { ...article, readTime: article.readingTime ?? 0 };
    if (t && typeof t === 'object') {
      if (t.title != null) out.title = t.title;
      if (t.excerpt != null) out.excerpt = t.excerpt;
      if (t.content != null) out.content = t.content;
    }
    delete out.translations;
    return out;
  } catch (e) {
    console.warn('localizeArticle skip:', e.message);
    return { ...article, readTime: article.readingTime ?? 0 };
  }
}

// @route   GET /api/magazine
// @desc    Get magazine articles (DB or demo). Query: lang=fr|en|es|it|de|ar pour le contenu multilingue. Si withTranslations=1 et admin, retourne les articles avec le champ translations (pour l’édition).
// @access  Public (avec optionalAuth pour withTranslations)
router.get('/', optionalAuth, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      const lang = (req.query.lang && String(req.query.lang).trim().toLowerCase()) || null;
      const data = magazineFallback.getAll(lang);
      return res.json({ data: Array.isArray(data) ? data : [] });
    }
    if (typeof Article.find !== 'function') {
      const lang = (req.query.lang && String(req.query.lang).trim().toLowerCase()) || null;
      const data = magazineFallback.getAll(lang);
      return res.json({ data: Array.isArray(data) ? data : [] });
    }
    const { category, featured, search, lang: langQuery, all, withTranslations } = req.query;
    const lang = (langQuery && String(langQuery).trim().toLowerCase()) || null;
    const query = { isActive: { $ne: false } };
    if (!all) query.$or = [{ isPublished: true }, { status: 'published' }];
    if (category && String(category).trim() && category !== 'all') query.category = String(category).trim();
    if (featured === 'true') query.featured = true;
    if (search && String(search).trim()) {
      const safe = safeRegexSearch(search);
      if (safe) query.$and = [{ $or: [{ title: { $regex: safe, $options: 'i' } }, { excerpt: { $regex: safe, $options: 'i' } }, { content: { $regex: safe, $options: 'i' } }] }];
    }
    const list = await Article.find(query).sort({ publishedAt: -1, createdAt: -1 }).lean();
    const isAdminWithTranslations = withTranslations === '1' && req.user && req.user.role === 'admin';
    const data = isAdminWithTranslations
      ? list.map(a => ({ ...a, readTime: a.readingTime ?? 0 }))
      : list.map(a => localizeArticle(a, lang));
    return res.json({ data: Array.isArray(data) ? data : [] });
  } catch (error) {
    console.error('Get magazine articles error:', error);
    res.status(500).json({
      message: 'Erreur serveur lors du chargement des articles',
      data: [],
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   POST /api/magazine
// @desc    Create a new article (persist in MongoDB, with optional translations)
// @access  Private (Admin)
router.post('/', authMiddleware, adminMiddleware, articleValidation, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: 'Base de données indisponible' });
    }
    const body = req.body || {};
    const payload = {
      title: body.title,
      excerpt: body.excerpt || '',
      content: body.content || '',
      category: body.category,
      author: body.author || 'Rédaction GNV',
      imageUrl: body.imageUrl || '',
      isPublished: body.status === 'published',
      status: body.status || 'draft',
      publishedAt: body.publishedAt ? new Date(body.publishedAt) : null,
      featured: !!body.featured,
      allowComments: body.allowComments !== false,
      readingTime: body.readingTime || 0,
      views: 0,
      likes: 0,
      isActive: true,
      tags: Array.isArray(body.tags) ? body.tags : [],
      countries: Array.isArray(body.countries) ? body.countries : [],
      metaDescription: body.metaDescription || '',
      metaKeywords: body.metaKeywords || [],
      gallery: Array.isArray(body.gallery) ? body.gallery : []
    };
    if (body.translations && typeof body.translations === 'object') {
      payload.translations = body.translations;
    }
    if (!payload.title || !payload.category || !payload.content) {
      return res.status(400).json({ message: 'Titre, catégorie et contenu requis.' });
    }
    if (!payload.imageUrl) {
      return res.status(400).json({ message: 'Image requise. Uploadez une image.' });
    }
    const created = await Article.create(payload);
    const doc = created.toObject ? created.toObject() : created;
    return res.status(201).json({ data: { ...doc, readTime: doc.readingTime || 0 } });
  } catch (error) {
    console.error('Create article error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/magazine/:id
// @desc    Get article by ID. Query: lang=fr|en|es|it|de|ar pour le contenu multilingue. Si withTranslations=1 et admin, retourne l’article avec le champ translations.
// @access  Public (avec optionalAuth pour withTranslations)
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const lang = (req.query.lang && String(req.query.lang).trim().toLowerCase()) || null;
      const article = await Article.findById(req.params.id).lean();
      if (!article) return res.status(404).json({ message: 'Article non trouvé' });
      await Article.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } });
      const isAdminWithTranslations = req.query.withTranslations === '1' && req.user?.role === 'admin';
      const data = isAdminWithTranslations
        ? { ...article, readTime: article.readingTime || 0 }
        : localizeArticle(article, lang);
      return res.json({ data });
    }
    const lang = (req.query.lang && String(req.query.lang).trim().toLowerCase()) || null;
    const data = magazineFallback.getById(req.params.id, lang);
    if (!data) return res.status(404).json({ message: 'Article non trouvé' });
    return res.json({ data });
  } catch (error) {
    console.error('Get article error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/magazine/:id
// @desc    Update article (persist in MongoDB)
// @access  Private (Admin)
router.put('/:id', authMiddleware, adminMiddleware, articleValidation, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: 'Base de données indisponible' });
    }
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Identifiant article invalide' });
    }
    const raw = req.body || {};
    const body = {
      title: raw.title,
      excerpt: raw.excerpt ?? '',
      content: raw.content,
      category: raw.category,
      author: raw.author ?? 'Rédaction GNV',
      imageUrl: (raw.imageUrl && String(raw.imageUrl).trim()) || undefined,
      isPublished: raw.status === 'published',
      status: raw.status || 'draft',
      publishedAt: raw.publishedAt === '' || raw.publishedAt === null ? null : (raw.publishedAt ? new Date(raw.publishedAt) : undefined),
      featured: !!raw.featured,
      allowComments: raw.allowComments !== false,
      readingTime: typeof raw.readingTime === 'number' ? raw.readingTime : (typeof raw.readTime === 'number' ? raw.readTime : 0),
      tags: Array.isArray(raw.tags) ? raw.tags.map(t => (typeof t === 'string' ? t.trim() : String(t))) : [],
      countries: Array.isArray(raw.countries) ? raw.countries : [],
      metaDescription: typeof raw.metaDescription === 'string' ? raw.metaDescription.slice(0, 160) : '',
      metaKeywords: Array.isArray(raw.metaKeywords) ? raw.metaKeywords : (typeof raw.metaKeywords === 'string' && raw.metaKeywords ? [raw.metaKeywords] : []),
      gallery: Array.isArray(raw.gallery) ? raw.gallery.map(g => ({ url: g?.url ?? '', caption: g?.caption ?? '' })) : [],
      isActive: raw.isActive !== false
    };
    if (raw.translations && typeof raw.translations === 'object') {
      body.translations = raw.translations;
    }
    Object.keys(body).forEach(k => { if (body[k] === undefined) delete body[k]; });
    if (!body.title?.trim() || !body.category?.trim() || body.content == null) {
      return res.status(400).json({ message: 'Titre, catégorie et contenu requis.' });
    }
    if (body.imageUrl !== undefined && !body.imageUrl) {
      return res.status(400).json({ message: 'Image requise. Uploadez une image.' });
    }
    const updated = await Article.findByIdAndUpdate(
      id,
      { $set: body },
      { new: true, runValidators: true }
    ).lean();
    if (!updated) return res.status(404).json({ message: 'Article non trouvé' });
    return res.json({ data: { ...updated, readTime: updated.readingTime || 0 } });
  } catch (error) {
    console.error('Update article error:', error);
    if (error.name === 'ValidationError') {
      const first = Object.values(error.errors)[0];
      const msg = first?.message || error.message;
      return res.status(400).json({ message: msg, error: msg });
    }
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Identifiant article invalide' });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   DELETE /api/magazine/:id
// @desc    Delete article (persist in MongoDB)
// @access  Private (Admin)
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: 'Base de données indisponible' });
    }
    const id = req.params.id;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Identifiant article invalide' });
    }
    const deleted = await Article.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ message: 'Article non trouvé' });
    return res.json({ message: 'Article supprimé' });
  } catch (error) {
    console.error('Delete article error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Identifiant article invalide' });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;



