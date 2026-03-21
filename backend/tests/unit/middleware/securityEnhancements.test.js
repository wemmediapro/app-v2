const request = require('supertest');
const express = require('express');
const { securityEnhancementsHeaders } = require('../../../src/middleware/securityEnhancements');

describe('securityEnhancements', () => {
  test('ajoute Permissions-Policy', async () => {
    const app = express();
    app.use(securityEnhancementsHeaders());
    app.get('/t', (_req, res) => res.send('ok'));
    const res = await request(app).get('/t');
    expect(res.status).toBe(200);
    expect(res.headers['permissions-policy']).toContain('geolocation=()');
  });
});
