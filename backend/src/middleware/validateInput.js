const mongoose = require('mongoose');
const { validationResult } = require('express-validator');

/**
 * Valide qu'un paramètre d'URL est un ObjectId MongoDB valide.
 * @param {string} [paramName='id'] - nom du param dans req.params
 */
const validateMongoId = (paramName = 'id') => {
  return (req, res, next) => {
    const id = req.params[paramName];
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: 'Invalid ID format',
        code: 'INVALID_ID',
      });
    }
    next();
  };
};

/**
 * Normalise page/limit depuis req.query et attache req.pagination.
 * @param {{ defaultLimit?: number }} [opts]
 */
const createValidatePagination = (opts = {}) => {
  const defaultLimit = opts.defaultLimit ?? 20;
  return (req, res, next) => {
    let { page = 1, limit = defaultLimit } = req.query;
    page = Math.max(1, Math.min(parseInt(page, 10) || 1, 10000));
    limit = Math.max(1, Math.min(parseInt(limit, 10) || defaultLimit, 100));
    req.pagination = { page, limit, skip: (page - 1) * limit };
    next();
  };
};

/** Pagination par défaut : limit 20 */
const validatePagination = createValidatePagination({ defaultLimit: 20 });

/**
 * Échappe les caractères regex spéciaux, trim, max 100 caractères (recherche sûre $regex).
 */
const sanitizeSearchString = (str) => {
  if (!str || typeof str !== 'string') {return '';}
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').trim().slice(0, 100);
};

/** À placer après des chaînes express-validator ; avec validateMongoId seul, résultat vide → next(). */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: errors.array(),
    });
  }
  next();
};

module.exports = {
  validateMongoId,
  validatePagination,
  createValidatePagination,
  sanitizeSearchString,
  handleValidationErrors,
};
