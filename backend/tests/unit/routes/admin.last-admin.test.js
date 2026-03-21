/**
 * Garde-fou : on ne peut pas supprimer / désactiver le dernier compte admin.
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
  findOne: jest.fn(),
  countDocuments: jest.fn(),
  findByIdAndDelete: jest.fn(),
}));

const express = require('express');
const request = require('supertest');
const User = require('../../../src/models/User');
const adminRouter = require('../../../src/routes/admin');
const { generateToken } = require('../../../src/middleware/auth');

const ACTOR_ID = '507f1f77bcf86cd799439011';
const TARGET_ID = '507f1f77bcf86cd799439099';

/** Chaîne type requête Mongoose : await Model.findById() et .select().lean() */
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

describe('Admin — dernier administrateur', () => {
  beforeEach(() => {
    User.findById.mockImplementation((id) => {
      const idStr = String(id);
      if (idStr === ACTOR_ID) {
        return makeThenableDoc({
          _id: idStr,
          email: 'actor@test.com',
          role: 'admin',
          isActive: true,
          twoFactorEnabled: false,
        });
      }
      return makeThenableDoc({
        _id: idStr,
        email: 'target@test.com',
        role: 'admin',
        isActive: true,
        save: jest.fn().mockResolvedValue(undefined),
      });
    });
    User.countDocuments.mockResolvedValue(0);
  });

  it('DELETE /api/admin/users/:id retourne 400 SELF_DELETE si la cible est le compte connecté', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/admin', adminRouter);

    const token = generateToken({
      id: ACTOR_ID,
      email: 'actor@test.com',
      role: 'admin',
    });

    User.countDocuments.mockResolvedValue(5);

    const res = await request(app).delete(`/api/admin/users/${ACTOR_ID}`).set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('SELF_DELETE');
    expect(User.findByIdAndDelete).not.toHaveBeenCalled();
    expect(User.countDocuments).not.toHaveBeenCalled();
  });

  it('DELETE /api/admin/users/:id retourne 400 LAST_ADMIN si aucun autre admin', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/admin', adminRouter);

    const token = generateToken({
      id: ACTOR_ID,
      email: 'actor@test.com',
      role: 'admin',
    });

    const res = await request(app).delete(`/api/admin/users/${TARGET_ID}`).set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('LAST_ADMIN');
    expect(res.body.message).toMatch(/dernier administrateur/i);
    expect(User.findByIdAndDelete).not.toHaveBeenCalled();
    expect(User.countDocuments).toHaveBeenCalledWith({
      role: 'admin',
      _id: { $ne: expect.anything() },
    });
  });

  describe('PUT /api/admin/users/:id', () => {
    beforeEach(() => {
      User.findOne.mockResolvedValue(null);
      User.findById.mockImplementation((id) => {
        const idStr = String(id);
        const base = {
          phone: '',
          cabinNumber: '',
          allowedModules: null,
          twoFactorEnabled: false,
          save: jest.fn().mockResolvedValue(undefined),
        };
        if (idStr === ACTOR_ID) {
          return makeThenableDoc({
            ...base,
            _id: idStr,
            firstName: 'Act',
            lastName: 'Or',
            email: 'actor@test.com',
            role: 'admin',
            isActive: true,
          });
        }
        return makeThenableDoc({
          ...base,
          _id: idStr,
          firstName: 'Tar',
          lastName: 'Get',
          email: 'target@test.com',
          role: 'admin',
          isActive: true,
        });
      });
    });

    it('retourne 400 SELF_DEACTIVATE si isActive false sur le compte connecté', async () => {
      const app = express();
      app.use(express.json());
      app.use('/api/admin', adminRouter);

      const token = generateToken({
        id: ACTOR_ID,
        email: 'actor@test.com',
        role: 'admin',
      });

      const res = await request(app)
        .put(`/api/admin/users/${ACTOR_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ isActive: false });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('SELF_DEACTIVATE');
    });

    it('retourne 400 SELF_DEMOTE si retrait du rôle admin sur soi-même', async () => {
      const app = express();
      app.use(express.json());
      app.use('/api/admin', adminRouter);

      const token = generateToken({
        id: ACTOR_ID,
        email: 'actor@test.com',
        role: 'admin',
      });

      const res = await request(app)
        .put(`/api/admin/users/${ACTOR_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ role: 'crew' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('SELF_DEMOTE');
    });

    it('retourne 400 LAST_ADMIN si désactivation du seul autre admin actif', async () => {
      const app = express();
      app.use(express.json());
      app.use('/api/admin', adminRouter);

      const token = generateToken({
        id: ACTOR_ID,
        email: 'actor@test.com',
        role: 'admin',
      });

      User.countDocuments.mockResolvedValue(0);

      const res = await request(app)
        .put(`/api/admin/users/${TARGET_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ isActive: false });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('LAST_ADMIN');
      expect(User.countDocuments).toHaveBeenCalledWith({
        role: 'admin',
        _id: { $ne: expect.anything() },
        isActive: true,
      });
    });
  });
});
