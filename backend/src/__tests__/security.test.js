/**
 * Tests de sécurité — à lancer avec: npm test -- src/__tests__/security.test.js
 * Vérifie : masquage des secrets dans les logs, AppError, validation JWT (config).
 */

const { redact } = require('../lib/logger');
const { AppError } = require('../lib/AppError');

describe('Security', () => {
  describe('redact()', () => {
    it('masque les champs sensibles dans un objet', () => {
      const obj = { email: 'a@b.com', password: 'secret123', token: 'jwt-xxx' };
      const out = redact(obj);
      expect(out.email).toBe('a@b.com');
      expect(out.password).toBe('[REDACTED]');
      expect(out.token).toBe('[REDACTED]');
    });

    it('masque les champs sensibles en profondeur', () => {
      const obj = { body: { password: 'pwd', name: 'John' } };
      const out = redact(obj);
      expect(out.body.password).toBe('[REDACTED]');
      expect(out.body.name).toBe('John');
    });

    it('ne modifie pas les objets sans champs sensibles', () => {
      const obj = { page: 1, limit: 20 };
      expect(redact(obj)).toEqual(obj);
    });
  });

  describe('AppError', () => {
    it('expose statusCode et code', () => {
      const err = new AppError('Invalid ID', 400, 'INVALID_ID');
      expect(err.message).toBe('Invalid ID');
      expect(err.statusCode).toBe(400);
      expect(err.code).toBe('INVALID_ID');
      expect(err).toBeInstanceOf(Error);
    });

    it('valeurs par défaut', () => {
      const err = new AppError('Oops');
      expect(err.statusCode).toBe(500);
      expect(err.code).toBe('INTERNAL_ERROR');
    });
  });

  // JWT_SECRET ≥ 32 chars : vérifié au démarrage dans backend/src/config/index.js
  // Pour tester : JWT_SECRET=short NODE_ENV=production node server.js → doit exit 1
});
