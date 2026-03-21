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
const restaurantsFallback = require('../../../src/lib/restaurants-fallback');
const Restaurant = require('../../../src/models/Restaurant');
const User = require('../../../src/models/User');
const { generateToken } = require('../../../src/middleware/auth');
const { restaurantValid } = require('../../fixtures');
const logger = require('../../../src/lib/logger');

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

  it('GET /categories/list : 500 si res.json lève (catch handler)', async () => {
    const errSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
    const broken = express();
    broken.use('/api/restaurants', (req, res, next) => {
      if (req.path === '/categories/list') {
        res.json = () => {
          throw new Error('json broken');
        };
      }
      next();
    });
    broken.use('/api/restaurants', restaurantsRouter);
    try {
      await request(broken).get('/api/restaurants/categories/list').expect(500);
      expect(errSpy).toHaveBeenCalled();
      expect(errSpy.mock.calls[0][0]).toEqual(
        expect.objectContaining({ event: 'restaurants_categories_failed', err: expect.stringMatching(/json broken/i) })
      );
    } finally {
      errSpy.mockRestore();
    }
  });

  it('GET / retourne fallback si Mongo déconnecté', async () => {
    origReadyState = mongoose.connection.readyState;
    mongoose.connection.readyState = 0;

    const res = await request(app).get('/api/restaurants').expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    mongoose.connection.readyState = origReadyState;
  });

  it('GET / fallback offline transmet lang normalisée à getAll', async () => {
    const spy = jest.spyOn(restaurantsFallback, 'getAll').mockReturnValue([]);
    try {
      origReadyState = mongoose.connection.readyState;
      mongoose.connection.readyState = 0;
      await request(app).get('/api/restaurants?lang=EN').expect(200);
      expect(spy).toHaveBeenCalledWith('en');
    } finally {
      spy.mockRestore();
      mongoose.connection.readyState = origReadyState;
    }
  });

  it('GET /:id fallback offline : 200 si restaurants-fallback trouve le document', async () => {
    const spy = jest.spyOn(restaurantsFallback, 'getById').mockReturnValue({
      _id: RESTAURANT_ID,
      name: 'Offline',
      isActive: true,
    });
    try {
      origReadyState = mongoose.connection.readyState;
      mongoose.connection.readyState = 0;
      const res = await request(app).get(`/api/restaurants/${RESTAURANT_ID}?lang=en`).expect(200);
      expect(res.body.name).toBe('Offline');
      expect(spy).toHaveBeenCalledWith(RESTAURANT_ID, 'en');
    } finally {
      spy.mockRestore();
      mongoose.connection.readyState = origReadyState;
    }
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

  it('GET / avec Mongo : entrée null dans lean → localizeRestaurant(null)', async () => {
    origReadyState = mongoose.connection.readyState;
    mongoose.connection.readyState = 1;
    const findSpy = jest.spyOn(Restaurant, 'find').mockReturnValue(mockRestaurantFindChain([null]));

    const res = await request(app).get('/api/restaurants').expect(200);

    expect(res.body).toEqual([null]);
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

  it('GET / avec Mongo : search uniquement espaces → pas de $or (safeRegex vide)', async () => {
    origReadyState = mongoose.connection.readyState;
    mongoose.connection.readyState = 1;
    const findSpy = jest.spyOn(Restaurant, 'find').mockReturnValue(mockRestaurantFindChain([]));

    await request(app).get('/api/restaurants?search=%20%20').expect(200);

    const q = findSpy.mock.calls[0][0];
    expect(q.$or).toBeUndefined();
    findSpy.mockRestore();
    mongoose.connection.readyState = origReadyState;
  });

  it('GET / avec Mongo : translations null → pas de fusion i18n', async () => {
    origReadyState = mongoose.connection.readyState;
    mongoose.connection.readyState = 1;
    const plain = {
      _id: RESTAURANT_ID,
      name: 'Base',
      translations: null,
      isActive: true,
    };
    const findSpy = jest.spyOn(Restaurant, 'find').mockReturnValue(mockRestaurantFindChain([plain]));

    const res = await request(app).get('/api/restaurants?lang=en').expect(200);
    expect(res.body[0].name).toBe('Base');
    findSpy.mockRestore();
    mongoose.connection.readyState = origReadyState;
  });

  it('GET / avec Mongo : translations non-objet → pas de fusion i18n', async () => {
    origReadyState = mongoose.connection.readyState;
    mongoose.connection.readyState = 1;
    const findSpy = jest.spyOn(Restaurant, 'find').mockReturnValue(
      mockRestaurantFindChain([
        {
          _id: RESTAURANT_ID,
          name: 'Base',
          translations: 'bad',
          isActive: true,
        },
      ])
    );

    const res = await request(app).get('/api/restaurants?lang=en').expect(200);
    expect(res.body[0].name).toBe('Base');
    findSpy.mockRestore();
    mongoose.connection.readyState = origReadyState;
  });

  it('GET / avec Mongo : lang sans clé dédiée → {} ; menu partiel ; promos seulement si même longueur', async () => {
    origReadyState = mongoose.connection.readyState;
    mongoose.connection.readyState = 1;
    const doc = {
      _id: RESTAURANT_ID,
      name: 'Fr',
      menu: [{ name: 'Plat', description: 'Dp' }],
      promotions: [{ title: 'T0', description: 'D0' }, { title: 'T1', description: 'D1' }],
      translations: {
        en: {
          name: 'EnName',
          menu: [{ description: 'Seulement desc' }],
          promotions: [{ title: 'UnSeul' }],
        },
      },
      isActive: true,
    };
    const findSpy = jest.spyOn(Restaurant, 'find').mockReturnValue(mockRestaurantFindChain([doc]));

    const resDe = await request(app).get('/api/restaurants?lang=de').expect(200);
    expect(resDe.body[0].name).toBe('Fr');

    const resEn = await request(app).get('/api/restaurants?lang=en').expect(200);
    expect(resEn.body[0].name).toBe('EnName');
    expect(resEn.body[0].menu[0].name).toBe('Plat');
    expect(resEn.body[0].menu[0].description).toBe('Seulement desc');
    expect(resEn.body[0].promotions[0].title).toBe('T0');
    expect(resEn.body[0].promotions[1].title).toBe('T1');

    findSpy.mockRestore();
    mongoose.connection.readyState = origReadyState;
  });

  it('GET / avec Mongo : fallback translations.fr si en absent', async () => {
    origReadyState = mongoose.connection.readyState;
    mongoose.connection.readyState = 1;
    const doc = {
      _id: RESTAURANT_ID,
      name: 'Root',
      translations: { fr: { name: 'Nom FR' } },
      isActive: true,
    };
    const findSpy = jest.spyOn(Restaurant, 'find').mockReturnValue(mockRestaurantFindChain([doc]));

    const res = await request(app).get('/api/restaurants?lang=en').expect(200);
    expect(res.body[0].name).toBe('Nom FR');

    findSpy.mockRestore();
    mongoose.connection.readyState = origReadyState;
  });

  it('GET / avec Mongo : fusion promotions si longueurs égales (titres partiels)', async () => {
    origReadyState = mongoose.connection.readyState;
    mongoose.connection.readyState = 1;
    const doc = {
      _id: RESTAURANT_ID,
      name: 'R',
      promotions: [{ title: 'T0', description: 'D0' }],
      translations: {
        en: {
          promotions: [{ description: 'SeulementDesc' }],
        },
      },
      isActive: true,
    };
    const findSpy = jest.spyOn(Restaurant, 'find').mockReturnValue(mockRestaurantFindChain([doc]));

    const res = await request(app).get('/api/restaurants?lang=en').expect(200);
    expect(res.body[0].promotions[0].title).toBe('T0');
    expect(res.body[0].promotions[0].description).toBe('SeulementDesc');

    findSpy.mockRestore();
    mongoose.connection.readyState = origReadyState;
  });

  it('GET / avec Mongo : menu traduit nom seul conserve description source', async () => {
    origReadyState = mongoose.connection.readyState;
    mongoose.connection.readyState = 1;
    const doc = {
      _id: RESTAURANT_ID,
      name: 'R',
      menu: [{ name: 'Plat', description: 'Desc source' }],
      translations: {
        en: {
          menu: [{ name: 'DishEn' }],
        },
      },
      isActive: true,
    };
    const findSpy = jest.spyOn(Restaurant, 'find').mockReturnValue(mockRestaurantFindChain([doc]));

    const res = await request(app).get('/api/restaurants?lang=en').expect(200);
    expect(res.body[0].menu[0].name).toBe('DishEn');
    expect(res.body[0].menu[0].description).toBe('Desc source');

    findSpy.mockRestore();
    mongoose.connection.readyState = origReadyState;
  });

  it('GET / avec Mongo : promotions traduites titre seul conserve description source', async () => {
    origReadyState = mongoose.connection.readyState;
    mongoose.connection.readyState = 1;
    const doc = {
      _id: RESTAURANT_ID,
      name: 'R',
      promotions: [{ title: 'T0', description: 'Desc promo' }],
      translations: {
        en: {
          promotions: [{ title: 'TEn' }],
        },
      },
      isActive: true,
    };
    const findSpy = jest.spyOn(Restaurant, 'find').mockReturnValue(mockRestaurantFindChain([doc]));

    const res = await request(app).get('/api/restaurants?lang=en').expect(200);
    expect(res.body[0].promotions[0].title).toBe('TEn');
    expect(res.body[0].promotions[0].description).toBe('Desc promo');

    findSpy.mockRestore();
    mongoose.connection.readyState = origReadyState;
  });

  it('GET / avec Mongo : 500 si Restaurant.find échoue', async () => {
    const errSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
    try {
      origReadyState = mongoose.connection.readyState;
      mongoose.connection.readyState = 1;
      const chain = {
        read: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockRejectedValue(new Error('db down')),
      };
      const findSpy = jest.spyOn(Restaurant, 'find').mockReturnValue(chain);

      await request(app).get('/api/restaurants').expect(500);

      expect(errSpy).toHaveBeenCalled();
      expect(errSpy.mock.calls[0][0]).toEqual(
        expect.objectContaining({ event: 'restaurants_list_failed', err: 'db down' })
      );

      findSpy.mockRestore();
      mongoose.connection.readyState = origReadyState;
    } finally {
      errSpy.mockRestore();
    }
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

  it('GET /:id avec Mongo : ?lang= en minuscule pour localizeRestaurant', async () => {
    origReadyState = mongoose.connection.readyState;
    mongoose.connection.readyState = 1;
    const doc = {
      _id: RESTAURANT_ID,
      name: 'Fr',
      isActive: true,
      translations: { en: { name: 'English' } },
    };
    const spy = jest.spyOn(Restaurant, 'findById').mockReturnValue(mockFindByIdChain(doc));

    const res = await request(app).get(`/api/restaurants/${RESTAURANT_ID}?lang=EN`).expect(200);
    expect(res.body.name).toBe('English');

    spy.mockRestore();
    mongoose.connection.readyState = origReadyState;
  });

  it('GET / avec Mongo : localisation complète (menu, promotions, toObject)', async () => {
    origReadyState = mongoose.connection.readyState;
    mongoose.connection.readyState = 1;
    const doc = {
      _id: RESTAURANT_ID,
      name: 'Fr',
      description: 'Df',
      type: 'Tf',
      isActive: true,
      menu: [{ name: 'Plat', description: 'Dp' }],
      promotions: [{ title: 'Promo', description: 'Pdesc' }],
      translations: {
        en: {
          name: 'En',
          description: 'End',
          type: 'Ent',
          location: 'Dock',
          openingHours: '8-22',
          specialties: ['fish'],
          menu: [{ name: 'DishEn', description: 'De' }],
          promotions: [{ title: 'Pen', description: 'Pde' }],
        },
      },
      toObject() {
        return {
          _id: this._id,
          name: this.name,
          description: this.description,
          type: this.type,
          isActive: this.isActive,
          menu: this.menu,
          promotions: this.promotions,
          translations: this.translations,
        };
      },
    };
    const findSpy = jest.spyOn(Restaurant, 'find').mockReturnValue(mockRestaurantFindChain([doc]));

    const res = await request(app).get('/api/restaurants?lang=en').expect(200);

    expect(res.body[0].name).toBe('En');
    expect(res.body[0].type).toBe('Ent');
    expect(res.body[0].location).toBe('Dock');
    expect(res.body[0].openingHours).toBe('8-22');
    expect(res.body[0].specialties).toEqual(['fish']);
    expect(res.body[0].menu[0].name).toBe('DishEn');
    expect(res.body[0].promotions[0].title).toBe('Pen');
    findSpy.mockRestore();
    mongoose.connection.readyState = origReadyState;
  });

  it('GET /:id avec Mongo : 500 si findById échoue', async () => {
    const errSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
    try {
      origReadyState = mongoose.connection.readyState;
      mongoose.connection.readyState = 1;
      const chain = {
        read: jest.fn().mockReturnThis(),
        lean: jest.fn().mockRejectedValue(new Error('read fail')),
      };
      const spy = jest.spyOn(Restaurant, 'findById').mockReturnValue(chain);

      await request(app).get(`/api/restaurants/${RESTAURANT_ID}`).expect(500);

      expect(errSpy).toHaveBeenCalled();
      expect(errSpy.mock.calls[0][0]).toEqual(
        expect.objectContaining({ event: 'restaurants_get_failed', err: 'read fail' })
      );

      spy.mockRestore();
      mongoose.connection.readyState = origReadyState;
    } finally {
      errSpy.mockRestore();
    }
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

  it('400 ValidationError sans messages explicites → Données invalides', async () => {
    const errSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
    saveSpy.mockRestore();
    const vErr = Object.assign(new Error('Validation failed'), {
      name: 'ValidationError',
      errors: { x: { message: '' } },
    });
    const failSave = jest.spyOn(Restaurant.prototype, 'save').mockRejectedValue(vErr);
    try {
      const token = generateToken({ id: ADMIN_ID, email: 'admin@test.com', role: 'admin' });
      const res = await request(app)
        .post('/api/restaurants')
        .set('Authorization', `Bearer ${token}`)
        .send(restaurantValid)
        .expect(400);
      expect(res.body.message).toMatch(/Données invalides|invalides/i);
    } finally {
      errSpy.mockRestore();
      failSave.mockRestore();
      saveSpy = jest.spyOn(Restaurant.prototype, 'save').mockImplementation(function saveMock() {
        if (!this._id) this._id = new mongoose.Types.ObjectId('60a1b2c3d4e5f6a7b8c9d0e1');
        return Promise.resolve();
      });
    }
  });

  it('201 ignore translations si ce n’est pas un objet', async () => {
    const token = generateToken({ id: ADMIN_ID, email: 'admin@test.com', role: 'admin' });
    const res = await request(app)
      .post('/api/restaurants')
      .set('Authorization', `Bearer ${token}`)
      .send({
        ...restaurantValid,
        translations: 'invalid',
      })
      .expect(201);
    expect(res.body.restaurant).toBeDefined();
  });

  it('500 si save lève une erreur hors ValidationError', async () => {
    const errSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
    saveSpy.mockRestore();
    const failSave = jest.spyOn(Restaurant.prototype, 'save').mockRejectedValue(new Error('persist failed'));
    try {
      const token = generateToken({ id: ADMIN_ID, email: 'admin@test.com', role: 'admin' });
      const res = await request(app)
        .post('/api/restaurants')
        .set('Authorization', `Bearer ${token}`)
        .send(restaurantValid)
        .expect(500);
      expect(res.body.message).toMatch(/persist failed/);
      expect(errSpy).toHaveBeenCalled();
      expect(errSpy.mock.calls[0][0]).toEqual(
        expect.objectContaining({ event: 'restaurants_create_failed', err: 'persist failed' })
      );
    } finally {
      errSpy.mockRestore();
      failSave.mockRestore();
      saveSpy = jest.spyOn(Restaurant.prototype, 'save').mockImplementation(function saveMock() {
        if (!this._id) this._id = new mongoose.Types.ObjectId('60a1b2c3d4e5f6a7b8c9d0e1');
        return Promise.resolve();
      });
    }
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

  it('400 si ValidationError Mongoose à la mise à jour', async () => {
    const errSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
    try {
      const token = generateToken({ id: ADMIN_ID, email: 'admin@test.com', role: 'admin' });
      const vErr = Object.assign(new Error('Validation failed'), {
        name: 'ValidationError',
        errors: { name: { message: 'Nom requis' } },
      });
      jest.spyOn(Restaurant, 'findByIdAndUpdate').mockRejectedValue(vErr);

      const res = await request(app)
        .put(`/api/restaurants/${RESTAURANT_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: '', type: 'X', description: 'Y' })
        .expect(400);

      expect(res.body.message).toMatch(/Nom requis|invalides/i);
      expect(errSpy).toHaveBeenCalled();
      expect(errSpy.mock.calls[0][0]).toEqual(
        expect.objectContaining({ event: 'restaurants_update_failed', err: 'Validation failed' })
      );
      Restaurant.findByIdAndUpdate.mockRestore();
    } finally {
      errSpy.mockRestore();
    }
  });

  it('400 PUT ValidationError messages vides → Données invalides', async () => {
    const errSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
    try {
      const token = generateToken({ id: ADMIN_ID, email: 'admin@test.com', role: 'admin' });
      const vErr = Object.assign(new Error('Validation failed'), {
        name: 'ValidationError',
        errors: { name: { message: '' } },
      });
      jest.spyOn(Restaurant, 'findByIdAndUpdate').mockRejectedValue(vErr);

      const res = await request(app)
        .put(`/api/restaurants/${RESTAURANT_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'X', type: 'Y', description: 'Z' })
        .expect(400);

      expect(res.body.message).toMatch(/Données invalides|invalides/i);
      Restaurant.findByIdAndUpdate.mockRestore();
    } finally {
      errSpy.mockRestore();
    }
  });

  it('ignore translations non-objet sur PUT', async () => {
    const token = generateToken({ id: ADMIN_ID, email: 'admin@test.com', role: 'admin' });
    const updated = { _id: RESTAURANT_ID, name: 'Ok', type: 'T', description: 'D' };
    const spy = jest.spyOn(Restaurant, 'findByIdAndUpdate').mockResolvedValue(updated);

    await request(app)
      .put(`/api/restaurants/${RESTAURANT_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Ok', translations: 123 })
      .expect(200);

    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('500 si findByIdAndUpdate lève hors ValidationError', async () => {
    const errSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
    try {
      const token = generateToken({ id: ADMIN_ID, email: 'admin@test.com', role: 'admin' });
      jest.spyOn(Restaurant, 'findByIdAndUpdate').mockRejectedValue(new Error('mongo down'));

      const res = await request(app)
        .put(`/api/restaurants/${RESTAURANT_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'X', type: 'Y', description: 'Z' })
        .expect(500);

      expect(res.body.message).toBe('mongo down');
      expect(errSpy).toHaveBeenCalled();
      expect(errSpy.mock.calls[0][0]).toEqual(
        expect.objectContaining({ event: 'restaurants_update_failed', err: 'mongo down' })
      );
      Restaurant.findByIdAndUpdate.mockRestore();
    } finally {
      errSpy.mockRestore();
    }
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

  it('500 si désactivation échoue', async () => {
    const errSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
    try {
      const token = generateToken({ id: ADMIN_ID, email: 'admin@test.com', role: 'admin' });
      jest.spyOn(Restaurant, 'findByIdAndUpdate').mockRejectedValue(new Error('db error'));

      await request(app).delete(`/api/restaurants/${RESTAURANT_ID}`).set('Authorization', `Bearer ${token}`).expect(500);

      expect(errSpy).toHaveBeenCalled();
      expect(errSpy.mock.calls[0][0]).toEqual(
        expect.objectContaining({ event: 'restaurants_delete_failed', err: 'db error' })
      );
      Restaurant.findByIdAndUpdate.mockRestore();
    } finally {
      errSpy.mockRestore();
    }
  });
});
