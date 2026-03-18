// Secret JWT pour les tests (auth middleware retourne 401 au lieu de 503)
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-at-least-32-chars!!';
