/**
 * Modèle d'audit trail pour les actions admin.
 * Rétention minimale : 1 an (voir docs/AUDIT-LOGGING-POLICY.md).
 * Index : userId, timestamp, action pour recherches performantes.
 * Index TTL optionnel sur `timestamp` : purge automatique après AUDIT_LOG_TTL_DAYS (défaut 365 jours).
 * Désactiver : AUDIT_LOG_TTL_DAYS=0 — utiliser archiveOldLogs ou export manuel.
 */
const mongoose = require('mongoose');

const SECONDS_PER_DAY = 86_400;
/** @param {object} [env] */
function resolveAuditLogTtlSeconds(env = process.env) {
  const raw = env.AUDIT_LOG_TTL_DAYS;
  if (raw === undefined || raw === '') {
    return 365 * SECONDS_PER_DAY;
  }
  const days = parseInt(String(raw), 10);
  if (!Number.isFinite(days) || days <= 0) {
    return null;
  }
  const capped = Math.min(days, 3650);
  return capped * SECONDS_PER_DAY;
}

const auditLogSchema = new mongoose.Schema(
  {
    /** Null pour login échoué (utilisateur inconnu) */
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    action: {
      type: String,
      required: true,
      enum: [
        'login',
        'logout',
        'create-user',
        'update-user',
        'delete-user',
        'admin-action',
        'update',
        'delete',
        'create',
      ],
      index: true,
    },
    resource: {
      type: String,
      required: true,
      enum: ['user', 'restaurant', 'content', 'settings', 'auth'],
    },
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    changes: {
      before: { type: mongoose.Schema.Types.Mixed, default: null },
      after: { type: mongoose.Schema.Types.Mixed, default: null },
    },
    ipAddress: {
      type: String,
      default: null,
    },
    userAgent: {
      type: String,
      default: null,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['success', 'failure'],
      default: 'success',
    },
    errorMessage: {
      type: String,
      default: null,
    },
    /** Contexte additionnel (route, méthode HTTP, etc.) */
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'auditlogs',
  }
);

// Index composites pour requêtes fréquentes (userId + timestamp, action + timestamp)
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ resource: 1, resourceId: 1, timestamp: -1 });
auditLogSchema.index({ timestamp: -1 }); // Pour archiveOldLogs et export

const auditTtlSeconds = resolveAuditLogTtlSeconds();
if (auditTtlSeconds != null && auditTtlSeconds > 0) {
  auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: auditTtlSeconds });
}

const AuditLog = mongoose.model('AuditLog', auditLogSchema);
AuditLog.resolveAuditLogTtlSeconds = resolveAuditLogTtlSeconds;
module.exports = AuditLog;
