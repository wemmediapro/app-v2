/**
 * Unités pures : strongPassword, validatePagination, handleValidationErrors, validateBody/Query/Params.
 */
const express = require('express');
const request = require('supertest');
const { body, query, param } = require('express-validator');
const validation = require('../../../src/middleware/validation');

describe('strongPassword', () => {
  const { strongPassword } = validation;

  it('rejette null, non-string, trop court', () => {
    expect(strongPassword(null)).toBe(false);
    expect(strongPassword(undefined)).toBe(false);
    expect(strongPassword(12)).toBe(false);
    expect(strongPassword('Short1!')).toBe(false);
  });

  it('rejette sans majuscule, minuscule, chiffre ou symbole', () => {
    expect(strongPassword('abcdefgh1!')).toBe(false);
    expect(strongPassword('ABCDEFGH1!')).toBe(false);
    expect(strongPassword('Abcdefgh!')).toBe(false);
    expect(strongPassword('Abcdefg1')).toBe(false);
  });

  it('accepte un mot de passe admin conforme', () => {
    expect(strongPassword('Abcd1234!')).toBe(true);
  });
});

describe('validatePagination', () => {
  const { validatePagination } = validation;

  it('400 si page < 1', () => {
    const req = { query: { page: '-1', limit: '10' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    validatePagination(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Page must be greater than 0' });
    expect(next).not.toHaveBeenCalled();
  });

  it('normalise page, limite le cap à 100', () => {
    const req = { query: { page: '3', limit: '500' } };
    const res = {};
    const next = jest.fn();
    validatePagination(req, res, next);
    expect(req.query.page).toBe(3);
    expect(req.query.limit).toBe(100);
    expect(next).toHaveBeenCalled();
  });

  it('défaut page=1 et limit=20 si absents', () => {
    const req = { query: {} };
    const next = jest.fn();
    validatePagination(req, {}, next);
    expect(req.query.page).toBe(1);
    expect(req.query.limit).toBe(20);
  });
});

describe('handleValidationErrors (intégration express-validator)', () => {
  const { handleValidationErrors } = validation;

  it('400 si validation échoue', async () => {
    const app = express();
    app.use(express.json());
    app.post('/x', body('email').isEmail(), handleValidationErrors, (req, res) => res.sendStatus(200));
    const res = await request(app).post('/x').send({ email: 'pas-un-email' }).expect(400);
    expect(res.body.message).toBe('Validation failed');
    expect(Array.isArray(res.body.errors)).toBe(true);
  });

  it('next si validation OK', async () => {
    const app = express();
    app.use(express.json());
    app.post('/x', body('email').isEmail(), handleValidationErrors, (req, res) => res.json({ ok: true }));
    const res = await request(app).post('/x').send({ email: 'ok@example.com' }).expect(200);
    expect(res.body.ok).toBe(true);
  });
});

describe('validateBody / validateQuery / validateParams', () => {
  it('terminent par handleValidationErrors', () => {
    const {
      validateBody,
      validateQuery,
      validateParams,
      handleValidationErrors,
      validateEmail,
      validateObjectId,
    } = validation;
    expect(validateBody(validateEmail()).slice(-1)[0]).toBe(handleValidationErrors);
    expect(validateQuery(query('q').optional()).slice(-1)[0]).toBe(handleValidationErrors);
    expect(validateParams(validateObjectId('segmentId')).slice(-1)[0]).toBe(handleValidationErrors);
  });
});

describe('validateMongoId', () => {
  it('retourne un tableau se terminant par handleValidationErrors', () => {
    const { validateMongoId, handleValidationErrors } = validation;
    const chain = validateMongoId('userId');
    expect(Array.isArray(chain)).toBe(true);
    expect(chain[chain.length - 1]).toBe(handleValidationErrors);
  });

  it('sans argument utilise le param id par défaut', () => {
    const { validateMongoId, handleValidationErrors } = validation;
    const chain = validateMongoId();
    expect(chain[chain.length - 1]).toBe(handleValidationErrors);
  });
});

describe('validateEmail et validateObjectId en chaîne', () => {
  it('validateEmail rejette un email invalide', async () => {
    const { validateBody, validateEmail } = validation;
    const app = express();
    app.use(express.json());
    app.post('/e', ...validateBody(validateEmail()), (req, res) => res.json({ ok: true }));
    const res = await request(app)
      .post('/e')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ email: 'not-an-email' }));
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Validation failed');
  });

  it('validateParams + validateObjectId() rejette un :id non Mongo', async () => {
    const { validateParams, validateObjectId } = validation;
    const app = express();
    app.get('/r/:id', ...validateParams(validateObjectId()), (req, res) => res.json({ ok: true }));
    await request(app).get('/r/not-valid-objectid').expect(400);
  });
});

describe('validatePassword(minLen)', () => {
  it('rejette si longueur < minLen', async () => {
    const { validateBody, validatePassword } = validation;
    const app = express();
    app.use(express.json());
    app.post('/p', ...validateBody(validatePassword(12)), (req, res) => res.json({ ok: true }));
    const short = 'p'.repeat(11);
    const ok = 'p'.repeat(12);
    expect(short.length).toBe(11);
    expect(ok.length).toBe(12);
    await request(app).post('/p').send({ password: short }).expect(400);
    await request(app).post('/p').send({ password: ok }).expect(200);
  });

  it('sans argument utilise minLen 8 par défaut', async () => {
    const { validateBody, validatePassword } = validation;
    const app = express();
    app.use(express.json());
    app.post('/p8', ...validateBody(validatePassword()), (req, res) => res.json({ ok: true }));
    await request(app).post('/p8').send({ password: '1234567' }).expect(400);
    await request(app).post('/p8').send({ password: '12345678' }).expect(200);
  });
});

describe('validateOptionalObjectId', () => {
  it('400 si champ présent mais pas un ObjectId', async () => {
    const { validateBody, validateOptionalObjectId } = validation;
    const app = express();
    app.use(express.json());
    app.post('/o', ...validateBody(validateOptionalObjectId('peerId')), (req, res) => res.json({ ok: true }));
    await request(app).post('/o').send({ peerId: 'not-an-object-id' }).expect(400);
    await request(app).post('/o').send({}).expect(200);
  });
});

describe('adminUserUpdateValidation — allowedModules', () => {
  it('accepte null ou objet, refuse un tableau', async () => {
    const { adminUserUpdateValidation } = validation;
    const app = express();
    app.use(express.json());
    app.put('/u', ...adminUserUpdateValidation, (req, res) => res.json({ ok: true }));
    await request(app).put('/u').send({ allowedModules: null }).expect(200);
    await request(app).put('/u').send({ allowedModules: { a: 1 } }).expect(200);
    await request(app).put('/u').send({ allowedModules: [] }).expect(400);
  });
});
