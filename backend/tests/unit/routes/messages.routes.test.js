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
  M.exists = jest.fn();
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
const logger = require('../../../src/lib/logger');

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

/** Chaîne Message.find → populate ×2 → lean() */
function mockMessageFindResult(messages) {
  return {
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(messages),
  };
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

  it('pagination : $skip / $limit appliqués dans aggregate (pas de chargement complet en mémoire)', async () => {
    const many = Array.from({ length: 5 }, (_, i) => ({
      ...mockConversations[0],
      _id: `507f1f77bcf86cd7994390${10 + i}`,
    }));
    aggregateSpy.mockRestore();
    aggregateSpy = jest.spyOn(Message, 'aggregate').mockImplementation((pipeline) => {
      const skipStage = pipeline.find((s) => s && typeof s.$skip === 'number');
      const limitStage = pipeline.find((s) => s && typeof s.$limit === 'number');
      const sk = skipStage ? skipStage.$skip : 0;
      const lim = limitStage ? limitStage.$limit : many.length;
      return Promise.resolve(many.slice(sk, sk + lim));
    });
    const token = generateToken({ id: uid, email: 'u@test.com', role: 'user' });
    const res = await request(app)
      .get('/api/messages?page=1&limit=2')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.length).toBe(2);
    const pipe = aggregateSpy.mock.calls[0][0];
    expect(pipe.some((s) => s.$skip === 0)).toBe(true);
    expect(pipe.some((s) => s.$limit === 2)).toBe(true);
  });

  it('500 si aggregate échoue', async () => {
    const errSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
    aggregateSpy.mockRestore();
    aggregateSpy = jest.spyOn(Message, 'aggregate').mockRejectedValue(new Error('agg failed'));
    try {
      const token = generateToken({ id: uid, email: 'u@test.com', role: 'user' });
      const res = await request(app)
        .get('/api/messages?page=1&limit=20')
        .set('Authorization', `Bearer ${token}`)
        .expect(500);
      expect(res.body.message).toMatch(/Server error/i);
      expect(errSpy).toHaveBeenCalled();
      expect(errSpy.mock.calls[0][0]).toEqual(
        expect.objectContaining({ event: 'messages_list_conversations_failed', err: 'agg failed' })
      );
    } finally {
      errSpy.mockRestore();
    }
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

  it('[] sans paramètre q (q absent)', async () => {
    const token = generateToken({ id: uid, email: 'u@test.com', role: 'user' });
    const res = await request(app).get('/api/messages/users/search').set('Authorization', `Bearer ${token}`).expect(200);
    expect(res.body).toEqual([]);
  });

  it('[] si q vide après trim', async () => {
    const token = generateToken({ id: uid, email: 'u@test.com', role: 'user' });
    const res = await request(app)
      .get('/api/messages/users/search?q=%20%20')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body).toEqual([]);
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
        limit: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([{ _id: peerId, email: 'x@y.com', firstName: 'X' }]),
        }),
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
        limit: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([{ _id: peerId, phone: '+33601020304' }]),
        }),
      }),
    });
    const token = generateToken({ id: uid, email: 'u@test.com', role: 'user' });
    const res = await request(app)
      .get('/api/messages/users/search?q=+33%20601%2002%2003%2004')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.length).toBe(1);
  });

  it('200 recherche téléphone extraite depuis q avec texte (branche isPhone + phone regex)', async () => {
    User.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([]),
        }),
      }),
    });
    const token = generateToken({ id: uid, email: 'u@test.com', role: 'user' });
    await request(app)
      .get('/api/messages/users/search?q=call%20601%2002%2003%2004')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const qArg = User.find.mock.calls[0][0];
    expect(qArg.phone).toBeDefined();
    expect(qArg.email).toBeUndefined();
  });

  it('500 si User.find échoue', async () => {
    const errSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
    User.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          lean: jest.fn().mockRejectedValue(new Error('db down')),
        }),
      }),
    });
    const token = generateToken({ id: uid, email: 'u@test.com', role: 'user' });
    try {
      await request(app)
        .get('/api/messages/users/search?q=someone@example.com')
        .set('Authorization', `Bearer ${token}`)
        .expect(500);
      expect(errSpy).toHaveBeenCalled();
      expect(errSpy.mock.calls[0][0]).toEqual(
        expect.objectContaining({ event: 'messages_search_users_failed', err: 'db down' })
      );
    } finally {
      errSpy.mockRestore();
    }
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
    const errSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
    findSpy.mockRestore();
    jest.spyOn(Message, 'find').mockImplementation(() => {
      throw new Error('db');
    });
    const token = generateToken({ id: uid, email: 'u@test.com', role: 'user' });
    try {
      await request(app).get(`/api/messages/${peerId}`).set('Authorization', `Bearer ${token}`).expect(500);
      expect(errSpy).toHaveBeenCalled();
      expect(errSpy.mock.calls[0][0]).toEqual(
        expect.objectContaining({ event: 'messages_thread_failed', err: 'db' })
      );
    } finally {
      errSpy.mockRestore();
      Message.find.mockRestore();
    }
  });

  it('500 si updateMany échoue (avant chargement du fil)', async () => {
    const errSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
    updateManySpy.mockRestore();
    jest.spyOn(Message, 'updateMany').mockRejectedValue(new Error('update failed'));
    try {
      const token = generateToken({ id: uid, email: 'u@test.com', role: 'user' });
      await request(app)
        .get(`/api/messages/${peerId}?page=1&limit=50`)
        .set('Authorization', `Bearer ${token}`)
        .expect(500);
      expect(errSpy).toHaveBeenCalled();
      expect(errSpy.mock.calls[0][0]).toEqual(
        expect.objectContaining({ event: 'messages_thread_failed', err: 'update failed' })
      );
    } finally {
      errSpy.mockRestore();
      Message.updateMany.mockRestore();
    }
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
    User.findById.mockImplementation(() => authUserChain());
    User.exists.mockResolvedValue(null);
    const token = generateToken({ id: uid, email: 'u@test.com', role: 'user' });
    await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${token}`)
      .send({ receiver: peerId, content: 'Salut' })
      .expect(404);
  });

  it('201 envoi message', async () => {
    User.findById.mockImplementation(() => authUserChain());
    User.exists.mockResolvedValue({ _id: peerId });
    const saveMock = jest.spyOn(Message.prototype, 'save').mockResolvedValue();
    const populateMock = jest.spyOn(Message.prototype, 'populate').mockImplementation(async function populateImpl() {
      this.sender = { firstName: 'A' };
      this.receiver = { firstName: 'B' };
      return this;
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
    populateMock.mockRestore();
  });

  it('200 idempotence clientSyncId si déjà présent', async () => {
    const existing = {
      _id: 'existingid',
      content: 'old',
      clientSyncId: 'sync-1',
    };
    User.findById.mockImplementation(() => authUserChain());
    User.exists.mockResolvedValue({ _id: peerId });
    jest.spyOn(Message, 'findOne').mockReturnValue({
      populate: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(existing),
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

  it('200 idempotence après E11000 à save (course clientSyncId)', async () => {
    const existing = {
      _id: 'dupmongo',
      content: 'persisted',
      clientSyncId: 'race-cs',
    };
    let findOneN = 0;
    User.findById.mockImplementation(() => authUserChain());
    User.exists.mockResolvedValue({ _id: peerId });
    jest.spyOn(Message, 'findOne').mockImplementation(() => {
      findOneN += 1;
      const val = findOneN === 1 ? null : existing;
      return {
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(val),
      };
    });
    const dupErr = Object.assign(new Error('E11000'), { code: 11000 });
    jest.spyOn(Message.prototype, 'save').mockRejectedValue(dupErr);

    const token = generateToken({ id: uid, email: 'u@test.com', role: 'user' });
    const res = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${token}`)
      .send({ receiver: peerId, content: 'Salut', clientSyncId: 'race-cs' })
      .expect(200);

    expect(res.body.message).toMatch(/synced/i);
    expect(res.body.data).toEqual(existing);
    Message.findOne.mockRestore();
    Message.prototype.save.mockRestore();
  });

  it('500 si save échoue sans gestion E11000', async () => {
    const errSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
    User.findById.mockImplementation(() => authUserChain());
    User.exists.mockResolvedValue({ _id: peerId });
    jest.spyOn(Message.prototype, 'save').mockRejectedValue(new Error('disk full'));

    const token = generateToken({ id: uid, email: 'u@test.com', role: 'user' });
    try {
      await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${token}`)
        .send({ receiver: peerId, content: 'Salut' })
        .expect(500);
      expect(errSpy).toHaveBeenCalled();
      expect(errSpy.mock.calls[0][0]).toEqual(
        expect.objectContaining({ event: 'messages_send_failed', err: 'disk full' })
      );
    } finally {
      errSpy.mockRestore();
      Message.prototype.save.mockRestore();
    }
  });

  it('500 si populate après save échoue', async () => {
    const errSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
    User.findById.mockImplementation(() => authUserChain());
    User.exists.mockResolvedValue({ _id: peerId });
    jest.spyOn(Message.prototype, 'save').mockResolvedValue();
    jest.spyOn(Message.prototype, 'populate').mockRejectedValue(new Error('populate failed'));

    const token = generateToken({ id: uid, email: 'u@test.com', role: 'user' });
    try {
      await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${token}`)
        .send({ receiver: peerId, content: 'Salut' })
        .expect(500);
      expect(errSpy).toHaveBeenCalled();
      expect(errSpy.mock.calls[0][0]).toEqual(
        expect.objectContaining({ event: 'messages_send_failed', err: 'populate failed' })
      );
    } finally {
      errSpy.mockRestore();
      Message.prototype.save.mockRestore();
      Message.prototype.populate.mockRestore();
    }
  });

  it('500 si E11000 et aucun document après findOne de secours', async () => {
    const errSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
    User.findById.mockImplementation(() => authUserChain());
    User.exists.mockResolvedValue({ _id: peerId });
    jest.spyOn(Message, 'findOne').mockImplementation(() => ({
      populate: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(null),
    }));
    const dupErr = Object.assign(new Error('E11000'), { code: 11000 });
    jest.spyOn(Message.prototype, 'save').mockRejectedValue(dupErr);

    const token = generateToken({ id: uid, email: 'u@test.com', role: 'user' });
    try {
      await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${token}`)
        .send({ receiver: peerId, content: 'Salut', clientSyncId: 'ghost-dup' })
        .expect(500);
      expect(errSpy).toHaveBeenCalled();
      expect(errSpy.mock.calls[0][0]).toEqual(
        expect.objectContaining({ event: 'messages_send_failed', err: 'E11000' })
      );
    } finally {
      errSpy.mockRestore();
      Message.findOne.mockRestore();
      Message.prototype.save.mockRestore();
    }
  });
});
