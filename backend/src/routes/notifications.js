/**
 * Routes API Notifications - Notifications push envoyées par l'équipe GNV (app passagers + admin)
 * Support multilingue (translations) et envoi programmé (scheduledAt).
 */

const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const Notification = require('../models/Notification');

const VALID_TYPES = ['restaurant', 'boarding', 'info', 'alert', 'other'];

// Normalise le corps pour créer une notification (translations ou title+message legacy)
function normalizeNotificationBody(body) {
  const type = VALID_TYPES.includes(body.type) ? body.type : 'info';
  const scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;
  if (body.translations && typeof body.translations === 'object' && Object.keys(body.translations).length > 0) {
    const translations = {};
    for (const [lang, content] of Object.entries(body.translations)) {
      if (content && (content.title != null || content.message != null)) {
        translations[lang] = {
          title: String(content.title || '').trim(),
          message: String(content.message || '').trim()
        };
      }
    }
    if (Object.keys(translations).length === 0) {
      return { error: 'Au moins une langue doit avoir un titre ou un message.' };
    }
    return { translations, type, scheduledAt };
  }
  const title = String(body.title || '').trim();
  const message = String(body.message || '').trim();
  if (!title && !message) {
    return { error: 'Title and message are required, or provide translations.' };
  }
  return {
    title,
    message,
    translations: { fr: { title, message } },
    type,
    scheduledAt
  };
}

// GET /api/notifications — liste publique pour l'app passagers (notifications envoyées, pas d'auth)
// Ne renvoie jamais 500 : en cas d'erreur (DB déconnectée, etc.) on renvoie toujours [].
function sendEmptyNotifications(res) {
  if (!res.headersSent) res.json([]);
}

router.get('/', async (req, res) => {
  try {
    const limitParam = req.query.limit != null ? req.query.limit : 50;
    const langParam = req.query.lang != null ? req.query.lang : 'fr';
    const limit = Math.min(parseInt(limitParam, 10) || 50, 100);
    const lang = typeof langParam === 'string' ? langParam.trim().toLowerCase() : 'fr';

    if (mongoose.connection.readyState !== 1) {
      return sendEmptyNotifications(res);
    }
    const now = new Date();
    const notifications = await Notification.find({
      isActive: true,
      $or: [
        { scheduledAt: null },
        { scheduledAt: { $lte: now } }
      ]
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const list = notifications.map((n) => {
      const fallbackLangs = [lang, 'fr', 'en'].filter((l, i, a) => a.indexOf(l) === i);
      let title = '';
      let message = '';
      for (const l of fallbackLangs) {
        const t = n.translations && n.translations[l];
        if (t && (t.title || t.message)) {
          title = t.title || n.title || '';
          message = t.message || n.message || '';
          break;
        }
      }
      if (!title && !message) {
        title = n.title || '';
        message = n.message || '';
      }
      return {
        _id: n._id,
        title,
        message,
        type: n.type,
        createdAt: n.createdAt
      };
    });
    if (!res.headersSent) res.json(list);
  } catch (error) {
    console.error('Get notifications error:', error);
    sendEmptyNotifications(res);
  }
});

// POST /api/notifications — créer une notification (admin), envoi immédiat ou programmé
router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const normalized = normalizeNotificationBody(req.body);
    if (normalized.error) {
      return res.status(400).json({ message: normalized.error });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: 'Database unavailable' });
    }
    const firstKey = normalized.translations && (normalized.translations.fr ? 'fr' : Object.keys(normalized.translations)[0]);
    const firstContent = firstKey && normalized.translations[firstKey];
    const notification = await Notification.create({
      translations: normalized.translations,
      type: normalized.type,
      scheduledAt: normalized.scheduledAt,
      title: normalized.title ?? (firstContent && firstContent.title) ?? '',
      message: normalized.message ?? (firstContent && firstContent.message) ?? ''
    });
    res.status(201).json(notification);
  } catch (error) {
    console.error('Create notification error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/notifications/all — liste complète pour le dashboard (admin), avec statut envoyé / programmé
// Expose title/message résolus (depuis translations si besoin) pour un affichage correct
function resolveTitleMessage(n, preferLang = 'fr') {
  const fallbackLangs = [preferLang, 'fr', 'en'].filter((l, i, a) => a.indexOf(l) === i);
  let title = '';
  let message = '';
  for (const l of fallbackLangs) {
    const t = n.translations && n.translations[l];
    if (t && (t.title || t.message)) {
      title = t.title || n.title || '';
      message = t.message || n.message || '';
      break;
    }
  }
  if (!title && !message) {
    title = n.title || '';
    message = n.message || '';
  }
  return { title, message };
}

router.get('/all', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { limit = 100 } = req.query;
    if (mongoose.connection.readyState !== 1) {
      return res.json([]);
    }
    const notifications = await Notification.find()
      .sort({ createdAt: -1 })
      .limit(Math.min(parseInt(limit, 10) || 100, 200))
      .lean();

    const now = new Date();
    const list = notifications.map((n) => {
      const { title, message } = resolveTitleMessage(n);
      return {
        ...n,
        _id: n._id != null ? String(n._id) : n._id,
        title,
        message,
        status: n.scheduledAt == null || n.scheduledAt <= now ? 'sent' : 'scheduled'
      };
    });
    res.json(list);
  } catch (error) {
    console.error('Get all notifications error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/notifications/:id — supprimer une notification (admin)
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const idStr = (req.params.id || '').trim();
    if (!idStr || !mongoose.Types.ObjectId.isValid(idStr)) {
      return res.status(400).json({ message: 'ID invalide' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: 'Database unavailable' });
    }
    const objectId = new mongoose.Types.ObjectId(idStr);
    const deleted = await Notification.findByIdAndDelete(objectId);
    if (!deleted) {
      return res.status(404).json({ message: 'Notification introuvable' });
    }
    res.json({ message: 'Notification supprimée', _id: idStr });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
