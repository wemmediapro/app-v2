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
const {
  authMiddleware,
  generateToken,
  verifyToken,
  optionalAuth,
  generateTokenCompat,
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
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'INVALID_TOKEN' })
    );
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
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'TOKEN_EXPIRED' })
    );
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
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'TOKEN_REVOKED' })
    );
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
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'ACCOUNT_DEACTIVATED' })
    );
  });

  it('utilise le cache Redis utilisateur si présent', async () => {
    cacheManager.isConnected = true;
    cacheManager.get.mockImplementation(async (key) => {
      if (String(key).startsWith('blacklist:')) return null;
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
});

describe('generateTokenCompat', () => {
  it('accepte un id string', () => {
    const t = generateTokenCompat('507f1f77bcf86cd799439011');
    const d = verifyToken(t);
    expect(d.id || d.userId).toBeDefined();
  });
});
