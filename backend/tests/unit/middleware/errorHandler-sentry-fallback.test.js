/**
 * Fichier dédié : jest.doMock doit précéder le premier chargement du middleware.
 */
jest.doMock('../../../src/lib/sentry', () => {
  throw new Error('sentry unavailable');
});

const { errorHandler } = require('../../../src/middleware/errorHandler');

describe('errorHandler — Sentry absent', () => {
  it('répond 500 sans lever', () => {
    process.env.NODE_ENV = 'production';
    const err = Object.assign(new Error('x'), { status: 500 });
    const res = {
      statusCode: 200,
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    errorHandler(err, { method: 'GET', url: '/y' }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
