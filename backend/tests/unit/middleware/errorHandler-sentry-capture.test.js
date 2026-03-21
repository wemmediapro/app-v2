/**
 * Sentry chargé mais sans captureException fonctionnel → branche typeof évitée.
 */
jest.doMock('../../../src/lib/sentry', () => ({ captureException: null }));

const { errorHandler } = require('../../../src/middleware/errorHandler');

describe('errorHandler — Sentry sans captureException', () => {
  it('répond 500 sans appeler captureException', () => {
    process.env.NODE_ENV = 'production';
    const err = Object.assign(new Error('x'), { status: 500 });
    const res = {
      statusCode: 200,
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    errorHandler(err, { method: 'GET', url: '/z' }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalled();
  });
});
