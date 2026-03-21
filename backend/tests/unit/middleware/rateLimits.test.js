const { buildRateLimitIdentity, AdaptiveRateLimiter } = require('../../../src/middleware/rateLimits');

describe('rateLimits — buildRateLimitIdentity', () => {
  const req = { ip: '10.0.0.2', socket: {} };

  it('ip : identité basée sur IP', () => {
    expect(buildRateLimitIdentity(req, 'ip')).toBe('ip:10.0.0.2');
  });

  it('user sans JWT : repli IP', () => {
    jest.spyOn(require('../../../src/middleware/auth'), 'getTokenFromRequest').mockReturnValue('');
    expect(buildRateLimitIdentity(req, 'user')).toBe('ip:10.0.0.2');
    jest.restoreAllMocks();
  });

  it('user avec JWT valide : préfixe u:', () => {
    jest.spyOn(require('../../../src/middleware/auth'), 'getTokenFromRequest').mockReturnValue('t');
    jest.spyOn(require('../../../src/middleware/auth'), 'verifyToken').mockReturnValue({ id: 'abc123' });
    expect(buildRateLimitIdentity(req, 'user')).toBe('u:abc123');
    jest.restoreAllMocks();
  });
});

describe('AdaptiveRateLimiter', () => {
  it('getLimit retourne defaultMax sans Redis', async () => {
    const ar = new AdaptiveRateLimiter(null);
    await expect(ar.getLimit('scope', 10, 5)).resolves.toBe(10);
  });

  it('getLimit lit la limite stockée', async () => {
    const redis = {
      async get(k) {
        if (k.includes('limit:')) {
          return JSON.stringify({ limit: 7 });
        }
        return null;
      },
      async setEx() {},
    };
    const ar = new AdaptiveRateLimiter(redis);
    await expect(ar.getLimit('s', 10, 5)).resolves.toBe(7);
  });

  it('recordRequest met à jour stats et la limite', async () => {
    const state = { limit: '10', stats: null };
    const redis = {
      async get(k) {
        if (k.includes('stats:')) {
          return state.stats;
        }
        if (k.includes('limit:')) {
          return state.limit;
        }
        return null;
      },
      async setEx(k, _ttl, v) {
        if (k.includes('stats:')) {
          state.stats = v;
        }
        if (k.includes('limit:')) {
          state.limit = v;
        }
      },
    };
    const ar = new AdaptiveRateLimiter(redis, { successThreshold: 0.5, lowThreshold: 0.1 });
    await ar.recordRequest('u1', true, 20, 5);
    const lim = JSON.parse(state.limit);
    expect(lim.limit).toBeGreaterThanOrEqual(5);
    const st = JSON.parse(state.stats);
    expect(st.total).toBe(1);
    expect(st.success).toBe(1);
  });
});
