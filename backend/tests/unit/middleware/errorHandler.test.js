const { errorHandler } = require('../../../src/middleware/errorHandler');

describe('errorHandler middleware', () => {
  const origEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = origEnv;
  });

  it('répond 400 avec message client pour err.status', () => {
    process.env.NODE_ENV = 'production';
    const err = Object.assign(new Error('Bad'), { status: 400 });
    const req = { method: 'GET', url: '/x' };
    const res = {
      statusCode: 200,
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    errorHandler(err, req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Bad' }));
  });

  it('masque le détail en production pour 500', () => {
    process.env.NODE_ENV = 'production';
    const err = Object.assign(new Error('DB exploded'), { status: 500 });
    const req = { method: 'POST', url: '/api/x' };
    const res = {
      statusCode: 200,
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    errorHandler(err, req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Internal Server Error' }));
    expect(res.json.mock.calls[0][0].error).toBeUndefined();
  });

  it('expose error en développement pour 500', () => {
    process.env.NODE_ENV = 'development';
    const err = Object.assign(new Error('DB exploded'), { status: 500 });
    const req = { method: 'POST', url: '/api/x' };
    const res = {
      statusCode: 200,
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    errorHandler(err, req, res, jest.fn());
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Internal Server Error', error: 'DB exploded' })
    );
  });

  it('utilise err.statusCode si err.status absent', () => {
    process.env.NODE_ENV = 'production';
    const err = Object.assign(new Error('Teapot'), { statusCode: 418 });
    const res = {
      statusCode: 200,
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    errorHandler(err, { method: 'GET', url: '/x' }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(418);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Teapot' }));
  });

  it('utilise res.statusCode si err sans status ni statusCode', () => {
    process.env.NODE_ENV = 'production';
    const err = new Error('Handled');
    const res = {
      statusCode: 409,
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    errorHandler(err, { method: 'GET', url: '/x' }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Handled' }));
  });

  it('message par défaut si err sans message', () => {
    process.env.NODE_ENV = 'production';
    const err = { status: 503 };
    const res = {
      statusCode: 200,
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    errorHandler(err, { method: 'GET', url: '/x' }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Internal Server Error' })
    );
  });

  it('statut 500 par défaut si ni err ni res ne définissent de code', () => {
    process.env.NODE_ENV = 'production';
    const err = { message: 'Sans code' };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    errorHandler(err, { method: 'GET', url: '/x' }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Internal Server Error' })
    );
  });
});
