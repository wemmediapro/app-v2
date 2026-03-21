/**
 * POST /api/sync/offline-queue — validation + succès minimal (mocks).
 */
jest.mock('../../../src/lib/cache-manager', () => ({
  isConnected: false,
  get: jest.fn(),
  set: jest.fn(),
}));

jest.mock('../../../src/models/User', () => {
  const M = function UserMock() {};
  M.findById = jest.fn();
  return M;
});

jest.mock('../../../src/models/Message', () => {
  function MessageMock(data) {
    Object.assign(this, data || {});
    this._id = (data && data._id) || '507f1f77bcf86cd799439088';
    this.save = jest.fn().mockResolvedValue(this);
    this.toObject = () => ({ ...this });
  }
  MessageMock.findOne = jest.fn();
  MessageMock.findById = jest.fn();
  return MessageMock;
});

const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const syncRouter = require('../../../src/routes/sync');
const { generateToken } = require('../../../src/middleware/auth');
const User = require('../../../src/models/User');
const Message = require('../../../src/models/Message');

const uid = '507f1f77bcf86cd799439011';
const peer = '507f1f77bcf86cd799439012';

function queryThenable(result) {
  const q = {
    populate: jest.fn(() => q),
    then(onF, onR) {
      return Promise.resolve(result).then(onF, onR);
    },
    catch(onR) {
      return Promise.resolve(result).catch(onR);
    },
  };
  return q;
}

describe('POST /api/sync/offline-queue', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/api/sync', syncRouter);

    User.findById.mockImplementation((id) => {
      if (String(id) === uid) {
        return {
          select: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue({
              _id: uid,
              email: 'u@test.com',
              role: 'user',
              isActive: true,
            }),
          }),
        };
      }
      if (String(id) === peer) {
        return Promise.resolve({ _id: peer, isActive: true });
      }
      return Promise.resolve(null);
    });

    Message.findOne.mockImplementation(() => queryThenable(null));

    const populatedDoc = {
      _id: '507f1f77bcf86cd799439088',
      content: 'hello',
      sender: uid,
      receiver: peer,
    };
    Message.findById.mockReturnValue({
      populate: jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue(populatedDoc),
      }),
    });
  });

  it('400 si items vide', async () => {
    const token = generateToken({ id: uid, email: 'u@test.com', role: 'user' });
    await request(app)
      .post('/api/sync/offline-queue')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [] })
      .expect(400);
  });

  it('200 synchronise un lot valide', async () => {
    const token = generateToken({ id: uid, email: 'u@test.com', role: 'user' });
    const res = await request(app)
      .post('/api/sync/offline-queue')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [
          {
            id: 'client-offline-1',
            room: `chat:${uid}_${peer}`,
            content: 'message hors ligne',
          },
        ],
        mergeStrategy: 'server_timestamp',
      })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.processedIds).toContain('client-offline-1');
    expect(res.body.merged).toBeDefined();
    expect(Message.findOne).toHaveBeenCalled();
  });

  it('200 — doublon idempotent (existing message) dans merged + skipped', async () => {
    const existingDoc = {
      _id: 'existing123',
      content: 'déjà synced',
      sender: uid,
      receiver: peer,
      toObject() {
        return { ...this };
      },
    };
    Message.findOne.mockImplementation(() => queryThenable(existingDoc));

    const token = generateToken({ id: uid, email: 'u@test.com', role: 'user' });
    const res = await request(app)
      .post('/api/sync/offline-queue')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{ id: 'dup-id', room: `chat:${uid}_${peer}`, content: 'replay' }],
      })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.skipped).toContainEqual(
      expect.objectContaining({ clientSyncId: 'dup-id', reason: 'duplicate' })
    );
    expect(res.body.merged.some((m) => m.duplicate === true)).toBe(true);
  });

  it('200 — room invalide → skipped invalid_room', async () => {
    Message.findOne.mockImplementation(() => queryThenable(null));

    const token = generateToken({ id: uid, email: 'u@test.com', role: 'user' });
    const res = await request(app)
      .post('/api/sync/offline-queue')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{ id: 'x1', room: 'invalid-format', content: 'msg' }],
      })
      .expect(200);

    expect(res.body.skipped).toContainEqual(
      expect.objectContaining({ clientSyncId: 'x1', reason: 'invalid_room' })
    );
  });

  it('200 — receiver inexistant → skipped receiver_not_found', async () => {
    Message.findOne.mockImplementation(() => queryThenable(null));
    const unknownPeer = '507f1f77bcf86cd799439099';
    User.findById.mockImplementation((id) => {
      if (String(id) === uid) {
        return {
          select: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue({
              _id: uid,
              email: 'u@test.com',
              role: 'user',
              isActive: true,
            }),
          }),
        };
      }
      return Promise.resolve(null);
    });

    const token = generateToken({ id: uid, email: 'u@test.com', role: 'user' });
    const res = await request(app)
      .post('/api/sync/offline-queue')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{ id: 'x2', room: `chat:${uid}_${unknownPeer}`, content: 'msg' }],
      })
      .expect(200);

    expect(res.body.skipped).toContainEqual(
      expect.objectContaining({ clientSyncId: 'x2', reason: 'receiver_not_found' })
    );
  });
});
