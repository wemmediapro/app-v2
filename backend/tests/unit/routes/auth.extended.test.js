/**
 * Couverture étendue auth.js : 503 admin, compte inactif, logout + blacklist, change-password, user-data.
 */
const mockSave = jest.fn().mockResolvedValue(undefined);
const mockComparePassword = jest.fn().mockResolvedValue(true);

jest.mock('../../../src/models/User', () => {
  function MockUser(data) {
    return {
      ...data,
      _id: data?._id || '507f1f77bcf86cd799439011',
      save: mockSave,
      toObject() {
        return { ...this };
      },
      comparePassword: mockComparePassword,
      markModified: jest.fn(),
    };
  }
  MockUser.findOne = jest.fn().mockReturnValue({
    select: jest.fn().mockReturnValue(Promise.resolve(null)),
  });
  MockUser.findById = jest.fn();
  return MockUser;
});

const mockCacheManager = {
  isConnected: false,
  get: jest.fn(),
  set: jest.fn(),
};
jest.mock('../../../src/lib/cache-manager', () => mockCacheManager);
jest.mock('../../../src/lib/logger', () => ({ logFailedLogin: jest.fn(), logApiError: jest.fn() }));
jest.mock('../../../src/services/auditService', () => ({
  logAction: jest.fn().mockResolvedValue(null),
}));

const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const authRouter = require('../../../src/routes/auth');
const { generateToken } = require('../../../src/middleware/auth');
const User = require('../../../src/models/User');

function mockFindByIdChain(userDoc) {
  const doc = {
    ...userDoc,
    toObject() {
      return { ...this };
    },
    save: mockSave,
    markModified: jest.fn(),
  };
  const withLean = {
    lean: jest.fn().mockResolvedValue(doc),
    then(resolve, reject) {
      return Promise.resolve(doc).then(resolve, reject);
    },
  };
  return {
    select: jest.fn().mockReturnValue(withLean),
    then(resolve, reject) {
      return Promise.resolve(doc).then(resolve, reject);
    },
  };
}

/** Réponse authMiddleware : findById → select(-password) → lean */
function authUserDbQuery() {
  return {
    select: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: '507f1f77bcf86cd799439011',
        email: 'u@test.com',
        role: 'user',
        isActive: true,
      }),
    }),
  };
}

function mockFindOneChain(resolvedValue) {
  return {
    select: jest.fn().mockReturnValue(Promise.resolve(resolvedValue)),
  };
}

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/auth', authRouter);

describe('API Auth (étendu)', () => {
  const origAdminEmail = process.env.ADMIN_EMAIL;
  const origAdminPassword = process.env.ADMIN_PASSWORD;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSave.mockResolvedValue(undefined);
    mockComparePassword.mockResolvedValue(true);
    process.env.ADMIN_EMAIL = 'admin@test.com';
    process.env.ADMIN_PASSWORD = 'AdminStrong1!@#';
    mockCacheManager.isConnected = false;
    // clearAllMocks retire les implémentations — rétablir le flux Mongo pour authMiddleware
    User.findById.mockReturnValue(authUserDbQuery());
  });

  afterAll(() => {
    process.env.ADMIN_EMAIL = origAdminEmail;
    process.env.ADMIN_PASSWORD = origAdminPassword;
  });

  describe('POST /api/auth/login', () => {
    it('500 si ADMIN_EMAIL / ADMIN_PASSWORD non configurés', async () => {
      process.env.ADMIN_EMAIL = '';
      process.env.ADMIN_PASSWORD = '';
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'x@test.com', password: 'whatever1' });
      expect(res.status).toBe(500);
      expect(res.body.message).toMatch(/ADMIN_EMAIL|ADMIN_PASSWORD|configuration|config/i);
    });

    it('401 si compte désactivé', async () => {
      User.findOne.mockReturnValue(
        mockFindOneChain({
          _id: '507f1f77bcf86cd799439011',
          email: 'u@test.com',
          isActive: false,
          comparePassword: mockComparePassword,
          save: mockSave,
        })
      );
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'u@test.com', password: 'pass' });
      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/désactivé|deactivated/i);
    });

    it('401 mot de passe invalide pour utilisateur existant', async () => {
      mockComparePassword.mockResolvedValue(false);
      User.findOne.mockReturnValue(
        mockFindOneChain({
          _id: '507f1f77bcf86cd799439011',
          email: 'u@test.com',
          role: 'user',
          isActive: true,
          comparePassword: mockComparePassword,
          save: mockSave,
        })
      );
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'u@test.com', password: 'wrong' });
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('blackliste le JWT dans Redis si connecté', async () => {
      mockCacheManager.isConnected = true;
      mockCacheManager.get.mockResolvedValue(null);
      mockCacheManager.set.mockResolvedValue(undefined);
      const token = generateToken({ id: '507f1f77bcf86cd799439011', email: 'u@test.com', role: 'user' });
      await request(app).post('/api/auth/logout').set('Cookie', `authToken=${token}`).expect(200);
      expect(mockCacheManager.set).toHaveBeenCalled();
      const key = mockCacheManager.set.mock.calls.find((c) => String(c[0]).startsWith('blacklist:'));
      expect(key).toBeDefined();
    });
  });

  describe('PUT /api/auth/change-password', () => {
    it('400 si champs manquants', async () => {
      const token = generateToken({ id: '507f1f77bcf86cd799439011', email: 'u@test.com', role: 'user' });
      const res = await request(app)
        .put('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(400);
    });

    it('400 si nouveau mot de passe trop court', async () => {
      const token = generateToken({ id: '507f1f77bcf86cd799439011', email: 'u@test.com', role: 'user' });
      const res = await request(app)
        .put('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'oldpass12', newPassword: 'short' });
      expect(res.status).toBe(400);
    });

    it('200 si mot de passe actuel valide', async () => {
      mockComparePassword.mockResolvedValue(true);
      User.findById
        .mockReturnValueOnce(authUserDbQuery())
        .mockReturnValueOnce({
          select: jest.fn().mockResolvedValue({
            _id: '507f1f77bcf86cd799439011',
            comparePassword: mockComparePassword,
            save: mockSave,
            mustChangePassword: true,
            password: 'hashed',
          }),
        });
      const token = generateToken({ id: '507f1f77bcf86cd799439011', email: 'u@test.com', role: 'user' });
      const res = await request(app)
        .put('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'oldpass12', newPassword: 'newpass12' });
      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/succès|success|modifié/i);
    });
  });

  describe('GET/PUT /api/auth/user-data', () => {
    it('GET 200 avec favoris par défaut', async () => {
      const token = generateToken({ id: '507f1f77bcf86cd799439011', email: 'u@test.com', role: 'user' });
      User.findById
        .mockReturnValueOnce(authUserDbQuery())
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue({
              userData: {},
            }),
          }),
        });
      const res = await request(app)
        .get('/api/auth/user-data')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body).toHaveProperty('favorites');
      expect(res.body).toHaveProperty('playbackPositions');
    });

    it('PUT 200 enregistre favoris', async () => {
      const token = generateToken({ id: '507f1f77bcf86cd799439011', email: 'u@test.com', role: 'user' });
      const u = {
        _id: '507f1f77bcf86cd799439011',
        userData: { favorites: {}, playbackPositions: {} },
        markModified: jest.fn(),
        save: mockSave,
      };
      User.findById
        .mockReturnValueOnce(authUserDbQuery())
        .mockImplementation(() => ({
          then(onF, onR) {
            return Promise.resolve(u).then(onF, onR);
          },
        }));
      const res = await request(app)
        .put('/api/auth/user-data')
        .set('Authorization', `Bearer ${token}`)
        .send({
          favorites: { magazineIds: ['a', 'b'] },
          playbackPositions: { x: 1 },
        });
      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/saved|enregistré/i);
    });
  });

  describe('POST /api/auth/register', () => {
    it('400 mot de passe faible si role admin dans le body', async () => {
      const adminToken = generateToken({ id: 'admin-id', email: 'admin@test.com', role: 'admin' });
      User.findOne.mockResolvedValue(null);
      User.findById.mockReturnValue(mockFindByIdChain({ _id: 'admin-id', role: 'admin', isActive: true }));
      const res = await request(app)
        .post('/api/auth/register')
        .set('Cookie', `authToken=${adminToken}`)
        .send({
          firstName: 'A',
          lastName: 'B',
          email: 'weakadmin@test.com',
          password: 'weak',
          role: 'admin',
        });
      expect(res.status).toBe(400);
    });
  });
});
