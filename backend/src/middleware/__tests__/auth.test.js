/**
 * Tests unitaires — middleware auth (getTokenFromRequest, adminMiddleware, requireRole)
 */

jest.mock('../../config', () => ({ jwt: { secret: 'test-secret-at-least-32-characters-long!!' } }));
jest.mock('../../models/User', () => ({
  findById: jest.fn(),
}));
jest.mock('../../lib/cache-manager', () => ({
  isConnected: false,
  get: jest.fn(),
  set: jest.fn(),
}));

const { getTokenFromRequest, adminMiddleware, requireRole, generateToken, verifyToken } = require('../auth');

describe('auth middleware', () => {
  describe('getTokenFromRequest', () => {
    it('retourne le token depuis le cookie authToken', () => {
      const req = { cookies: { authToken: 'cookie-token' }, header: () => '' };
      expect(getTokenFromRequest(req)).toBe('cookie-token');
    });

    it('retourne le token depuis Authorization Bearer si pas de cookie', () => {
      const req = {
        cookies: {},
        header: (name) => (name === 'Authorization' ? 'Bearer header-token' : ''),
      };
      expect(getTokenFromRequest(req)).toBe('header-token');
    });

    it('retourne une chaîne vide si pas de token', () => {
      const req = { cookies: {}, header: () => '' };
      expect(getTokenFromRequest(req)).toBe('');
    });
  });

  describe('adminMiddleware', () => {
    it('retourne 401 si req.user absent', async () => {
      const req = {};
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();
      await adminMiddleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Authentication required.' }));
      expect(next).not.toHaveBeenCalled();
    });

    it('retourne 403 si req.user.role !== admin', async () => {
      const req = { user: { id: '1', role: 'user' } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();
      await adminMiddleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('appelle next() si req.user.role === admin', async () => {
      const req = { user: { id: '1', role: 'admin' } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();
      await adminMiddleware(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('production : 403 ADMIN_2FA_SETUP_REQUIRED si admin sans 2FA hors onboarding', async () => {
      const prev = process.env.NODE_ENV;
      delete process.env.ADMIN_2FA_OPTIONAL;
      process.env.NODE_ENV = 'production';
      const req = {
        user: { id: '1', role: 'admin', twoFactorEnabled: false },
        originalUrl: '/api/v1/movies',
      };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();
      await adminMiddleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'ADMIN_2FA_SETUP_REQUIRED' }));
      expect(next).not.toHaveBeenCalled();
      process.env.NODE_ENV = prev;
    });

    it('production : laisse passer admin sans 2FA pour POST /auth/2fa/setup', async () => {
      const prev = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      const req = {
        user: { id: '1', role: 'admin', twoFactorEnabled: false },
        originalUrl: '/api/v1/auth/2fa/setup',
      };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();
      await adminMiddleware(req, res, next);
      expect(next).toHaveBeenCalled();
      process.env.NODE_ENV = prev;
    });

    it('production : laisse passer /auth/register avant 2FA (bootstrap comptes)', async () => {
      const prev = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      const req = {
        user: { id: '1', role: 'admin', twoFactorEnabled: false },
        originalUrl: '/api/v1/auth/register',
      };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();
      await adminMiddleware(req, res, next);
      expect(next).toHaveBeenCalled();
      process.env.NODE_ENV = prev;
    });

    it('production : ADMIN_2FA_OPTIONAL=1 désactive le blocage 2FA', async () => {
      const prevEnv = process.env.NODE_ENV;
      const prevOpt = process.env.ADMIN_2FA_OPTIONAL;
      process.env.NODE_ENV = 'production';
      process.env.ADMIN_2FA_OPTIONAL = '1';
      const req = {
        user: { id: '1', role: 'admin', twoFactorEnabled: false },
        originalUrl: '/api/v1/movies',
      };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();
      await adminMiddleware(req, res, next);
      expect(next).toHaveBeenCalled();
      process.env.NODE_ENV = prevEnv;
      process.env.ADMIN_2FA_OPTIONAL = prevOpt;
    });
  });

  describe('requireRole', () => {
    it('retourne 401 si req.user absent', () => {
      const req = {};
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();
      requireRole('admin')(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('retourne 403 si rôle non autorisé', () => {
      const req = { user: { role: 'user' } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();
      requireRole('admin')(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('appelle next() si rôle autorisé', () => {
      const req = { user: { role: 'admin' } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();
      requireRole('admin', 'editor')(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('generateToken / verifyToken', () => {
    it('generateToken produit un JWT décodable par verifyToken', () => {
      const payload = { id: 'user123', email: 'u@test.com', role: 'user' };
      const token = generateToken(payload);
      expect(typeof token).toBe('string');
      const decoded = verifyToken(token);
      expect(decoded).toMatchObject({ id: payload.id, email: payload.email, role: payload.role });
      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();
    });
  });
});
