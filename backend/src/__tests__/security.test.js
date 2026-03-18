/**
 * Tests de sécurité — à lancer avec: npm test -- src/__tests__/security.test.js
 * Vérifie : masquage des secrets dans les logs, AppError, CSRF (403 sans token), validation JWT (config).
 */

const express = require('express');
const cookieParser = require('cookie-parser');
const request = require('supertest');
const { redact } = require('../lib/logger');
const { AppError } = require('../lib/AppError');
const { csrfCookie, csrfProtection } = require('../middleware/csrf');

describe('Security', () => {
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

  // JWT_SECRET ≥ 32 chars : vérifié au démarrage dans backend/src/config/index.js
  // Pour tester : JWT_SECRET=short NODE_ENV=production node server.js → doit exit 1

  describe('CSRF', () => {
    /** App minimale : cookieParser + csrfCookie + csrfProtection sur /api, POST /api/csrf-test non exempté */
    function buildApp() {
      const app = express();
      app.use(express.json());
      app.use(cookieParser());
      app.use('/api', csrfCookie);
      app.use('/api', csrfProtection);
      app.post('/api/csrf-test', (req, res) => res.status(200).json({ ok: true }));
      return app;
    }

    it('retourne 403 sur POST sans token CSRF (ni cookie ni header)', async () => {
      const app = buildApp();
      const res = await request(app)
        .post('/api/csrf-test')
        .send({})
        .expect(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid CSRF token');
      expect(res.body.code).toBe('CSRF_INVALID');
    });

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
});
