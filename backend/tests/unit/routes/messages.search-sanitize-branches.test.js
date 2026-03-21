/**
 * Branches GET /users/search quand sanitizeSearchString retourne '' (pas de $regex email/téléphone).
 * Fichier séparé : le routeur doit charger validateInput mocké.
 */
process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-chars!!';

jest.mock('../../../src/lib/cache-manager', () => ({
  isConnected: false,
  get: jest.fn(),
  set: jest.fn(),
}));

jest.mock('../../../src/middleware/validateInput', () => {
  const actual = jest.requireActual('../../../src/middleware/validateInput');
  return {
    ...actual,
    sanitizeSearchString: jest.fn(() => ''),
  };
});

jest.mock('../../../src/models/User', () => {
  const M = function UserMock() {};
  M.findById = jest.fn();
  M.find = jest.fn();
  return M;
});

const mongoose = require('mongoose');
const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const messagesRouter = require('../../../src/routes/messages');
const User = require('../../../src/models/User');
const { generateToken } = require('../../../src/middleware/auth');

const uid = '507f1f77bcf86cd799439011';

function authUserChain() {
  return {
    select: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: uid,
        email: 'u@test.com',
        role: 'user',
        isActive: true,
        twoFactorEnabled: false,
      }),
    }),
  };
}

describe('GET /api/messages/users/search — sanitize vide', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    mongoose.connection.readyState = 1;
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/api/messages', messagesRouter);
    User.findById.mockImplementation(() => authUserChain());
    User.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue([]),
      }),
    });
  });

  it('n’ajoute pas email au filtre si sanitize retourne vide (chemin @)', async () => {
    const token = generateToken({ id: uid, email: 'u@test.com', role: 'user' });
    await request(app)
      .get('/api/messages/users/search?q=someone@example.com')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(User.find).toHaveBeenCalled();
    const qArg = User.find.mock.calls[0][0];
    expect(qArg.isActive).toBe(true);
    expect(qArg.email).toBeUndefined();
    expect(qArg.phone).toBeUndefined();
  });

  it('n’ajoute pas phone au filtre si sanitize retourne vide (chemin téléphone)', async () => {
    const token = generateToken({ id: uid, email: 'u@test.com', role: 'user' });
    await request(app)
      .get('/api/messages/users/search?q=601020304')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const qArg = User.find.mock.calls[0][0];
    expect(qArg.phone).toBeUndefined();
    expect(qArg.email).toBeUndefined();
  });
});
