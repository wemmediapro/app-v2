/**
 * getSecret() — branches réservées à NODE_ENV=production (via isolateModules + config mockée).
 */
describe('middleware/auth getSecret en production (isolateModules)', () => {
  const origEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = origEnv;
  });

  it('lève si JWT_SECRET (config) fait moins de 32 caractères', () => {
    jest.isolateModules(() => {
      jest.doMock('../../../src/config', () => ({
        jwt: { secret: 'a'.repeat(31) },
      }));
      jest.doMock('../../../src/models/User', () => ({ findById: jest.fn() }));
      jest.doMock('../../../src/lib/cache-manager', () => ({
        isConnected: false,
        get: jest.fn(),
        set: jest.fn(),
      }));
      jest.doMock('../../../src/services/authService', () => ({}));
      jest.doMock('../../../src/lib/apiPath', () => ({ getApiPathSuffix: () => '/' }));
      jest.doMock('../../../src/lib/logger', () => ({ error: jest.fn() }));

      process.env.NODE_ENV = 'production';
      const { generateToken } = require('../../../src/middleware/auth');
      expect(() => generateToken({ id: '507f1f77bcf86cd799439011' })).toThrow(/at least 32 characters/);
    });
  });

  it('lève si JWT_SECRET (config) est vide en production', () => {
    jest.isolateModules(() => {
      jest.doMock('../../../src/config', () => ({
        jwt: { secret: '' },
      }));
      jest.doMock('../../../src/models/User', () => ({ findById: jest.fn() }));
      jest.doMock('../../../src/lib/cache-manager', () => ({
        isConnected: false,
        get: jest.fn(),
        set: jest.fn(),
      }));
      jest.doMock('../../../src/services/authService', () => ({}));
      jest.doMock('../../../src/lib/apiPath', () => ({ getApiPathSuffix: () => '/' }));
      jest.doMock('../../../src/lib/logger', () => ({ error: jest.fn() }));

      process.env.NODE_ENV = 'production';
      const { generateToken } = require('../../../src/middleware/auth');
      expect(() => generateToken({ id: '507f1f77bcf86cd799439011' })).toThrow(/JWT_SECRET must be set in production/);
    });
  });
});
