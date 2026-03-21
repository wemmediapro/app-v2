/**
 * Validation des variables de sécurité au démarrage.
 * En production : throw si manquant ou invalide.
 * À appeler dès le chargement (ex. dans server.js après dotenv).
 *
 * CSRF : les exemptions sont dans src/middleware/csrf.js (EXEMPT_PATHS, EXEMPT_PATH_PATTERNS).
 * Ne doivent figurer que login/register/refresh et tracking public (banners/ads/radio) — aucune route sensible.
 */
const logger = require('./logger');

function validateSecurityConfig() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    // JWT_SECRET : min 32 caractères (OWASP / RFC 8725)
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret || typeof jwtSecret !== 'string' || jwtSecret.length < 32) {
      throw new Error('CRITICAL: JWT_SECRET must be set and at least 32 characters in production.');
    }

    // MONGODB_URI / DATABASE_URL : doit être défini et non vide
    const mongoUri = process.env.MONGODB_URI || process.env.DATABASE_URL;
    if (!mongoUri || typeof mongoUri !== 'string' || !mongoUri.trim()) {
      throw new Error('CRITICAL: MONGODB_URI or DATABASE_URL must be set in production.');
    }

    const adminEmail = (process.env.ADMIN_EMAIL || '').trim();
    if (!adminEmail) {
      throw new Error('CRITICAL: ADMIN_EMAIL must be set (non-empty) in production.');
    }
    if (adminEmail.toLowerCase() === 'admin@gnv.com') {
      throw new Error('CRITICAL: ADMIN_EMAIL must not be the default demo address admin@gnv.com in production.');
    }

    // ADMIN_PASSWORD : obligatoire pour le dashboard (longueur + pas de mots de passe de démo connus)
    const ap = process.env.ADMIN_PASSWORD;
    if (!ap || typeof ap !== 'string' || !ap.trim()) {
      throw new Error('CRITICAL: ADMIN_PASSWORD must be set (non-empty) in production.');
    }
    const apTrim = ap.trim();
    if (apTrim.length < 12) {
      throw new Error('CRITICAL: ADMIN_PASSWORD must be at least 12 characters in production.');
    }
    const apLower = apTrim.toLowerCase();
    const bannedAdminPasswords = new Set([
      'admin123!',
      'admin123!!',
      'password',
      'password123',
      'changeme',
      'admin123',
      'administrator',
      'gnvadmin123',
    ]);
    if (bannedAdminPasswords.has(apLower)) {
      throw new Error(
        'CRITICAL: ADMIN_PASSWORD must not be a known default or trivial password. Choose a unique strong password (12+ characters).'
      );
    }

    const sentryDsn = (process.env.SENTRY_DSN || '').trim();
    if (!sentryDsn) {
      throw new Error('CRITICAL: SENTRY_DSN must be set (non-empty) in production.');
    }
    if (!sentryDsn.startsWith('https://')) {
      throw new Error('CRITICAL: SENTRY_DSN must be a valid HTTPS DSN URL in production.');
    }
  } else {
    // En dev : avertissements seulement
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      logger.warn({
        event: 'security_config_jwt_short_dev',
        message: 'JWT_SECRET should be at least 32 characters for production.',
      });
    }
    if (!(process.env.ADMIN_EMAIL || '').trim() || !process.env.ADMIN_PASSWORD) {
      logger.warn({
        event: 'security_config_admin_credentials_missing_dev',
        message:
          'ADMIN_EMAIL et ADMIN_PASSWORD doivent être définis dans config.env pour le login admin (sinon POST /api/auth/login renverra 500).',
      });
    }
  }
}

module.exports = { validateSecurityConfig };
