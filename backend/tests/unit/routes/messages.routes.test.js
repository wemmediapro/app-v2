/**
 * Routes /api/messages — conversations, recherche utilisateurs, fil, envoi.
 */
jest.mock('../../../src/lib/cache-manager', () => ({
  isConnected: false,
  get: jest.fn(),
  set: jest.fn(),
}));

jest.mock('../../../src/models/User', () => {
  const M = function UserMock() {};
  M.findById = jest.fn();
  M.find = jest.fn();
  return M;
});

const mongoose = require('mongoose');
const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const messagesRouter = require('../../../src/routes/messages');
const User = require('../../../src/models/User');
const Message = require('../../../src/models/Message');
const { generateToken } = require('../../../src/middleware/auth');

const uid = '507f1f77bcf86cd799439011';
const peerId = '507f1f77bcf86cd799439012';

const mockConversations = [
  {
    _id: peerId,
    user: { _id: peerId, firstName: 'B', lastName: 'B', email: 'b@test.com' },
    lastMessage: { content: 'hi' },
    unreadCount: 0,
  },
];

function authUserChain() {
  return {
    select: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: uid,
        email: 'u@test.com',
        role: 'user',
        isActive: true,
        twoFactorEnabled: false,
      }),
    }),
  };
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/messages', messagesRouter);
  return app;
}

/** Chaîne Message.find thenable (double populate) */
function mockMessageFindResult(messages) {
  const query = {
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    then(resolve, reject) {
      return Promise.resolve(messages).then(resolve, reject);
    },
    catch(onReject) {
      return Promise.resolve(messages).catch(onReject);
    },
  };
  return query;
}

describe('GET /api/messages (conversations)', () => {
  let app;
  let aggregateSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    mongoose.connection.readyState = 1;
    app = buildApp();
    User.findById.mockImplementation(() => authUserChain());
    aggregateSpy = jest.spyOn(Message, 'aggregate').mockReturnValue(Promise.resolve(mockConversations));
  });

  afterEach(() => {
    aggregateSpy?.mockRestore?.();
  });

  it('401 sans token', async () => {
    await request(app).get('/api/messages').expect(401);
  });

  it('200 retourne conversations (aggregate mock)', async () => {
    const token = generateToken({ id: uid, email: 'u@test.com', role: 'user' });
    const res = await request(app)
      .get('/api/messages?page=1&limit=20')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(aggregateSpy).toHaveBeenCalled();
  });

  it('pagination : slice skip/limit', async () => {
    const many = Array.from({ length: 5 }, (_, i) => ({
      ...mockConversations[0],
      _id: `507f1f77bcf86cd7994390${10 + i}`,
    }));
    aggregateSpy.mockRestore();
    aggregateSpy = jest.spyOn(Message, 'aggregate').mockResolvedValue(many);
    const token = generateToken({ id: uid, email: 'u@test.com', role: 'user' });
    const res = await request(app)
      .get('/api/messages?page=1&limit=2')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.length).toBe(2);
  });
});

describe('GET /api/messages/users/search', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    mongoose.connection.readyState = 1;
    app = buildApp();
    User.findById.mockImplementation(() => authUserChain());
  });

  it('401 sans token', async () => {
    await request(app).get('/api/messages/users/search?q=test@test.com').expect(401);
  });

  it('[] si requête trop courte', async () => {
    const token = generateToken({ id: uid, email: 'u@test.com', role: 'user' });
    const res = await request(app)
      .get('/api/messages/users/search?q=a')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body).toEqual([]);
  });

  it('[] si ni email ni téléphone exploitable', async () => {
    const token = generateToken({ id: uid, email: 'u@test.com', role: 'user' });
    const res = await request(app)
      .get('/api/messages/users/search?q=ab')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body).toEqual([]);
  });

  it('200 recherche par email', async () => {
    User.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue([{ _id: peerId, email: 'x@y.com', firstName: 'X' }]),
      }),
    });
    const token = generateToken({ id: uid, email: 'u@test.com', role: 'user' });
    const res = await request(app)
      .get('/api/messages/users/search?q=someone@domain.com')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
    expect(User.find).toHaveBeenCalled();
  });

  it('200 recherche par téléphone (chiffres)', async () => {
    User.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue([{ _id: peerId, phone: '+33601020304' }]),
      }),
    });
    const token = generateToken({ id: uid, email: 'u@test.com', role: 'user' });
    const res = await request(app)
      .get('/api/messages/users/search?q=+33%20601%2002%2003%2004')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.length).toBe(1);
  });
});

describe('GET /api/messages/:userId', () => {
  let app;
  let findSpy;
  let updateManySpy;

  beforeEach(() => {
    jest.clearAllMocks();
    mongoose.connection.readyState = 1;
    app = buildApp();
    User.findById.mockImplementation(() => authUserChain());
    const msgs = [
      { _id: '1', content: 'a', createdAt: new Date('2020-01-01') },
      { _id: '2', content: 'b', createdAt: new Date('2020-01-02') },
    ];
    findSpy = jest.spyOn(Message, 'find').mockReturnValue(mockMessageFindResult(msgs));
    updateManySpy = jest.spyOn(Message, 'updateMany').mockResolvedValue({ modifiedCount: 1 });
  });

  afterEach(() => {
    findSpy?.mockRestore();
    updateManySpy?.mockRestore();
  });

  it('401 sans token', async () => {
    await request(app).get(`/api/messages/${peerId}`).expect(401);
  });

  it('400 si userId Mongo invalide', async () => {
    const token = generateToken({ id: uid, email: 'u@test.com', role: 'user' });
    await request(app).get('/api/messages/not-an-id').set('Authorization', `Bearer ${token}`).expect(400);
  });

  it('200 retourne messages chronologiques et marque comme lus', async () => {
    const token = generateToken({ id: uid, email: 'u@test.com', role: 'user' });
    const res = await request(app)
      .get(`/api/messages/${peerId}?page=1&limit=50`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(2);
    expect(updateManySpy).toHaveBeenCalled();
    expect(findSpy).toHaveBeenCalled();
  });

  it('500 si Message.find lève avant la chaîne (erreur DB)', async () => {
    findSpy.mockRestore();
    jest.spyOn(Message, 'find').mockImplementation(() => {
      throw new Error('db');
    });
    const token = generateToken({ id: uid, email: 'u@test.com', role: 'user' });
    await request(app).get(`/api/messages/${peerId}`).set('Authorization', `Bearer ${token}`).expect(500);
  });
});

describe('POST /api/messages', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    mongoose.connection.readyState = 1;
    app = buildApp();
  });

  it('401 sans token', async () => {
    await request(app).post('/api/messages').send({ receiver: peerId, content: 'hi' }).expect(401);
  });

  it('400 si receiver invalide', async () => {
    User.findById.mockImplementation((id) => {
      if (String(id) === uid) return authUserChain();
      return { select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }) };
    });
    const token = generateToken({ id: uid, email: 'u@test.com', role: 'user' });
    await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${token}`)
      .send({ receiver: 'not-a-valid-id', content: 'hi' })
      .expect(400);
  });

  it('400 si content vide', async () => {
    User.findById.mockImplementation(() => authUserChain());
    const token = generateToken({ id: uid, email: 'u@test.com', role: 'user' });
    await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${token}`)
      .send({ receiver: peerId, content: '   ' })
      .expect(400);
  });

  it('404 si destinataire inexistant', async () => {
    User.findById.mockImplementation((id) => {
      if (String(id) === uid) return authUserChain();
      return Promise.resolve(null);
    });
    const token = generateToken({ id: uid, email: 'u@test.com', role: 'user' });
    await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${token}`)
      .send({ receiver: peerId, content: 'Salut' })
      .expect(404);
  });

  it('201 envoi message', async () => {
    User.findById.mockImplementation((id) => {
      if (String(id) === uid) return authUserChain();
      return Promise.resolve({ _id: peerId, isActive: true });
    });
    const saveMock = jest.spyOn(Message.prototype, 'save').mockResolvedValue();
    jest.spyOn(Message, 'findById').mockReturnValue({
      populate: jest.fn().mockReturnThis(),
      then(onFulfilled) {
        const doc = {
          _id: new mongoose.Types.ObjectId(),
          content: 'Salut',
          sender: { firstName: 'A' },
          receiver: { firstName: 'B' },
        };
        return Promise.resolve(doc).then(onFulfilled);
      },
    });

    const token = generateToken({ id: uid, email: 'u@test.com', role: 'user' });
    const res = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${token}`)
      .send({ receiver: peerId, content: 'Salut' })
      .expect(201);

    expect(res.body.message).toMatch(/sent/i);
    expect(res.body.data).toBeDefined();
    saveMock.mockRestore();
    Message.findById.mockRestore();
  });

  it('200 idempotence clientSyncId si déjà présent', async () => {
    const existing = {
      _id: 'existingid',
      content: 'old',
      clientSyncId: 'sync-1',
    };
    User.findById.mockImplementation((id) => {
      if (String(id) === uid) return authUserChain();
      return Promise.resolve({ _id: peerId, isActive: true });
    });
    jest.spyOn(Message, 'findOne').mockReturnValue({
      populate: jest.fn().mockReturnThis(),
      then(onFulfilled) {
        return Promise.resolve(existing).then(onFulfilled);
      },
    });

    const token = generateToken({ id: uid, email: 'u@test.com', role: 'user' });
    const res = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${token}`)
      .send({ receiver: peerId, content: 'Salut', clientSyncId: 'sync-1' })
      .expect(200);

    expect(res.body.message).toMatch(/synced/i);
    Message.findOne.mockRestore();
  });
});
