const logger = require('../../../src/lib/logger');
const { logRouteError } = require('../../../src/lib/route-logger');

describe('logRouteError', () => {
  it('utilise logger racine sans req.log', () => {
    const spy = jest.spyOn(logger, 'error').mockImplementation(() => {});
    logRouteError(null, 'test_event', new Error('boom'));
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'test_event', err: 'boom', stack: expect.any(String) })
    );
    spy.mockRestore();
  });

  it('utilise req.log.error si défini', () => {
    const error = jest.fn();
    logRouteError({ log: { error } }, 'x', new Error('e'));
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ event: 'x', err: 'e' }));
  });

  it('fusionne extra sans écraser err (message)', () => {
    const spy = jest.spyOn(logger, 'error').mockImplementation(() => {});
    logRouteError(null, 'ev', new Error('msg'), { hasAdminEmail: false });
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'ev', err: 'msg', hasAdminEmail: false, stack: expect.any(String) })
    );
    spy.mockRestore();
  });
});
