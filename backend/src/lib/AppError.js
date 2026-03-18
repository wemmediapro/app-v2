/**
 * Erreur applicative standardisée (sévérité, code métier, pas de fuite de stack en prod).
 * Utilisation : next(new AppError('Message', 400, 'INVALID_ID'))
 */
class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace?.(this, this.constructor);
  }
}

module.exports = { AppError };
