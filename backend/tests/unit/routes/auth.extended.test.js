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
  del: jest.fn().mockResolvedValue(undefined),
};
jest.mock('../../../src/lib/cache-manager', () => mockCacheManager);
jest.mock('../../../src/lib/logger', () => ({
  logFailedLogin: jest.fn(),
  error: jest.fn(),
}));
jest.mock('../../../src/services/auditService', () => ({
  logAction: jest.fn().mockResolvedValue(null),
}));

const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const speakeasy = require('speakeasy');
const authRouter = require('../../../src/routes/auth');
const logger = require('../../../src/lib/logger');
const authMiddlewareModule = require('../../../src/middleware/auth');
const { generateToken } = authMiddlewareModule;
const User = require('../../../src/models/User');
const auditService = require('../../../src/services/auditService');

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
  const origNodeEnv = process.env.NODE_ENV;

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
    process.env.NODE_ENV = origNodeEnv;
  });

  describe('POST /api/auth/login', () => {
    it('500 si ADMIN_EMAIL / ADMIN_PASSWORD non configurés', async () => {
      process.env.ADMIN_EMAIL = '';
      process.env.ADMIN_PASSWORD = '';
      const res = await request(app).post('/api/auth/login').send({ email: 'x@test.com', password: 'whatever1' });
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
      const res = await request(app).post('/api/auth/login').send({ email: 'u@test.com', password: 'pass' });
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
      const res = await request(app).post('/api/auth/login').send({ email: 'u@test.com', password: 'wrong' });
      expect(res.status).toBe(401);
    });

    it('403 si email admin@gnv.com en production (identifiant interdit)', async () => {
      process.env.NODE_ENV = 'production';
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@gnv.com', password: 'AnyPassword1!' });
      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/production|autorisé|ADMIN_EMAIL/i);
      process.env.NODE_ENV = 'test';
    });

    it('401 si email inconnu et pas identifiants admin (audit user_not_found)', async () => {
      User.findOne.mockReturnValue(mockFindOneChain(null));
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'ghost@test.com', password: 'Whatever12!' });
      expect(res.status).toBe(401);
    });

    it('401 si findById fresh retourne null après mot de passe valide', async () => {
      mockComparePassword.mockResolvedValue(true);
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
      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });
      const res = await request(app).post('/api/auth/login').send({ email: 'u@test.com', password: 'goodpass12' });
      expect(res.status).toBe(401);
    });

    it('200 auto-création admin si aucun compte et identifiants = ADMIN_EMAIL / ADMIN_PASSWORD', async () => {
      User.findOne.mockReturnValue(mockFindOneChain(null));
      const loginDoc = {
        _id: '507f1f77bcf86cd799439011',
        role: 'admin',
        twoFactorEnabled: false,
        firstName: 'Admin',
        lastName: 'GNV',
        email: 'admin@test.com',
        phone: null,
        cabinNumber: null,
        country: null,
        dateOfBirth: null,
        preferences: null,
        allowedModules: null,
        mustChangePassword: false,
        userData: null,
        save: mockSave,
      };
      User.findById.mockImplementation(() => ({
        select: jest.fn().mockResolvedValue(loginDoc),
      }));
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@test.com', password: 'AdminStrong1!@#' });
      expect(res.status).toBe(200);
      expect(res.body.user.role).toBe('admin');
      expect(res.body.message).toMatch(/success|succès|Login/i);
      expect(mockSave).toHaveBeenCalled();
    });

    it('200 login utilisateur en production : cookie Secure si X-Forwarded-Proto=https', async () => {
      try {
        process.env.NODE_ENV = 'production';
        mockComparePassword.mockResolvedValue(true);
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
        const loginSuccessDoc = {
          _id: '507f1f77bcf86cd799439011',
          email: 'u@test.com',
          role: 'user',
          twoFactorEnabled: false,
          firstName: 'U',
          lastName: 'T',
          phone: null,
          cabinNumber: null,
          country: null,
          dateOfBirth: null,
          preferences: null,
          allowedModules: null,
          mustChangePassword: false,
          userData: null,
          save: mockSave,
        };
        User.findById.mockImplementation(() => ({
          select: jest.fn().mockResolvedValue(loginSuccessDoc),
        }));
        const res = await request(app)
          .post('/api/auth/login')
          .set('X-Forwarded-Proto', 'https')
          .send({ email: 'u@test.com', password: 'goodpass12' });
        expect(res.status).toBe(200);
        expect(String(res.headers['set-cookie'])).toMatch(/Secure/i);
      } finally {
        process.env.NODE_ENV = 'test';
      }
    });

    it('200 login utilisateur en production : branche req.secure si pas de X-Forwarded-Proto', async () => {
      try {
        process.env.NODE_ENV = 'production';
        mockComparePassword.mockResolvedValue(true);
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
        const loginSuccessDoc = {
          _id: '507f1f77bcf86cd799439011',
          email: 'u@test.com',
          role: 'user',
          twoFactorEnabled: false,
          firstName: 'U',
          lastName: 'T',
          phone: null,
          cabinNumber: null,
          country: null,
          dateOfBirth: null,
          preferences: null,
          allowedModules: null,
          mustChangePassword: false,
          userData: null,
          save: mockSave,
        };
        User.findById.mockImplementation(() => ({
          select: jest.fn().mockResolvedValue(loginSuccessDoc),
        }));
        const res = await request(app)
          .post('/api/auth/login')
          .send({ email: 'u@test.com', password: 'goodpass12' });
        expect(res.status).toBe(200);
        expect(res.headers['set-cookie']).toBeDefined();
      } finally {
        process.env.NODE_ENV = 'test';
      }
    });

    it('200 login utilisateur en production : cookie sans Secure si X-Forwarded-Proto=http', async () => {
      try {
        process.env.NODE_ENV = 'production';
        mockComparePassword.mockResolvedValue(true);
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
        const loginSuccessDoc = {
          _id: '507f1f77bcf86cd799439011',
          email: 'u@test.com',
          role: 'user',
          twoFactorEnabled: false,
          firstName: 'U',
          lastName: 'T',
          phone: null,
          cabinNumber: null,
          country: null,
          dateOfBirth: null,
          preferences: null,
          allowedModules: null,
          mustChangePassword: false,
          userData: null,
          save: mockSave,
        };
        User.findById.mockImplementation(() => ({
          select: jest.fn().mockResolvedValue(loginSuccessDoc),
        }));
        const res = await request(app)
          .post('/api/auth/login')
          .set('X-Forwarded-Proto', 'http')
          .send({ email: 'u@test.com', password: 'goodpass12' });
        expect(res.status).toBe(200);
        expect(String(res.headers['set-cookie'])).not.toMatch(/;\s*Secure/i);
      } finally {
        process.env.NODE_ENV = 'test';
      }
    });

    it('401 admin avec 2FA : TOTP invalide au login (invalid_2fa)', async () => {
      const secret32 = speakeasy.generateSecret({ length: 20 });
      const adminDoc = {
        _id: '507f1f77bcf86cd799439011',
        email: 'admin2fa@test.com',
        role: 'admin',
        twoFactorEnabled: true,
        isActive: true,
        comparePassword: mockComparePassword,
        save: mockSave,
      };
      User.findOne.mockReturnValue(mockFindOneChain(adminDoc));
      mockComparePassword.mockResolvedValue(true);
      const freshShape = {
        ...adminDoc,
        firstName: 'A',
        lastName: 'B',
        phone: null,
        cabinNumber: null,
        country: null,
        dateOfBirth: null,
        preferences: null,
        allowedModules: null,
        mustChangePassword: false,
        userData: null,
        lastLogin: null,
      };
      User.findById.mockImplementation(() => ({
        select: jest.fn().mockImplementation((fields) => {
          const s = String(fields);
          if (s.includes('+twoFactorSecret')) {
            return Promise.resolve({
              ...adminDoc,
              twoFactorSecret: secret32.base32,
              twoFactorBackupCodes: [],
              save: mockSave,
            });
          }
          return Promise.resolve({ ...freshShape, save: mockSave });
        }),
      }));
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin2fa@test.com', password: 'goodpass12', twoFactorToken: '000000' });
      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/2FA|invalide/i);
      expect(auditService.logAction).toHaveBeenCalledWith(
        expect.objectContaining({ errorMessage: 'invalid_2fa', status: 'failure' })
      );
    });

    it('500 si User.findOne échoue pendant login', async () => {
      User.findOne.mockReturnValue({
        select: jest.fn().mockRejectedValue(new Error('db findOne')),
      });
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'u@test.com', password: 'whatever12' });
      expect(res.status).toBe(500);
      expect(res.body.message).toMatch(/login/i);
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'auth_login_failed',
          err: 'db findOne',
          email: 'u@test.com',
        })
      );
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

    it('200 même si le token cookie est invalide (pas de blacklist)', async () => {
      mockCacheManager.isConnected = true;
      mockCacheManager.set.mockClear();
      await request(app).post('/api/auth/logout').set('Cookie', 'authToken=not.a.jwt').expect(200);
      expect(mockCacheManager.set).not.toHaveBeenCalled();
    });

    it('blacklist TTL = 7j si le JWT décodé sans exp', async () => {
      mockCacheManager.isConnected = true;
      mockCacheManager.set.mockClear();
      const spy = jest.spyOn(authMiddlewareModule, 'verifyToken').mockReturnValue({ id: '507f1f77bcf86cd799439011' });
      try {
        const token = generateToken({ id: '507f1f77bcf86cd799439011', email: 'u@test.com', role: 'user' });
        await request(app).post('/api/auth/logout').set('Cookie', `authToken=${token}`).expect(200);
        const call = mockCacheManager.set.mock.calls.find((c) => String(c[0]).startsWith('blacklist:'));
        expect(call).toBeDefined();
        expect(call[2]).toBe(7 * 24 * 60 * 60);
      } finally {
        spy.mockRestore();
      }
    });
  });

  describe('GET /api/auth/me', () => {
    it('200 retourne le profil (toObject + mustChangePassword)', async () => {
      const token = generateToken({ id: '507f1f77bcf86cd799439011', email: 'u@test.com', role: 'user' });
      let calls = 0;
      User.findById.mockImplementation(() => {
        calls += 1;
        if (calls === 1) return authUserDbQuery();
        return {
          select: jest.fn().mockResolvedValue({
            _id: '507f1f77bcf86cd799439011',
            email: 'u@test.com',
            firstName: 'F',
            mustChangePassword: true,
            twoFactorEnabled: false,
            toObject() {
              return {
                _id: this._id,
                email: this.email,
                firstName: this.firstName,
                mustChangePassword: this.mustChangePassword,
                twoFactorEnabled: this.twoFactorEnabled,
              };
            },
          }),
        };
      });
      const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`).expect(200);
      expect(res.body.email).toBe('u@test.com');
      expect(res.body.mustChangePassword).toBe(true);
    });

    it('404 si utilisateur supprimé entre-temps', async () => {
      const token = generateToken({ id: '507f1f77bcf86cd799439011', email: 'u@test.com', role: 'user' });
      let calls = 0;
      User.findById.mockImplementation(() => {
        calls += 1;
        if (calls === 1) return authUserDbQuery();
        return {
          select: jest.fn().mockResolvedValue(null),
        };
      });
      await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`).expect(404);
    });

    it('500 si lecture profil échoue', async () => {
      const token = generateToken({ id: '507f1f77bcf86cd799439011', email: 'u@test.com', role: 'user' });
      let calls = 0;
      User.findById.mockImplementation(() => {
        calls += 1;
        if (calls === 1) return authUserDbQuery();
        return {
          select: jest.fn().mockRejectedValue(new Error('db me')),
        };
      });
      const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(500);
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'auth_me_get_failed', err: 'db me' })
      );
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('200 renouvelle le cookie', async () => {
      const token = generateToken({ id: '507f1f77bcf86cd799439011', email: 'u@test.com', role: 'user' });
      const res = await request(app).post('/api/auth/refresh').set('Authorization', `Bearer ${token}`).expect(200);
      expect(res.body.message).toMatch(/refreshed|Token/i);
    });

    it('200 conserve mfa dans le nouveau JWT si présent', async () => {
      const token = generateToken({
        id: '507f1f77bcf86cd799439011',
        email: 'admin@test.com',
        role: 'admin',
        mfa: true,
      });
      User.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            _id: '507f1f77bcf86cd799439011',
            email: 'admin@test.com',
            role: 'admin',
            isActive: true,
          }),
        }),
      });
      await request(app).post('/api/auth/refresh').set('Authorization', `Bearer ${token}`).expect(200);
    });

    it('401 sans token (authMiddleware)', async () => {
      await request(app).post('/api/auth/refresh').expect(401);
    });

    it('401 si verifyToken échoue dans le handler refresh (spy sur le module)', async () => {
      // authMiddleware garde une ref locale à verifyToken ; seul POST /refresh rappelle
      // require('../middleware/auth').verifyToken (voir auth.js). Un mock qui lève donc cible
      // le handler. Si le middleware utilisait aussi l’export, le 1er appel lèverait (401 middleware).
      const spy = jest.spyOn(authMiddlewareModule, 'verifyToken').mockImplementation(() => {
        const err = new Error('boom');
        err.name = 'JsonWebTokenError';
        throw err;
      });
      try {
        User.findById.mockReturnValue({
          select: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue({
              _id: '507f1f77bcf86cd799439011',
              email: 'u@test.com',
              role: 'user',
              isActive: true,
            }),
          }),
        });
        const token = generateToken({ id: '507f1f77bcf86cd799439011', email: 'u@test.com', role: 'user' });
        const res = await request(app).post('/api/auth/refresh').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(401);
        expect(res.body.message).toMatch(/invalide|invalid token|token/i);
      } finally {
        spy.mockRestore();
      }
    });
  });

  describe('POST /api/auth/2fa/complete-login', () => {
    it('400 si challenge ou token manquant', async () => {
      const res = await request(app).post('/api/auth/2fa/complete-login').send({}).expect(400);
      expect(res.body.message).toMatch(/requis|required/i);
    });
  });

  describe('PUT /api/auth/profile', () => {
    it('200 met à jour prénom et préférences', async () => {
      const token = generateToken({ id: '507f1f77bcf86cd799439011', email: 'u@test.com', role: 'user' });
      const u = {
        _id: '507f1f77bcf86cd799439011',
        firstName: 'Old',
        lastName: 'L',
        email: 'u@test.com',
        phone: null,
        cabinNumber: null,
        country: null,
        dateOfBirth: null,
        preferences: {},
        save: mockSave,
      };
      let calls = 0;
      User.findById.mockImplementation(() => {
        calls += 1;
        if (calls === 1) return authUserDbQuery();
        return Promise.resolve(u);
      });
      const res = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ firstName: 'New', preferences: { theme: 'dark' } })
        .expect(200);
      expect(res.body.user.firstName).toBe('New');
      expect(res.body.user.preferences.theme).toBe('dark');
    });

    it('200 met à jour tous les champs optionnels du profil', async () => {
      const token = generateToken({ id: '507f1f77bcf86cd799439011', email: 'u@test.com', role: 'user' });
      const u = {
        _id: '507f1f77bcf86cd799439011',
        firstName: 'Old',
        lastName: 'OldL',
        email: 'u@test.com',
        phone: null,
        cabinNumber: null,
        country: null,
        dateOfBirth: null,
        preferences: { a: 1 },
        save: mockSave,
      };
      let calls = 0;
      User.findById.mockImplementation(() => {
        calls += 1;
        if (calls === 1) return authUserDbQuery();
        return Promise.resolve(u);
      });
      const res = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({
          lastName: 'NewL',
          phone: '+33 6 00 00 00 00',
          cabinNumber: 'C12',
          country: 'FR',
          dateOfBirth: '1990-05-15',
          preferences: { theme: 'light' },
        })
        .expect(200);
      expect(res.body.user.lastName).toBe('NewL');
      expect(res.body.user.cabinNumber).toBe('C12');
      expect(res.body.user.country).toBe('FR');
      expect(res.body.user.dateOfBirth).toBe('1990-05-15');
      expect(res.body.user.preferences.theme).toBe('light');
    });

    it('404 si profil introuvable', async () => {
      const token = generateToken({ id: '507f1f77bcf86cd799439011', email: 'u@test.com', role: 'user' });
      let calls = 0;
      User.findById.mockImplementation(() => {
        calls += 1;
        if (calls === 1) return authUserDbQuery();
        return Promise.resolve(null);
      });
      await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ firstName: 'X' })
        .expect(404);
    });

    it('500 si save profil échoue', async () => {
      mockSave.mockRejectedValueOnce(new Error('profile save'));
      const token = generateToken({ id: '507f1f77bcf86cd799439011', email: 'u@test.com', role: 'user' });
      const u = {
        _id: '507f1f77bcf86cd799439011',
        firstName: 'Old',
        lastName: 'L',
        email: 'u@test.com',
        phone: null,
        cabinNumber: null,
        country: null,
        dateOfBirth: null,
        preferences: {},
        save: mockSave,
      };
      let calls = 0;
      User.findById.mockImplementation(() => {
        calls += 1;
        if (calls === 1) return authUserDbQuery();
        return Promise.resolve(u);
      });
      const res = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ phone: '+33123456789' });
      expect(res.status).toBe(500);
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'auth_profile_update_failed', err: 'profile save' })
      );
    });
  });

  describe('PUT /api/auth/change-password', () => {
    it('400 si champs manquants', async () => {
      const token = generateToken({ id: '507f1f77bcf86cd799439011', email: 'u@test.com', role: 'user' });
      const res = await request(app).put('/api/auth/change-password').set('Authorization', `Bearer ${token}`).send({});
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
      User.findById.mockReturnValueOnce(authUserDbQuery()).mockReturnValueOnce({
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

    it('404 si utilisateur introuvable après select +password', async () => {
      const token = generateToken({ id: '507f1f77bcf86cd799439011', email: 'u@test.com', role: 'user' });
      User.findById.mockReturnValueOnce(authUserDbQuery()).mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });
      const res = await request(app)
        .put('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'oldpass12', newPassword: 'newpass12' });
      expect(res.status).toBe(404);
    });

    it('400 si mot de passe actuel incorrect', async () => {
      mockComparePassword.mockResolvedValue(false);
      const token = generateToken({ id: '507f1f77bcf86cd799439011', email: 'u@test.com', role: 'user' });
      User.findById.mockReturnValueOnce(authUserDbQuery()).mockReturnValue({
        select: jest.fn().mockResolvedValue({
          _id: '507f1f77bcf86cd799439011',
          comparePassword: mockComparePassword,
          save: mockSave,
        }),
      });
      const res = await request(app)
        .put('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'wrongpass1', newPassword: 'newpass12' });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/incorrect|actuel/i);
    });

    it('500 si save après changement de mot de passe échoue', async () => {
      mockComparePassword.mockResolvedValue(true);
      mockSave.mockRejectedValueOnce(new Error('pwd save'));
      const token = generateToken({ id: '507f1f77bcf86cd799439011', email: 'u@test.com', role: 'user' });
      User.findById.mockReturnValueOnce(authUserDbQuery()).mockReturnValue({
        select: jest.fn().mockResolvedValue({
          _id: '507f1f77bcf86cd799439011',
          comparePassword: mockComparePassword,
          save: mockSave,
        }),
      });
      const res = await request(app)
        .put('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'oldpass12', newPassword: 'newpass12' });
      expect(res.status).toBe(500);
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'auth_change_password_failed', err: 'pwd save' })
      );
    });
  });

  describe('GET/PUT /api/auth/user-data', () => {
    it('GET 200 avec favoris par défaut', async () => {
      const token = generateToken({ id: '507f1f77bcf86cd799439011', email: 'u@test.com', role: 'user' });
      User.findById.mockReturnValueOnce(authUserDbQuery()).mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            userData: {},
          }),
        }),
      });
      const res = await request(app).get('/api/auth/user-data').set('Authorization', `Bearer ${token}`).expect(200);
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
      User.findById.mockReturnValueOnce(authUserDbQuery()).mockImplementation(() => ({
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

    it('GET 404 si userData introuvable', async () => {
      const token = generateToken({ id: '507f1f77bcf86cd799439011', email: 'u@test.com', role: 'user' });
      let calls = 0;
      User.findById.mockImplementation(() => {
        calls += 1;
        if (calls === 1) return authUserDbQuery();
        return {
          select: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(null),
          }),
        };
      });
      await request(app).get('/api/auth/user-data').set('Authorization', `Bearer ${token}`).expect(404);
    });

    it('500 GET user-data si lean échoue', async () => {
      const token = generateToken({ id: '507f1f77bcf86cd799439011', email: 'u@test.com', role: 'user' });
      User.findById.mockReturnValueOnce(authUserDbQuery()).mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockRejectedValue(new Error('db lean')),
        }),
      });
      const res = await request(app).get('/api/auth/user-data').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(500);
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'auth_user_data_get_failed', err: 'db lean' })
      );
    });

    it('PUT 200 initialise userData si absent ou non-objet', async () => {
      const token = generateToken({ id: '507f1f77bcf86cd799439011', email: 'u@test.com', role: 'user' });
      const u = {
        _id: '507f1f77bcf86cd799439011',
        userData: null,
        markModified: jest.fn(),
        save: mockSave,
      };
      User.findById.mockReturnValueOnce(authUserDbQuery()).mockImplementation(() => Promise.resolve(u));
      const res = await request(app)
        .put('/api/auth/user-data')
        .set('Authorization', `Bearer ${token}`)
        .send({ favorites: { magazineIds: ['m1'] } });
      expect(res.status).toBe(200);
      expect(u.userData).toEqual(expect.objectContaining({ favorites: expect.any(Object) }));
    });

    it('PUT 404 user-data si utilisateur absent', async () => {
      const token = generateToken({ id: '507f1f77bcf86cd799439011', email: 'u@test.com', role: 'user' });
      User.findById.mockReturnValueOnce(authUserDbQuery()).mockReturnValue(Promise.resolve(null));
      await request(app)
        .put('/api/auth/user-data')
        .set('Authorization', `Bearer ${token}`)
        .send({ favorites: { magazineIds: [] } })
        .expect(404);
    });

    it('500 PUT user-data si save échoue', async () => {
      mockSave.mockRejectedValueOnce(new Error('persist failed'));
      const token = generateToken({ id: '507f1f77bcf86cd799439011', email: 'u@test.com', role: 'user' });
      const u = {
        _id: '507f1f77bcf86cd799439011',
        userData: { favorites: {}, playbackPositions: {} },
        markModified: jest.fn(),
        save: mockSave,
      };
      User.findById.mockReturnValueOnce(authUserDbQuery()).mockImplementation(() => Promise.resolve(u));
      const res = await request(app)
        .put('/api/auth/user-data')
        .set('Authorization', `Bearer ${token}`)
        .send({ favorites: { magazineIds: ['x'] } });
      expect(res.status).toBe(500);
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'auth_user_data_put_failed', err: 'persist failed' })
      );
    });

    it('PUT favoris : magazineIds non-tableau conserve la valeur précédente', async () => {
      const token = generateToken({ id: '507f1f77bcf86cd799439011', email: 'u@test.com', role: 'user' });
      const u = {
        _id: '507f1f77bcf86cd799439011',
        userData: {
          favorites: { magazineIds: ['keep-me'], restaurantIds: [], enfantIds: [], watchlist: [], shopItems: [] },
          playbackPositions: {},
        },
        markModified: jest.fn(),
        save: mockSave,
      };
      User.findById.mockReturnValueOnce(authUserDbQuery()).mockImplementation(() => Promise.resolve(u));
      await request(app)
        .put('/api/auth/user-data')
        .set('Authorization', `Bearer ${token}`)
        .send({ favorites: { magazineIds: 'bad', restaurantIds: ['r1'] } })
        .expect(200);
      expect(u.userData.favorites.magazineIds).toEqual(['keep-me']);
      expect(u.userData.favorites.restaurantIds).toEqual(['r1']);
    });

    it('PUT ignore playbackPositions null (ne remplace pas)', async () => {
      const token = generateToken({ id: '507f1f77bcf86cd799439011', email: 'u@test.com', role: 'user' });
      const u = {
        _id: '507f1f77bcf86cd799439011',
        userData: {
          favorites: { magazineIds: [], restaurantIds: [], enfantIds: [], watchlist: [], shopItems: [] },
          playbackPositions: { a: 1 },
        },
        markModified: jest.fn(),
        save: mockSave,
      };
      User.findById.mockReturnValueOnce(authUserDbQuery()).mockImplementation(() => Promise.resolve(u));
      await request(app)
        .put('/api/auth/user-data')
        .set('Authorization', `Bearer ${token}`)
        .send({ favorites: { magazineIds: [] }, playbackPositions: null })
        .expect(200);
      expect(u.userData.playbackPositions).toEqual({ a: 1 });
    });
  });

  describe('POST /api/auth/register', () => {
    it('400 mot de passe faible si role admin dans le body', async () => {
      const adminToken = generateToken({ id: 'admin-id', email: 'admin@test.com', role: 'admin' });
      User.findOne.mockResolvedValue(null);
      User.findById.mockReturnValue(mockFindByIdChain({ _id: 'admin-id', role: 'admin', isActive: true }));
      const res = await request(app).post('/api/auth/register').set('Cookie', `authToken=${adminToken}`).send({
        firstName: 'A',
        lastName: 'B',
        email: 'weakadmin@test.com',
        password: 'weak',
        role: 'admin',
      });
      expect(res.status).toBe(400);
    });

    it('400 si email déjà enregistré', async () => {
      const adminId = '507f1f77bcf86cd799439099';
      const adminToken = generateToken({ id: adminId, email: 'admin@test.com', role: 'admin' });
      User.findOne.mockResolvedValue({ _id: 'existing', email: 'taken@test.com' });
      User.findById.mockImplementation((id) => {
        if (String(id) === adminId) {
          return mockFindByIdChain({ _id: adminId, role: 'admin', isActive: true });
        }
        return authUserDbQuery();
      });
      const res = await request(app)
        .post('/api/auth/register')
        .set('Cookie', `authToken=${adminToken}`)
        .send({
          firstName: 'N',
          lastName: 'U',
          email: 'taken@test.com',
          password: 'Validpass1!',
        });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/already exists|email/i);
    });

    it('500 si logAction échoue après inscription (catch register)', async () => {
      const adminId = '507f1f77bcf86cd799439099';
      const adminToken = generateToken({ id: adminId, email: 'admin@test.com', role: 'admin' });
      User.findOne.mockResolvedValue(null);
      mockSave.mockResolvedValue(undefined);
      auditService.logAction.mockRejectedValueOnce(new Error('audit fail'));
      User.findById.mockImplementation((id) => {
        if (String(id) === adminId) {
          return mockFindByIdChain({ _id: adminId, role: 'admin', isActive: true });
        }
        return authUserDbQuery();
      });
      const res = await request(app)
        .post('/api/auth/register')
        .set('Cookie', `authToken=${adminToken}`)
        .send({
          firstName: 'N',
          lastName: 'U',
          email: 'newuser-audit-fail@test.com',
          password: 'Validpass1!',
        });
      expect(res.status).toBe(500);
      expect(res.body.message).toMatch(/Server error during registration/i);
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'auth_register_failed', err: 'audit fail' })
      );
    });
  });
});
