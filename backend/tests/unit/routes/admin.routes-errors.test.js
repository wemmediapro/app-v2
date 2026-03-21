/**
 * Erreurs 500 admin + logRouteError (stats, cache, audit, liste bases, dashboard, users, settings).
 */
process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-chars!!';

jest.mock('../../../src/lib/cache-manager', () => ({
  isConnected: false,
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  delPattern: jest.fn(),
  flush: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../../src/lib/redis-connection-manager', () => ({
  getStatsGlobal: jest.fn().mockResolvedValue({ workers: 0 }),
}));

jest.mock('../../../src/lib/connection-manager', () => ({
  getStats: jest.fn().mockReturnValue({ local: 1 }),
}));

jest.mock('../../../src/lib/memory-monitor', () => ({
  getSnapshot: jest.fn().mockReturnValue({ heapUsed: 1 }),
  getThresholds: jest.fn().mockReturnValue({}),
  intervalMs: 0,
}));

jest.mock('../../../src/services/auditService', () => ({
  logAction: jest.fn().mockResolvedValue({}),
  getAdminLogs: jest.fn().mockResolvedValue({ logs: [], total: 0 }),
  exportLogs: jest.fn().mockResolvedValue({ content: '[]', contentType: 'application/json' }),
}));

jest.mock('../../../src/models/User', () => {
  const saveMock = jest.fn().mockResolvedValue(undefined);
  function User(data = {}) {
    this._id = data._id || '507f1f77bcf86cd7994390aa';
    Object.assign(this, data);
    if (this.isActive === undefined) this.isActive = true;
    this.save = saveMock;
  }
  User.saveMock = saveMock;
  User.findById = jest.fn();
  User.findOne = jest.fn();
  User.find = jest.fn();
  User.countDocuments = jest.fn();
  User.findByIdAndDelete = jest.fn();
  User.aggregate = jest.fn();
  return User;
});

jest.mock('../../../src/models/LocalServerConfig', () => ({
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
}));

const mongoose = require('mongoose');
const express = require('express');
const request = require('supertest');
const User = require('../../../src/models/User');
const LocalServerConfig = require('../../../src/models/LocalServerConfig');
const adminRouter = require('../../../src/routes/admin');
const { generateToken } = require('../../../src/middleware/auth');
const logger = require('../../../src/lib/logger');
const redisConnectionManager = require('../../../src/lib/redis-connection-manager');
const connectionManager = require('../../../src/lib/connection-manager');
const memoryMonitor = require('../../../src/lib/memory-monitor');
const cacheManager = require('../../../src/lib/cache-manager');
const auditService = require('../../../src/services/auditService');

const ADMIN_ID = '507f1f77bcf86cd799439011';
const PEER_ID = '507f1f77bcf86cd799439099';

function makeThenableDoc(doc) {
  const q = {
    select() {
      return q;
    },
    lean() {
      return q;
    },
    then(onFulfilled, onRejected) {
      return Promise.resolve(doc).then(onFulfilled, onRejected);
    },
    catch(onRejected) {
      return Promise.resolve(doc).catch(onRejected);
    },
  };
  return q;
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/admin', adminRouter);
  return app;
}

function adminToken() {
  return generateToken({ id: ADMIN_ID, email: 'admin@test.com', role: 'admin' });
}

describe('Admin — erreurs HTTP et logRouteError', () => {
  let origDb;

  beforeEach(() => {
    jest.clearAllMocks();
    User.saveMock.mockReset();
    User.saveMock.mockResolvedValue(undefined);
    mongoose.connection.readyState = 1;
    origDb = mongoose.connection.db;
    User.findById.mockImplementation((id) => {
      const idStr = String(id);
      if (idStr === ADMIN_ID) {
        return makeThenableDoc({
          _id: ADMIN_ID,
          email: 'admin@test.com',
          role: 'admin',
          isActive: true,
          twoFactorEnabled: false,
        });
      }
      if (idStr === PEER_ID) {
        return makeThenableDoc({
          _id: PEER_ID,
          firstName: 'Peer',
          lastName: 'User',
          email: 'peer@test.com',
          role: 'passenger',
          isActive: true,
          save: User.saveMock,
        });
      }
      return makeThenableDoc(null);
    });
    User.findOne.mockResolvedValue(null);
    User.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      skip: jest.fn().mockResolvedValue([]),
    });
    User.countDocuments.mockResolvedValue(0);
    User.findByIdAndDelete.mockResolvedValue(null);
    User.aggregate.mockResolvedValue([]);
    LocalServerConfig.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({ accessByRole: { admin: { a: 1 } } }),
    });
    LocalServerConfig.findOneAndUpdate.mockResolvedValue({});
    redisConnectionManager.getStatsGlobal.mockResolvedValue({ workers: 0 });
    connectionManager.getStats.mockReturnValue({ local: 1 });
    memoryMonitor.getSnapshot.mockReturnValue({ heapUsed: 1 });
    cacheManager.flush.mockResolvedValue(true);
    auditService.getAdminLogs.mockResolvedValue({ logs: [], total: 0 });
    auditService.exportLogs.mockResolvedValue({ content: '[]', contentType: 'application/json' });
  });

  afterEach(() => {
    mongoose.connection.db = origDb;
  });

  it('GET /connections-stats 500 + admin_connections_stats_failed', async () => {
    const errSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
    redisConnectionManager.getStatsGlobal.mockRejectedValueOnce(new Error('redis stats'));
    try {
      await request(buildApp())
        .get('/api/admin/connections-stats')
        .set('Authorization', `Bearer ${adminToken()}`)
        .expect(500);
      expect(errSpy.mock.calls[0][0]).toEqual(
        expect.objectContaining({ event: 'admin_connections_stats_failed', err: 'redis stats' })
      );
    } finally {
      errSpy.mockRestore();
    }
  });

  it('GET /memory-stats 500 + admin_memory_stats_failed', async () => {
    const errSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
    memoryMonitor.getSnapshot.mockImplementationOnce(() => {
      throw new Error('heap oom');
    });
    try {
      await request(buildApp())
        .get('/api/admin/memory-stats')
        .set('Authorization', `Bearer ${adminToken()}`)
        .expect(500);
      expect(errSpy.mock.calls[0][0]).toEqual(
        expect.objectContaining({ event: 'admin_memory_stats_failed', err: 'heap oom' })
      );
    } finally {
      errSpy.mockRestore();
    }
  });

  it('GET /databases 500 + admin_list_databases_failed', async () => {
    const errSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
    mongoose.connection.db = {
      admin: jest.fn().mockReturnValue({
        listDatabases: jest.fn().mockRejectedValue(new Error('list fail')),
      }),
    };
    try {
      await request(buildApp()).get('/api/admin/databases').set('Authorization', `Bearer ${adminToken()}`).expect(500);
      expect(errSpy.mock.calls[0][0]).toEqual(
        expect.objectContaining({ event: 'admin_list_databases_failed', err: 'list fail' })
      );
    } finally {
      errSpy.mockRestore();
    }
  });

  it('POST /cache/clear 500 + admin_cache_clear_failed', async () => {
    const errSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
    cacheManager.flush.mockRejectedValueOnce(new Error('flush denied'));
    try {
      await request(buildApp())
        .post('/api/admin/cache/clear')
        .set('Authorization', `Bearer ${adminToken()}`)
        .expect(500);
      expect(errSpy.mock.calls[0][0]).toEqual(
        expect.objectContaining({ event: 'admin_cache_clear_failed', err: 'flush denied' })
      );
    } finally {
      errSpy.mockRestore();
    }
  });

  it('GET /audit-logs 500 + admin_audit_logs_list_failed', async () => {
    const errSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
    auditService.getAdminLogs.mockRejectedValueOnce(new Error('audit list'));
    try {
      await request(buildApp()).get('/api/admin/audit-logs').set('Authorization', `Bearer ${adminToken()}`).expect(500);
      expect(errSpy.mock.calls[0][0]).toEqual(
        expect.objectContaining({ event: 'admin_audit_logs_list_failed', err: 'audit list' })
      );
    } finally {
      errSpy.mockRestore();
    }
  });

  it('GET /audit-logs/export 500 + admin_audit_logs_export_failed', async () => {
    const errSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
    auditService.exportLogs.mockRejectedValueOnce(new Error('export fail'));
    try {
      await request(buildApp())
        .get('/api/admin/audit-logs/export')
        .set('Authorization', `Bearer ${adminToken()}`)
        .expect(500);
      expect(errSpy.mock.calls[0][0]).toEqual(
        expect.objectContaining({ event: 'admin_audit_logs_export_failed', err: 'export fail' })
      );
    } finally {
      errSpy.mockRestore();
    }
  });

  it('GET /audit-logs/user/:userId 500 + admin_audit_logs_user_failed', async () => {
    const errSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
    auditService.getAdminLogs.mockRejectedValueOnce(new Error('user logs'));
    try {
      await request(buildApp())
        .get(`/api/admin/audit-logs/user/${PEER_ID}`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .expect(500);
      expect(errSpy.mock.calls[0][0]).toEqual(
        expect.objectContaining({ event: 'admin_audit_logs_user_failed', err: 'user logs' })
      );
    } finally {
      errSpy.mockRestore();
    }
  });

  it('GET /dashboard 500 + admin_dashboard_failed', async () => {
    const errSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
    User.aggregate.mockRejectedValueOnce(new Error('dash count'));
    try {
      await request(buildApp()).get('/api/admin/dashboard').set('Authorization', `Bearer ${adminToken()}`).expect(500);
      expect(errSpy.mock.calls[0][0]).toEqual(
        expect.objectContaining({ event: 'admin_dashboard_failed', err: 'dash count' })
      );
    } finally {
      errSpy.mockRestore();
    }
  });

  it('GET /users 500 + admin_users_list_failed', async () => {
    const errSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
    User.countDocuments.mockRejectedValueOnce(new Error('users total'));
    try {
      await request(buildApp())
        .get('/api/admin/users?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken()}`)
        .expect(500);
      expect(errSpy.mock.calls[0][0]).toEqual(
        expect.objectContaining({ event: 'admin_users_list_failed', err: 'users total' })
      );
    } finally {
      errSpy.mockRestore();
    }
  });

  it('POST /users 500 + admin_user_create_failed', async () => {
    const errSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
    User.findOne.mockResolvedValue(null);
    User.saveMock.mockRejectedValueOnce(new Error('create save'));
    try {
      await request(buildApp())
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({
          firstName: 'N',
          lastName: 'U',
          email: 'newuser-errors@test.com',
          password: 'Validpass1!',
          role: 'passenger',
        })
        .expect(500);
      expect(errSpy.mock.calls[0][0]).toEqual(
        expect.objectContaining({ event: 'admin_user_create_failed', err: 'create save' })
      );
    } finally {
      errSpy.mockRestore();
    }
  });

  it('PUT /users/:id 500 + admin_user_update_failed', async () => {
    const errSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
    User.saveMock.mockRejectedValueOnce(new Error('update save'));
    try {
      await request(buildApp())
        .put(`/api/admin/users/${PEER_ID}`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ firstName: 'Upd' })
        .expect(500);
      expect(errSpy.mock.calls[0][0]).toEqual(
        expect.objectContaining({ event: 'admin_user_update_failed', err: 'update save' })
      );
    } finally {
      errSpy.mockRestore();
    }
  });

  it('DELETE /users/:id hard 500 + admin_user_delete_failed', async () => {
    const errSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
    User.findByIdAndDelete.mockRejectedValueOnce(new Error('hard del'));
    try {
      await request(buildApp())
        .delete(`/api/admin/users/${PEER_ID}?hard=true`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .expect(500);
      expect(errSpy.mock.calls[0][0]).toEqual(
        expect.objectContaining({ event: 'admin_user_delete_failed', err: 'hard del' })
      );
    } finally {
      errSpy.mockRestore();
    }
  });

  it('DELETE /users/:id soft 500 + admin_user_delete_failed', async () => {
    const errSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
    User.saveMock.mockRejectedValueOnce(new Error('soft save'));
    try {
      await request(buildApp())
        .delete(`/api/admin/users/${PEER_ID}`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .expect(500);
      expect(errSpy.mock.calls[0][0]).toEqual(
        expect.objectContaining({ event: 'admin_user_delete_failed', err: 'soft save' })
      );
    } finally {
      errSpy.mockRestore();
    }
  });

  it('GET /settings/access 500 + admin_settings_access_get_failed', async () => {
    const errSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
    LocalServerConfig.findOne.mockReturnValueOnce({
      lean: jest.fn().mockRejectedValue(new Error('cfg read')),
    });
    try {
      await request(buildApp())
        .get('/api/admin/settings/access')
        .set('Authorization', `Bearer ${adminToken()}`)
        .expect(500);
      expect(errSpy.mock.calls[0][0]).toEqual(
        expect.objectContaining({ event: 'admin_settings_access_get_failed', err: 'cfg read' })
      );
    } finally {
      errSpy.mockRestore();
    }
  });

  it('PUT /settings/access 500 + admin_settings_access_put_failed', async () => {
    const errSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
    LocalServerConfig.findOne.mockReturnValueOnce({
      lean: jest.fn().mockResolvedValue(null),
    });
    LocalServerConfig.findOneAndUpdate.mockRejectedValueOnce(new Error('cfg write'));
    try {
      await request(buildApp())
        .put('/api/admin/settings/access')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ admin: { modules: ['a'] } })
        .expect(500);
      expect(errSpy.mock.calls[0][0]).toEqual(
        expect.objectContaining({ event: 'admin_settings_access_put_failed', err: 'cfg write' })
      );
    } finally {
      errSpy.mockRestore();
    }
  });
});
