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
                lean: jest.fn().mockResolvedValue([
                  { firstName: 'A', lastName: 'B', email: 'a@b.com', cabinNumber: '1' },
                ]),
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
