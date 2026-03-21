/**
 * P0 — Panier / commande (shop) et envoi de message.
 * Les routes existent ; ces tests fixent le contrat HTTP (401, 400, 201) avec Mongo mocké.
 */
jest.mock('../../../src/lib/cache-manager', () => ({
  isConnected: false,
  get: jest.fn(),
  set: jest.fn(),
}));

jest.mock('../../../src/models/Product', () => ({
  findOne: jest.fn(),
}));

jest.mock('../../../src/models/User', () => {
  const M = function UserMock() {};
  M.findById = jest.fn();
  M.exists = jest.fn();
  return M;
});

const mockSave = jest.fn().mockResolvedValue(undefined);

jest.mock('../../../src/models/Message', () => {
  function MessageMock(data) {
    this._id = '507f1f77bcf86cd799439099';
    Object.assign(this, data);
  }
  MessageMock.prototype.save = mockSave;
  MessageMock.prototype.populate = jest.fn().mockImplementation(function mockPopulate() {
    return Promise.resolve(this);
  });
  MessageMock.prototype.toJSON = function toJSON() {
    return {
      _id: this._id,
      sender: this.sender,
      receiver: this.receiver,
      content: this.content,
      type: this.type,
      attachments: this.attachments,
    };
  };
  MessageMock.prototype.toObject = MessageMock.prototype.toJSON;
  MessageMock.findOne = jest.fn().mockResolvedValue(null);
  MessageMock.findById = jest.fn();
  return MessageMock;
});

const mongoose = require('mongoose');
const request = require('supertest');
const express = require('express');
const shopRouter = require('../../../src/routes/shop');
const messagesRouter = require('../../../src/routes/messages');
const User = require('../../../src/models/User');
const Message = require('../../../src/models/Message');
const Product = require('../../../src/models/Product');
const { generateToken } = require('../../../src/middleware/auth');

const uid = '507f1f77bcf86cd799439011';
const peer = '507f1f77bcf86cd799439012';
const productId = '507f1f77bcf86cd799439013';

function mountUserFindByIdForAuthAndPeer() {
  User.findById.mockImplementation((id) => {
    const idStr = String(id);
    if (idStr === uid) {
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
    return {
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(null),
      then(onF, onR) {
        if (idStr === peer) {
          return Promise.resolve({ _id: peer, email: 'peer@test.com' }).then(onF, onR);
        }
        return Promise.resolve(null).then(onF, onR);
      },
      catch(onR) {
        return this.then(undefined, onR);
      },
    };
  });
}

describe('P0 — POST /api/shop/cart/add', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSave.mockResolvedValue(undefined);
    mongoose.connection.readyState = 1;
    mountUserFindByIdForAuthAndPeer();
    app = express();
    app.use(express.json());
    app.use('/api/shop', shopRouter);
  });

  it('401 sans token', async () => {
    await request(app).post('/api/shop/cart/add').send({ productId, quantity: 1 }).expect(401);
  });

  it('400 si productId manquant', async () => {
    const token = generateToken({ id: uid, email: 'u@test.com', role: 'user' });
    await request(app)
      .post('/api/shop/cart/add')
      .set('Authorization', `Bearer ${token}`)
      .send({ quantity: 2 })
      .expect(400);
  });

  it('503 si Mongo déconnecté', async () => {
    mongoose.connection.readyState = 0;
    const token = generateToken({ id: uid, email: 'u@test.com', role: 'user' });
    await request(app)
      .post('/api/shop/cart/add')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId, quantity: 1 })
      .expect(503);
    mongoose.connection.readyState = 1;
  });

  it('200 ajoute un article (produit actif et disponible)', async () => {
    Product.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: productId,
        name: 'Test',
        isActive: true,
        isAvailable: true,
      }),
    });
    const token = generateToken({ id: uid, email: 'u@test.com', role: 'user' });
    const res = await request(app)
      .post('/api/shop/cart/add')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId, quantity: 2 })
      .expect(200);
    expect(res.body.message).toMatch(/cart|panier|success|ajout/i);
    expect(res.body.quantity).toBe(2);
    expect(Product.findOne).toHaveBeenCalled();
  });
});

describe('P0 — POST /api/shop/orders/create', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    mountUserFindByIdForAuthAndPeer();
    app = express();
    app.use(express.json());
    app.use('/api/shop', shopRouter);
  });

  it('401 sans token', async () => {
    await request(app)
      .post('/api/shop/orders/create')
      .send({ items: [{ price: 10, quantity: 1 }] })
      .expect(401);
  });

  it('400 si items vide', async () => {
    const token = generateToken({ id: uid, email: 'u@test.com', role: 'user' });
    await request(app)
      .post('/api/shop/orders/create')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [] })
      .expect(400);
  });

  it('201 crée une commande (mock)', async () => {
    const token = generateToken({ id: uid, email: 'u@test.com', role: 'user' });
    const res = await request(app)
      .post('/api/shop/orders/create')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{ price: 5, quantity: 2 }],
        shippingAddress: { line1: 'x' },
        paymentMethod: 'card',
      })
      .expect(201);
    expect(res.body.order).toMatchObject({
      userId: uid,
      status: 'pending',
    });
    expect(res.body.order.total).toBe(10);
  });
});

describe('P0 — POST /api/messages (envoi)', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSave.mockResolvedValue(undefined);
    Message.findOne.mockResolvedValue(null);
    User.exists.mockResolvedValue({ _id: peer });
    mountUserFindByIdForAuthAndPeer();
    const populated = { _id: '507f1f77bcf86cd799439099', content: 'hello', sender: {}, receiver: {} };
    const chain = {
      populate: jest.fn().mockReturnThis(),
      then(onF, onR) {
        return Promise.resolve(populated).then(onF, onR);
      },
      catch(onR) {
        return this.then(undefined, onR);
      },
    };
    chain.populate.mockReturnValue(chain);
    Message.findById.mockReturnValue(chain);

    app = express();
    app.use(express.json());
    app.use('/api/messages', messagesRouter);
  });

  it('401 sans token', async () => {
    await request(app).post('/api/messages').send({ receiver: peer, content: 'hi' }).expect(401);
  });

  it('400 validation (contenu vide)', async () => {
    const token = generateToken({ id: uid, email: 'u@test.com', role: 'user' });
    await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${token}`)
      .send({ receiver: peer, content: '   ' })
      .expect(400);
  });

  it('404 si destinataire inconnu', async () => {
    User.findById.mockImplementation((id) => {
      const idStr = String(id);
      if (idStr === uid) {
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
      return {
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(null),
        then(onF, onR) {
          return Promise.resolve(null).then(onF, onR);
        },
        catch(onR) {
          return this.then(undefined, onR);
        },
      };
    });
    User.exists.mockResolvedValue(null);
    const token = generateToken({ id: uid, email: 'u@test.com', role: 'user' });
    await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${token}`)
      .send({ receiver: peer, content: 'hello' })
      .expect(404);
  });

  it('201 envoie un message', async () => {
    const token = generateToken({ id: uid, email: 'u@test.com', role: 'user' });
    const res = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${token}`)
      .send({ receiver: peer, content: 'hello world' })
      .expect(201);
    expect(res.body.data).toBeDefined();
    expect(mockSave).toHaveBeenCalled();
  });
});
