const { RedisStore } = require('../../../src/lib/rateLimitRedisStore');

describe('RedisStore.slidingIncrement', () => {
  it('appelle eval et retourne le cardinal', async () => {
    const store = new RedisStore({ prefix: 't:' });
    store.client = {
      async eval(_lua, { keys, arguments: args }) {
        expect(keys.length).toBe(1);
        expect(args.length).toBe(3);
        return 4;
      },
    };
    store.init({ windowMs: 900000 });
    const r = await store.slidingIncrement('k', { windowMs: 8000 });
    expect(r.totalHits).toBe(4);
    expect(r.resetTime.getTime()).toBeGreaterThan(Date.now());
  });
});

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
