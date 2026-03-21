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

jest.mock('../../../src/lib/logger', () => ({
  logFailedLogin: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));
jest.mock('../../../src/lib/cache-manager', () => ({
  isConnected: false,
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../src/services/auditService', () => ({
  logAction: jest.fn().mockResolvedValue(null),
}));

const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const authService = require('../../../src/services/authService');
const authRouter = require('../../../src/routes/auth');
const User = require('../../../src/models/User');
const cacheManager = require('../../../src/lib/cache-manager');
const logger = require('../../../src/lib/logger');
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
    cacheManager.isConnected = false;
    cacheManager.del.mockResolvedValue(undefined);
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

  it('complete-login : TOTP valide reste 200 si invalidation cache Redis échoue', async () => {
    cacheManager.isConnected = true;
    cacheManager.del.mockRejectedValueOnce(new Error('redis down'));
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

    expect(cacheManager.del).toHaveBeenCalled();
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

  it('POST /2fa/verify 401 code 6 chiffres mais TOTP incorrect (secret base32 valide)', async () => {
    const sec = speakeasy.generateSecret({ length: 20 });
    const adminToken = generateToken({ id: 'admin-id', email: 'a@test.com', role: 'admin' });
    User.findById.mockImplementation(() => ({
      select(sel) {
        const s = String(sel);
        if (s.includes('-password')) {
          return {
            lean: jest.fn().mockResolvedValue({
              _id: 'admin-id',
              role: 'admin',
              isActive: true,
              email: 'a@test.com',
            }),
          };
        }
        return Promise.resolve({
          _id: 'admin-id',
          twoFactorPendingSecret: sec.base32,
          twoFactorPendingBackupHashes: [],
          save: mockSave,
        });
      },
    }));

    await request(app)
      .post('/api/auth/2fa/verify')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ token: '111111' })
      .expect(401);
  });

  it('POST /2fa/verify 400 si token pas exactement 6 chiffres', async () => {
    const adminToken = generateToken({ id: 'admin-id', email: 'a@test.com', role: 'admin' });
    User.findById.mockImplementation(() => ({
      select(sel) {
        const s = String(sel);
        if (s.includes('-password')) {
          return {
            lean: jest.fn().mockResolvedValue({
              _id: 'admin-id',
              role: 'admin',
              isActive: true,
              email: 'a@test.com',
            }),
          };
        }
        return Promise.resolve({});
      },
    }));

    const res = await request(app)
      .post('/api/auth/2fa/verify')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ token: '12345' })
      .expect(400);

    expect(res.body.message).toMatch(/6|chiffres|TOTP/i);
  });

  it('POST /2fa/verify 200 active 2FA, cookie mfa et backupCodes vides', async () => {
    mockSave.mockResolvedValue(undefined);
    const sec = speakeasy.generateSecret({ length: 20 });
    const totp = speakeasy.totp({ secret: sec.base32, encoding: 'base32' });
    const adminToken = generateToken({ id: 'admin-id', email: 'a@test.com', role: 'admin' });
    User.findById.mockImplementation(() => ({
      select(sel) {
        const s = String(sel);
        if (s.includes('-password')) {
          return {
            lean: jest.fn().mockResolvedValue({
              _id: 'admin-id',
              role: 'admin',
              isActive: true,
              email: 'a@test.com',
            }),
          };
        }
        return Promise.resolve({
          _id: 'admin-id',
          email: 'a@test.com',
          role: 'admin',
          twoFactorPendingSecret: sec.base32,
          twoFactorPendingBackupHashes: ['h1', 'h2'],
          save: mockSave,
        });
      },
    }));

    const res = await request(app)
      .post('/api/auth/2fa/verify')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ token: totp })
      .expect(200);

    expect(res.headers['set-cookie']).toBeDefined();
    expect(res.body.twoFactorEnabled).toBe(true);
    expect(res.body.backupCodes).toEqual([]);
  });

  it('POST /2fa/verify 200 si twoFactorPendingBackupHashes n’est pas un tableau → []', async () => {
    mockSave.mockResolvedValue(undefined);
    const sec = speakeasy.generateSecret({ length: 20 });
    const totp = speakeasy.totp({ secret: sec.base32, encoding: 'base32' });
    const adminToken = generateToken({ id: 'admin-id', email: 'a@test.com', role: 'admin' });
    User.findById.mockImplementation(() => ({
      select(sel) {
        const s = String(sel);
        if (s.includes('-password')) {
          return {
            lean: jest.fn().mockResolvedValue({
              _id: 'admin-id',
              role: 'admin',
              isActive: true,
              email: 'a@test.com',
            }),
          };
        }
        return Promise.resolve({
          _id: 'admin-id',
          email: 'a@test.com',
          role: 'admin',
          twoFactorPendingSecret: sec.base32,
          twoFactorPendingBackupHashes: 'not-an-array',
          save: mockSave,
        });
      },
    }));

    await request(app)
      .post('/api/auth/2fa/verify')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ token: totp })
      .expect(200);
  });

  it('POST /2fa/setup 500 si qrCodeDataUrl échoue', async () => {
    const spy = jest.spyOn(authService, 'qrCodeDataUrl').mockRejectedValueOnce(new Error('qr png'));
    try {
      const adminToken = generateToken({ id: 'admin-id', email: 'admin@test.com', role: 'admin' });
      const leanUser = {
        _id: 'admin-id',
        email: 'admin@test.com',
        role: 'admin',
        twoFactorEnabled: false,
        isActive: true,
      };
      const pendingUser = { ...leanUser, save: mockSave };
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
        .expect(500);

      expect(res.body.message).toMatch(/Server error/i);
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'auth_2fa_setup_failed', err: 'qr png' })
      );
    } finally {
      spy.mockRestore();
    }
  });

  it('POST /2fa/verify 400 si aucune config en cours', async () => {
    const adminToken = generateToken({ id: 'admin-id', email: 'a@test.com', role: 'admin' });
    User.findById.mockImplementation(() => ({
      select(sel) {
        const s = String(sel);
        if (s.includes('-password')) {
          return {
            lean: jest.fn().mockResolvedValue({
              _id: 'admin-id',
              role: 'admin',
              isActive: true,
              email: 'a@test.com',
            }),
          };
        }
        return Promise.resolve({
          _id: 'admin-id',
          twoFactorPendingSecret: null,
          twoFactorPendingBackupHashes: [],
          save: mockSave,
        });
      },
    }));

    const res = await request(app)
      .post('/api/auth/2fa/verify')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ token: '123456' })
      .expect(400);

    expect(res.body.message).toMatch(/configuration|setup/i);
  });

  it('POST /2fa/verify 500 si save échoue après TOTP valide', async () => {
    const sec = speakeasy.generateSecret({ length: 20 });
    const totp = speakeasy.totp({ secret: sec.base32, encoding: 'base32' });
    mockSave.mockRejectedValueOnce(new Error('verify save fail'));
    const adminToken = generateToken({ id: 'admin-id', email: 'a@test.com', role: 'admin' });
    User.findById.mockImplementation(() => ({
      select(sel) {
        const s = String(sel);
        if (s.includes('-password')) {
          return {
            lean: jest.fn().mockResolvedValue({
              _id: 'admin-id',
              role: 'admin',
              isActive: true,
              email: 'a@test.com',
            }),
          };
        }
        return Promise.resolve({
          _id: 'admin-id',
          email: 'a@test.com',
          role: 'admin',
          twoFactorPendingSecret: sec.base32,
          twoFactorPendingBackupHashes: [],
          save: mockSave,
        });
      },
    }));

    const res = await request(app)
      .post('/api/auth/2fa/verify')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ token: totp })
      .expect(500);

    expect(res.body.message).toMatch(/Server error/i);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'auth_2fa_verify_failed', err: 'verify save fail' })
    );
  });

  it('POST /2fa/disable 400 si champs manquants', async () => {
    const adminToken = generateToken({ id: 'admin-id', email: 'a@test.com', role: 'admin', mfa: true });
    User.findById.mockImplementation(() => ({
      select(sel) {
        if (String(sel).includes('-password')) {
          return {
            lean: jest.fn().mockResolvedValue({
              _id: 'admin-id',
              role: 'admin',
              isActive: true,
              email: 'a@test.com',
              twoFactorEnabled: true,
            }),
          };
        }
        return Promise.resolve({});
      },
    }));

    await request(app)
      .post('/api/auth/2fa/disable')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(400);
  });

  it('POST /2fa/disable 400 si 2FA déjà désactivé', async () => {
    const adminToken = generateToken({ id: 'admin-id', email: 'a@test.com', role: 'admin', mfa: true });
    User.findById.mockImplementation(() => ({
      select(sel) {
        const s = String(sel);
        if (s.includes('-password')) {
          return {
            lean: jest.fn().mockResolvedValue({
              _id: 'admin-id',
              role: 'admin',
              isActive: true,
              email: 'a@test.com',
              twoFactorEnabled: true,
            }),
          };
        }
        if (s.includes('+password')) {
          return Promise.resolve({
            _id: 'admin-id',
            twoFactorEnabled: false,
            comparePassword: mockComparePassword,
            save: mockSave,
          });
        }
        return Promise.resolve({});
      },
    }));

    const res = await request(app)
      .post('/api/auth/2fa/disable')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ password: 'x', twoFactorToken: '123456' })
      .expect(400);

    expect(res.body.message).toMatch(/pas activé|not activ/i);
  });

  it('POST /2fa/disable 401 si mot de passe incorrect', async () => {
    mockComparePassword.mockResolvedValue(false);
    const adminToken = generateToken({ id: 'admin-id', email: 'a@test.com', role: 'admin', mfa: true });
    User.findById.mockImplementation(() => ({
      select(sel) {
        const s = String(sel);
        if (s.includes('-password')) {
          return {
            lean: jest.fn().mockResolvedValue({
              _id: 'admin-id',
              role: 'admin',
              isActive: true,
              email: 'a@test.com',
              twoFactorEnabled: true,
            }),
          };
        }
        if (s.includes('+password')) {
          return Promise.resolve({
            _id: 'admin-id',
            twoFactorEnabled: true,
            twoFactorSecret: 'ABCDABCDABCDABCDABCDABCDABCDABCD',
            comparePassword: mockComparePassword,
            save: mockSave,
          });
        }
        return Promise.resolve({});
      },
    }));

    await request(app)
      .post('/api/auth/2fa/disable')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ password: 'wrong', twoFactorToken: '123456' })
      .expect(401);
  });

  it('POST /2fa/disable 401 si code TOTP incorrect', async () => {
    mockComparePassword.mockResolvedValue(true);
    const sec = speakeasy.generateSecret({ length: 20 });
    const adminToken = generateToken({ id: 'admin-id', email: 'a@test.com', role: 'admin', mfa: true });
    User.findById.mockImplementation(() => ({
      select(sel) {
        const s = String(sel);
        if (s.includes('-password')) {
          return {
            lean: jest.fn().mockResolvedValue({
              _id: 'admin-id',
              role: 'admin',
              isActive: true,
              email: 'a@test.com',
              twoFactorEnabled: true,
            }),
          };
        }
        if (s.includes('+password')) {
          return Promise.resolve({
            _id: 'admin-id',
            twoFactorEnabled: true,
            twoFactorSecret: sec.base32,
            comparePassword: mockComparePassword,
            save: mockSave,
          });
        }
        return Promise.resolve({});
      },
    }));

    await request(app)
      .post('/api/auth/2fa/disable')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ password: 'good', twoFactorToken: '000000' })
      .expect(401);
  });

  it('POST /2fa/disable 200 désactive le 2FA', async () => {
    mockComparePassword.mockResolvedValue(true);
    mockSave.mockResolvedValue(undefined);
    const sec = speakeasy.generateSecret({ length: 20 });
    const totp = speakeasy.totp({ secret: sec.base32, encoding: 'base32' });
    const adminToken = generateToken({ id: 'admin-id', email: 'a@test.com', role: 'admin', mfa: true });
    User.findById.mockImplementation(() => ({
      select(sel) {
        const s = String(sel);
        if (s.includes('-password')) {
          return {
            lean: jest.fn().mockResolvedValue({
              _id: 'admin-id',
              role: 'admin',
              isActive: true,
              email: 'a@test.com',
              twoFactorEnabled: true,
            }),
          };
        }
        if (s.includes('+password')) {
          return Promise.resolve({
            _id: 'admin-id',
            email: 'a@test.com',
            role: 'admin',
            twoFactorEnabled: true,
            twoFactorSecret: sec.base32,
            comparePassword: mockComparePassword,
            save: mockSave,
          });
        }
        return Promise.resolve({});
      },
    }));

    const res = await request(app)
      .post('/api/auth/2fa/disable')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ password: 'goodpass', twoFactorToken: totp })
      .expect(200);

    expect(res.body.twoFactorEnabled).toBe(false);
  });

  it('complete-login 401 si challenge JWT invalide', async () => {
    const res = await request(app)
      .post('/api/auth/2fa/complete-login')
      .send({ twoFactorChallenge: 'not-a-jwt', token: '123456' })
      .expect(401);
    expect(res.body.message).toMatch(/Challenge|invalide|expiré/i);
  });

  it('complete-login 401 si utilisateur introuvable', async () => {
    const challenge = generateTwoFactorChallengeToken('507f1f77bcf86cd799439011', 'admin@test.com');
    User.findById.mockImplementation(() => ({
      select: jest.fn().mockResolvedValue(null),
    }));
    await request(app)
      .post('/api/auth/2fa/complete-login')
      .send({ twoFactorChallenge: challenge, token: '123456' })
      .expect(401);
  });

  it('complete-login 200 avec challenge JWT ayant seulement sub (pas id)', async () => {
    const secret32 = speakeasy.generateSecret({ length: 20 });
    const tokenTotp = speakeasy.totp({ secret: secret32.base32, encoding: 'base32' });
    const challenge = jwt.sign(
      {
        typ: '2fa_challenge',
        sub: '507f1f77bcf86cd799439011',
        email: 'admin@test.com',
      },
      process.env.JWT_SECRET,
      { expiresIn: '5m' }
    );
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
      .send({ twoFactorChallenge: challenge, token: tokenTotp })
      .expect(200);

    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('complete-login 400 si compte passager (2FA non actif admin)', async () => {
    const challenge = generateTwoFactorChallengeToken('507f1f77bcf86cd799439011', 'user@test.com');
    User.findById.mockImplementation(() => ({
      select: jest.fn().mockResolvedValue({
        _id: '507f1f77bcf86cd799439011',
        email: 'user@test.com',
        role: 'user',
        twoFactorEnabled: false,
        isActive: true,
      }),
    }));
    const res = await request(app)
      .post('/api/auth/2fa/complete-login')
      .send({ twoFactorChallenge: challenge, token: '123456' })
      .expect(400);
    expect(res.body.message).toMatch(/2FA|non actif/i);
  });

  it('complete-login 500 si User.findById rejette', async () => {
    const challenge = generateTwoFactorChallengeToken('507f1f77bcf86cd799439011', 'admin@test.com');
    User.findById.mockImplementation(() => ({
      select: jest.fn().mockRejectedValue(new Error('db')),
    }));
    await request(app)
      .post('/api/auth/2fa/complete-login')
      .send({ twoFactorChallenge: challenge, token: '123456' })
      .expect(500);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'auth_2fa_complete_login_failed', err: 'db' })
    );
  });

  it('complete-login : code de secours valide → session (splice backup)', async () => {
    const plain = ['beef-beef-cafe-cafe'];
    const hashes = await authService.hashBackupCodes(plain);
    const challenge = generateTwoFactorChallengeToken('507f1f77bcf86cd799439011', 'admin@test.com');
    const userDoc = {
      _id: '507f1f77bcf86cd799439011',
      email: 'admin@test.com',
      firstName: 'A',
      lastName: 'B',
      role: 'admin',
      twoFactorEnabled: true,
      twoFactorSecret: 'ABCDABCDABCDABCDABCDABCDABCDABCD',
      twoFactorBackupCodes: [...hashes],
      isActive: true,
      save: mockSave,
    };
    User.findById.mockImplementation(() => ({
      select: jest.fn().mockResolvedValue(userDoc),
    }));

    const res = await request(app)
      .post('/api/auth/2fa/complete-login')
      .send({ twoFactorChallenge: challenge, token: plain[0] })
      .expect(200);

    expect(res.headers['set-cookie']).toBeDefined();
    expect(userDoc.twoFactorBackupCodes.length).toBe(0);
  });

  it('POST /2fa/setup 400 si 2FA déjà activé', async () => {
    const adminToken = generateToken({ id: 'admin-id', email: 'a@test.com', role: 'admin' });
    User.findById.mockImplementation(() => ({
      select(sel) {
        const s = String(sel);
        if (s.includes('-password')) {
          return {
            lean: jest.fn().mockResolvedValue({
              _id: 'admin-id',
              email: 'a@test.com',
              role: 'admin',
              isActive: true,
            }),
          };
        }
        return Promise.resolve({
          _id: 'admin-id',
          email: 'a@test.com',
          twoFactorEnabled: true,
          save: mockSave,
        });
      },
    }));

    const res = await request(app)
      .post('/api/auth/2fa/setup')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(400);

    expect(res.body.message).toMatch(/déjà activé|already/i);
  });

  it('POST /2fa/disable 500 si save échoue', async () => {
    mockComparePassword.mockResolvedValue(true);
    mockSave.mockRejectedValueOnce(new Error('persist'));
    const sec = speakeasy.generateSecret({ length: 20 });
    const totp = speakeasy.totp({ secret: sec.base32, encoding: 'base32' });
    const adminToken = generateToken({ id: 'admin-id', email: 'a@test.com', role: 'admin', mfa: true });
    User.findById.mockImplementation(() => ({
      select(sel) {
        const s = String(sel);
        if (s.includes('-password')) {
          return {
            lean: jest.fn().mockResolvedValue({
              _id: 'admin-id',
              role: 'admin',
              isActive: true,
              email: 'a@test.com',
              twoFactorEnabled: true,
            }),
          };
        }
        if (s.includes('+password')) {
          return Promise.resolve({
            _id: 'admin-id',
            email: 'a@test.com',
            role: 'admin',
            twoFactorEnabled: true,
            twoFactorSecret: sec.base32,
            comparePassword: mockComparePassword,
            save: mockSave,
          });
        }
        return Promise.resolve({});
      },
    }));

    await request(app)
      .post('/api/auth/2fa/disable')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ password: 'goodpass', twoFactorToken: totp })
      .expect(500);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'auth_2fa_disable_failed', err: 'persist' })
    );
  });
});
