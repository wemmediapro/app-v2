const express = require('express');
const request = require('supertest');
const {
  requestContextMiddleware,
  readIncomingCorrelationId,
  shouldSkipHttpAccessLog,
} = require('../../../src/lib/request-context');

describe('request-context', () => {
  it('réutilise X-Correlation-Id entrant et renvoie les en-têtes', async () => {
    const app = express();
    app.use(requestContextMiddleware());
    app.get('/x', (req, res) => {
      expect(req.id).toBe('client-corr-001');
      expect(req.correlationId).toBe('client-corr-001');
      expect(req.log).toBeDefined();
      expect(req.log.bindings().requestId).toBe('client-corr-001');
      expect(req.log.bindings().correlationId).toBe('client-corr-001');
      res.json({ ok: true });
    });
    const res = await request(app).get('/x').set('X-Correlation-Id', 'client-corr-001');
    expect(res.status).toBe(200);
    expect(res.headers['x-request-id']).toBe('client-corr-001');
    expect(res.headers['x-correlation-id']).toBe('client-corr-001');
  });

  it('readIncomingCorrelationId préfère X-Request-Id si les deux sont présents', () => {
    const req = {
      get: (h) => {
        if (h === 'x-request-id') return 'rid-1';
        if (h === 'X-Request-Id') return 'rid-1';
        if (h === 'x-correlation-id') return 'cid-2';
        return undefined;
      },
    };
    expect(readIncomingCorrelationId(req)).toBe('rid-1');
  });

  it('shouldSkipHttpAccessLog ignore /health', () => {
    expect(shouldSkipHttpAccessLog({ path: '/api/v1/health' })).toBe(true);
    expect(shouldSkipHttpAccessLog({ path: '/api/movies' })).toBe(false);
  });
});
