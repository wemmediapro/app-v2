/**
 * GET /api/admin/conversations — agrégation paginée (plus de slice mémoire sur 500 messages).
 */
process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-chars!!';

jest.mock('../../../src/lib/cache-manager', () => ({
  isConnected: false,
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  delPattern: jest.fn(),
}));

jest.mock('../../../src/services/auditService', () => ({
  logAction: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../../src/models/User', () => ({
  findById: jest.fn(),
  countDocuments: jest.fn(),
  findByIdAndDelete: jest.fn(),
}));

const mongoose = require('mongoose');
const express = require('express');
const request = require('supertest');
const User = require('../../../src/models/User');
const Message = require('../../../src/models/Message');
const adminRouter = require('../../../src/routes/admin');
const { generateToken } = require('../../../src/middleware/auth');
const logger = require('../../../src/lib/logger');

const ADMIN_ID = '507f1f77bcf86cd799439011';

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

describe('GET /api/admin/conversations', () => {
  let aggregateSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    mongoose.connection.readyState = 1;
    delete process.env.ADMIN_CONVERSATIONS_MESSAGE_SAMPLE;
    User.findById.mockImplementation(() =>
      makeThenableDoc({
        _id: ADMIN_ID,
        email: 'admin@test.com',
        role: 'admin',
        isActive: true,
        twoFactorEnabled: false,
      })
    );
    aggregateSpy = jest.spyOn(Message, 'aggregate').mockResolvedValue([]);
  });

  afterEach(() => {
    aggregateSpy.mockRestore();
  });

  it('200 et appelle Message.aggregate avec $skip / $limit pagination', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/admin', adminRouter);

    const token = generateToken({ id: ADMIN_ID, email: 'admin@test.com', role: 'admin' });
    const res = await request(app)
      .get('/api/admin/conversations?page=2&limit=15')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(Message.aggregate).toHaveBeenCalledTimes(1);
    const pipe = Message.aggregate.mock.calls[0][0];
    expect(pipe.some((s) => s.$skip === 15)).toBe(true);
    expect(pipe.some((s) => s.$limit === 15)).toBe(true);
    expect(pipe.some((s) => s.$limit === 2000)).toBe(true);
  });

  it('[] sans appeler aggregate si Mongo déconnecté', async () => {
    mongoose.connection.readyState = 0;
    const app = express();
    app.use(express.json());
    app.use('/api/admin', adminRouter);
    const token = generateToken({ id: ADMIN_ID, email: 'admin@test.com', role: 'admin' });
    const res = await request(app).get('/api/admin/conversations').set('Authorization', `Bearer ${token}`).expect(200);
    expect(res.body).toEqual([]);
    expect(Message.aggregate).not.toHaveBeenCalled();
  });

  it('500 si Message.aggregate échoue', async () => {
    const errSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
    aggregateSpy.mockRestore();
    const failSpy = jest.spyOn(Message, 'aggregate').mockRejectedValue(new Error('agg down'));
    const app = express();
    app.use(express.json());
    app.use('/api/admin', adminRouter);
    const token = generateToken({ id: ADMIN_ID, email: 'admin@test.com', role: 'admin' });
    try {
      await request(app)
        .get('/api/admin/conversations?page=1&limit=10')
        .set('Authorization', `Bearer ${token}`)
        .expect(500);
      expect(errSpy).toHaveBeenCalled();
      expect(errSpy.mock.calls[0][0]).toEqual(
        expect.objectContaining({ event: 'admin_conversations_list_failed', err: 'agg down' })
      );
    } finally {
      errSpy.mockRestore();
      failSpy.mockRestore();
      aggregateSpy = jest.spyOn(Message, 'aggregate').mockResolvedValue([]);
    }
  });

  it('500 si unread-count et countDocuments échoue', async () => {
    const errSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
    const cdSpy = jest.spyOn(Message, 'countDocuments').mockRejectedValue(new Error('cd fail'));
    const app = express();
    app.use(express.json());
    app.use('/api/admin', adminRouter);
    const token = generateToken({ id: ADMIN_ID, email: 'admin@test.com', role: 'admin' });
    try {
      const res = await request(app)
        .get('/api/admin/conversations/unread-count')
        .set('Authorization', `Bearer ${token}`)
        .expect(500);
      expect(res.body).toEqual({ count: 0 });
      expect(errSpy.mock.calls[0][0]).toEqual(
        expect.objectContaining({ event: 'admin_conversations_unread_failed', err: 'cd fail' })
      );
    } finally {
      errSpy.mockRestore();
      cdSpy.mockRestore();
    }
  });
});
