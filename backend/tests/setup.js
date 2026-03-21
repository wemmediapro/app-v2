/**
 * Setup global Jest — exécuté avant chaque fichier de test (setupFiles).
 * Ne pas importer Mongoose ici : évite effets de bord avant les mocks.
 */
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-at-least-32-chars!!';
process.env.NODE_ENV = 'test';
process.env.ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@test.com').trim().toLowerCase();
process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'AdminStrong1!@#';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Fenêtre rate-limit login plus large en CI/test si besoin
process.env.LOGIN_RATE_LIMIT_MAX = process.env.LOGIN_RATE_LIMIT_MAX || '1000';
