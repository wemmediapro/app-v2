/**
 * Couverture du catch d’init dans errorHandler (require('../lib/sentry') qui lève).
 * Fichier dédié : le mock factory doit être évalué avant le premier chargement d’errorHandler.
 */
jest.mock('../../../src/lib/sentry', () => {
  throw new Error('sentry indisponible');
});

const routeLogger = require('../../../src/lib/route-logger');
const logSpy = jest.spyOn(routeLogger, 'logRouteError').mockImplementation(() => {});

const { errorHandler } = require('../../../src/middleware/errorHandler');

afterAll(() => {
  logSpy.mockRestore();
});

describe('errorHandler — module sentry absent', () => {
  it('répond 500 et journalise sans dépendre de Sentry', () => {
    process.env.NODE_ENV = 'production';
    logSpy.mockClear();
    const err = Object.assign(new Error('boom'), { status: 500 });
    const req = { method: 'GET', url: '/x' };
    const res = {
      statusCode: 200,
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    errorHandler(err, req, res, jest.fn());
    expect(logSpy).toHaveBeenCalledWith(req, 'express_legacy_error_handler', err);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Internal Server Error' })
    );
  });
});
