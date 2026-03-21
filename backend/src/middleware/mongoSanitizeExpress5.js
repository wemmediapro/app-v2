'use strict';

const { sanitize, has } = require('express-mongo-sanitize');

/**
 * Même comportement qu'express-mongo-sanitize, mais sans réassigner req.query.
 * Express 5 expose req.query en lecture seule (getter) ; l’assignation lève une TypeError.
 * sanitize() modifie l’objet query en place, ce qui suffit.
 */
function mongoSanitizeExpress5(options = {}) {
  const hasOnSanitize = typeof options.onSanitize === 'function';
  const allowDots = Boolean(options.allowDots);

  return function mongoSanitizeMiddleware(req, _res, next) {
    ['body', 'params', 'headers'].forEach((key) => {
      if (!req[key]) {
        return;
      }
      const { isSanitized } = sanitizeInPlace(req[key], options, allowDots);
      if (isSanitized && hasOnSanitize) {
        options.onSanitize({ req, key });
      }
    });

    if (req.query && typeof req.query === 'object') {
      const { isSanitized } = sanitizeInPlace(req.query, options, allowDots);
      if (isSanitized && hasOnSanitize) {
        options.onSanitize({ req, key: 'query' });
      }
    }

    next();
  };
}

/**
 *
 */
function sanitizeInPlace(target, options, allowDots) {
  const hadBefore = has(target, allowDots);
  sanitize(target, options);
  return { isSanitized: hadBefore };
}

module.exports = mongoSanitizeExpress5;
