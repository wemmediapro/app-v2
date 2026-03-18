/**
 * Tests API Auth — login, register, profil (me), refresh, accès protégé.
 */
process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-chars!!';
process.env.ADMIN_EMAIL = 'admin@test.com';
process.env.ADMIN_PASSWORD = 'adminpass';

const mockSave = jest.fn().mockResolvedValue(undefined);
const mockComparePassword = jest.fn().mockResolvedValue(true);

jest.mock('../../models/User', () => {
  function MockUser(data) {
    return {
      ...data,
      _id: data?._id || '507f1f77bcf86cd799439011',
      save: mockSave,
      toObject() { return { ...this }; },
      comparePassword: mockComparePassword,
    };
  }
  MockUser.findOne = jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue(Promise.resolve(null)) });
  MockUser.create = jest.fn();
  MockUser.findById = jest.fn();
  MockUser.findByIdAndUpdate = jest.fn();
  return MockUser;
});

jest.mock('../../lib/logger', () => ({ logFailedLogin: jest.fn(), logApiError: jest.fn() }));
jest.mock('../../lib/cache-manager', () => ({ isConnected: false, get: jest.fn(), set: jest.fn() }));

/** Chaîne Mongoose findById().select().lean() ou findById().select() / findById() pour les routes */
function mockFindByIdChain(userDoc) {
  const doc = { ...userDoc, toObject: function () { return { ...this }; }, save: mockSave };
  const chain = {
    lean: jest.fn().mockResolvedValue(doc),
    then(resolve, reject) { return Promise.resolve(doc).then(resolve, reject); },
  };
  return {
    select: jest.fn().mockReturnValue(chain),
    then(resolve, reject) { return Promise.resolve(doc).then(resolve, reject); },
  };
}

/** Chaîne findOne().select('+password') pour le login (password à select: false dans le schéma) */
function mockFindOneChain(resolvedValue) {
  return {
    select: jest.fn().mockReturnValue(Promise.resolve(resolvedValue)),
  };
}

const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const authRouter = require('../auth');
const { generateToken } = require('../../middleware/auth');
const User = require('../../models/User');

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/auth', authRouter);

describe('API Auth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSave.mockResolvedValue(undefined);
    mockComparePassword.mockResolvedValue(true);
  });

  describe('POST /api/auth/register', () => {
    it('retourne 401 sans token admin', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ firstName: 'A', lastName: 'B', email: 'a@b.com', password: 'password123' })
        .expect(401);
      expect(res.body).toHaveProperty('message');
    });

    it('retourne 201 et user + cookie authToken avec token admin (SEC-4: pas de token dans le body)', async () => {
      const adminToken = generateToken({ id: 'admin-id', email: 'admin@test.com', role: 'admin' });
      User.findOne.mockResolvedValue(null);
      User.findById.mockReturnValue(mockFindByIdChain({ _id: 'admin-id', role: 'admin', isActive: true }));
      const res = await request(app)
        .post('/api/auth/register')
        .set('Cookie', `authToken=${adminToken}`)
        .send({
          firstName: 'John',
          lastName: 'Doe',
          email: 'new@test.com',
          password: 'password123',
        })
        .expect(201);
      expect(res.body).not.toHaveProperty('token');
      expect(res.headers['set-cookie']).toBeDefined();
      expect(res.headers['set-cookie'].some((c) => c.startsWith('authToken='))).toBe(true);
      expect(res.body).toHaveProperty('user');
      expect(res.body.user.email).toBe('new@test.com');
    });

    it('retourne 400 si email déjà utilisé (avec token admin)', async () => {
      const adminToken = generateToken({ id: 'admin-id', email: 'admin@test.com', role: 'admin' });
      User.findOne.mockResolvedValue({ _id: 'existing' });
      User.findById.mockReturnValue(mockFindByIdChain({ _id: 'admin-id', role: 'admin', isActive: true }));
      await request(app)
        .post('/api/auth/register')
        .set('Cookie', `authToken=${adminToken}`)
        .send({
          firstName: 'John',
          lastName: 'Doe',
          email: 'existing@test.com',
          password: 'password123',
        })
        .expect(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('retourne 400 si email ou password manquants', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({})
        .expect((r) => expect([400, 503]).toContain(r.status));
      expect(res.body).toHaveProperty('message');
    });

    it('retourne 401 si utilisateur non trouvé ou mot de passe invalide', async () => {
      User.findOne.mockReturnValue(mockFindOneChain(null));
      await request(app)
        .post('/api/auth/login')
        .send({ email: 'unknown@test.com', password: 'wrong' })
        .expect(401);
    });

    it('retourne 200 + cookie authToken (SEC-4: pas de token dans le body)', async () => {
      const fakeUser = {
        _id: '507f1f77bcf86cd799439011',
        email: 'user@test.com',
        firstName: 'User',
        lastName: 'Test',
        role: 'user',
        isActive: true,
        save: mockSave,
        comparePassword: mockComparePassword,
      };
      User.findOne.mockReturnValue(mockFindOneChain(fakeUser));
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'user@test.com', password: 'validpass' })
        .expect(200);
      expect(res.body).not.toHaveProperty('token');
      expect(res.headers['set-cookie']).toBeDefined();
      expect(res.headers['set-cookie'].some((c) => c.startsWith('authToken='))).toBe(true);
      expect(res.body).toHaveProperty('user');
    });
  });

  describe('GET /api/auth/me', () => {
    it('retourne 401 sans token', async () => {
      await request(app)
        .get('/api/auth/me')
        .expect(401);
    });

    it('retourne 401 avec token invalide', async () => {
      await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid')
        .expect(401);
    });

    it('retourne 200 + user avec token valide', async () => {
      const token = generateToken({ id: '507f1f77bcf86cd799439011', email: 'u@test.com', role: 'user' });
      const fakeUser = {
        _id: '507f1f77bcf86cd799439011',
        email: 'u@test.com',
        firstName: 'U',
        lastName: 'T',
        role: 'user',
        mustChangePassword: false,
      };
      User.findById.mockReturnValue(mockFindByIdChain(fakeUser));
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body).toHaveProperty('email', 'u@test.com');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('retourne 200 et message de déconnexion', async () => {
      const res = await request(app)
        .post('/api/auth/logout')
        .expect(200);
      expect(res.body).toHaveProperty('message');
      expect(res.body.message).toMatch(/logout|déconnexion|success/i);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('retourne 401 sans token', async () => {
      await request(app)
        .post('/api/auth/refresh')
        .expect(401);
    });

    it('retourne 200 + cookie authToken (SEC-4: pas de token dans le body)', async () => {
      const token = generateToken({ id: '507f1f77bcf86cd799439011', email: 'u@test.com', role: 'user' });
      const fakeUser = { _id: '507f1f77bcf86cd799439011', email: 'u@test.com', role: 'user', isActive: true };
      User.findById.mockReturnValue(mockFindByIdChain(fakeUser));
      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body).not.toHaveProperty('token');
      expect(res.headers['set-cookie']).toBeDefined();
      expect(res.headers['set-cookie'].some((c) => c.startsWith('authToken='))).toBe(true);
      expect(res.body).toHaveProperty('message');
    });
  });

  describe('PUT /api/auth/profile', () => {
    it('retourne 401 sans token', async () => {
      await request(app)
        .put('/api/auth/profile')
        .send({ firstName: 'New' })
        .expect(401);
    });

    it('retourne 200 et user mis à jour avec token valide', async () => {
      const token = generateToken({ id: '507f1f77bcf86cd799439011', email: 'u@test.com', role: 'user' });
      const savedUser = {
        _id: '507f1f77bcf86cd799439011',
        email: 'u@test.com',
        firstName: 'Updated',
        lastName: 'T',
        phone: '',
        cabinNumber: '',
        country: '',
        dateOfBirth: null,
        preferences: {},
      };
      User.findById.mockReturnValue(mockFindByIdChain(savedUser));
      const res = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ firstName: 'Updated' })
        .expect(200);
      expect(res.body).toHaveProperty('user');
      expect(res.body.user.firstName).toBe('Updated');
    });
  });

  describe('PUT /api/auth/change-password', () => {
    it('retourne 401 sans token', async () => {
      await request(app)
        .put('/api/auth/change-password')
        .send({ currentPassword: 'old', newPassword: 'new' })
        .expect(401);
    });
  });
});
