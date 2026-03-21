/**
 * Pagination / IDs : plafonds page et limit (pas de req.query brut dans les handlers).
 */
const express = require('express');
const request = require('supertest');
const { validatePagination, createValidatePagination, handleValidationErrors } = require('../validateInput');

describe('validateInput middleware', () => {
  /**
   *
   */
  function buildApp(extra = {}) {
    const app = express();
    app.get('/list', validatePagination, handleValidationErrors, (req, res) => {
      res.json({ pagination: req.pagination, ...extra });
    });
    return app;
  }

  it('plafonne limit à 100 (même si query demande plus)', async () => {
    const app = buildApp();
    const res = await request(app).get('/list?limit=9999&page=1');
    expect(res.status).toBe(200);
    expect(res.body.pagination.limit).toBe(100);
  });

  it('plafonne page à 10000', async () => {
    const app = buildApp();
    const res = await request(app).get('/list?page=999999&limit=10');
    expect(res.status).toBe(200);
    expect(res.body.pagination.page).toBe(10000);
  });

  it('createValidatePagination définit defaultLimit et respecte le plafond 100', async () => {
    const app = express();
    const v = createValidatePagination({ defaultLimit: 50 });
    app.get('/x', v, handleValidationErrors, (req, res) => {
      res.json(req.pagination);
    });
    const res = await request(app).get('/x');
    expect(res.body.limit).toBe(50);
    const res2 = await request(app).get('/x?limit=200');
    expect(res2.body.limit).toBe(100);
  });
});
