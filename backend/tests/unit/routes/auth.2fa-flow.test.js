/**
 * Flux 2FA : challenge login admin, complete-login, setup (QR + backup codes).
 */
process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-chars!!';
process.env.ADMIN_EMAIL = 'admin@test.com';
process.env.ADMIN_PASSWORD = 'adminpass';

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
    };
  }
  MockUser.findOne = jest.fn();
  MockUser.create = jest.fn();
  MockUser.findById = jest.fn();
  return MockUser;
});

jest.mock('../../../src/lib/logger', () => ({ logFailedLogin: jest.fn(), logApiError: jest.fn() }));
jest.mock('../../../src/lib/cache-manager', () => ({
  isConnected: false,
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
}));
jest.mock('../../../src/services/auditService', () => ({
  logAction: jest.fn().mockResolvedValue(null),
}));

const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const speakeasy = require('speakeasy');
const authService = require('../../../src/services/authService');
const authRouter = require('../../../src/routes/auth');
const User = require('../../../src/models/User');
const {
  generateToken,
  generateTwoFactorChallengeToken,
  verifyTwoFactorChallengeToken,
} = require('../../../src/middleware/auth');

function mockFindOneChain(resolvedValue) {
  return {
    select: jest.fn().mockReturnValue(Promise.resolve(resolvedValue)),
  };
}

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/auth', authRouter);

describe('Auth 2FA — flux', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSave.mockResolvedValue(undefined);
    mockComparePassword.mockResolvedValue(true);
  });

  it('login admin avec 2FA sans code → requiresTwoFactor + challenge JWT', async () => {
    const adminDoc = {
      _id: '507f1f77bcf86cd799439011',
      email: 'admin@test.com',
      firstName: 'A',
      lastName: 'B',
      role: 'admin',
      twoFactorEnabled: true,
      isActive: true,
      save: mockSave,
      comparePassword: mockComparePassword,
    };
    User.findOne.mockReturnValue(mockFindOneChain(adminDoc));
    User.findById.mockImplementation(() => ({
      select: jest.fn().mockResolvedValue({ ...adminDoc }),
    }));

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'okpass' })
      .expect(200);

    expect(res.body.requiresTwoFactor).toBe(true);
    expect(res.body.twoFactorChallenge).toBeDefined();
    expect(res.headers['set-cookie']).toBeUndefined();
    const dec = verifyTwoFactorChallengeToken(res.body.twoFactorChallenge);
    expect(dec.typ).toBe('2fa_challenge');
  });

  it('complete-login : TOTP invalide → 401', async () => {
    const challenge = generateTwoFactorChallengeToken('507f1f77bcf86cd799439011', 'admin@test.com');
    const userDoc = {
      _id: '507f1f77bcf86cd799439011',
      email: 'admin@test.com',
      role: 'admin',
      twoFactorEnabled: true,
      twoFactorSecret: 'INVALIDBASE32SECRETXXXX',
      twoFactorBackupCodes: [],
      isActive: true,
      save: mockSave,
    };
    User.findById.mockImplementation(() => ({
      select: jest.fn().mockResolvedValue(userDoc),
    }));

    await request(app)
      .post('/api/auth/2fa/complete-login')
      .send({ twoFactorChallenge: challenge, token: '123456' })
      .expect(401);
  });

  it('complete-login : TOTP valide → cookie session', async () => {
    const secret32 = speakeasy.generateSecret({ length: 20 });
    const token = speakeasy.totp({ secret: secret32.base32, encoding: 'base32' });
    const challenge = generateTwoFactorChallengeToken('507f1f77bcf86cd799439011', 'admin@test.com');
    const userDoc = {
      _id: '507f1f77bcf86cd799439011',
      email: 'admin@test.com',
      firstName: 'A',
      lastName: 'B',
      role: 'admin',
      twoFactorEnabled: true,
      twoFactorSecret: secret32.base32,
      twoFactorBackupCodes: [],
      isActive: true,
      save: mockSave,
    };
    User.findById.mockImplementation(() => ({
      select: jest.fn().mockResolvedValue(userDoc),
    }));

    const res = await request(app)
      .post('/api/auth/2fa/complete-login')
      .send({ twoFactorChallenge: challenge, token })
      .expect(200);

    expect(res.body.message).toMatch(/success|succ/i);
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('POST /2fa/setup retourne qrCodeDataUrl et 10 backupCodes', async () => {
    const adminToken = generateToken({ id: 'admin-id', email: 'admin@test.com', role: 'admin' });
    const leanUser = {
      _id: 'admin-id',
      email: 'admin@test.com',
      role: 'admin',
      twoFactorEnabled: false,
      isActive: true,
    };
    const pendingUser = {
      ...leanUser,
      save: mockSave,
    };
    User.findById.mockImplementation(() => ({
      select(sel) {
        const s = String(sel);
        if (s.includes('-password')) {
          return { lean: jest.fn().mockResolvedValue(leanUser) };
        }
        return Promise.resolve(pendingUser);
      },
    }));

    const res = await request(app)
      .post('/api/auth/2fa/setup')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(200);

    expect(res.body.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(Array.isArray(res.body.backupCodes)).toBe(true);
    expect(res.body.backupCodes).toHaveLength(10);
  });

  it('login admin : code de secours valide → cookie (usage unique simulé)', async () => {
    const plain = ['feed-feed-beef-beef'];
    const hashes = await authService.hashBackupCodes(plain);
    const adminDoc = {
      _id: '507f1f77bcf86cd799439011',
      email: 'admin@test.com',
      firstName: 'A',
      lastName: 'B',
      role: 'admin',
      twoFactorEnabled: true,
      isActive: true,
      save: mockSave,
      comparePassword: mockComparePassword,
    };
    User.findOne.mockReturnValue(mockFindOneChain(adminDoc));
    User.findById.mockImplementation(() => ({
      select: jest.fn().mockImplementation((sel) => {
        if (String(sel).includes('twoFactorSecret')) {
          return Promise.resolve({
            ...adminDoc,
            twoFactorSecret: 'ABCDABCDABCDABCDABCDABCDABCDABCD',
            twoFactorBackupCodes: [...hashes],
            save: mockSave,
          });
        }
        return Promise.resolve({ ...adminDoc });
      }),
    }));

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'ok', twoFactorToken: 'feed-feed-beef-beef' })
      .expect(200);

    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('POST /2fa/verify : TOTP invalide → 401', async () => {
    const adminToken = generateToken({ id: 'admin-id', email: 'a@test.com', role: 'admin' });
    User.findById.mockImplementation(() => ({
      select: jest.fn().mockResolvedValue({
        _id: 'admin-id',
        twoFactorPendingSecret: 'ABCDEFGHIJKLMNOP',
        twoFactorPendingBackupHashes: [],
        save: mockSave,
      }),
    }));

    await request(app)
      .post('/api/auth/2fa/verify')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ token: '000000' })
      .expect(401);
  });
});
