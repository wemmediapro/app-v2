/**
 * Nouvelles tentatives avec backoff exponentiel + jitter, et circuit breaker optionnel.
 * Évite le thundering herd (jitter) et les boucles infinies (plafond de délai, pas de retry sur 4xx).
 */

const logger = require('./logger');

/** Erreur levée quand le disjoncteur est ouvert (appels rapides « fail » sans charger la dépendance). */
class CircuitOpenError extends Error {
  constructor(message = 'Circuit breaker is OPEN') {
    super(message);
    this.name = 'CircuitOpenError';
    this.code = 'CIRCUIT_OPEN';
  }
}

/**
 * @param {unknown} error
 * @returns {boolean} true si l’erreur ressemble à une erreur client HTTP 4xx
 */
function isClientError(error) {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const status =
    /** @type {{ statusCode?: number, status?: number, response?: { status?: number } }} */ (error).statusCode ??
    /** @type {{ status?: number }} */ (error).status ??
    /** @type {{ response?: { status?: number } }} */ (error).response?.status;
  return typeof status === 'number' && status >= 400 && status < 500;
}

/**
 * @param {unknown} error
 * @param {number} _attemptIndex - 0-based (tentative en cours après échec)
 * @returns {boolean}
 */
function defaultShouldRetry(error, _attemptIndex) {
  if (isClientError(error)) {
    return false;
  }
  const name =
    error && typeof error === 'object' && 'name' in error ? String(/** @type {{ name?: string }} */ (error).name) : '';
  if (name === 'ValidationError' || name === 'CastError') {
    return false;
  }
  return true;
}

/** Backoff exponentiel + jitter entre tentatives. */
class RetryStrategy {
  /**
   * @param {object} [options]
   * @param {number} [options.maxRetries] - nombre total de tentatives (défaut 3)
   * @param {number} [options.baseDelayMs] - délai de base avant 1er backoff (défaut 100)
   * @param {number} [options.maxDelayMs] - plafond du délai entre deux tentatives (défaut 30_000)
   * @param {number} [options.jitterRatio] - portion aléatoire du délai (défaut 0.1 = 10 %)
   * @param {(error: unknown, attemptIndex: number) => boolean} [options.shouldRetry]
   */
  constructor(options = {}) {
    this.maxRetries = options.maxRetries ?? 3;
    this.baseDelayMs = options.baseDelayMs ?? 100;
    this.maxDelayMs = options.maxDelayMs ?? 30_000;
    this.jitterRatio = Math.min(1, Math.max(0, options.jitterRatio ?? 0.1));
    this.shouldRetry = options.shouldRetry ?? defaultShouldRetry;
  }

  /**
   * @template T
   * @param {() => Promise<T>} operation
   * @param {string} [context] - libellé pour les logs
   * @returns {Promise<T>}
   */
  async executeWithRetry(operation, context = '') {
    let lastError;
    const max = Math.max(1, this.maxRetries);

    for (let attempt = 0; attempt < max; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (!this.shouldRetry(error, attempt)) {
          throw error;
        }
        const hasAnotherAttempt = attempt < max - 1;
        if (!hasAnotherAttempt) {
          break;
        }

        const exp = Math.min(this.baseDelayMs * 2 ** attempt, this.maxDelayMs);
        const jitter = this.jitterRatio > 0 ? Math.random() * exp * this.jitterRatio : 0;
        const totalDelay = Math.round(exp + jitter);

        logger.warn({
          event: 'retry_backoff',
          context: context || undefined,
          attempt: attempt + 1,
          maxRetries: max,
          delayMs: totalDelay,
          err: error instanceof Error ? error.message : String(error),
        });

        await new Promise((resolve) => {
          setTimeout(resolve, totalDelay);
        });
      }
    }

    throw lastError;
  }
}

/** Limite les appels à une opération instable (CLOSED / OPEN / HALF_OPEN). */
class CircuitBreaker {
  /**
   * @param {(...args: unknown[]) => Promise<unknown>} operation
   * @param {object} [options]
   * @param {number} [options.failureThreshold]
   * @param {number} [options.successThreshold] - succès consécutifs en HALF_OPEN pour fermer
   * @param {number} [options.resetTimeoutMs] - après OPEN, délai avant HALF_OPEN (défaut 60_000)
   */
  constructor(operation, options = {}) {
    if (typeof operation !== 'function') {
      throw new TypeError('CircuitBreaker requires an async operation function');
    }
    this.operation = operation;
    this.failureThreshold = Math.max(1, options.failureThreshold ?? 5);
    this.successThreshold = Math.max(1, options.successThreshold ?? 2);
    this.resetTimeoutMs = Math.max(0, options.resetTimeoutMs ?? 60_000);

    /** @type {'CLOSED' | 'OPEN' | 'HALF_OPEN'} */
    this.state = 'CLOSED';
    this.failures = 0;
    this.successes = 0;
    /** @type {ReturnType<typeof setTimeout> | null} */
    this._resetTimer = null;
  }

  /** Annule le timer de réouverture en HALF_OPEN. */
  _clearResetTimer() {
    if (this._resetTimer != null) {
      clearTimeout(this._resetTimer);
      this._resetTimer = null;
    }
  }

  /** Planifie le passage OPEN → HALF_OPEN (ou immédiat si resetTimeoutMs = 0). */
  _scheduleHalfOpen() {
    this._clearResetTimer();
    if (this.resetTimeoutMs <= 0) {
      this.state = 'HALF_OPEN';
      this.failures = 0;
      this.successes = 0;
      return;
    }
    this._resetTimer = setTimeout(() => {
      this._resetTimer = null;
      if (this.state === 'OPEN') {
        this.state = 'HALF_OPEN';
        this.failures = 0;
        this.successes = 0;
      }
    }, this.resetTimeoutMs);
  }

  getState() {
    return this.state;
  }

  /**
   * @param {...unknown} args
   */
  async execute(...args) {
    if (this.state === 'OPEN') {
      throw new CircuitOpenError();
    }

    try {
      const result = await this.operation(...args);

      if (this.state === 'HALF_OPEN') {
        this.successes++;
        if (this.successes >= this.successThreshold) {
          this.state = 'CLOSED';
          this.failures = 0;
          this.successes = 0;
          this._clearResetTimer();
        }
      } else if (this.state === 'CLOSED') {
        this.failures = 0;
      }

      return result;
    } catch (error) {
      if (this.state === 'HALF_OPEN') {
        this.state = 'OPEN';
        this.failures = this.failureThreshold;
        this.successes = 0;
        this._scheduleHalfOpen();
      } else if (this.state === 'CLOSED') {
        this.failures++;
        if (this.failures >= this.failureThreshold) {
          this.state = 'OPEN';
          this._scheduleHalfOpen();
        }
      }
      throw error;
    }
  }

  /** Pour tests / arrêt propre : annule le timer de passage en HALF_OPEN. */
  dispose() {
    this._clearResetTimer();
  }
}

module.exports = {
  RetryStrategy,
  CircuitBreaker,
  CircuitOpenError,
  isClientError,
  defaultShouldRetry,
};
