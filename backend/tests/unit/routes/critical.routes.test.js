/**
 * Routes critiques : GET /api/users, POST /api/restaurants, GET /api/messages/:userId
 */
jest.mock('../../../src/lib/cache-manager', () => ({
  isConnected: false,
  get: jest.fn(),
  set: jest.fn(),
}));

jest.mock('../../../src/models/User', () => {
  const Mock = function UserMock() {};
  Mock.find = jest.fn();
  Mock.findOne = jest.fn();
  Mock.findById = jest.fn();
  Mock.countDocuments = jest.fn();
  return Mock;
});

const mongoose = require('mongoose');
const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');

const usersRouter = require('../../../src/routes/users');
const restaurantsRouter = require('../../../src/routes/restaurants');
const messagesRouter = require('../../../src/routes/messages');
const User = require('../../../src/models/User');
const Message = require('../../../src/models/Message');
const Restaurant = require('../../../src/models/Restaurant');
const { generateToken } = require('../../../src/middleware/auth');
const logger = require('../../../src/lib/logger');

describe('Routes critiques', () => {
  let app;
  const uid = '507f1f77bcf86cd799439011';
  const peer = '507f1f77bcf86cd799439012';

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Restaurant.prototype, 'save').mockResolvedValue(undefined);
    mongoose.connection.readyState = 1;

    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/api/users', usersRouter);
    app.use('/api/restaurants', restaurantsRouter);
    app.use('/api/messages', messagesRouter);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('GET /api/users', () => {
    it('401 sans authentification', async () => {
      await request(app).get('/api/users').expect(401);
    });

    it('200 avec token — liste paginée', async () => {
      User.find = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            skip: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                lean: jest
                  .fn()
                  .mockResolvedValue([{ firstName: 'A', lastName: 'B', email: 'a@b.com', cabinNumber: '1' }]),
              }),
            }),
          }),
        }),
      });
      User.countDocuments = jest.fn().mockResolvedValue(1);

      User.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            _id: uid,
            email: 'u@test.com',
            role: 'user',
            isActive: true,
          }),
        }),
      });

      const token = generateToken({ id: uid, email: 'u@test.com', role: 'user' });
      const res = await request(app)
        .get('/api/users?page=1&limit=20')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.total).toBe(1);
    });

    it('200 liste vide si MongoDB non connecté', async () => {
      mongoose.connection.readyState = 0;
      User.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            _id: uid,
            email: 'u@test.com',
            role: 'user',
            isActive: true,
          }),
        }),
      });
      const token = generateToken({ id: uid, email: 'u@test.com', role: 'user' });
      const res = await request(app)
        .get('/api/users?page=1&limit=20')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body.data).toEqual([]);
      expect(res.body.total).toBe(0);
      expect(User.find).not.toHaveBeenCalled();
      mongoose.connection.readyState = 1;
    });

    it('200 avec ?search= applique un filtre $or sécurisé', async () => {
      const findChain = {
        select: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            skip: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      };
      User.find = jest.fn().mockReturnValue(findChain);
      User.countDocuments = jest.fn().mockResolvedValue(0);
      User.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            _id: uid,
            email: 'u@test.com',
            role: 'user',
            isActive: true,
          }),
        }),
      });
      const token = generateToken({ id: uid, email: 'u@test.com', role: 'user' });
      await request(app)
        .get('/api/users?page=1&limit=10&search=Jean')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(User.find).toHaveBeenCalled();
      const q = User.find.mock.calls[0][0];
      expect(q.$or).toBeDefined();
      expect(q.$or.length).toBe(4);
      expect(q.isActive).toBe(true);
    });

    it('200 avec ?search= espaces uniquement → pas de $or (sanitize vide)', async () => {
      const findChain = {
        select: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            skip: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      };
      User.find = jest.fn().mockReturnValue(findChain);
      User.countDocuments = jest.fn().mockResolvedValue(0);
      User.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            _id: uid,
            email: 'u@test.com',
            role: 'user',
            isActive: true,
          }),
        }),
      });
      const token = generateToken({ id: uid, email: 'u@test.com', role: 'user' });
      await request(app)
        .get('/api/users?page=1&limit=10&search=%20%20')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const q = User.find.mock.calls[0][0];
      expect(q.$or).toBeUndefined();
      expect(q.isActive).toBe(true);
    });

    it('500 si User.find lève une erreur', async () => {
      const errSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
      try {
        User.find = jest.fn().mockImplementation(() => {
          throw new Error('db down');
        });
        User.findById.mockReturnValue({
          select: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue({
              _id: uid,
              email: 'u@test.com',
              role: 'user',
              isActive: true,
            }),
          }),
        });
        const token = generateToken({ id: uid, email: 'u@test.com', role: 'user' });
        const res = await request(app)
          .get('/api/users?page=1&limit=10')
          .set('Authorization', `Bearer ${token}`)
          .expect(500);
        expect(res.body.message).toBe('Server error');
        expect(errSpy).toHaveBeenCalled();
        expect(errSpy.mock.calls[0][0]).toEqual(
          expect.objectContaining({ event: 'users_list_failed', err: 'db down' })
        );
      } finally {
        errSpy.mockRestore();
      }
    });
  });

  describe('GET /api/users/:id', () => {
    it('200 profil utilisateur', async () => {
      const profile = { _id: peer, email: 'peer@test.com', firstName: 'P' };
      User.findById.mockImplementation((id) => {
        const idStr = String(id);
        const authUser = { _id: uid, email: 'u@test.com', role: 'user', isActive: true };
        if (idStr === uid) {
          return {
            select: jest.fn().mockReturnValue({
              lean: jest.fn().mockResolvedValue(authUser),
            }),
          };
        }
        return {
          select: jest.fn().mockResolvedValue(profile),
        };
      });
      const token = generateToken({ id: uid, email: 'u@test.com', role: 'user' });
      const res = await request(app).get(`/api/users/${peer}`).set('Authorization', `Bearer ${token}`).expect(200);
      expect(res.body.email).toBe('peer@test.com');
    });

    it('404 si utilisateur absent', async () => {
      User.findById.mockImplementation((id) => {
        const idStr = String(id);
        const authUser = { _id: uid, email: 'u@test.com', role: 'user', isActive: true };
        if (idStr === uid) {
          return {
            select: jest.fn().mockReturnValue({
              lean: jest.fn().mockResolvedValue(authUser),
            }),
          };
        }
        return {
          select: jest.fn().mockResolvedValue(null),
        };
      });
      const token = generateToken({ id: uid, email: 'u@test.com', role: 'user' });
      await request(app).get(`/api/users/${peer}`).set('Authorization', `Bearer ${token}`).expect(404);
    });

    it('500 si User.findById lève une erreur sur le profil cible', async () => {
      const errSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
      try {
        User.findById.mockImplementation((id) => {
          const idStr = String(id);
          const authUser = { _id: uid, email: 'u@test.com', role: 'user', isActive: true };
          if (idStr === uid) {
            return {
              select: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue(authUser),
              }),
            };
          }
          throw new Error('db error');
        });
        const token = generateToken({ id: uid, email: 'u@test.com', role: 'user' });
        const res = await request(app).get(`/api/users/${peer}`).set('Authorization', `Bearer ${token}`).expect(500);
        expect(res.body.message).toBe('Server error');
        expect(errSpy).toHaveBeenCalled();
        expect(errSpy.mock.calls[0][0]).toEqual(
          expect.objectContaining({ event: 'users_get_failed', err: 'db error' })
        );
      } finally {
        errSpy.mockRestore();
      }
    });
  });

  describe('POST /api/restaurants', () => {
    it('403 si utilisateur non admin', async () => {
      User.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            _id: uid,
            email: 'u@test.com',
            role: 'user',
            isActive: true,
          }),
        }),
      });
      const token = generateToken({ id: uid, email: 'u@test.com', role: 'user' });
      await request(app)
        .post('/api/restaurants')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'R', type: 't', description: 'd' })
        .expect(403);
    });

    it('201 si admin', async () => {
      User.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            _id: uid,
            email: 'admin@test.com',
            role: 'admin',
            isActive: true,
          }),
        }),
      });
      const token = generateToken({ id: uid, email: 'admin@test.com', role: 'admin' });
      const res = await request(app)
        .post('/api/restaurants')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Le Port',
          type: 'Brasserie',
          description: 'Repas',
        })
        .expect(201);
      expect(res.body).toHaveProperty('restaurant');
      expect(Restaurant.prototype.save).toHaveBeenCalled();
    });
  });

  describe('GET /api/messages/:userId', () => {
    it('200 retourne messages (mock query)', async () => {
      const reversed = [{ _id: 'm1', content: 'hi' }];
      const query = {
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        then(onF) {
          return Promise.resolve(reversed).then(onF);
        },
        catch(onR) {
          return Promise.resolve(reversed).catch(onR);
        },
      };
      Message.find = jest.fn().mockReturnValue(query);
      Message.updateMany = jest.fn().mockResolvedValue({ modifiedCount: 0 });

      User.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            _id: uid,
            email: 'u@test.com',
            role: 'user',
            isActive: true,
          }),
        }),
      });

      const token = generateToken({ id: uid, email: 'u@test.com', role: 'user' });
      const res = await request(app)
        .get(`/api/messages/${peer}?page=1&limit=50`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(Message.updateMany).toHaveBeenCalled();
    });
  });
});
