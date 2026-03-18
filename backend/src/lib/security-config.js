/**
 * Validation des variables de sécurité au démarrage.
 * En production : throw si manquant ou invalide.
 * À appeler dès le chargement (ex. dans server.js après dotenv).
 */
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

    // ADMIN_PASSWORD : obligatoire pour le dashboard
    if (!process.env.ADMIN_PASSWORD || typeof process.env.ADMIN_PASSWORD !== 'string') {
      throw new Error('CRITICAL: ADMIN_PASSWORD must be set in production.');
    }
  } else {
    // En dev : avertissements seulement
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      console.warn('WARN: JWT_SECRET should be at least 32 characters for production.');
    }
    if (!process.env.ADMIN_PASSWORD) {
      console.warn('WARN: ADMIN_PASSWORD not set. Set it in config.env for admin login.');
    }
  }
}

module.exports = { validateSecurityConfig };
