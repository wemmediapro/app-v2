/**
 * Cache de réponses HTTP : GET, skip auth, invalidation.
 */
jest.mock('../../../src/lib/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const express = require('express');
const cookieParser = require('cookie-parser');
const request = require('supertest');
const {
  createResponseCacheMiddleware,
  invalidateResponseCacheByEvent,
  invalidateResponseCacheByTag,
} = require('../../../src/middleware/responseCache');

function mockCacheManager() {
  const store = new Map();
  return {
    isConnected: true,
    get: jest.fn(async (k) => store.get(k) ?? null),
    set: jest.fn(async (k, v, _ttl) => {
      store.set(k, v);
      return true;
    }),
    delPattern: jest.fn(async (pattern) => {
      const prefix = pattern.replace(/\*$/, '');
      let n = 0;
      for (const key of [...store.keys()]) {
        if (key.startsWith(prefix)) {
          store.delete(key);
          n += 1;
        }
      }
      return n;
    }),
    __store: store,
  };
}

describe('createResponseCacheMiddleware', () => {
  it('désactivé si enabled=false : pas de lecture Redis', async () => {
    const cacheManager = mockCacheManager();
    const app = express();
    app.use((req, res, next) => {
      req.language = 'fr';
      next();
    });
    app.get('/api/movies', createResponseCacheMiddleware({ cacheManager, enabled: false }), (_req, res) =>
      res.json({ ok: 1 })
    );
    await request(app).get('/api/movies').expect(200);
    expect(cacheManager.get).not.toHaveBeenCalled();
  });

  it('HIT : renvoie le corps mis en cache et X-Cache: HIT', async () => {
    const cacheManager = mockCacheManager();
    const keyLike = 'http:rsp:v1:movies:GET:';
    cacheManager.get.mockImplementation(async (k) => {
      if (String(k).startsWith(keyLike)) {
        return { v: 1, status: 200, body: { cached: true } };
      }
      return null;
    });
    const app = express();
    app.use((req, res, next) => {
      req.language = 'fr';
      next();
    });
    app.get('/api/movies', createResponseCacheMiddleware({ cacheManager, enabled: true }), (_req, res) =>
      res.json({ live: true })
    );
    const res = await request(app).get('/api/movies').expect(200);
    expect(res.body).toEqual({ cached: true });
    expect(res.headers['x-cache']).toBe('HIT');
  });

  it('MISS puis enregistre un 200 JSON', async () => {
    const cacheManager = mockCacheManager();
    const app = express();
    app.use((req, res, next) => {
      req.language = 'en';
      next();
    });
    app.get('/api/magazine', createResponseCacheMiddleware({ cacheManager, enabled: true }), (_req, res) =>
      res.json({ items: [] })
    );
    const res = await request(app).get('/api/magazine').expect(200);
    expect(res.headers['x-cache']).toBe('MISS');
    expect(cacheManager.set).toHaveBeenCalled();
    const [key, payload, ttl] = cacheManager.set.mock.calls[0];
    expect(String(key)).toMatch(/^http:rsp:v1:magazine:GET:/);
    expect(payload.v).toBe(1);
    expect(payload.body).toEqual({ items: [] });
    expect(typeof ttl).toBe('number');
    expect(ttl).toBeGreaterThan(0);
  });

  it('ne cache pas POST', async () => {
    const cacheManager = mockCacheManager();
    const app = express();
    app.use((req, res, next) => {
      req.language = 'fr';
      next();
    });
    app.post('/api/movies', createResponseCacheMiddleware({ cacheManager, enabled: true }), (_req, res) =>
      res.json({ x: 1 })
    );
    await request(app).post('/api/movies').expect(200);
    expect(cacheManager.get).not.toHaveBeenCalled();
  });

  it('skip si Authorization présent', async () => {
    const cacheManager = mockCacheManager();
    const app = express();
    app.use((req, res, next) => {
      req.language = 'fr';
      next();
    });
    app.get('/api/movies', createResponseCacheMiddleware({ cacheManager, enabled: true }), (_req, res) =>
      res.json({ a: 1 })
    );
    await request(app).get('/api/movies').set('Authorization', 'Bearer x').expect(200);
    expect(cacheManager.get).not.toHaveBeenCalled();
  });

  it('skip si cookie authToken', async () => {
    const cacheManager = mockCacheManager();
    const app = express();
    app.use(cookieParser());
    app.use((req, res, next) => {
      req.language = 'fr';
      next();
    });
    app.get('/api/movies', createResponseCacheMiddleware({ cacheManager, enabled: true }), (_req, res) =>
      res.json({ a: 1 })
    );
    await request(app).get('/api/movies').set('Cookie', ['authToken=jwt']).expect(200);
    expect(cacheManager.get).not.toHaveBeenCalled();
  });

  it('skip si req.user défini', async () => {
    const cacheManager = mockCacheManager();
    const app = express();
    app.use((req, res, next) => {
      req.language = 'fr';
      req.user = { id: '1' };
      next();
    });
    app.get('/api/movies', createResponseCacheMiddleware({ cacheManager, enabled: true }), (_req, res) =>
      res.json({ a: 1 })
    );
    await request(app).get('/api/movies').expect(200);
    expect(cacheManager.get).not.toHaveBeenCalled();
  });

  it('skip si chemin hors règles', async () => {
    const cacheManager = mockCacheManager();
    const app = express();
    app.use((req, res, next) => {
      req.language = 'fr';
      next();
    });
    app.get('/api/notifications', createResponseCacheMiddleware({ cacheManager, enabled: true }), (_req, res) =>
      res.json([])
    );
    await request(app).get('/api/notifications').expect(200);
    expect(cacheManager.get).not.toHaveBeenCalled();
  });

  it('skip si Redis down', async () => {
    const cacheManager = mockCacheManager();
    cacheManager.isConnected = false;
    const app = express();
    app.use((req, res, next) => {
      req.language = 'fr';
      next();
    });
    app.get('/api/movies', createResponseCacheMiddleware({ cacheManager, enabled: true }), (_req, res) =>
      res.json({ live: true })
    );
    await request(app).get('/api/movies').expect(200);
    expect(cacheManager.get).not.toHaveBeenCalled();
  });

  it('ne stocke pas si status !== 200', async () => {
    const cacheManager = mockCacheManager();
    const app = express();
    app.use((req, res, next) => {
      req.language = 'fr';
      next();
    });
    app.get('/api/movies', createResponseCacheMiddleware({ cacheManager, enabled: true }), (_req, res) =>
      res.status(503).json({ err: true })
    );
    await request(app).get('/api/movies').expect(503);
    expect(cacheManager.set).not.toHaveBeenCalled();
  });
});

describe('invalidateResponseCacheByTag / ByEvent', () => {
  it('delPattern par tag', async () => {
    const cacheManager = mockCacheManager();
    await cacheManager.set('http:rsp:v1:movies:GET:abc', { v: 1 }, 60);
    await cacheManager.set('http:rsp:v1:movies:GET:def', { v: 1 }, 60);
    await cacheManager.set('http:rsp:v1:magazine:GET:ghi', { v: 1 }, 60);
    const n = await invalidateResponseCacheByTag(cacheManager, 'movies');
    expect(n).toBe(2);
    expect(cacheManager.__store.has('http:rsp:v1:magazine:GET:ghi')).toBe(true);
  });

  it('événement magazine_updated → tag magazine', async () => {
    const cacheManager = mockCacheManager();
    await cacheManager.set('http:rsp:v1:magazine:GET:x', { v: 1 }, 60);
    const n = await invalidateResponseCacheByEvent(cacheManager, 'magazine_updated');
    expect(n).toBe(1);
  });

  it('événement public_lists purge plusieurs tags', async () => {
    const cacheManager = mockCacheManager();
    await cacheManager.set('http:rsp:v1:movies:GET:a', { v: 1 }, 60);
    await cacheManager.set('http:rsp:v1:radio:GET:b', { v: 1 }, 60);
    const n = await invalidateResponseCacheByEvent(cacheManager, 'public_lists');
    expect(n).toBe(2);
  });
});
