'use strict';

const mongoSanitizeExpress5 = require('../../../src/middleware/mongoSanitizeExpress5');

describe('mongoSanitizeExpress5', () => {
  it('nettoie req.query sans réassigner (getter uniquement, style Express 5)', (done) => {
    const query = { $where: '1' };
    const req = {
      body: {},
      params: {},
      headers: { host: 'localhost' },
    };
    Object.defineProperty(req, 'query', {
      get() {
        return query;
      },
      enumerable: true,
      configurable: true,
    });

    const mw = mongoSanitizeExpress5({ replaceWith: '_' });
    mw(req, {}, (err) => {
      expect(err).toBeUndefined();
      expect(query._where).toBe('1');
      expect(Object.prototype.hasOwnProperty.call(query, '$where')).toBe(false);
      done();
    });
  });

  it('appelle onSanitize pour la query quand des clés sont interdites', (done) => {
    const query = { $gt: '' };
    const req = {};
    Object.defineProperty(req, 'query', {
      get() {
        return query;
      },
      enumerable: true,
      configurable: true,
    });

    const onSanitize = jest.fn();
    const mw = mongoSanitizeExpress5({ replaceWith: '_', onSanitize });
    mw(req, {}, () => {
      expect(onSanitize).toHaveBeenCalledWith(expect.objectContaining({ req, key: 'query' }));
      done();
    });
  });
});
