/**
 * Tests API Radio — stations, listeners.
 * Sans MongoDB : fallback JSON ; avec MongoDB : données réelles.
 */
const request = require('supertest');
const express = require('express');
const radioRouter = require('../radio');

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
  });
});
