/**
 * Service d'audit des actions admin.
 * Logging centralisé pour conformité et traçabilité (rétention 1 an minimum).
 * @see docs/AUDIT-LOGGING-POLICY.md
 */
const AuditLog = require('../models/AuditLog');
const mongoose = require('mongoose');

/** Actions reconnues */
const ACTIONS = {
  LOGIN: 'login',
  LOGOUT: 'logout',
  CREATE_USER: 'create-user',
  UPDATE_USER: 'update-user',
  DELETE_USER: 'delete-user',
  ADMIN_ACTION: 'admin-action',
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
};

/** Ressources reconnues */
const RESOURCES = {
  USER: 'user',
  RESTAURANT: 'restaurant',
  CONTENT: 'content',
  SETTINGS: 'settings',
  AUTH: 'auth',
};

/**
 * Enregistre une action d'audit.
 * @param {Object} opts
 * @param {string|ObjectId} opts.userId - Admin ayant effectué l'action (null pour login échoué)
 * @param {string} opts.action - login | create-user | update-user | delete-user | admin-action | create | update | delete
 * @param {string} opts.resource - user | restaurant | content | settings | auth
 * @param {ObjectId|null} [opts.resourceId] - ID de la ressource ciblée
 * @param {{ before?: Object, after?: Object }} [opts.changes]
 * @param {string} [opts.ipAddress]
 * @param {string} [opts.userAgent]
 * @param {string} [opts.status] - success | failure
 * @param {string} [opts.errorMessage]
 * @param {Object} [opts.metadata]
 * @returns {Promise<AuditLog|null>} Document créé ou null en cas d'erreur (ne pas faire échouer l'app)
 */
async function logAction(opts) {
  const {
    userId,
    action,
    resource,
    resourceId = null,
    changes = {},
    ipAddress = null,
    userAgent = null,
    status = 'success',
    errorMessage = null,
    metadata = null,
  } = opts;

  if (!action || !resource) {
    console.warn('[auditService] logAction: action et resource requis');
    return null;
  }

  try {
    const doc = await AuditLog.create({
      userId: userId ? (mongoose.Types.ObjectId.isValid(userId) ? userId : null) : null,
      action,
      resource,
      resourceId: resourceId && mongoose.Types.ObjectId.isValid(resourceId) ? resourceId : null,
      changes: {
        before: changes.before ?? null,
        after: changes.after ?? null,
      },
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
      status,
      errorMessage: errorMessage || null,
      metadata: metadata || null,
    });
    return doc;
  } catch (err) {
    console.error('[auditService] logAction error:', err.message);
    return null;
  }
}

/**
 * Récupère les logs admin avec filtres et pagination.
 * @param {Object} filters
 * @param {string|ObjectId} [filters.adminId] - Filtrer par admin
 * @param {string} [filters.action]
 * @param {string} [filters.resource]
 * @param {number} [filters.days=30] - Période en jours
 * @param {number} [filters.page=1]
 * @param {number} [filters.limit=50]
 * @returns {Promise<{ logs: AuditLog[], total: number, page: number, limit: number }>}
 */
async function getAdminLogs(filters = {}) {
  const { adminId, action, resource, resourceId, days = 30, page = 1, limit = 50 } = filters;
  const skip = Math.max(0, (Math.max(1, page) - 1) * Math.min(100, Math.max(1, limit)));

  const query = {};
  const since = new Date();
  since.setDate(since.getDate() - Math.max(1, Math.min(365, days || 30)));
  query.timestamp = { $gte: since };

  if (adminId && mongoose.Types.ObjectId.isValid(adminId)) {
    query.userId = adminId;
  }
  if (action) {query.action = action;}
  if (resource) {query.resource = resource;}
  if (resourceId && mongoose.Types.ObjectId.isValid(resourceId)) {
    query.resourceId = resourceId;
  }

  const [logs, total] = await Promise.all([
    AuditLog.find(query).sort({ timestamp: -1 }).skip(skip).limit(Math.min(100, Math.max(1, limit))).lean(),
    AuditLog.countDocuments(query),
  ]);

  return {
    logs,
    total,
    page: Math.max(1, page),
    limit: Math.min(100, Math.max(1, limit)),
  };
}

/**
 * Exporte les logs au format CSV ou JSON.
 * @param {'csv'|'json'} format
 * @param {Object} [filters] - Mêmes filtres que getAdminLogs
 * @returns {Promise<{ content: string, contentType: string }>}
 */
async function exportLogs(format = 'json', filters = {}) {
  const { logs } = await getAdminLogs({ ...filters, limit: 10000 });

  if (format === 'csv') {
    const headers = ['timestamp', 'userId', 'action', 'resource', 'resourceId', 'status', 'ipAddress', 'errorMessage'];
    const rows = logs.map((l) => {
      const row = [
        l.timestamp ? new Date(l.timestamp).toISOString() : '',
        l.userId ? String(l.userId) : '',
        l.action || '',
        l.resource || '',
        l.resourceId ? String(l.resourceId) : '',
        l.status || '',
        l.ipAddress || '',
        (l.errorMessage || '').replace(/"/g, '""'),
      ];
      return row.map((c) => `"${String(c)}"`).join(',');
    });
    const content = [headers.map((h) => `"${h}"`).join(','), ...rows].join('\n');
    return { content, contentType: 'text/csv; charset=utf-8' };
  }

  return {
    content: JSON.stringify(logs, null, 2),
    contentType: 'application/json; charset=utf-8',
  };
}

/**
 * Archive ou supprime les logs plus anciens que la date donnée.
 * En production : préférer une archivage (export) avant suppression.
 * @param {Date|number} olderThan - Date ou millisecondes
 * @returns {Promise<{ deleted: number }>}
 */
async function archiveOldLogs(olderThan) {
  const cutoff = olderThan instanceof Date ? olderThan : new Date(Date.now() - Number(olderThan));
  const result = await AuditLog.deleteMany({ timestamp: { $lt: cutoff } });
  return { deleted: result.deletedCount };
}

module.exports = {
  logAction,
  getAdminLogs,
  exportLogs,
  archiveOldLogs,
  ACTIONS,
  RESOURCES,
};
