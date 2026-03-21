/**
 * Gestionnaire d'erreurs global — corrélation requestId + req.log.
 */
const { AppError, globalErrorHandler } = require('../../../src/utils/errors');
const logger = require('../../../src/lib/logger');

describe('globalErrorHandler', () => {
  const origEnv = process.env.NODE_ENV;

  beforeEach(() => {
    jest.spyOn(logger, 'warn').mockImplementation(() => {});
    jest.spyOn(logger, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.NODE_ENV = origEnv;
    jest.restoreAllMocks();
  });

  it('répond AppError avec requestId quand req.id est défini', () => {
    process.env.NODE_ENV = 'production';
    const handler = globalErrorHandler({ env: 'production' });
    const req = { id: 'deadbeef01', path: '/api/x', method: 'GET' };
    const res = { headersSent: false, status: jest.fn().mockReturnThis(), json: jest.fn() };
    handler(new AppError('Refusé', 403, 'FORBIDDEN'), req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'Refusé',
        code: 'FORBIDDEN',
        requestId: 'deadbeef01',
      })
    );
  });

  it('500 inclut requestId en production (message générique)', () => {
    process.env.NODE_ENV = 'production';
    const handler = globalErrorHandler({ env: 'production' });
    const req = { id: 'reqid-99', path: '/api/y', method: 'POST', body: {} };
    const res = { headersSent: false, status: jest.fn().mockReturnThis(), json: jest.fn() };
    handler(new Error('secret db leak'), req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Internal server error',
        code: 'INTERNAL_ERROR',
        requestId: 'reqid-99',
      })
    );
    expect(res.json.mock.calls[0][0].stack).toBeUndefined();
  });

  it('utilise req.log.warn pour AppError si présent', () => {
    const handler = globalErrorHandler({ env: 'development' });
    const warn = jest.fn();
    const req = {
      id: 'x1',
      path: '/z',
      method: 'GET',
      log: { warn, error: jest.fn() },
    };
    const res = { headersSent: false, status: jest.fn().mockReturnThis(), json: jest.fn() };
    handler(new AppError('bad', 400, 'BAD'), req, res, jest.fn());

    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'app_error', code: 'BAD', message: 'bad' })
    );
  });
});
