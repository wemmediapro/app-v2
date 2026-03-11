const { body, validationResult } = require('express-validator');

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
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  
  if (page < 1) {
    return res.status(400).json({ message: 'Page must be greater than 0' });
  }
  
  if (limit < 1 || limit > 100) {
    return res.status(400).json({ message: 'Limit must be between 1 and 100' });
  }
  
  req.query.page = page;
  req.query.limit = limit;
  next();
};

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

module.exports = {
  registerValidation,
  loginValidation,
  feedbackValidation,
  handleValidationErrors,
  validatePagination,
  strongPassword,
  articleValidation,
  bannerValidation,
  productCreateValidation,
  productUpdateValidation,
};



