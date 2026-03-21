/**
 * Routes API Notifications - Notifications push envoyées par l'équipe GNV (app passagers + admin)
 * Support multilingue (translations) et envoi programmé (scheduledAt).
 */

const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const Notification = require('../models/Notification');
const {
  validatePagination,
  createValidatePagination,
  validateMongoId,
  handleValidationErrors,
} = require('../middleware/validateInput');
const { logRouteError } = require('../lib/route-logger');

/** Dashboard admin : liste complète, défaut 100 entrées (plafonné par validatePagination à 100 max) */
const validateNotificationsAdminPagination = createValidatePagination({ defaultLimit: 100 });

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
          message: String(content.message || '').trim(),
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
    scheduledAt,
  };
}

// GET /api/notifications — liste publique pour l'app passagers (notifications envoyées, pas d'auth)
// Ne renvoie jamais 500 : en cas d'erreur (DB déconnectée, etc.) on renvoie toujours 200 + { data: [], total: 0, ... }.
function sendEmptyNotifications(req, res, pagination) {
  if (res.headersSent) {
    return;
  }
  const page = (pagination && pagination.page) || 1;
  const limit = (pagination && pagination.limit) || 20;
  try {
    res.json({ data: [], total: 0, page, limit });
  } catch (e) {
    logRouteError(req, 'notifications_send_empty_failed', e);
  }
}

router.get('/', validatePagination, handleValidationErrors, (req, res) => {
  const pagination = req.pagination;
  (async () => {
    try {
      const langParam = req.query.lang != null ? req.query.lang : 'fr';
      const lang = typeof langParam === 'string' ? langParam.trim().toLowerCase() : 'fr';
      const { skip, limit } = req.pagination;

      if (mongoose.connection.readyState !== 1) {
        return sendEmptyNotifications(req, res, pagination);
      }
      const now = new Date();
      const query = {
        isActive: true,
        $or: [{ scheduledAt: null }, { scheduledAt: { $lte: now } }],
      };
      const [notifications, total] = await Promise.all([
        Notification.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        Notification.countDocuments(query),
      ]);

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
          createdAt: n.createdAt,
        };
      });
      if (!res.headersSent) {
        res.json({ data: list, total, page: req.pagination.page, limit });
      }
    } catch (error) {
      logRouteError(req, 'notifications_list_failed', error);
      sendEmptyNotifications(req, res, pagination);
    }
  })().catch((err) => {
    logRouteError(req, 'notifications_list_unhandled', err);
    sendEmptyNotifications(req, res, pagination);
  });
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
    const firstKey =
      normalized.translations && (normalized.translations.fr ? 'fr' : Object.keys(normalized.translations)[0]);
    const firstContent = firstKey && normalized.translations[firstKey];
    const notification = await Notification.create({
      translations: normalized.translations,
      type: normalized.type,
      scheduledAt: normalized.scheduledAt,
      title: normalized.title ?? (firstContent && firstContent.title) ?? '',
      message: normalized.message ?? (firstContent && firstContent.message) ?? '',
    });
    res.status(201).json(notification);
  } catch (error) {
    logRouteError(req, 'notifications_create_failed', error);
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

router.get(
  '/all',
  authMiddleware,
  adminMiddleware,
  validateNotificationsAdminPagination,
  handleValidationErrors,
  async (req, res) => {
    try {
      const { limit } = req.pagination;
      if (mongoose.connection.readyState !== 1) {
        return res.json([]);
      }
      const notifications = await Notification.find().sort({ createdAt: -1 }).limit(limit).lean();

      const now = new Date();
      const list = notifications.map((n) => {
        const { title, message } = resolveTitleMessage(n);
        return {
          ...n,
          _id: n._id != null ? String(n._id) : n._id,
          title,
          message,
          status: n.scheduledAt == null || n.scheduledAt <= now ? 'sent' : 'scheduled',
        };
      });
      res.json(list);
    } catch (error) {
      logRouteError(req, 'notifications_admin_list_failed', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// DELETE /api/notifications/:id — supprimer une notification (admin)
router.delete(
  '/:id',
  authMiddleware,
  adminMiddleware,
  validateMongoId('id'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const idStr = req.params.id;
      if (mongoose.connection.readyState !== 1) {
        return res.status(503).json({ message: 'Database unavailable' });
      }
      const deleted = await Notification.findByIdAndDelete(idStr);
      if (!deleted) {
        return res.status(404).json({ message: 'Notification introuvable' });
      }
      res.json({ message: 'Notification supprimée', _id: idStr });
    } catch (error) {
      logRouteError(req, 'notifications_delete_failed', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

module.exports = router;
