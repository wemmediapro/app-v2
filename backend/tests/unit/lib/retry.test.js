const logger = require('../../../src/lib/logger');
const {
  RetryStrategy,
  CircuitBreaker,
  CircuitOpenError,
  isClientError,
  defaultShouldRetry,
} = require('../../../src/lib/retry');

describe('retry.js', () => {
  describe('isClientError / defaultShouldRetry', () => {
    it('détecte 4xx via statusCode', () => {
      expect(isClientError({ statusCode: 404 })).toBe(true);
      expect(isClientError({ statusCode: 500 })).toBe(false);
    });

    it('defaultShouldRetry refuse 4xx et ValidationError', () => {
      expect(defaultShouldRetry({ statusCode: 429 }, 0)).toBe(false);
      expect(defaultShouldRetry({ name: 'ValidationError' }, 0)).toBe(false);
      expect(defaultShouldRetry(new Error('timeout'), 0)).toBe(true);
    });
  });

  describe('RetryStrategy', () => {
    beforeEach(() => {
      jest.spyOn(logger, 'warn').mockImplementation(() => {});
    });
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('retourne au premier succès', async () => {
      const rs = new RetryStrategy({ maxRetries: 3 });
      let n = 0;
      const out = await rs.executeWithRetry(async () => {
        n++;
        return 'ok';
      });
      expect(out).toBe('ok');
      expect(n).toBe(1);
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('réessaie puis réussit (backoff avec timers factices)', async () => {
      jest.useFakeTimers();
      const rs = new RetryStrategy({ maxRetries: 3, baseDelayMs: 100, jitterRatio: 0 });
      let calls = 0;
      const p = rs.executeWithRetry(async () => {
        calls++;
        if (calls < 2) {
          throw new Error('transient');
        }
        return 'done';
      }, 'op');

      await jest.advanceTimersByTimeAsync(0);
      await Promise.resolve();
      await jest.advanceTimersByTimeAsync(150);
      const result = await p;
      expect(result).toBe('done');
      expect(calls).toBe(2);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'retry_backoff', context: 'op', attempt: 1, maxRetries: 3 })
      );
      jest.useRealTimers();
    });

    it('ne retente pas sur 4xx', async () => {
      const rs = new RetryStrategy({ maxRetries: 5 });
      let calls = 0;
      const err = Object.assign(new Error('bad'), { statusCode: 400 });
      await expect(
        rs.executeWithRetry(async () => {
          calls++;
          throw err;
        })
      ).rejects.toThrow('bad');
      expect(calls).toBe(1);
    });

    it('épuise maxRetries puis propage la dernière erreur', async () => {
      jest.useFakeTimers();
      const rs = new RetryStrategy({ maxRetries: 2, baseDelayMs: 10, jitterRatio: 0 });
      let calls = 0;
      const p = rs.executeWithRetry(async () => {
        calls++;
        throw new Error(`fail-${calls}`);
      });
      const assertion = expect(p).rejects.toThrow('fail-2');
      await jest.advanceTimersByTimeAsync(500);
      await assertion;
      expect(calls).toBe(2);
      jest.useRealTimers();
    });
  });

  describe('CircuitBreaker', () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    it('refuse un constructeur sans fonction', () => {
      expect(() => new CircuitBreaker(null)).toThrow(TypeError);
    });

    it('CLOSED -> OPEN après failureThreshold puis CircuitOpenError', async () => {
      jest.useFakeTimers();
      let calls = 0;
      const breaker = new CircuitBreaker(
        async () => {
          calls++;
          throw new Error('down');
        },
        { failureThreshold: 3, successThreshold: 2, resetTimeoutMs: 1000 }
      );

      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute()).rejects.toThrow('down');
      }
      expect(breaker.getState()).toBe('OPEN');
      expect(calls).toBe(3);

      await expect(breaker.execute()).rejects.toBeInstanceOf(CircuitOpenError);
      expect(calls).toBe(3);

      await jest.advanceTimersByTimeAsync(1000);
      expect(breaker.getState()).toBe('HALF_OPEN');

      breaker.dispose();
    });

    it('HALF_OPEN: succès successThreshold fois -> CLOSED', async () => {
      jest.useFakeTimers();
      let fail = true;
      const breaker = new CircuitBreaker(
        async () => {
          if (fail) {
            throw new Error('x');
          }
          return 1;
        },
        { failureThreshold: 2, successThreshold: 2, resetTimeoutMs: 100 }
      );

      await expect(breaker.execute()).rejects.toThrow('x');
      await expect(breaker.execute()).rejects.toThrow('x');
      expect(breaker.getState()).toBe('OPEN');

      await jest.advanceTimersByTimeAsync(100);
      expect(breaker.getState()).toBe('HALF_OPEN');

      fail = false;
      await breaker.execute();
      await breaker.execute();
      expect(breaker.getState()).toBe('CLOSED');

      breaker.dispose();
    });

    it('HALF_OPEN: une erreur -> OPEN à nouveau', async () => {
      jest.useFakeTimers();
      const breaker = new CircuitBreaker(
        async () => {
          throw new Error('always');
        },
        { failureThreshold: 1, successThreshold: 1, resetTimeoutMs: 50 }
      );

      await expect(breaker.execute()).rejects.toThrow('always');
      expect(breaker.getState()).toBe('OPEN');

      await jest.advanceTimersByTimeAsync(50);
      expect(breaker.getState()).toBe('HALF_OPEN');

      await expect(breaker.execute()).rejects.toThrow('always');
      expect(breaker.getState()).toBe('OPEN');

      breaker.dispose();
    });

    it('resetTimeoutMs 0 passe tout de suite en HALF_OPEN après OPEN', async () => {
      const breaker = new CircuitBreaker(
        async () => {
          throw new Error('e');
        },
        { failureThreshold: 1, successThreshold: 1, resetTimeoutMs: 0 }
      );

      await expect(breaker.execute()).rejects.toThrow('e');
      expect(breaker.getState()).toBe('HALF_OPEN');
      breaker.dispose();
    });
  });
});
