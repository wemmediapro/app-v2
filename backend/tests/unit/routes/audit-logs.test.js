/**
 * Tests d'audit logs : login logué, création utilisateur, suppression, export CSV.
 */
const mockLogAction = jest.fn().mockResolvedValue({ _id: 'audit123' });

jest.mock('../../../src/services/auditService', () => ({
  logAction: (...args) => mockLogAction(...args),
  getAdminLogs: jest.fn().mockResolvedValue({ logs: [], total: 0, page: 1, limit: 50 }),
  exportLogs: jest.fn().mockResolvedValue({
    content: 'timestamp,userId,action,resource\n"2025-01-01","admin1","login","auth"',
    contentType: 'text/csv; charset=utf-8',
  }),
  archiveOldLogs: jest.fn().mockResolvedValue({ deleted: 0 }),
}));

const mockSave = jest.fn().mockResolvedValue(undefined);
const mockComparePassword = jest.fn().mockResolvedValue(true);

jest.mock('../../../src/models/User', () => {
  const saveFn = jest.fn().mockResolvedValue(undefined);
  const compareFn = jest.fn().mockResolvedValue(true);
  const MockUser = jest.fn((data) => ({
    ...data,
    _id: data?._id || '507f1f77bcf86cd799439011',
    save: saveFn,
    comparePassword: compareFn,
    toObject() {
      return { ...this };
    },
  }));
  MockUser.findOne = jest.fn();
  MockUser.create = jest.fn();
  MockUser.findById = jest.fn();
  MockUser.findByIdAndDelete = jest.fn();
  MockUser.findByIdAndUpdate = jest.fn();
  MockUser._mockComparePassword = compareFn;
  MockUser._mockSave = saveFn;
  return MockUser;
});

jest.mock('../../../src/lib/logger', () => ({
  logFailedLogin: jest.fn(),
  logApiError: jest.fn(),
}));

jest.mock('../../../src/lib/cache-manager', () => ({
  isConnected: false,
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
}));

jest.mock('mongoose', () => {
  const actual = jest.requireActual('mongoose');
  return {
    ...actual,
    connection: {
      readyState: 1,
      db: {
        admin: jest
          .fn()
          .mockReturnValue({ listDatabases: jest.fn().mockResolvedValue({ databases: [], totalSize: 0 }) }),
      },
    },
  };
});

const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'test-jwt-secret-at-least-32-chars!!';
const adminUser = {
  _id: '507f1f77bcf86cd799439011',
  email: 'admin@test.com',
  role: 'admin',
  firstName: 'Admin',
  lastName: 'Test',
  isActive: true,
  twoFactorEnabled: false,
};

/** Chain thenable pour findById().select().lean() et findById().select() */
function mockFindByIdForAuth(userDoc) {
  const u = { ...userDoc, save: mockSave, comparePassword: mockComparePassword };
  const forLean = { ...u };
  delete forLean.password;
  delete forLean.comparePassword;
  const chain = {
    lean: () => chain,
    then: (resolve) => resolve(forLean),
  };
  return { select: () => chain };
}

function buildApp() {
  const authRouter = require('../../../src/routes/auth');
  const adminRouter = require('../../../src/routes/admin');
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRouter);
  app.use('/api/admin', adminRouter);
  return app;
}

function createAdminToken() {
  return jwt.sign({ id: adminUser._id, email: adminUser.email, role: 'admin' }, JWT_SECRET, { expiresIn: '1h' });
}

describe('Audit logs', () => {
  let User;

  beforeEach(() => {
    jest.resetModules();
    mockLogAction.mockClear();
    User = require('../../../src/models/User');
    User._mockComparePassword?.mockResolvedValue?.(true);
    User._mockSave?.mockResolvedValue?.(undefined);
    process.env.JWT_SECRET = JWT_SECRET;
    process.env.ADMIN_EMAIL = 'admin@test.com';
    process.env.ADMIN_PASSWORD = 'AdminStrong1!@#';
    process.env.NODE_ENV = 'test';
  });

  describe('Login logué', () => {
    it('POST /login admin success appelle auditService.logAction avec action=login', async () => {
      const fakeUser = {
        ...adminUser,
        save: mockSave,
        comparePassword: mockComparePassword,
      };
      User.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(fakeUser),
      });
      User.findById.mockReturnValue(mockFindByIdForAuth(fakeUser));

      const app = buildApp();
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@test.com', password: 'AdminStrong1!@#' });
      if (res.status !== 200) {
        throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
      }

      expect(mockLogAction).toHaveBeenCalled();
      const call = mockLogAction.mock.calls.find((c) => c[0]?.action === 'login' && c[0]?.status === 'success');
      expect(call).toBeDefined();
      expect(String(call[0].userId)).toBe(adminUser._id);
      expect(call[0].resource).toBe('auth');
    });

    it('POST /login failure appelle auditService.logAction avec status=failure', async () => {
      User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });

      const app = buildApp();
      await request(app).post('/api/auth/login').send({ email: 'wrong@test.com', password: 'wrong' }).expect(401);

      expect(mockLogAction).toHaveBeenCalled();
      const call = mockLogAction.mock.calls.find((c) => c[0]?.status === 'failure');
      expect(call).toBeDefined();
      expect(call[0].action).toBe('login');
      expect(call[0].errorMessage).toBeDefined();
    });
  });

  describe('User creation logué avec before/after', () => {
    it('POST /api/admin/users appelle logAction avec create-user et changes.after', async () => {
      const newUserId = '507f1f77bcf86cd799439012';
      const newUserInstance = {
        _id: newUserId,
        email: 'newuser@test.com',
        role: 'passenger',
        firstName: 'New',
        lastName: 'User',
        cabinNumber: undefined,
        isActive: true,
        save: jest.fn().mockResolvedValue(undefined),
      };
      User.mockImplementation((data) => ({
        ...data,
        _id: newUserId,
        email: data.email,
        role: data.role || 'passenger',
        cabinNumber: data.cabinNumber,
        save: newUserInstance.save,
      }));
      User.findOne.mockResolvedValue(null);
      User.findById.mockImplementation((id) => {
        if (String(id) === adminUser._id) {
          return mockFindByIdForAuth(adminUser);
        }
        if (String(id) === newUserId) {
          return mockFindByIdForAuth(newUserInstance);
        }
        return Promise.resolve(null);
      });

      const app = buildApp();
      const token = createAdminToken();
      const createRes = await request(app)
        .post('/api/admin/users')
        .set('Cookie', `authToken=${token}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          firstName: 'New',
          lastName: 'User',
          email: 'newuser@test.com',
          password: 'Pass1234!',
        });

      expect(createRes.status).toBe(201);
      expect(mockLogAction).toHaveBeenCalled();
      const createCall = mockLogAction.mock.calls.find((c) => c[0]?.action === 'create-user');
      expect(createCall).toBeDefined();
      expect(createCall[0].changes?.after).toBeDefined();
      expect(createCall[0].resource).toBe('user');
    });
  });

  describe('Delete operation logué', () => {
    it('DELETE /api/admin/users/:id appelle logAction avec delete-user', async () => {
      const targetId = '507f1f77bcf86cd799439013';
      const targetUser = {
        _id: targetId,
        email: 'todelete@test.com',
        role: 'passenger',
        isActive: true,
        save: mockSave,
      };
      User.findById.mockImplementation((id) => {
        if (String(id) === adminUser._id) {
          return mockFindByIdForAuth(adminUser);
        }
        if (String(id) === targetId) {
          return Promise.resolve(targetUser);
        }
        return Promise.resolve(null);
      });
      User.findByIdAndDelete.mockResolvedValue(targetUser);

      const app = buildApp();
      const token = createAdminToken();
      await request(app)
        .delete(`/api/admin/users/${targetId}?hard=true`)
        .set('Cookie', `authToken=${token}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(mockLogAction).toHaveBeenCalled();
      const deleteCall = mockLogAction.mock.calls.find((c) => c[0]?.action === 'delete-user');
      expect(deleteCall).toBeDefined();
      expect(deleteCall[0].metadata?.hard).toBe(true);
    });
  });

  describe('Export logs en CSV', () => {
    it('GET /api/admin/audit-logs/export?format=csv retourne CSV', async () => {
      const auditService = require('../../../src/services/auditService');
      auditService.exportLogs.mockResolvedValue({
        content: 'timestamp,userId,action\n"2025-01-01","a1","login"',
        contentType: 'text/csv; charset=utf-8',
      });

      User.findById.mockImplementation((id) => {
        if (String(id) === adminUser._id) {
          return mockFindByIdForAuth(adminUser);
        }
        return Promise.resolve(null);
      });

      const app = buildApp();
      const token = createAdminToken();
      const res = await request(app)
        .get('/api/admin/audit-logs/export?format=csv')
        .set('Cookie', `authToken=${token}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.headers['content-type']).toMatch(/csv/);
      expect(auditService.exportLogs).toHaveBeenCalledWith('csv', expect.any(Object));
    });
  });
});
