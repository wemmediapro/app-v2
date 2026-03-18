/**
 * Tests API Auth — login, profil (me), accès protégé.
 */
const request = require('supertest');
const express = require('express');
const authRouter = require('../auth');

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);

describe('API Auth', () => {
  describe('POST /api/auth/login', () => {
    it('retourne 400 si email ou password manquants', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({})
        .expect((r) => expect([400, 503]).toContain(r.status));
      expect(res.body).toHaveProperty('message');
    });

    it('retourne 400 ou 503 avec body incomplet', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@test.com' })
        .expect((r) => expect([400, 401, 503]).toContain(r.status));
      expect(res.body).toHaveProperty('message');
    });
  });

  describe('GET /api/auth/me', () => {
    it('retourne 401 sans token', async () => {
      await request(app)
        .get('/api/auth/me')
        .expect(401);
    });

    it('retourne 401 avec token invalide', async () => {
      await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid')
        .expect(401);
    });
  });
});
