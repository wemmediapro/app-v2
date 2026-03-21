const { isTransientError, withRetry } = require('../../../src/lib/errorHandler');

describe('lib/errorHandler (retry)', () => {
  test('isTransientError détecte erreurs réseau Mongo', () => {
    expect(isTransientError({ name: 'MongoNetworkError' })).toBe(true);
    expect(isTransientError({ code: 'ECONNRESET' })).toBe(true);
    expect(isTransientError(new Error('socket hang up'))).toBe(true);
    expect(isTransientError({ message: 'Validation failed' })).toBe(false);
    expect(isTransientError(null)).toBe(false);
  });

  test('withRetry réussit au premier essai', async () => {
    const fn = jest.fn().mockResolvedValue(42);
    await expect(withRetry(fn, { attempts: 3 })).resolves.toBe(42);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('withRetry retente sur erreur transitoire puis réussit', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('fail'), { name: 'MongoNetworkError' }))
      .mockResolvedValueOnce(7);
    await expect(withRetry(fn, { attempts: 3, baseDelayMs: 1, maxDelayMs: 5 })).resolves.toBe(7);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  test('withRetry propage après épuisement si toujours transitoire', async () => {
    const err = Object.assign(new Error('net'), { name: 'MongoNetworkError' });
    const fn = jest.fn().mockRejectedValue(err);
    await expect(withRetry(fn, { attempts: 2, baseDelayMs: 1, maxDelayMs: 5 })).rejects.toBe(err);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
