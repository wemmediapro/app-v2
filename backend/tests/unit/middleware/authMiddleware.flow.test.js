/**
 * Flux authMiddleware : token, blacklist cache, MongoDB, erreurs JWT.
 */
jest.mock('../../../src/models/User', () => ({
  findById: jest.fn(),
}));

jest.mock('../../../src/lib/cache-manager', () => ({
  isConnected: false,
  get: jest.fn(),
  set: jest.fn(),
}));

const jwt = require('jsonwebtoken');
const config = require('../../../src/config');
const {
  authMiddleware,
  adminMiddleware,
  requireRole,
  generateToken,
  generateAccessToken,
  verifyToken,
  optionalAuth,
  generateTokenCompat,
  verifyTwoFactorChallengeToken,
  isMfaExemptApiPath,
  generateTwoFactorChallengeToken,
} = require('../../../src/middleware/auth');
const User = require('../../../src/models/User');
const cacheManager = require('../../../src/lib/cache-manager');

describe('authMiddleware (flux)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    cacheManager.isConnected = false;
  });

  it('401 si aucun token', async () => {
    const req = { cookies: {}, header: () => '' };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    await authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('401 JsonWebTokenError', async () => {
    const req = {
      cookies: {},
      header: (n) => (n === 'Authorization' ? 'Bearer not-a.jwt' : ''),
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    await authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_TOKEN' }));
  });

  it('401 TokenExpiredError', async () => {
    const secret = process.env.JWT_SECRET;
    const expired = jwt.sign({ id: '507f1f77bcf86cd799439011' }, secret, { expiresIn: '-30s' });
    const req = {
      cookies: {},
      header: (n) => (n === 'Authorization' ? `Bearer ${expired}` : ''),
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    await authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'TOKEN_EXPIRED' }));
  });

  it('401 si token révoqué (Redis blacklist)', async () => {
    cacheManager.isConnected = true;
    cacheManager.get.mockResolvedValue('1');
    const token = generateToken({ id: '507f1f77bcf86cd799439011', email: 'u@test.com', role: 'user' });
    const req = {
      cookies: {},
      header: (n) => (n === 'Authorization' ? `Bearer ${token}` : ''),
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    await authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'TOKEN_REVOKED' }));
  });

  it('401 INVALID_TOKEN_TYPE si JWT typ 2fa_challenge', async () => {
    const secret = process.env.JWT_SECRET;
    const challenge = jwt.sign(
      { typ: '2fa_challenge', id: '507f1f77bcf86cd799439011', sub: '507f1f77bcf86cd799439011' },
      secret,
      { expiresIn: '5m' }
    );
    const req = {
      originalUrl: '/api/users',
      cookies: {},
      header: (n) => (n === 'Authorization' ? `Bearer ${challenge}` : ''),
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    await authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_TOKEN_TYPE' }));
    expect(next).not.toHaveBeenCalled();
  });

  it('401 MFA_REQUIRED pour admin avec 2FA sans claim mfa (hors routes exemptées)', async () => {
    User.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: '507f1f77bcf86cd799439011',
          email: 'a@test.com',
          role: 'admin',
          twoFactorEnabled: true,
          isActive: true,
        }),
      }),
    });
    const token = generateToken({ id: '507f1f77bcf86cd799439011', email: 'a@test.com', role: 'admin' });
    const req = {
      originalUrl: '/api/users',
      url: '/api/users',
      cookies: {},
      header(n) {
        if (n === 'Authorization') {
          return `Bearer ${token}`;
        }
        return '';
      },
      get(name) {
        return this.header(name);
      },
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    await authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'MFA_REQUIRED' }));
    expect(next).not.toHaveBeenCalled();
  });

  it('next si admin 2FA avec en-tête X-2FA-Token TOTP valide', async () => {
    const speakeasy = require('speakeasy');
    const sec = speakeasy.generateSecret({ length: 20 });
    const totp = speakeasy.totp({ secret: sec.base32, encoding: 'base32' });
    User.findById.mockImplementation(() => ({
      select(sel) {
        const s = String(sel);
        if (s.includes('twoFactorSecret')) {
          return {
            lean: jest.fn().mockResolvedValue({ twoFactorSecret: sec.base32 }),
          };
        }
        return {
          lean: jest.fn().mockResolvedValue({
            _id: '507f1f77bcf86cd799439011',
            email: 'a@test.com',
            role: 'admin',
            twoFactorEnabled: true,
            isActive: true,
          }),
        };
      },
    }));
    const token = generateToken({ id: '507f1f77bcf86cd799439011', email: 'a@test.com', role: 'admin' });
    const req = {
      originalUrl: '/api/users',
      cookies: {},
      header(n) {
        if (n === 'Authorization') {
          return `Bearer ${token}`;
        }
        return '';
      },
      get(name) {
        if (name === 'X-2FA-Token' || name === 'x-2fa-token') {
          return totp;
        }
        return this.header(name);
      },
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    await authMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('next + req.user après lookup Mongo', async () => {
    cacheManager.isConnected = false;
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
    const req = {
      cookies: {},
      header: (n) => (n === 'Authorization' ? `Bearer ${token}` : ''),
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    await authMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user).toMatchObject({ email: 'u@test.com', role: 'user' });
  });

  it('401 compte désactivé', async () => {
    User.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: '507f1f77bcf86cd799439011',
          email: 'u@test.com',
          role: 'user',
          isActive: false,
        }),
      }),
    });
    const token = generateToken({ id: '507f1f77bcf86cd799439011', email: 'u@test.com', role: 'user' });
    const req = {
      cookies: {},
      header: (n) => (n === 'Authorization' ? `Bearer ${token}` : ''),
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    await authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'ACCOUNT_DEACTIVATED' }));
  });

  it('utilise le cache Redis utilisateur si présent', async () => {
    cacheManager.isConnected = true;
    cacheManager.get.mockImplementation(async (key) => {
      if (String(key).startsWith('blacklist:')) {
        return null;
      }
      if (String(key).startsWith('auth:user:')) {
        return { _id: '507f1f77bcf86cd799439011', email: 'cached@test.com', role: 'user', isActive: true };
      }
      return null;
    });
    const token = generateToken({ id: '507f1f77bcf86cd799439011', email: 'u@test.com', role: 'user' });
    const req = {
      cookies: {},
      header: (n) => (n === 'Authorization' ? `Bearer ${token}` : ''),
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    await authMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user.email).toBe('cached@test.com');
    expect(User.findById).not.toHaveBeenCalled();
  });

  it('cache utilisateur avec id seul (sans _id) alimente req.user.id', async () => {
    cacheManager.isConnected = true;
    cacheManager.get.mockImplementation(async (key) => {
      if (String(key).startsWith('blacklist:')) return null;
      if (String(key).startsWith('auth:user:')) {
        return { id: '507f1f77bcf86cd799439011', email: 'idonly@test.com', role: 'user', isActive: true };
      }
      return null;
    });
    const token = generateToken({ id: '507f1f77bcf86cd799439011', role: 'user' });
    const req = {
      cookies: {},
      header: (n) => (n === 'Authorization' ? `Bearer ${token}` : ''),
    };
    const next = jest.fn();
    await authMiddleware(req, {}, next);
    expect(next).toHaveBeenCalled();
    expect(req.user.id).toBe('507f1f77bcf86cd799439011');
    expect(req.user.email).toBe('idonly@test.com');
  });

  it('401 payload JWT sans id / userId / _id', async () => {
    const secret = process.env.JWT_SECRET;
    const token = jwt.sign({ role: 'orphan' }, secret, { expiresIn: '1h' });
    const req = {
      cookies: {},
      header: (n) => (n === 'Authorization' ? `Bearer ${token}` : ''),
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    await authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Invalid token payload.' }));
  });

  it('ignore erreur Redis sur lecture blacklist puis continue', async () => {
    cacheManager.isConnected = true;
    cacheManager.get.mockImplementation(async (key) => {
      if (String(key).startsWith('blacklist:')) {
        throw new Error('redis down');
      }
      return null;
    });
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
    const req = {
      cookies: {},
      header: (n) => (n === 'Authorization' ? `Bearer ${token}` : ''),
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    await authMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('401 cache utilisateur marqué invalid', async () => {
    cacheManager.isConnected = true;
    cacheManager.get.mockImplementation(async (key) => {
      if (String(key).startsWith('blacklist:')) return null;
      if (String(key).startsWith('auth:user:')) return { invalid: true };
      return null;
    });
    const token = generateToken({ id: '507f1f77bcf86cd799439011', role: 'user' });
    const req = {
      cookies: {},
      header: (n) => (n === 'Authorization' ? `Bearer ${token}` : ''),
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    await authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_TOKEN' }));
  });

  it('401 cache utilisateur isActive false', async () => {
    cacheManager.isConnected = true;
    cacheManager.get.mockImplementation(async (key) => {
      if (String(key).startsWith('blacklist:')) return null;
      if (String(key).startsWith('auth:user:')) {
        return { _id: '507f1f77bcf86cd799439011', email: 'u@test.com', role: 'user', isActive: false };
      }
      return null;
    });
    const token = generateToken({ id: '507f1f77bcf86cd799439011', role: 'user' });
    const req = {
      cookies: {},
      header: (n) => (n === 'Authorization' ? `Bearer ${token}` : ''),
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    await authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'ACCOUNT_DEACTIVATED' }));
  });

  it('erreur lecture cache auth:user → fallback Mongo', async () => {
    cacheManager.isConnected = true;
    cacheManager.get.mockImplementation(async (key) => {
      if (String(key).startsWith('blacklist:')) return null;
      if (String(key).startsWith('auth:user:')) throw new Error('cache read');
      return null;
    });
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
    const req = {
      cookies: {},
      header: (n) => (n === 'Authorization' ? `Bearer ${token}` : ''),
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    await authMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(User.findById).toHaveBeenCalled();
  });

  it('401 utilisateur absent + enregistre invalid dans le cache Redis', async () => {
    cacheManager.isConnected = true;
    cacheManager.get.mockResolvedValue(null);
    cacheManager.set.mockResolvedValue(undefined);
    User.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      }),
    });
    const token = generateToken({ id: '507f1f77bcf86cd799439011', role: 'user' });
    const req = {
      cookies: {},
      header: (n) => (n === 'Authorization' ? `Bearer ${token}` : ''),
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    await authMiddleware(req, res, next);
    expect(cacheManager.set).toHaveBeenCalledWith(
      'auth:user:507f1f77bcf86cd799439011',
      { invalid: true },
      60
    );
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('401 utilisateur absent sans Redis : pas d’écriture cache invalid', async () => {
    cacheManager.isConnected = false;
    User.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      }),
    });
    const token = generateToken({ id: '507f1f77bcf86cd799439011', role: 'user' });
    const req = {
      cookies: {},
      header: (n) => (n === 'Authorization' ? `Bearer ${token}` : ''),
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    await authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(cacheManager.set).not.toHaveBeenCalled();
  });

  it('401 compte désactivé (Mongo) + cache invalid si Redis', async () => {
    cacheManager.isConnected = true;
    cacheManager.get.mockResolvedValue(null);
    User.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: '507f1f77bcf86cd799439011',
          email: 'u@test.com',
          role: 'user',
          isActive: false,
        }),
      }),
    });
    const token = generateToken({ id: '507f1f77bcf86cd799439011', role: 'user' });
    const req = {
      cookies: {},
      header: (n) => (n === 'Authorization' ? `Bearer ${token}` : ''),
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    await authMiddleware(req, res, next);
    expect(cacheManager.set).toHaveBeenCalledWith(
      'auth:user:507f1f77bcf86cd799439011',
      expect.objectContaining({ invalid: true }),
      60
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'ACCOUNT_DEACTIVATED' }));
  });

  it('next admin 2FA sur route exemptée /api/auth/me sans claim mfa', async () => {
    User.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: '507f1f77bcf86cd799439011',
          email: 'a@test.com',
          role: 'admin',
          twoFactorEnabled: true,
          isActive: true,
        }),
      }),
    });
    const token = generateToken({ id: '507f1f77bcf86cd799439011', email: 'a@test.com', role: 'admin' });
    const req = {
      originalUrl: '/api/auth/me',
      url: '/api/auth/me',
      cookies: {},
      header: (n) => (n === 'Authorization' ? `Bearer ${token}` : ''),
      get: (n) => req.header(n),
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    await authMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('401 MFA si X-2FA-Token 6 chiffres mais secret 2FA absent en base', async () => {
    User.findById.mockImplementation(() => ({
      select(sel) {
        const s = String(sel);
        if (s.includes('twoFactorSecret')) {
          return { lean: jest.fn().mockResolvedValue({ twoFactorSecret: null }) };
        }
        return {
          lean: jest.fn().mockResolvedValue({
            _id: '507f1f77bcf86cd799439011',
            email: 'a@test.com',
            role: 'admin',
            twoFactorEnabled: true,
            isActive: true,
          }),
        };
      },
    }));
    const token = generateToken({ id: '507f1f77bcf86cd799439011', email: 'a@test.com', role: 'admin' });
    const req = {
      originalUrl: '/api/admin/x',
      cookies: {},
      header(n) {
        if (n === 'Authorization') return `Bearer ${token}`;
        return '';
      },
      get(name) {
        if (name === 'X-2FA-Token') return '123456';
        return this.header(name);
      },
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    await authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'MFA_REQUIRED' }));
  });

  it('401 MFA : erreur lecture secret TOTP (lean rejette) avec X-2FA-Token', async () => {
    User.findById.mockImplementation(() => ({
      select(sel) {
        const s = String(sel);
        if (s.includes('twoFactorSecret')) {
          return { lean: jest.fn().mockRejectedValue(new Error('db')) };
        }
        return {
          lean: jest.fn().mockResolvedValue({
            _id: '507f1f77bcf86cd799439011',
            email: 'a@test.com',
            role: 'admin',
            twoFactorEnabled: true,
            isActive: true,
          }),
        };
      },
    }));
    const token = generateToken({ id: '507f1f77bcf86cd799439011', email: 'a@test.com', role: 'admin' });
    const req = {
      originalUrl: '/api/admin/x',
      cookies: {},
      header(n) {
        if (n === 'Authorization') return `Bearer ${token}`;
        return '';
      },
      get(name) {
        if (name === 'X-2FA-Token') return '123456';
        return this.header(name);
      },
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    await authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'MFA_REQUIRED' }));
  });

  it('401 erreur inattendue après verifyToken (ex. lean)', async () => {
    User.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockRejectedValue(new Error('db')),
      }),
    });
    const token = generateToken({ id: '507f1f77bcf86cd799439011', role: 'user' });
    const req = {
      cookies: {},
      header: (n) => (n === 'Authorization' ? `Bearer ${token}` : ''),
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    await authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Invalid token.' });
  });
});

describe('authMiddleware — JWT secret absent (config mutable)', () => {
  let savedSecret;
  beforeAll(() => {
    savedSecret = config.jwt.secret;
  });
  afterEach(() => {
    config.jwt.secret = savedSecret;
  });

  it('503 authMiddleware si jwt.secret vide', async () => {
    config.jwt.secret = '';
    const req = { cookies: {}, header: () => '' };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    await authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'JWT_NOT_CONFIGURED' })
    );
  });

  it('503 optionalAuth si jwt.secret vide', async () => {
    config.jwt.secret = '';
    const req = { cookies: {}, header: () => '' };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    await optionalAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'JWT_NOT_CONFIGURED' }));
  });
});

describe('adminMiddleware', () => {
  const origEnv = process.env.NODE_ENV;
  const origOpt = process.env.ADMIN_2FA_OPTIONAL;

  afterEach(() => {
    process.env.NODE_ENV = origEnv;
    process.env.ADMIN_2FA_OPTIONAL = origOpt;
  });

  it('403 en production si admin sans 2FA hors routes onboarding', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ADMIN_2FA_OPTIONAL;
    const req = {
      user: { role: 'admin', twoFactorEnabled: false },
      originalUrl: '/api/admin/users',
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    await adminMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'ADMIN_2FA_SETUP_REQUIRED' }));
  });

  it('next en production si admin sans 2FA mais req.path est route onboarding', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ADMIN_2FA_OPTIONAL;
    const req = {
      user: { role: 'admin', twoFactorEnabled: false },
      path: '/auth/2fa/setup',
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    await adminMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('next en production si originalUrl complète /api/auth/register', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ADMIN_2FA_OPTIONAL;
    const req = {
      user: { role: 'admin', twoFactorEnabled: false },
      originalUrl: '/api/auth/register',
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    await adminMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('next si production et ADMIN_2FA_OPTIONAL=1', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ADMIN_2FA_OPTIONAL = '1';
    const req = {
      user: { role: 'admin', twoFactorEnabled: false },
      originalUrl: '/api/admin/users',
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    await adminMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('403 catch si accès à req.user lève', async () => {
    const req = {
      get user() {
        throw new Error('boom');
      },
      originalUrl: '/api/x',
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    await adminMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: 'Access denied.' });
  });
});

describe('requireRole', () => {
  it('403 si rôle insuffisant', () => {
    const mw = requireRole('admin');
    const req = { user: { role: 'user' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    mw(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'INSUFFICIENT_PERMISSIONS' }));
  });

  it('next si rôle ok', () => {
    const mw = requireRole('admin', 'crew');
    const req = { user: { role: 'crew' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    mw(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});

describe('isMfaExemptApiPath', () => {
  it('exempte /api/auth/me avec query', () => {
    expect(isMfaExemptApiPath({ originalUrl: '/api/auth/me?x=1' })).toBe(true);
  });

  it('n’exempte pas une route arbitraire', () => {
    expect(isMfaExemptApiPath({ originalUrl: '/api/admin/logs' })).toBe(false);
  });

  it('sans originalUrl ni url : chemin normalisé / (non exempt)', () => {
    expect(isMfaExemptApiPath({})).toBe(false);
  });

  it('seulement req.url si pas d’originalUrl', () => {
    expect(isMfaExemptApiPath({ url: '/api/auth/logout' })).toBe(true);
  });
});

describe('generateAccessToken', () => {
  const origAccess = process.env.JWT_ACCESS_EXPIRES_IN;

  afterEach(() => {
    if (origAccess === undefined) delete process.env.JWT_ACCESS_EXPIRES_IN;
    else process.env.JWT_ACCESS_EXPIRES_IN = origAccess;
  });

  it('produit un JWT vérifiable (exp courte)', () => {
    const t = generateAccessToken({ id: '507f1f77bcf86cd799439011', sub: 'sub' });
    const d = verifyToken(t);
    expect(d.id || d.sub).toBeDefined();
  });

  it('respecte JWT_ACCESS_EXPIRES_IN', () => {
    process.env.JWT_ACCESS_EXPIRES_IN = '2h';
    const t = generateAccessToken({ id: '507f1f77bcf86cd799439011' });
    const d = jwt.decode(t);
    const now = Math.floor(Date.now() / 1000);
    const delta = d.exp - now;
    expect(delta).toBeGreaterThan(7000);
    expect(delta).toBeLessThan(7300);
  });
});

describe('optionalAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    cacheManager.isConnected = false;
  });

  it('next sans token → req.user null', async () => {
    const req = { cookies: {}, header: () => '' };
    const res = {};
    const next = jest.fn();
    await optionalAuth(req, res, next);
    expect(req.user).toBeNull();
    expect(next).toHaveBeenCalled();
  });

  it('next avec token valide → req.user défini', async () => {
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
    const req = {
      cookies: {},
      header: (n) => (n === 'Authorization' ? `Bearer ${token}` : ''),
    };
    const res = {};
    const next = jest.fn();
    await optionalAuth(req, res, next);
    expect(req.user).toMatchObject({ email: 'u@test.com' });
    expect(next).toHaveBeenCalled();
  });

  it('utilise le cache Redis si entrée valide', async () => {
    cacheManager.isConnected = true;
    cacheManager.get.mockImplementation(async (key) => {
      if (String(key).startsWith('auth:user:')) {
        return { _id: '507f1f77bcf86cd799439011', email: 'c@test.com', role: 'user', isActive: true };
      }
      return null;
    });
    const token = generateToken({ id: '507f1f77bcf86cd799439011', role: 'user' });
    const req = {
      cookies: {},
      header: (n) => (n === 'Authorization' ? `Bearer ${token}` : ''),
    };
    const next = jest.fn();
    await optionalAuth(req, {}, next);
    expect(req.user.email).toBe('c@test.com');
    expect(User.findById).not.toHaveBeenCalled();
  });

  it('cache avec id seul (sans _id) définit req.user.id', async () => {
    cacheManager.isConnected = true;
    cacheManager.get.mockResolvedValue({
      id: '507f1f77bcf86cd799439011',
      email: 'optid@test.com',
      role: 'user',
      isActive: true,
    });
    const token = generateToken({ id: '507f1f77bcf86cd799439011', role: 'user' });
    const req = {
      cookies: {},
      header: (n) => (n === 'Authorization' ? `Bearer ${token}` : ''),
    };
    const next = jest.fn();
    await optionalAuth(req, {}, next);
    expect(req.user.id).toBe('507f1f77bcf86cd799439011');
    expect(req.user.email).toBe('optid@test.com');
  });

  it('cache Redis non-objet → fallback Mongo', async () => {
    cacheManager.isConnected = true;
    cacheManager.get.mockResolvedValue('corrupt');
    User.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: '507f1f77bcf86cd799439011',
          email: 'mongo@test.com',
          role: 'user',
          isActive: true,
        }),
      }),
    });
    const token = generateToken({ id: '507f1f77bcf86cd799439011', role: 'user' });
    const req = {
      cookies: {},
      header: (n) => (n === 'Authorization' ? `Bearer ${token}` : ''),
    };
    const next = jest.fn();
    await optionalAuth(req, {}, next);
    expect(User.findById).toHaveBeenCalled();
    expect(req.user.email).toBe('mongo@test.com');
  });

  it('cache invalid → req.user null', async () => {
    cacheManager.isConnected = true;
    cacheManager.get.mockResolvedValue({ invalid: true });
    const token = generateToken({ id: '507f1f77bcf86cd799439011', role: 'user' });
    const req = {
      cookies: {},
      header: (n) => (n === 'Authorization' ? `Bearer ${token}` : ''),
    };
    const next = jest.fn();
    await optionalAuth(req, {}, next);
    expect(req.user).toBeNull();
    expect(next).toHaveBeenCalled();
  });

  it('erreur lecture cache → fallback Mongo', async () => {
    cacheManager.isConnected = true;
    cacheManager.get.mockRejectedValue(new Error('redis'));
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
    const token = generateToken({ id: '507f1f77bcf86cd799439011', role: 'user' });
    const req = {
      cookies: {},
      header: (n) => (n === 'Authorization' ? `Bearer ${token}` : ''),
    };
    const next = jest.fn();
    await optionalAuth(req, {}, next);
    expect(req.user).toMatchObject({ email: 'u@test.com' });
  });

  it('token JWT illisible → req.user null', async () => {
    const req = {
      cookies: {},
      header: (n) => (n === 'Authorization' ? 'Bearer not-a-jwt' : ''),
    };
    const next = jest.fn();
    await optionalAuth(req, {}, next);
    expect(req.user).toBeNull();
    expect(next).toHaveBeenCalled();
  });

  it('utilisateur inactif → req.user null', async () => {
    User.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: '507f1f77bcf86cd799439011',
          email: 'u@test.com',
          role: 'user',
          isActive: false,
        }),
      }),
    });
    const token = generateToken({ id: '507f1f77bcf86cd799439011', role: 'user' });
    const req = {
      cookies: {},
      header: (n) => (n === 'Authorization' ? `Bearer ${token}` : ''),
    };
    const next = jest.fn();
    await optionalAuth(req, {}, next);
    expect(req.user).toBeNull();
  });

  it('payload sans userId → req.user null', async () => {
    const secret = process.env.JWT_SECRET;
    const token = jwt.sign({ n: 1 }, secret, { expiresIn: '1h' });
    const req = {
      cookies: {},
      header: (h) => (h === 'Authorization' ? `Bearer ${token}` : ''),
    };
    const next = jest.fn();
    await optionalAuth(req, {}, next);
    expect(req.user).toBeNull();
  });

  it('catch externe : si next() lève, remet req.user à null et rappelle next', async () => {
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
    const req = {
      cookies: {},
      header: (n) => (n === 'Authorization' ? `Bearer ${token}` : ''),
    };
    const next = jest
      .fn()
      .mockImplementationOnce(() => {
        throw new Error('next boom');
      })
      .mockImplementation(() => {});
    await optionalAuth(req, {}, next);
    expect(req.user).toBeNull();
    expect(next).toHaveBeenCalledTimes(2);
  });
});

describe('generateTokenCompat', () => {
  it('accepte un id string', () => {
    const t = generateTokenCompat('507f1f77bcf86cd799439011');
    const d = verifyToken(t);
    expect(d.id || d.userId).toBeDefined();
  });

  it('accepte un objet payload tel quel', () => {
    const t = generateTokenCompat({ id: '507f1f77bcf86cd799439011', role: 'admin', custom: 1 });
    const d = verifyToken(t);
    expect(d.role).toBe('admin');
    expect(d.custom).toBe(1);
  });

  it('null → id et userId null dans le payload', () => {
    const t = generateTokenCompat(null);
    const d = jwt.decode(t);
    expect(d.id).toBeNull();
    expect(d.userId).toBeNull();
  });
});

describe('generateToken — option expiresIn env', () => {
  const origA = process.env.JWT_EXPIRES_IN;
  const origB = process.env.JWT_EXPIRE;

  afterEach(() => {
    if (origA === undefined) delete process.env.JWT_EXPIRES_IN;
    else process.env.JWT_EXPIRES_IN = origA;
    if (origB === undefined) delete process.env.JWT_EXPIRE;
    else process.env.JWT_EXPIRE = origB;
  });

  it('utilise JWT_EXPIRE si JWT_EXPIRES_IN est absent', () => {
    delete process.env.JWT_EXPIRES_IN;
    process.env.JWT_EXPIRE = '2d';
    const t = generateToken({ id: '507f1f77bcf86cd799439011' });
    const d = jwt.decode(t);
    expect(d.exp).toBeDefined();
  });

  it('priorise JWT_EXPIRES_IN sur JWT_EXPIRE', () => {
    process.env.JWT_EXPIRE = '30d';
    process.env.JWT_EXPIRES_IN = '1h';
    const t = generateToken({ id: '507f1f77bcf86cd799439011' });
    const d = jwt.decode(t);
    const now = Math.floor(Date.now() / 1000);
    const delta = d.exp - now;
    expect(delta).toBeLessThan(3700);
    expect(delta).toBeGreaterThan(3500);
  });

  it('défaut 7d si JWT_EXPIRES_IN et JWT_EXPIRE absents', () => {
    delete process.env.JWT_EXPIRES_IN;
    delete process.env.JWT_EXPIRE;
    const t = generateToken({ id: '507f1f77bcf86cd799439011' });
    const d = jwt.decode(t);
    const now = Math.floor(Date.now() / 1000);
    const delta = d.exp - now;
    expect(delta).toBeGreaterThan(600000);
    expect(delta).toBeLessThan(620000);
  });
});

describe('generateTwoFactorChallengeToken', () => {
  it('email chaîne vide → pas de claim email dans le JWT', () => {
    const t = generateTwoFactorChallengeToken('507f1f77bcf86cd799439011', '');
    const d = jwt.decode(t);
    expect(d.email).toBeUndefined();
  });
});

describe('verifyTwoFactorChallengeToken', () => {
  it('rejette un JWT de session (typ !== 2fa_challenge)', () => {
    const t = generateToken({ id: '507f1f77bcf86cd799439011', email: 'u@test.com', role: 'user' });
    expect(() => verifyTwoFactorChallengeToken(t)).toThrow();
  });
});
