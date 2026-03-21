const { validateSecurityConfig } = require('../../../src/lib/security-config');

describe('validateSecurityConfig — credentials admin (production)', () => {
  const KEYS = ['NODE_ENV', 'JWT_SECRET', 'MONGODB_URI', 'ADMIN_EMAIL', 'ADMIN_PASSWORD', 'DATABASE_URL'];
  const backup = {};
  KEYS.forEach((k) => {
    backup[k] = process.env[k];
  });

  afterEach(() => {
    KEYS.forEach((k) => {
      if (backup[k] === undefined) {
        delete process.env[k];
      } else {
        process.env[k] = backup[k];
      }
    });
  });

  it('lève une erreur si ADMIN_EMAIL est admin@gnv.com en production', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'x'.repeat(32);
    process.env.MONGODB_URI = 'mongodb://localhost:27017/t';
    process.env.ADMIN_EMAIL = 'admin@gnv.com';
    process.env.ADMIN_PASSWORD = 'ValidPass1!';
    expect(() => validateSecurityConfig()).toThrow(/admin@gnv\.com/);
  });

  it('passe avec ADMIN_EMAIL non démo et secrets valides', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'x'.repeat(32);
    process.env.MONGODB_URI = 'mongodb://localhost:27017/t';
    process.env.ADMIN_EMAIL = 'ops@entreprise.example';
    process.env.ADMIN_PASSWORD = 'ValidPass1!';
    expect(() => validateSecurityConfig()).not.toThrow();
  });
});
