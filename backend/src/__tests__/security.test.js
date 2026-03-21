/**
 * Tests de sécurité — à lancer avec: npm test -- src/__tests__/security.test.js
 * Vérifie : validation entrées, CSRF, logs (pas de secrets), AppError, helpers.
 */

jest.mock('../lib/cache-manager', () => ({ isConnected: false, get: jest.fn(), set: jest.fn() }));

jest.mock('../models/User', () => ({
  findById: jest.fn(),
  find: jest.fn(),
  countDocuments: jest.fn(),
  findOne: jest.fn(),
}));

const crypto = require('crypto');
const express = require('express');
const cookieParser = require('cookie-parser');
const request = require('supertest');

const logger = require('../lib/logger');
const { redact, hashEmailForLog, redactEmail, logFailedLogin } = logger;
const { AppError } = require('../lib/AppError');
const { csrfCookie, csrfProtection, csrfTokensEqual } = require('../middleware/csrf');
const { generateToken } = require('../middleware/auth');
const adminRouter = require('../routes/admin');
const usersRouter = require('../routes/users');

function buildSecurityRoutesApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api', csrfCookie);
  app.use('/api', csrfProtection);
  app.use('/api/admin', adminRouter);
  app.use('/api/users', usersRouter);
  return app;
}

describe('Security Tests', () => {
  const User = require('../models/User');
  const validAdminToken = generateToken({
    id: '507f1f77bcf86cd799439011',
    email: 'admin@test.com',
    role: 'admin',
  });
  const validUserToken = generateToken({
    id: '507f1f77bcf86cd799439012',
    email: 'user@test.com',
    role: 'passenger',
  });

  beforeEach(() => {
    jest.clearAllMocks();
    User.findById.mockImplementation((id) => ({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: id,
          email: 'u@test.com',
          role: String(id).endsWith('12') ? 'passenger' : 'admin',
          isActive: true,
        }),
      }),
    }));
    User.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
        }),
      }),
    });
    User.countDocuments.mockResolvedValue(0);
  });

  describe('Input Validation', () => {
    it('rejette les IDs MongoDB invalides (400 INVALID_ID)', async () => {
      const app = buildSecurityRoutesApp();
      const res = await request(app).get('/api/users/invalid-id').set('Authorization', `Bearer ${validUserToken}`);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_ID');
    });

    it('plafonne la pagination à max 100 éléments (req.pagination.limit)', async () => {
      const app = buildSecurityRoutesApp();
      const res = await request(app)
        .get('/api/users?limit=999999&page=1')
        .set('Authorization', `Bearer ${validUserToken}`);

      expect(res.status).toBe(200);
      expect(res.body.limit).toBe(100);
    });

    it('plafonne page à 10000', async () => {
      const app = buildSecurityRoutesApp();
      const res = await request(app)
        .get('/api/users?page=999999&limit=10')
        .set('Authorization', `Bearer ${validUserToken}`);

      expect(res.status).toBe(200);
      expect(res.body.page).toBe(10000);
    });

    it('gère les chaînes type injection / regex dans search sans erreur 500', async () => {
      const app = buildSecurityRoutesApp();
      const payload = encodeURIComponent('*.*+?^${}()|[\\\\]');
      const res = await request(app)
        .get(`/api/users?search=${payload}`)
        .set('Authorization', `Bearer ${validUserToken}`);

      expect(res.status).not.toBe(500);
      expect(res.status).toBe(200);
    });
  });

  describe('CSRF Protection', () => {
    function buildApp() {
      const app = express();
      app.use(express.json());
      app.use(cookieParser());
      app.use('/api', csrfCookie);
      app.use('/api', csrfProtection);
      app.post('/api/csrf-test', (req, res) => res.status(200).json({ ok: true }));
      return app;
    }

    it('rejette les requêtes avec tokens CSRF non concordants (cookie ≠ header)', async () => {
      const app = buildApp();
      const res = await request(app)
        .post('/api/csrf-test')
        .set('Cookie', 'csrfToken=token1')
        .set('X-CSRF-Token', 'token2')
        .send({});

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('CSRF_INVALID');
    });

    it('retourne 403 sur POST sans token CSRF (ni cookie ni header)', async () => {
      const app = buildApp();
      const res = await request(app).post('/api/csrf-test').send({}).expect(403);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('CSRF_INVALID');
    });

    it('retourne 200 sur POST avec cookie et header X-CSRF-Token valides', async () => {
      const app = buildApp();
      const getRes = await request(app).get('/api/any');
      const cookie = getRes.headers['set-cookie'];
      const tokenMatch = getRes.headers['set-cookie']?.[0]?.match(/csrfToken=([^;]+)/);
      const token = tokenMatch ? decodeURIComponent(tokenMatch[1]) : null;
      expect(token).toBeTruthy();
      const res = await request(app)
        .post('/api/csrf-test')
        .set('Cookie', cookie || [])
        .set('x-csrf-token', token)
        .send({})
        .expect(200);
      expect(res.body.ok).toBe(true);
    });
  });

  describe('Logging Security', () => {
    it('ne log pas le mot de passe en clair via logFailedLogin', () => {
      const spy = jest.spyOn(logger, 'warn').mockImplementation(() => {});
      logFailedLogin('test@test.com', 'invalid_password', null);
      expect(spy).toHaveBeenCalled();
      const payload = spy.mock.calls[0][0];
      expect(JSON.stringify(payload)).not.toContain('secret123');
      expect(Object.keys(payload)).not.toContain('password');
      expect(payload.email).toBeUndefined();
      expect(payload.emailHash).toBeDefined();
      spy.mockRestore();
    });

    it('redact masque password dans les objets de log', () => {
      const obj = { email: 'a@b.com', password: 'secret123', token: 'x' };
      const out = redact(obj);
      expect(out.password).toBe('[REDACTED]');
      expect(JSON.stringify(out)).not.toContain('secret123');
    });
  });
});

describe('Security (helpers)', () => {
  describe('redact()', () => {
    it('masque les champs sensibles dans un objet', () => {
      const obj = { email: 'a@b.com', password: 'secret123', token: 'jwt-xxx' };
      const out = redact(obj);
      expect(out.email).toBe('a@b.com');
      expect(out.password).toBe('[REDACTED]');
      expect(out.token).toBe('[REDACTED]');
    });

    it('masque les champs sensibles en profondeur', () => {
      const obj = { body: { password: 'pwd', name: 'John' } };
      const out = redact(obj);
      expect(out.body.password).toBe('[REDACTED]');
      expect(out.body.name).toBe('John');
    });

    it('ne modifie pas les objets sans champs sensibles', () => {
      const obj = { page: 1, limit: 20 };
      expect(redact(obj)).toEqual(obj);
    });
  });

  describe('logFailedLogin / hashEmailForLog (pas d’email en clair)', () => {
    it('hashEmailForLog est déterministe et ne contient pas l’email', () => {
      const h1 = hashEmailForLog('User@Example.com');
      const h2 = hashEmailForLog('user@example.com');
      expect(h1).toBe(h2);
      expect(h1).toHaveLength(16);
      expect(h1).toMatch(/^[0-9a-f]{16}$/);
      expect(h1).not.toContain('user');
      expect(h1).not.toContain('@');
    });

    it('hashEmailForLog traite absent comme unknown', () => {
      expect(hashEmailForLog('')).toBe(hashEmailForLog(null));
      expect(hashEmailForLog(undefined)).toBe(hashEmailForLog(null));
    });

    it('redactEmail masque local et domaine', () => {
      expect(redactEmail('alice@example.com')).toMatch(/^al\*+@\*+$/);
      expect(redactEmail('ab')).toBe('***');
    });

    it('logFailedLogin n’écrit jamais l’email en clair', () => {
      const spy = jest.spyOn(logger, 'warn').mockImplementation(() => {});
      logFailedLogin('victim@company.test', 'invalid_password', null);
      expect(spy).toHaveBeenCalled();
      const payload = spy.mock.calls[0][0];
      expect(payload.event).toBe('auth_failed_login');
      expect(payload.email).toBeUndefined();
      expect(payload.emailHash).toBeDefined();
      expect(payload.emailHash).toHaveLength(16);
      expect(JSON.stringify(payload)).not.toContain('victim');
      expect(JSON.stringify(payload)).not.toContain('company.test');
      spy.mockRestore();
    });
  });

  describe('AppError', () => {
    it('expose statusCode et code', () => {
      const err = new AppError('Invalid ID', 400, 'INVALID_ID');
      expect(err.message).toBe('Invalid ID');
      expect(err.statusCode).toBe(400);
      expect(err.code).toBe('INVALID_ID');
      expect(err).toBeInstanceOf(Error);
    });

    it('valeurs par défaut', () => {
      const err = new AppError('Oops');
      expect(err.statusCode).toBe(500);
      expect(err.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('CSRF (détail middleware)', () => {
    function buildApp() {
      const app = express();
      app.use(express.json());
      app.use(cookieParser());
      app.use('/api', csrfCookie);
      app.use('/api', csrfProtection);
      app.post('/api/csrf-test', (req, res) => res.status(200).json({ ok: true }));
      return app;
    }

    it('retourne 403 sur POST avec cookie CSRF mais sans header X-CSRF-Token', async () => {
      const app = buildApp();
      const getRes = await request(app).get('/api/any').expect(404);
      const cookie = getRes.headers['set-cookie'];
      const res = await request(app)
        .post('/api/csrf-test')
        .set('Cookie', cookie || [])
        .send({})
        .expect(403);
      expect(res.body.code).toBe('CSRF_INVALID');
    });

    it('retourne 403 sur POST avec header X-CSRF-Token incorrect (timing-safe)', async () => {
      const app = buildApp();
      const getRes = await request(app).get('/api/any');
      const cookie = getRes.headers['set-cookie'];
      const res = await request(app)
        .post('/api/csrf-test')
        .set('Cookie', cookie || [])
        .set('x-csrf-token', 'wrong-token-value')
        .send({})
        .expect(403);
      expect(res.body.code).toBe('CSRF_INVALID');
    });

    describe('CSRF middleware - timing safe comparison', () => {
      it('rejette les tokens invalides (même longueur) sans comparaison chaîne ===', () => {
        const validToken = 'a'.repeat(32);
        const invalidToken1 = 'b'.repeat(32);
        const invalidToken2 = 'c' + 'a'.repeat(31);

        expect(csrfTokensEqual(validToken, invalidToken1)).toBe(false);
        expect(csrfTokensEqual(validToken, invalidToken2)).toBe(false);
        expect(csrfTokensEqual(validToken, validToken)).toBe(true);
      });

      it('rejette si longueurs différentes (branche dummy timingSafeEqual)', () => {
        expect(csrfTokensEqual('a'.repeat(32), 'a'.repeat(31))).toBe(false);
      });

      it('utilise crypto.timingSafeEqual pour la comparaison (pas une égalité JS)', () => {
        const spy = jest.spyOn(crypto, 'timingSafeEqual');
        csrfTokensEqual('x'.repeat(16), 'y'.repeat(16));
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
      });

      it('rejette invalid tokens sans timing évident à exploiter (ordre de grandeur stable)', () => {
        const validToken = 'a'.repeat(32);
        const invalidToken1 = 'b'.repeat(32);
        const invalidToken2 = 'c' + 'a'.repeat(31);

        const samples = 30;
        const timesInvalid1 = [];
        const timesInvalid2 = [];
        for (let i = 0; i < samples; i++) {
          const t0 = process.hrtime.bigint();
          csrfTokensEqual(validToken, invalidToken1);
          timesInvalid1.push(Number(process.hrtime.bigint() - t0));
          const t1 = process.hrtime.bigint();
          csrfTokensEqual(validToken, invalidToken2);
          timesInvalid2.push(Number(process.hrtime.bigint() - t1));
        }
        const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
        const mean1 = avg(timesInvalid1);
        const mean2 = avg(timesInvalid2);
        const ratio = mean1 > 0 ? mean2 / mean1 : 1;
        expect(ratio).toBeGreaterThan(0.2);
        expect(ratio).toBeLessThan(5);
      });
    });
  });
});
