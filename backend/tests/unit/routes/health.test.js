const express = require('express');
const request = require('supertest');
const { HealthChecker, registerHealthRoutes } = require('../../../src/routes/health');

describe('HealthChecker.externalOverall', () => {
  it('healthy si vide', () => {
    expect(HealthChecker.externalOverall({})).toBe('healthy');
  });

  it('degraded si un service unhealthy', () => {
    expect(HealthChecker.externalOverall({ x: { status: 'unhealthy' } })).toBe('degraded');
  });
});

describe('registerHealthRoutes', () => {
  it('GET /health/live retourne alive', async () => {
    const app = express();
    registerHealthRoutes(app, '/api', {
      dbManager: { isConnected: () => false },
      cacheManager: {},
    });
    const res = await request(app).get('/api/health/live');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('alive');
    expect(res.body.apiVersion).toBe('v1');
  });

  it('GET /health/ready 503 si Mongo déconnecté', async () => {
    const app = express();
    registerHealthRoutes(app, '/api', {
      dbManager: { isConnected: () => false },
      cacheManager: {},
    });
    const res = await request(app).get('/api/health/ready');
    expect(res.status).toBe(503);
    expect(res.body.ready).toBe(false);
    expect(res.body.mongodb).toBe('disconnected');
  });

  it('GET /health 503 si Mongo déconnecté (unhealthy)', async () => {
    const app = express();
    registerHealthRoutes(app, '/api', {
      dbManager: { isConnected: () => false },
      cacheManager: {},
    });
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(503);
    expect(res.body.healthOverall).toBe('unhealthy');
    expect(res.body.checks.database.status).toBe('unhealthy');
  });
});

describe('HealthChecker mémoire', () => {
  it('retourne des champs numériques', () => {
    const hc = new HealthChecker({});
    const m = hc.checkMemory();
    expect(m).toHaveProperty('status');
    expect(m).toHaveProperty('heapUsedMB');
    expect(m).toHaveProperty('heapRatioPercent');
  });
});
