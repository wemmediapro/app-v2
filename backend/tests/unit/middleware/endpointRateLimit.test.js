const {
  createEndpointRateLimitMiddleware,
  normalizeSuffixForEndpointRateLimit,
  pickEndpointRateRule,
  clearMemoryCountersForTests,
  clearSlidingMemoryForTests,
} = require('../../../src/middleware/endpointRateLimit');

describe('endpointRateLimit — matching', () => {
  it('normalise le suffixe API', () => {
    expect(normalizeSuffixForEndpointRateLimit('/api/v1/messages/')).toBe('/messages');
    expect(normalizeSuffixForEndpointRateLimit('/api/messages')).toBe('/messages');
  });

  it('choisit le préfixe le plus long', () => {
    const rules = [
      { prefix: '/messages', max: 100, windowMs: 60000 },
      { prefix: '/messages/search', max: 2, windowMs: 60000 },
    ];
    const suffix = '/messages/search';
    expect(pickEndpointRateRule(suffix, rules).max).toBe(2);
  });
});

describe('createEndpointRateLimitMiddleware', () => {
  afterEach(() => {
    clearMemoryCountersForTests();
    clearSlidingMemoryForTests();
  });

  it('429 après dépassement du max (store mémoire)', async () => {
    const mw = createEndpointRateLimitMiddleware({
      rules: [{ prefix: '/export', max: 2, windowMs: 60_000 }],
      redisStore: null,
      skip: () => false,
      defaultWindowMs: 60_000,
    });

    const req = { method: 'GET', path: '/api/v1/export/csv', ip: '10.0.0.1' };
    const res = {
      headers: {},
      setHeader(k, v) {
        this.headers[k] = v;
      },
      statusCode: 200,
      status(n) {
        this.statusCode = n;
        return this;
      },
      json() {},
    };
    const next = jest.fn();

    await mw(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    next.mockClear();

    await mw(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    next.mockClear();

    await mw(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(429);
  });

  it('fenêtre glissante mémoire : 429 après max hits', async () => {
    const mw = createEndpointRateLimitMiddleware({
      rules: [{ prefix: '/t', max: 2, windowMs: 60_000, windowType: 'sliding' }],
      redisStore: null,
      skip: () => false,
      defaultWindowMs: 60_000,
    });
    const req = { method: 'GET', path: '/api/v1/t', ip: '10.0.0.9' };
    const mkRes = () => ({
      headers: {},
      setHeader(k, v) {
        this.headers[k] = v;
      },
      statusCode: 200,
      status(n) {
        this.statusCode = n;
        return this;
      },
      json() {},
      on() {},
    });
    await mw(req, mkRes(), jest.fn());
    await mw(req, mkRes(), jest.fn());
    const res = mkRes();
    const next = jest.fn();
    await mw(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(429);
  });

  it('ignore si skip retourne true', async () => {
    const mw = createEndpointRateLimitMiddleware({
      rules: [{ prefix: '/export', max: 1, windowMs: 60_000 }],
      redisStore: null,
      skip: () => true,
      defaultWindowMs: 60_000,
    });
    const next = jest.fn();
    await mw({ method: 'GET', path: '/api/export/x', ip: '1.1.1.1' }, {}, next);
    expect(next).toHaveBeenCalled();
  });
});
