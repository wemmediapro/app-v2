/**
 * Résilience erreurs transitoires (réseau Mongo, pool). Le middleware Express 4-args reste dans middleware/errorHandler.js.
 */

/**
 * @param {unknown} err
 * @returns {boolean}
 */
function isTransientError(err) {
  if (!err || typeof err !== 'object') {
    return false;
  }
  const code = /** @type {{ code?: string, name?: string, message?: string }} */ (err).code;
  const name = /** @type {{ name?: string }} */ (err).name;
  const message = String(/** @type {{ message?: string }} */ (err).message || '');
  return (
    code === 'PoolClearedOnNetworkError' ||
    code === 'ECONNRESET' ||
    name === 'MongoNetworkError' ||
    name === 'MongoServerSelectionError' ||
    message.includes('ECONNRESET') ||
    message.includes('socket') ||
    message.includes('timed out')
  );
}

/**
 * @template T
 * @param {() => Promise<T>} fn
 * @param {{ attempts?: number, baseDelayMs?: number, maxDelayMs?: number }} [opts]
 * @returns {Promise<T>}
 */
async function withRetry(fn, opts = {}) {
  const attempts = Math.max(1, opts.attempts ?? 3);
  const baseDelayMs = opts.baseDelayMs ?? 50;
  const maxDelayMs = opts.maxDelayMs ?? 2000;
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isTransientError(err) || i === attempts - 1) {
        throw err;
      }
      const delay = Math.min(maxDelayMs, baseDelayMs * 2 ** i);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

module.exports = {
  isTransientError,
  withRetry,
};
