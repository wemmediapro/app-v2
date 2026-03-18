/**
 * Tests API Messages — conversations, accès protégé.
 */
const request = require('supertest');
const express = require('express');
const messagesRouter = require('../messages');

const app = express();
app.use(express.json());
app.use('/api/messages', messagesRouter);

describe('API Messages', () => {
  describe('GET /api/messages', () => {
    it('retourne 401 sans token', async () => {
      await request(app)
        .get('/api/messages')
        .expect(401);
    });

    it('retourne 401 avec token invalide', async () => {
      await request(app)
        .get('/api/messages')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });
});
