const { RedisStore } = require('../../../src/lib/rateLimitRedisStore');

describe('RedisStore.increment — windowMs par appel', () => {
  it('utilise options.windowMs quand fourni', async () => {
    const store = new RedisStore({ prefix: 't:' });
    store.client = {
      async incr() {
        return 1;
      },
      async sendCommand(args) {
        if (args[0] === 'PTTL') {
          return -1;
        }
        return -1;
      },
      async pExpire(_k, ms) {
        expect(ms).toBe(5000);
      },
    };
    store.init({ windowMs: 900000 });
    await store.increment('k', { windowMs: 5000 });
  });
});
