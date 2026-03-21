/**
 * Résolution du TTL MongoDB pour la collection audit (sans recharger le modèle Mongoose).
 */
const { resolveAuditLogTtlSeconds } = require('../../../src/models/AuditLog');

describe('AuditLog TTL (resolveAuditLogTtlSeconds)', () => {
  it('défaut 365 jours si AUDIT_LOG_TTL_DAYS absent ou vide', () => {
    expect(resolveAuditLogTtlSeconds({})).toBe(365 * 86_400);
    expect(resolveAuditLogTtlSeconds({ AUDIT_LOG_TTL_DAYS: '' })).toBe(365 * 86_400);
  });

  it('retourne null si AUDIT_LOG_TTL_DAYS=0 (pas d’index TTL)', () => {
    expect(resolveAuditLogTtlSeconds({ AUDIT_LOG_TTL_DAYS: '0' })).toBeNull();
  });

  it('convertit un nombre de jours en secondes', () => {
    expect(resolveAuditLogTtlSeconds({ AUDIT_LOG_TTL_DAYS: '30' })).toBe(30 * 86_400);
  });

  it('plafonne à 3650 jours', () => {
    expect(resolveAuditLogTtlSeconds({ AUDIT_LOG_TTL_DAYS: '99999' })).toBe(3650 * 86_400);
  });
});
