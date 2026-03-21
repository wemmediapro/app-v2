const { CacheManager } = require('../../../src/lib/cache-manager');

describe('CacheManager.pingHealth', () => {
  it('retourne disconnected sans client', async () => {
    const cm = new CacheManager();
    await expect(cm.pingHealth()).resolves.toEqual({ ok: false, status: 'disconnected' });
  });
});
