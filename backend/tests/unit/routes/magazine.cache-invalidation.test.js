/**
 * Après mutation magazine, invalidation Redis list:magazine:* (aligné sur shop).
 */
process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-chars!!';

const mockDelPattern = jest.fn().mockResolvedValue(0);

jest.mock('../../../src/lib/cache-manager', () => ({
  isConnected: true,
  get: jest.fn(),
  set: jest.fn(),
  delPattern: (...args) => mockDelPattern(...args),
}));

jest.mock('../../../src/models/Article', () => ({
  create: jest.fn(),
}));

jest.mock('../../../src/models/User', () => ({
  findById: jest.fn(),
}));

const mongoose = require('mongoose');
const request = require('supertest');
const express = require('express');

const magazineRouter = require('../../../src/routes/magazine');
const User = require('../../../src/models/User');
const Article = require('../../../src/models/Article');
const { generateToken } = require('../../../src/middleware/auth');

const createdDoc = {
  toObject() {
    return {
      _id: '507f1f77bcf86cd799439099',
      title: 'Titre test',
      category: 'Actualités',
      content: 'Contenu',
      readingTime: 1,
    };
  },
};

describe('Magazine — invalidation cache liste', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    Article.create.mockResolvedValue(createdDoc);
    mongoose.connection.readyState = 1;
    User.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: '507f1f77bcf86cd799439011',
          email: 'admin@test.com',
          role: 'admin',
        }),
      }),
    });
    app = express();
    app.use(express.json({ limit: '2mb' }));
    app.use('/api/magazine', magazineRouter);
  });

  it('POST /api/magazine appelle delPattern(list:magazine:*) après création', async () => {
    const token = generateToken({
      id: '507f1f77bcf86cd799439011',
      email: 'admin@test.com',
      role: 'admin',
    });
    await request(app)
      .post('/api/magazine')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Titre test',
        category: 'Actualités',
        content: 'Contenu article',
        imageUrl: 'https://example.com/cover.png',
        status: 'draft',
      })
      .expect(201);

    expect(mockDelPattern).toHaveBeenCalledWith('list:magazine:*');
  });
});
