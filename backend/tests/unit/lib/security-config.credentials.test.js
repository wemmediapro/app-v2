const { validateSecurityConfig } = require('../../../src/lib/security-config');

describe('validateSecurityConfig — credentials admin (production)', () => {
  const KEYS = ['NODE_ENV', 'JWT_SECRET', 'MONGODB_URI', 'ADMIN_EMAIL', 'ADMIN_PASSWORD', 'DATABASE_URL', 'SENTRY_DSN'];
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
    process.env.ADMIN_PASSWORD = 'ValidPass12!x';
    process.env.SENTRY_DSN = 'https://examplePublicKey@o0.ingest.sentry.io/1';
    expect(() => validateSecurityConfig()).toThrow(/admin@gnv\.com/);
  });

  it('lève une erreur si ADMIN_PASSWORD fait moins de 12 caractères en production', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'x'.repeat(32);
    process.env.MONGODB_URI = 'mongodb://localhost:27017/t';
    process.env.ADMIN_EMAIL = 'ops@entreprise.example';
    process.env.ADMIN_PASSWORD = 'short';
    process.env.SENTRY_DSN = 'https://examplePublicKey@o0.ingest.sentry.io/1';
    expect(() => validateSecurityConfig()).toThrow(/at least 12 characters/);
  });

  it('lève une erreur si ADMIN_PASSWORD est un mot de passe de démo connu', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'x'.repeat(32);
    process.env.MONGODB_URI = 'mongodb://localhost:27017/t';
    process.env.ADMIN_EMAIL = 'ops@entreprise.example';
    process.env.ADMIN_PASSWORD = 'Administrator'; // ≥12 car. et entrée exacte bannie (administrator)
    process.env.SENTRY_DSN = 'https://examplePublicKey@o0.ingest.sentry.io/1';
    expect(() => validateSecurityConfig()).toThrow(/known default|trivial password/i);
  });

  it('lève une erreur si SENTRY_DSN est absent en production', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'x'.repeat(32);
    process.env.MONGODB_URI = 'mongodb://localhost:27017/t';
    process.env.ADMIN_EMAIL = 'ops@entreprise.example';
    process.env.ADMIN_PASSWORD = 'ValidPass12!Secure';
    delete process.env.SENTRY_DSN;
    expect(() => validateSecurityConfig()).toThrow(/SENTRY_DSN must be set/);
  });

  it('passe avec ADMIN_EMAIL non démo et secrets valides', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'x'.repeat(32);
    process.env.MONGODB_URI = 'mongodb://localhost:27017/t';
    process.env.ADMIN_EMAIL = 'ops@entreprise.example';
    process.env.ADMIN_PASSWORD = 'ValidPass12!Secure';
    process.env.SENTRY_DSN = 'https://examplePublicKey@o0.ingest.sentry.io/1';
    expect(() => validateSecurityConfig()).not.toThrow();
  });
});
