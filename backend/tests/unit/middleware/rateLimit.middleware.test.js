const express = require('express');
const request = require('supertest');
const rateLimit = require('express-rate-limit');

describe('express-rate-limit (comportement middleware)', () => {
  it('bloque après N requêtes depuis la même IP', async () => {
    const app = express();
    app.set('trust proxy', false);
    const limiter = rateLimit({
      windowMs: 60_000,
      max: 2,
      standardHeaders: false,
      legacyHeaders: false,
    });
    app.get('/ping', limiter, (req, res) => res.send('ok'));

    await request(app).get('/ping').expect(200);
    await request(app).get('/ping').expect(200);
    const res = await request(app).get('/ping');
    expect(res.status).toBe(429);
  });
});
