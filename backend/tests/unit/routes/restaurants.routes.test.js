/**
 * GET /api/restaurants — categories, liste (Mongo déconnecté = fallback).
 */
const mongoose = require('mongoose');
const request = require('supertest');
const express = require('express');
const restaurantsRouter = require('../../../src/routes/restaurants');

describe('GET /api/restaurants', () => {
  let app;
  let origReadyState;

  beforeAll(() => {
    app = express();
    app.use('/api/restaurants', restaurantsRouter);
  });

  it('GET /categories/list retourne la liste des catégories', async () => {
    const res = await request(app).get('/api/restaurants/categories/list').expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty('id');
    expect(res.body[0]).toHaveProperty('name');
    expect(res.body[0]).toHaveProperty('icon');
  });

  it('GET / retourne fallback si Mongo déconnecté', async () => {
    origReadyState = mongoose.connection.readyState;
    mongoose.connection.readyState = 0;

    const res = await request(app).get('/api/restaurants').expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    mongoose.connection.readyState = origReadyState;
  });
});
