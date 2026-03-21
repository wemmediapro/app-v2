/**
 * Rate limit dédié export snapshot : 5 / heure par défaut (ici max: 2 pour le test).
 */
const express = require('express');
const request = require('supertest');
const { createExportSnapshotLimiter } = require('../../../src/routes/export');

describe('export snapshot — rate limit middleware', () => {
  it('bloque au-delà de max avec message clair et en-têtes standard', async () => {
    const app = express();
    app.set('trust proxy', true);
    const limiter = createExportSnapshotLimiter({
      max: 2,
      windowMs: 60_000,
      skip: () => false,
    });
    app.get('/x', limiter, (req, res) => res.json({ ok: true }));

    await request(app).get('/x').expect(200);
    await request(app).get('/x').expect(200);
    const res = await request(app).get('/x');
    expect(res.status).toBe(429);
    expect(res.body).toMatchObject({
      success: false,
      code: 'EXPORT_RATE_LIMIT',
    });
    expect(res.body.message).toMatch(/export/i);
    expect(res.headers['ratelimit-limit']).toBeDefined();
  });
});
