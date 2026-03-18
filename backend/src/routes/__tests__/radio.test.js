/**
 * Tests API Radio — stations, listeners.
 * Sans MongoDB : fallback JSON ; avec MongoDB : données réelles.
 */
process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-chars!!';

const request = require('supertest');
const express = require('express');
const radioRouter = require('../radio');
const { generateToken } = require('../../middleware/auth');

const app = express();
app.use(express.json());
app.use('/api/radio', radioRouter);

describe('API Radio', () => {
  describe('GET /api/radio', () => {
    it('retourne 200 et un tableau (stations ou vide)', async () => {
      const res = await request(app)
        .get('/api/radio')
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('accepte ?lang= pour localisation', async () => {
      const res = await request(app)
        .get('/api/radio?lang=fr')
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('accepte ?all=1 pour toutes les stations (dashboard)', async () => {
      const res = await request(app)
        .get('/api/radio?all=1')
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('PATCH /api/radio/:id/listeners', () => {
    it('retourne 400 si action manquante ou invalide', async () => {
      await request(app)
        .patch('/api/radio/abc123/listeners')
        .send({})
        .expect(400);
    });

    it('retourne 400 si action invalide', async () => {
      await request(app)
        .patch('/api/radio/abc123/listeners')
        .send({ action: 'invalid' })
        .expect(400);
    });

    it('accepte action join (404 ou 200 selon fallback/DB)', async () => {
      const res = await request(app)
        .patch('/api/radio/abc123/listeners')
        .send({ action: 'join' });
      expect([200, 404]).toContain(res.status);
      if (res.status === 200) expect(res.body).toHaveProperty('listeners');
    });

    it('accepte action leave', async () => {
      const res = await request(app)
        .patch('/api/radio/abc123/listeners')
        .send({ action: 'leave' });
      expect([200, 404]).toContain(res.status);
      if (res.status === 200) expect(res.body).toHaveProperty('listeners');
    });
  });

  describe('GET /api/radio/:id', () => {
    it('retourne 404 pour id inexistant ou 200 avec station (fallback)', async () => {
      const res = await request(app)
        .get('/api/radio/507f1f77bcf86cd799439011');
      expect([200, 404]).toContain(res.status);
    });
  });

  describe('POST /api/radio', () => {
    it('retourne 401 sans token admin', async () => {
      await request(app)
        .post('/api/radio')
        .send({ name: 'Test Station', streamUrl: 'https://example.com/stream' })
        .expect(401);
    });
  });

  describe('PUT /api/radio/:id', () => {
    it('retourne 401 sans token admin', async () => {
      await request(app)
        .put('/api/radio/abc123')
        .send({ name: 'Updated' })
        .expect(401);
    });
  });

  describe('DELETE /api/radio/:id', () => {
    it('retourne 401 sans token admin', async () => {
      await request(app)
        .delete('/api/radio/abc123')
        .expect(401);
    });
  });

  describe('Admin requis (403 si token user non-admin)', () => {
    it('POST /api/radio retourne 403 avec token user (non admin)', async () => {
      const token = generateToken({ id: 'u1', email: 'user@test.com', role: 'user' });
      await request(app)
        .post('/api/radio')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Station', streamUrl: 'https://example.com' })
        .expect(403);
    });
  });
});
