const { body, param, query, validationResult } = require('express-validator');

// Handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: errors.array().map(error => ({
        field: error.path,
        message: error.msg,
        value: error.value
      }))
    });
  }
  next();
};

// User validation rules
const validateUserRegistration = [
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('First name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),
  
  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Last name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),
  
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  
  body('phone')
    .optional()
    .matches(/^\+?[\d\s-()]+$/)
    .withMessage('Please provide a valid phone number'),
  
  body('country')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Country name cannot exceed 50 characters'),
  
  body('dateOfBirth')
    .optional()
    .isISO8601()
    .withMessage('Please provide a valid date of birth'),
  
  body('cabinNumber')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('Cabin number cannot exceed 20 characters'),
  
  handleValidationErrors
];

const validateUserLogin = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  
  handleValidationErrors
];

// Movie validation rules
const validateMovie = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Movie title is required')
    .isLength({ max: 200 })
    .withMessage('Title cannot exceed 200 characters'),
  
  body('description')
    .trim()
    .notEmpty()
    .withMessage('Description is required')
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters'),
  
  body('genre')
    .isArray({ min: 1 })
    .withMessage('At least one genre is required'),
  
  body('genre.*')
    .isIn(['action', 'comedy', 'drama', 'horror', 'romance', 'thriller', 'sci-fi', 'fantasy', 'documentary', 'animation', 'other'])
    .withMessage('Invalid genre'),
  
  body('year')
    .isInt({ min: 1900, max: new Date().getFullYear() + 2 })
    .withMessage('Please provide a valid year'),
  
  body('duration')
    .isInt({ min: 1 })
    .withMessage('Duration must be at least 1 minute'),
  
  body('language')
    .isIn(['fr', 'en', 'it', 'es', 'de', 'other'])
    .withMessage('Invalid language'),
  
  body('streamUrl')
    .isURL()
    .withMessage('Please provide a valid stream URL'),
  
  body('posterUrl')
    .optional()
    .isURL()
    .withMessage('Please provide a valid poster URL'),
  
  handleValidationErrors
];

// Restaurant validation rules
const validateRestaurant = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Restaurant name is required')
    .isLength({ max: 100 })
    .withMessage('Restaurant name cannot exceed 100 characters'),
  
  body('type')
    .isIn(['restaurant', 'cafe', 'bar', 'snack', 'pizzeria', 'steakhouse', 'buffet', 'room-service'])
    .withMessage('Invalid restaurant type'),
  
  body('category')
    .isIn(['french', 'italian', 'international', 'fast-food', 'seafood', 'vegetarian', 'dessert', 'beverage'])
    .withMessage('Invalid category'),
  
  body('description')
    .trim()
    .notEmpty()
    .withMessage('Description is required')
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),
  
  body('priceRange')
    .isIn(['€', '€€', '€€€', '€€€€'])
    .withMessage('Invalid price range'),
  
  body('location.deck')
    .notEmpty()
    .withMessage('Deck location is required'),
  
  handleValidationErrors
];

// Radio station validation rules
const validateRadioStation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Station name is required')
    .isLength({ max: 100 })
    .withMessage('Station name cannot exceed 100 characters'),
  
  body('genre')
    .isIn(['pop', 'rock', 'jazz', 'classical', 'news', 'talk', 'sports', 'children', 'other'])
    .withMessage('Invalid genre'),
  
  body('streamUrl')
    .isURL()
    .withMessage('Please provide a valid stream URL'),
  
  body('language')
    .isIn(['fr', 'en', 'it', 'es'])
    .withMessage('Invalid language'),
  
  handleValidationErrors
];

// Common validation for IDs
const validateObjectId = (paramName) => [
  param(paramName)
    .isMongoId()
    .withMessage(`Invalid ${paramName} ID`),
  handleValidationErrors
];

// Pagination validation
const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  handleValidationErrors
];

module.exports = {
  handleValidationErrors,
  validateUserRegistration,
  validateUserLogin,
  validateMovie,
  validateRestaurant,
  validateRadioStation,
  validateObjectId,
  validatePagination
};



