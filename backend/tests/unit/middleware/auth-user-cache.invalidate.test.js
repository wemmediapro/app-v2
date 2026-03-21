/**
 * invalidateAuthUserCache : del Redis, skip si down, warn si del échoue.
 */
jest.mock('../../../src/lib/cache-manager', () => ({
  isConnected: false,
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
}));

jest.mock('../../../src/lib/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const cacheManager = require('../../../src/lib/cache-manager');
const logger = require('../../../src/lib/logger');
const { invalidateAuthUserCache } = require('../../../src/middleware/auth');

describe('invalidateAuthUserCache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    cacheManager.isConnected = true;
    cacheManager.del.mockResolvedValue(undefined);
  });

  it('no-op si userId null', async () => {
    await invalidateAuthUserCache(null);
    expect(cacheManager.del).not.toHaveBeenCalled();
  });

  it('log skip + pas de del si Redis non connecté', async () => {
    cacheManager.isConnected = false;
    await invalidateAuthUserCache('507f1f77bcf86cd799439011');
    expect(cacheManager.del).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'auth_user_cache_invalidate_skipped',
        reason: 'redis_unavailable',
      })
    );
  });

  it('appelle del sur la clé auth:user:<id>', async () => {
    await invalidateAuthUserCache('507f1f77bcf86cd799439011');
    expect(cacheManager.del).toHaveBeenCalledWith('auth:user:507f1f77bcf86cd799439011');
    expect(logger.debug).toHaveBeenCalledWith(expect.objectContaining({ event: 'auth_user_cache_invalidated' }));
  });

  it('del rejeté → warn sans throw', async () => {
    cacheManager.del.mockRejectedValue(new Error('boom'));
    await expect(invalidateAuthUserCache('507f1f77bcf86cd799439011')).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: 'auth_user_cache_invalidate_failed' }));
  });
});
