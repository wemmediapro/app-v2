/**
 * Routes /api/restaurants — fallback offline, liste Mongo mockée, CRUD admin.
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

const mongoose = require('mongoose');
const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const restaurantsRouter = require('../../../src/routes/restaurants');
const Restaurant = require('../../../src/models/Restaurant');
const User = require('../../../src/models/User');
const { generateToken } = require('../../../src/middleware/auth');
const { restaurantValid } = require('../../fixtures');

const ADMIN_ID = '507f1f77bcf86cd799439011';
const RESTAURANT_ID = '507f1f77bcf86cd7994390aa';

function buildApp() {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use('/api/restaurants', restaurantsRouter);
  return app;
}

function mockRestaurantFindChain(docs) {
  return {
    read: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(docs),
  };
}

function mockFindByIdChain(doc) {
  return {
    read: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(doc),
  };
}

describe('GET /api/restaurants', () => {
  let app;
  let origReadyState;

  beforeAll(() => {
    app = express();
    app.use('/api/restaurants', restaurantsRouter);
  });

  it('GET /categories/list retourne la liste des catégories', async () => {
    const res = await request(app).get('/api/restaurants/categories/list').expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty('id');
    expect(res.body[0]).toHaveProperty('name');
    expect(res.body[0]).toHaveProperty('icon');
  });

  it('GET / retourne fallback si Mongo déconnecté', async () => {
    origReadyState = mongoose.connection.readyState;
    mongoose.connection.readyState = 0;

    const res = await request(app).get('/api/restaurants').expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    mongoose.connection.readyState = origReadyState;
  });

  it('GET / avec Mongo : filtre category + localisation lang', async () => {
    origReadyState = mongoose.connection.readyState;
    mongoose.connection.readyState = 1;
    const findSpy = jest.spyOn(Restaurant, 'find').mockReturnValue(
      mockRestaurantFindChain([
        {
          _id: RESTAURANT_ID,
          name: 'Fr',
          translations: { en: { name: 'English Name', description: 'Desc' } },
          isActive: true,
        },
      ])
    );

    const res = await request(app).get('/api/restaurants?category=french&lang=en').expect(200);

    expect(findSpy).toHaveBeenCalled();
    expect(res.body[0].name).toBe('English Name');
    findSpy.mockRestore();
    mongoose.connection.readyState = origReadyState;
  });

  it('GET / avec Mongo : search applique $or regex', async () => {
    origReadyState = mongoose.connection.readyState;
    mongoose.connection.readyState = 1;
    const findSpy = jest.spyOn(Restaurant, 'find').mockReturnValue(mockRestaurantFindChain([]));

    await request(app).get('/api/restaurants?search=sushi%20bar').expect(200);

    const q = findSpy.mock.calls[0][0];
    expect(q.$or).toBeDefined();
    expect(q.$or.length).toBe(3);
    findSpy.mockRestore();
    mongoose.connection.readyState = origReadyState;
  });

  it('GET / avec Mongo : 500 si Restaurant.find échoue', async () => {
    origReadyState = mongoose.connection.readyState;
    mongoose.connection.readyState = 1;
    const chain = {
      read: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      lean: jest.fn().mockRejectedValue(new Error('db down')),
    };
    const findSpy = jest.spyOn(Restaurant, 'find').mockReturnValue(chain);

    await request(app).get('/api/restaurants').expect(500);

    findSpy.mockRestore();
    mongoose.connection.readyState = origReadyState;
  });

  it('GET /:id fallback offline : 404 si inconnu', async () => {
    origReadyState = mongoose.connection.readyState;
    mongoose.connection.readyState = 0;

    await request(app).get(`/api/restaurants/${RESTAURANT_ID}`).expect(404);

    mongoose.connection.readyState = origReadyState;
  });

  it('GET /:id avec Mongo : 404 si absent', async () => {
    origReadyState = mongoose.connection.readyState;
    mongoose.connection.readyState = 1;
    const spy = jest.spyOn(Restaurant, 'findById').mockReturnValue(mockFindByIdChain(null));

    await request(app).get(`/api/restaurants/${RESTAURANT_ID}`).expect(404);

    spy.mockRestore();
    mongoose.connection.readyState = origReadyState;
  });

  it('GET /:id avec Mongo : 200 + document', async () => {
    origReadyState = mongoose.connection.readyState;
    mongoose.connection.readyState = 1;
    const doc = { _id: RESTAURANT_ID, name: 'Solo', description: 'D', type: 'T', isActive: true };
    const spy = jest.spyOn(Restaurant, 'findById').mockReturnValue(mockFindByIdChain(doc));

    const res = await request(app).get(`/api/restaurants/${RESTAURANT_ID}`).expect(200);

    expect(res.body.name).toBe('Solo');
    spy.mockRestore();
    mongoose.connection.readyState = origReadyState;
  });
});

describe('POST /api/restaurants (admin)', () => {
  let app;
  let saveSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    mongoose.connection.readyState = 1;
    app = buildApp();
    User.findById.mockImplementation(() => ({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: ADMIN_ID,
          email: 'admin@test.com',
          role: 'admin',
          isActive: true,
          twoFactorEnabled: false,
        }),
      }),
    }));
    saveSpy = jest.spyOn(Restaurant.prototype, 'save').mockImplementation(function saveMock() {
      if (!this._id) this._id = new mongoose.Types.ObjectId('60a1b2c3d4e5f6a7b8c9d0e1');
      return Promise.resolve();
    });
  });

  afterEach(() => {
    saveSpy?.mockRestore();
  });

  it('401 sans token', async () => {
    await request(app).post('/api/restaurants').send(restaurantValid).expect(401);
  });

  it('403 si utilisateur non admin', async () => {
    User.findById.mockImplementation(() => ({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: ADMIN_ID,
          email: 'u@test.com',
          role: 'passenger',
          isActive: true,
          twoFactorEnabled: false,
        }),
      }),
    }));
    const token = generateToken({ id: ADMIN_ID, email: 'u@test.com', role: 'passenger' });
    await request(app)
      .post('/api/restaurants')
      .set('Authorization', `Bearer ${token}`)
      .send(restaurantValid)
      .expect(403);
  });

  it('201 création valide', async () => {
    const token = generateToken({ id: ADMIN_ID, email: 'admin@test.com', role: 'admin' });
    const res = await request(app)
      .post('/api/restaurants')
      .set('Authorization', `Bearer ${token}`)
      .send(restaurantValid)
      .expect(201);

    expect(res.body.message).toMatch(/created/i);
    expect(res.body.restaurant).toBeDefined();
  });

  it('400 si validation Mongoose échoue', async () => {
    const token = generateToken({ id: ADMIN_ID, email: 'admin@test.com', role: 'admin' });
    saveSpy.mockRestore();
    await request(app)
      .post('/api/restaurants')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Seulement le nom' })
      .expect(400);
    saveSpy = jest.spyOn(Restaurant.prototype, 'save').mockResolvedValue();
  });
});

describe('PUT /api/restaurants/:id (admin)', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    mongoose.connection.readyState = 1;
    app = buildApp();
    User.findById.mockImplementation(() => ({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: ADMIN_ID,
          email: 'admin@test.com',
          role: 'admin',
          isActive: true,
          twoFactorEnabled: false,
        }),
      }),
    }));
  });

  it('404 si restaurant inexistant', async () => {
    const token = generateToken({ id: ADMIN_ID, email: 'admin@test.com', role: 'admin' });
    jest.spyOn(Restaurant, 'findByIdAndUpdate').mockResolvedValue(null);

    await request(app)
      .put(`/api/restaurants/${RESTAURANT_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'X', type: 'Y', description: 'Z' })
      .expect(404);

    Restaurant.findByIdAndUpdate.mockRestore();
  });

  it('200 mise à jour', async () => {
    const token = generateToken({ id: ADMIN_ID, email: 'admin@test.com', role: 'admin' });
    const updated = { _id: RESTAURANT_ID, name: 'Nouveau', type: 'T', description: 'D' };
    jest.spyOn(Restaurant, 'findByIdAndUpdate').mockResolvedValue(updated);

    const res = await request(app)
      .put(`/api/restaurants/${RESTAURANT_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Nouveau' })
      .expect(200);

    expect(res.body.restaurant.name).toBe('Nouveau');
    Restaurant.findByIdAndUpdate.mockRestore();
  });
});

describe('DELETE /api/restaurants/:id (admin)', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    mongoose.connection.readyState = 1;
    app = buildApp();
    User.findById.mockImplementation(() => ({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: ADMIN_ID,
          email: 'admin@test.com',
          role: 'admin',
          isActive: true,
          twoFactorEnabled: false,
        }),
      }),
    }));
  });

  it('404 si déjà absent', async () => {
    const token = generateToken({ id: ADMIN_ID, email: 'admin@test.com', role: 'admin' });
    jest.spyOn(Restaurant, 'findByIdAndUpdate').mockResolvedValue(null);

    await request(app).delete(`/api/restaurants/${RESTAURANT_ID}`).set('Authorization', `Bearer ${token}`).expect(404);

    Restaurant.findByIdAndUpdate.mockRestore();
  });

  it('200 désactivation', async () => {
    const token = generateToken({ id: ADMIN_ID, email: 'admin@test.com', role: 'admin' });
    jest.spyOn(Restaurant, 'findByIdAndUpdate').mockResolvedValue({ _id: RESTAURANT_ID, isActive: false });

    const res = await request(app)
      .delete(`/api/restaurants/${RESTAURANT_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.message).toMatch(/deactivated/i);
    Restaurant.findByIdAndUpdate.mockRestore();
  });
});
