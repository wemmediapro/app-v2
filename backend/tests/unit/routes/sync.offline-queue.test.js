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
  const saveCtrl = { rejectWith: null };
  function MessageMock(data) {
    Object.assign(this, data || {});
    this._id = (data && data._id) || '507f1f77bcf86cd799439088';
    this.save = jest.fn().mockImplementation(() => {
      if (saveCtrl.rejectWith) {
        return Promise.reject(saveCtrl.rejectWith);
      }
      return Promise.resolve(this);
    });
    this.toObject = () => ({ ...this });
  }
  MessageMock.findOne = jest.fn();
  MessageMock.findById = jest.fn();
  MessageMock.__saveCtrl = saveCtrl;
  return MessageMock;
});

const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const syncRouter = require('../../../src/routes/sync');
const { generateToken } = require('../../../src/middleware/auth');
const User = require('../../../src/models/User');
const Message = require('../../../src/models/Message');
const logger = require('../../../src/lib/logger');

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
    Message.__saveCtrl.rejectWith = null;
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

  it('200 — type image conservé sur le Message', async () => {
    Message.findOne.mockImplementation(() => queryThenable(null));
    Message.findById.mockReturnValue({
      populate: jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          _id: '507f1f77bcf86cd799439088',
          content: '/u/x.png',
          type: 'image',
          sender: uid,
          receiver: peer,
        }),
      }),
    });
    const token = generateToken({ id: uid, email: 'u@test.com', role: 'user' });
    const res = await request(app)
      .post('/api/sync/offline-queue')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{ id: 'img-1', room: `chat:${uid}_${peer}`, content: '/u/x.png', type: 'image' }],
      })
      .expect(200);

    expect(res.body.merged[0].message.type).toBe('image');
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
    expect(res.body.skipped).toContainEqual(expect.objectContaining({ clientSyncId: 'dup-id', reason: 'duplicate' }));
    expect(res.body.merged.some((m) => m.duplicate === true)).toBe(true);
  });

  it('200 — doublon sans toObject : message utilisé tel quel', async () => {
    const existingPlain = { _id: 'plain-dup', content: 'lean', sender: uid, receiver: peer };
    Message.findOne.mockImplementation(() => queryThenable(existingPlain));

    const token = generateToken({ id: uid, email: 'u@test.com', role: 'user' });
    const res = await request(app)
      .post('/api/sync/offline-queue')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{ id: 'dup-plain', room: `chat:${uid}_${peer}`, content: 'x' }],
      })
      .expect(200);

    expect(res.body.merged[0].message).toEqual(existingPlain);
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

    expect(res.body.skipped).toContainEqual(expect.objectContaining({ clientSyncId: 'x1', reason: 'invalid_room' }));
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

  it('200 — room chat:peer_uid (ordre inversé) résout le destinataire', async () => {
    const token = generateToken({ id: uid, email: 'u@test.com', role: 'user' });
    const res = await request(app)
      .post('/api/sync/offline-queue')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{ id: 'inv-room', room: `chat:${peer}_${uid}`, content: 'ok' }],
        mergeStrategy: 'prefer_server',
      })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.processedIds).toContain('inv-room');
    expect(res.body.mergeStrategy).toBe('prefer_server');
  });

  it('200 — chat:sans_deuxième_partie → invalid_room', async () => {
    const token = generateToken({ id: uid, email: 'u@test.com', role: 'user' });
    const res = await request(app)
      .post('/api/sync/offline-queue')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{ id: 'bad-parts', room: 'chat:seulement', content: 'x' }],
      })
      .expect(200);

    expect(res.body.skipped).toContainEqual(
      expect.objectContaining({ clientSyncId: 'bad-parts', reason: 'invalid_room' })
    );
  });

  it('200 — id destinataire non ObjectId → invalid_room', async () => {
    const token = generateToken({ id: uid, email: 'u@test.com', role: 'user' });
    const res = await request(app)
      .post('/api/sync/offline-queue')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{ id: 'bad-oid', room: `chat:${uid}_nope`, content: 'x' }],
      })
      .expect(200);

    expect(res.body.skipped).toContainEqual(
      expect.objectContaining({ clientSyncId: 'bad-oid', reason: 'invalid_room' })
    );
  });

  it('200 — tri mergeStrategy par createdAt (server_timestamp)', async () => {
    Message.findOne.mockImplementation(() => queryThenable(null));
    let idSeq = 0;
    Message.findById.mockImplementation(() => {
      idSeq += 1;
      const createdAt = idSeq === 1 ? '2020-01-02T00:00:00.000Z' : '2020-01-01T00:00:00.000Z';
      const populatedDoc = {
        _id: `507f1f77bcf86cd7994390${10 + idSeq}`,
        content: `m${idSeq}`,
        sender: uid,
        receiver: peer,
        createdAt,
      };
      return {
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(populatedDoc),
        }),
      };
    });

    const token = generateToken({ id: uid, email: 'u@test.com', role: 'user' });
    const res = await request(app)
      .post('/api/sync/offline-queue')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [
          { id: 't1', room: `chat:${uid}_${peer}`, content: 'a' },
          { id: 't2', room: `chat:${uid}_${peer}`, content: 'b' },
        ],
      })
      .expect(200);

    expect(res.body.merged.length).toBe(2);
    const times = res.body.merged.map((m) => new Date(m.message.createdAt).getTime());
    expect(times[0]).toBeLessThanOrEqual(times[1]);
  });

  it('200 — room chat:a_b sans l’expéditeur → invalid_room (parseReceiver null)', async () => {
    const token = generateToken({ id: uid, email: 'u@test.com', role: 'user' });
    const otherA = '507f1f77bcf86cd799439099';
    const otherB = '507f1f77bcf86cd799439098';
    const res = await request(app)
      .post('/api/sync/offline-queue')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{ id: 'stranger-room', room: `chat:${otherA}_${otherB}`, content: 'x' }],
      })
      .expect(200);

    expect(res.body.skipped).toContainEqual(
      expect.objectContaining({ clientSyncId: 'stranger-room', reason: 'invalid_room' })
    );
  });

  it('500 — erreur save autre que E11000', async () => {
    const errSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
    Message.__saveCtrl.rejectWith = Object.assign(new Error('persist failed'), { code: 99999 });

    const token = generateToken({ id: uid, email: 'u@test.com', role: 'user' });
    try {
      const res = await request(app)
        .post('/api/sync/offline-queue')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [{ id: 'save-fail', room: `chat:${uid}_${peer}`, content: 'x' }],
        })
        .expect(500);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/synchronisation/i);
      expect(res.body.error).toMatch(/persist failed/i);
      expect(errSpy).toHaveBeenCalled();
      expect(errSpy.mock.calls[0][0]).toEqual(
        expect.objectContaining({ event: 'sync_offline_queue_failed', err: 'persist failed' })
      );
    } finally {
      errSpy.mockRestore();
    }
  });

  it('200 — E11000 à la save → doublon comme findOne initial', async () => {
    const existingAfterRace = {
      _id: 'race-dup',
      clientSyncId: 'race-id',
      content: 'persisted',
      toObject() {
        return { _id: this._id, clientSyncId: this.clientSyncId, content: this.content };
      },
    };
    Message.findOne
      .mockImplementationOnce(() => queryThenable(null))
      .mockImplementation(() => queryThenable(existingAfterRace));

    Message.__saveCtrl.rejectWith = Object.assign(new Error('duplicate key'), { code: 11000 });

    const token = generateToken({ id: uid, email: 'u@test.com', role: 'user' });
    const res = await request(app)
      .post('/api/sync/offline-queue')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{ id: 'race-id', room: `chat:${uid}_${peer}`, content: 'concurrent' }],
      })
      .expect(200);

    expect(res.body.skipped.some((s) => s.clientSyncId === 'race-id' && s.reason === 'duplicate')).toBe(true);
    expect(res.body.merged.some((m) => m.duplicate === true && m.clientSyncId === 'race-id')).toBe(true);
  });

  it('200 — E11000 puis again sans toObject (objet plain)', async () => {
    const plainAgain = {
      _id: '507f1f77bcf86cd7994390ee',
      clientSyncId: 'e11000-plain',
      content: 'from-db',
    };
    Message.findOne
      .mockImplementationOnce(() => queryThenable(null))
      .mockImplementation(() => queryThenable(plainAgain));

    Message.__saveCtrl.rejectWith = Object.assign(new Error('duplicate key'), { code: 11000 });

    const token = generateToken({ id: uid, email: 'u@test.com', role: 'user' });
    const res = await request(app)
      .post('/api/sync/offline-queue')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{ id: 'e11000-plain', room: `chat:${uid}_${peer}`, content: 'x' }],
      })
      .expect(200);

    const dup = res.body.merged.find((m) => m.clientSyncId === 'e11000-plain');
    expect(dup.duplicate).toBe(true);
    expect(dup.message).toEqual(plainAgain);
  });

  it('200 — E11000 puis findOne sans document : pas de fusion ni skipped', async () => {
    Message.findOne.mockImplementation(() => queryThenable(null));
    Message.__saveCtrl.rejectWith = Object.assign(new Error('duplicate key'), { code: 11000 });

    const token = generateToken({ id: uid, email: 'u@test.com', role: 'user' });
    const res = await request(app)
      .post('/api/sync/offline-queue')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{ id: 'ghost-dup', room: `chat:${uid}_${peer}`, content: 'x' }],
      })
      .expect(200);

    expect(res.body.processedIds).not.toContain('ghost-dup');
    expect(res.body.skipped.some((s) => s.clientSyncId === 'ghost-dup')).toBe(false);
    expect(res.body.merged.some((m) => m.clientSyncId === 'ghost-dup')).toBe(false);
  });

  it('200 — mergeStrategy : entrées sans createdAt (timestamps 0)', async () => {
    Message.findOne.mockImplementation(() => queryThenable(null));
    Message.findById.mockImplementation(() => ({
      populate: jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          _id: 'a',
          content: 'first',
          sender: uid,
          receiver: peer,
        }),
      }),
    }));

    const token = generateToken({ id: uid, email: 'u@test.com', role: 'user' });
    const res = await request(app)
      .post('/api/sync/offline-queue')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [
          { id: 'n1', room: `chat:${uid}_${peer}`, content: 'a' },
          { id: 'n2', room: `chat:${uid}_${peer}`, content: 'b' },
        ],
        mergeStrategy: 'prefer_server',
      })
      .expect(200);

    expect(res.body.merged.length).toBe(2);
  });
});
