const { body, query, param, validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

// --- Validators réutilisables (express-validator) ---
const validateEmail = () => body('email').isEmail().withMessage('Invalid email').normalizeEmail();
const validatePassword = (minLen = 8) =>
  body('password').isLength({ min: minLen }).withMessage(`Password must be at least ${minLen} characters`);
const validateObjectId = (paramName = 'id') =>
  param(paramName).isMongoId().withMessage('Invalid ID');
const validateOptionalObjectId = (fieldName) =>
  body(fieldName).optional().isMongoId().withMessage(`Invalid ${fieldName}`);

/** Middleware : valider le body avec les chaînes de validation passées */
function validateBody(...validators) {
  return [...validators, handleValidationErrors];
}
/** Middleware : valider la query (ex. page, limit) */
function validateQuery(...validators) {
  return [...validators, handleValidationErrors];
}
/** Middleware : valider les paramètres (ex. :id) */
function validateParams(...validators) {
  return [...validators, handleValidationErrors];
}

/** Exige au moins 8 caractères, une majuscule, une minuscule, un chiffre et un symbole (pour admin) */
const strongPassword = (value) => {
  if (!value || typeof value !== 'string') return false;
  if (value.length < 8) return false;
  if (!/[A-Z]/.test(value)) return false;
  if (!/[a-z]/.test(value)) return false;
  if (!/[0-9]/.test(value)) return false;
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(value)) return false;
  return true;
};

const registerValidation = [
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('First name is required')
    .isLength({ max: 50 })
    .withMessage('First name cannot exceed 50 characters'),
  
  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Last name is required')
    .isLength({ max: 50 })
    .withMessage('Last name cannot exceed 50 characters'),
  
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .custom((value, { req }) => {
      if (req.body.role === 'admin' && !strongPassword(value)) {
        throw new Error('Admin password must contain uppercase, lowercase, number and symbol');
      }
      return true;
    }),
  
  body('phone')
    .optional()
    .matches(/^[+]?[\d\s\-\(\)]+$/)
    .withMessage('Please provide a valid phone number'),
  
  handleValidationErrors
];

const loginValidation = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  
  handleValidationErrors
];

/** [Q1] Validation PUT /api/auth/profile — champs optionnels, formats contrôlés */
const profileValidation = [
  body('firstName')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('First name cannot exceed 50 characters'),
  body('lastName')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Last name cannot exceed 50 characters'),
  body('phone')
    .optional()
    .matches(/^[+]?[\d\s\-\(\)]+$/)
    .withMessage('Please provide a valid phone number'),
  body('cabinNumber')
    .optional()
    .trim()
    .isLength({ max: 30 })
    .withMessage('Cabin number cannot exceed 30 characters'),
  body('country')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Country cannot exceed 100 characters'),
  body('dateOfBirth')
    .optional()
    .isISO8601()
    .withMessage('Invalid date of birth (ISO 8601 expected)'),
  body('preferences')
    .optional()
    .isObject()
    .withMessage('Preferences must be an object'),
  handleValidationErrors
];

const feedbackValidation = [
  body('type')
    .isIn(['complaint', 'suggestion', 'compliment', 'technical'])
    .withMessage('Invalid feedback type'),
  
  body('category')
    .isIn(['restaurant', 'entertainment', 'service', 'technical', 'other'])
    .withMessage('Invalid category'),
  
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ max: 100 })
    .withMessage('Title cannot exceed 100 characters'),
  
  body('description')
    .trim()
    .notEmpty()
    .withMessage('Description is required')
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters'),
  
  handleValidationErrors
];

const validatePagination = (req, res, next) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);

  if (page < 1) {
    return res.status(400).json({ message: 'Page must be greater than 0' });
  }

  req.query.page = page;
  req.query.limit = limit;
  next();
};

/** Validation des IDs MongoDB (à utiliser sur les routes :id) */
const validateMongoId = (paramName = 'id') => [
  param(paramName).isMongoId().withMessage('Invalid ID'),
  handleValidationErrors,
];

const articleValidation = [
  body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 300 }),
  body('excerpt').optional().trim().isLength({ max: 1000 }),
  body('content').optional().trim().isLength({ max: 100000 }),
  body('category').optional().trim().isLength({ max: 50 }),
  body('status').optional().isIn(['draft', 'published']),
  handleValidationErrors,
];

const bannerValidation = [
  body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 150 }),
  body('description').optional().trim().isLength({ max: 1000 }),
  body('position').optional().trim().isLength({ max: 50 }),
  body('link').optional().trim().isLength({ max: 2000 }),
  handleValidationErrors,
];

const productCreateValidation = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 200 }),
  body('description').trim().notEmpty().withMessage('Description is required').isLength({ max: 5000 }),
  body('category').notEmpty().withMessage('Category is required').isLength({ max: 100 }),
  handleValidationErrors,
];

const productUpdateValidation = [
  body('name').optional().trim().isLength({ max: 200 }),
  body('description').optional().trim().isLength({ max: 5000 }),
  body('category').optional().isLength({ max: 100 }),
  handleValidationErrors,
];

/** PUT /api/admin/users/:id — mise à jour partielle, tous les champs optionnels */
const adminUserUpdateValidation = [
  body('firstName').optional({ values: 'falsy' }).trim().notEmpty().isLength({ max: 50 }),
  body('lastName').optional({ values: 'falsy' }).trim().notEmpty().isLength({ max: 50 }),
  body('email').optional().isEmail().normalizeEmail(),
  body('phone')
    .optional({ values: 'falsy' })
    .matches(/^[+]?[\d\s\-\(\)]+$/)
    .withMessage('phone invalide'),
  body('cabinNumber').optional().trim().isLength({ max: 30 }),
  body('password').optional().isLength({ min: 8, max: 256 }),
  body('role').optional().isIn(['passenger', 'crew', 'admin']),
  body('isActive').optional().isBoolean(),
  body('allowedModules').optional().custom((v) => v === null || (typeof v === 'object' && !Array.isArray(v))),
  handleValidationErrors,
];

/** PUT /api/admin/settings/access — objets de droits par rôle */
const settingsAccessValidation = [
  body('admin').optional().isObject(),
  body('crew').optional().isObject(),
  body('passenger').optional().isObject(),
  handleValidationErrors,
];

/** DELETE /api/admin/users/:id — query ?hard= */
const adminDeleteUserQueryValidation = [
  query('hard').optional().isIn(['true', 'false', '1', '0']),
  handleValidationErrors,
];

module.exports = {
  registerValidation,
  loginValidation,
  profileValidation,
  feedbackValidation,
  handleValidationErrors,
  validatePagination,
  validateMongoId,
  validateBody,
  validateQuery,
  validateParams,
  validateEmail,
  validatePassword,
  validateObjectId,
  validateOptionalObjectId,
  strongPassword,
  articleValidation,
  bannerValidation,
  productCreateValidation,
  productUpdateValidation,
  adminUserUpdateValidation,
  settingsAccessValidation,
  adminDeleteUserQueryValidation,
};



