/**
 * Credentials admin : 500 si config absente, 403 admin@gnv.com en prod,
 * ancien mot de passe refusé après changement.
 */
const mockSave = jest.fn().mockResolvedValue(undefined);

jest.mock('../../../src/models/User', () => {
  const mockComparePassword = jest.fn();
  function MockUser(data) {
    return {
      ...data,
      _id: data?._id || '507f1f77bcf86cd799439011',
      save: mockSave,
      toObject() {
        return { ...this };
      },
      comparePassword: mockComparePassword,
    };
  }
  MockUser.findOne = jest.fn();
  MockUser.create = jest.fn();
  MockUser.findById = jest.fn();
  MockUser.findByIdAndUpdate = jest.fn();
  MockUser._mockComparePassword = mockComparePassword;
  return MockUser;
});

jest.mock('../../../src/lib/logger', () => ({
  logFailedLogin: jest.fn(),
  error: jest.fn(),
}));
jest.mock('../../../src/lib/cache-manager', () => ({
  isConnected: false,
  get: jest.fn(),
  set: jest.fn(),
}));

jest.mock('../../../src/services/auditService', () => ({
  logAction: jest.fn().mockResolvedValue(null),
}));

const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');

/** Réassigné après chaque resetModules() pour cibler le même mock que le routeur auth. */
let User;

function mockFindOneChain(resolvedValue) {
  return {
    select: jest.fn().mockReturnValue(Promise.resolve(resolvedValue)),
  };
}

/** findById().select('-password').lean() (authMiddleware) et .select('+password') (change-password). */
function mockFindByIdFlexible(userDoc) {
  const u = {
    ...userDoc,
    save: mockSave,
    comparePassword: userDoc.comparePassword || User._mockComparePassword,
  };
  const forLean = { ...u };
  delete forLean.password;
  delete forLean.comparePassword;
  return {
    select(sel) {
      if (sel === '-password') {
        return {
          lean: jest.fn().mockResolvedValue(forLean),
        };
      }
      if (sel === '+password') {
        return Promise.resolve(u);
      }
      return Promise.resolve(forLean);
    },
  };
}

function buildApp() {
  const authRouter = require('../../../src/routes/auth');
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRouter);
  return app;
}

describe('Auth — credentials & sécurité', () => {
  const saved = {
    NODE_ENV: process.env.NODE_ENV,
    ADMIN_EMAIL: process.env.ADMIN_EMAIL,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
    JWT_SECRET: process.env.JWT_SECRET,
    LOGIN_RATE_LIMIT_MAX: process.env.LOGIN_RATE_LIMIT_MAX,
  };

  beforeEach(() => {
    jest.resetModules();
    User = require('../../../src/models/User');
    jest.clearAllMocks();
    mockSave.mockResolvedValue(undefined);
    User._mockComparePassword.mockReset();
    process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-chars!!';
    process.env.LOGIN_RATE_LIMIT_MAX = '1000';
    process.env.NODE_ENV = 'test';
    process.env.ADMIN_EMAIL = 'admin@test.com';
    process.env.ADMIN_PASSWORD = 'AdminStrong1!@#';
  });

  afterEach(() => {
    process.env.NODE_ENV = saved.NODE_ENV;
    process.env.ADMIN_EMAIL = saved.ADMIN_EMAIL;
    process.env.ADMIN_PASSWORD = saved.ADMIN_PASSWORD;
    process.env.JWT_SECRET = saved.JWT_SECRET;
    process.env.LOGIN_RATE_LIMIT_MAX = saved.LOGIN_RATE_LIMIT_MAX;
  });

  it('POST /login retourne 500 si ADMIN_PASSWORD est absent', async () => {
    delete process.env.ADMIN_PASSWORD;
    process.env.ADMIN_EMAIL = 'ops@company.test';

    const app = buildApp();
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ops@company.test', password: 'whatever1' })
      .expect(500);
    expect(res.body.message).toMatch(/ADMIN_EMAIL|ADMIN_PASSWORD|configuration/i);
    const { error: logError } = require('../../../src/lib/logger');
    expect(logError).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'auth_login_admin_config_missing',
        err: 'ADMIN_EMAIL and ADMIN_PASSWORD required',
        hasAdminEmail: true,
        hasAdminPassword: false,
      })
    );
  });

  it('POST /login retourne 500 si ADMIN_EMAIL est vide', async () => {
    process.env.ADMIN_EMAIL = '   ';
    process.env.ADMIN_PASSWORD = 'x';

    const app = buildApp();
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'someone@test.com', password: 'whatever1' })
      .expect(500);
    expect(res.body.message).toMatch(/configuration/i);
    const { error: logError } = require('../../../src/lib/logger');
    expect(logError).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'auth_login_admin_config_missing',
        err: 'ADMIN_EMAIL and ADMIN_PASSWORD required',
        hasAdminEmail: false,
        hasAdminPassword: true,
      })
    );
  });

  it('POST /login refuse admin@gnv.com en production (403)', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ADMIN_EMAIL = 'real-admin@company.test';
    process.env.ADMIN_PASSWORD = 'ProdSecret1!';

    User.findOne.mockReturnValue(mockFindOneChain(null));

    const app = buildApp();
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@gnv.com', password: 'AnyPass1!' })
      .expect(403);
    expect(res.body.message).toMatch(/production|autorisé|administrateur/i);
  });

  it('après changement de mot de passe, l’ancien mot de passe n’est plus accepté au login', async () => {
    const compare = User._mockComparePassword;
    compare.mockResolvedValueOnce(true).mockResolvedValueOnce(true).mockResolvedValue(false);

    const fakeUser = {
      _id: '507f1f77bcf86cd799439011',
      email: 'admin@test.com',
      firstName: 'Admin',
      lastName: 'Test',
      role: 'admin',
      isActive: true,
      save: mockSave,
      comparePassword: compare,
    };

    User.findOne.mockReturnValue(mockFindOneChain(fakeUser));
    User.findById.mockImplementation(() => mockFindByIdFlexible(fakeUser));

    const app = buildApp();

    const login1 = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'tempInitPassword1' })
      .expect(200);

    const cookies = login1.headers['set-cookie'];
    expect(cookies).toBeDefined();

    await request(app)
      .put('/api/auth/change-password')
      .set('Cookie', cookies)
      .send({ currentPassword: 'tempInitPassword1', newPassword: 'newSecurePass9' })
      .expect(200);

    User.findOne.mockReturnValue(mockFindOneChain({ ...fakeUser, comparePassword: compare }));

    await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'tempInitPassword1' })
      .expect(401);
  });
});
