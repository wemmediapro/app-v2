/**
 * Tests API WebTV — chaînes, accès protégé (sans MongoDB : fallback ou 503).
 */
const request = require('supertest');
const express = require('express');
const webtvRouter = require('../webtv');

const app = express();
app.use(express.json());
app.use('/api/webtv', webtvRouter);

describe('API WebTV', () => {
  describe('GET /api/webtv/channels', () => {
    it('retourne 200 et un tableau (vide si DB indisponible)', async () => {
      const res = await request(app)
        .get('/api/webtv/channels')
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('accepte ?lang= pour localisation', async () => {
      const res = await request(app)
        .get('/api/webtv/channels?lang=fr')
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /api/webtv/channels/:id', () => {
    it('retourne 503 si base indisponible ou 404 si chaîne inexistante', async () => {
      const res = await request(app)
        .get('/api/webtv/channels/507f1f77bcf86cd799439011');
      expect([503, 404]).toContain(res.status);
      if (res.status === 503) {
        expect(res.body).toHaveProperty('message');
      }
    });
  });

  describe('POST /api/webtv/channels/:id/translate', () => {
    it('retourne 401 sans token', async () => {
      await request(app)
        .post('/api/webtv/channels/507f1f77bcf86cd799439011/translate')
        .send({ name: 'Test', description: 'Desc' })
        .expect(401);
    });
  });

  describe('POST /api/webtv/translate', () => {
    it('retourne 401 sans token', async () => {
      await request(app)
        .post('/api/webtv/translate')
        .send({ name: 'Test', description: 'Desc' })
        .expect(401);
    });
  });

  describe('POST /api/webtv/channels', () => {
    it('retourne 401 sans token', async () => {
      await request(app)
        .post('/api/webtv/channels')
        .send({ name: 'Chaîne', streamUrl: 'https://example.com/stream' })
        .expect(401);
    });
  });

  describe('PUT /api/webtv/channels/:id', () => {
    it('retourne 401 sans token', async () => {
      await request(app)
        .put('/api/webtv/channels/507f1f77bcf86cd799439011')
        .send({ name: 'Chaîne mise à jour' })
        .expect(401);
    });
  });

  describe('DELETE /api/webtv/channels/:id', () => {
    it('retourne 401 sans token', async () => {
      await request(app)
        .delete('/api/webtv/channels/507f1f77bcf86cd799439011')
        .expect(401);
    });
  });
});
