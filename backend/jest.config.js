/** @type {import('jest').Config} */
const criticalCoverageGlobs = [
  'src/routes/auth.js',
  'src/routes/users.js',
  'src/routes/restaurants.js',
  'src/routes/messages.js',
  'src/routes/sync.js',
  'src/middleware/auth.js',
  'src/middleware/validation.js',
  'src/middleware/errorHandler.js',
  'src/middleware/validateInput.js',
  'src/models/User.js',
  'src/models/Restaurant.js',
  'src/models/Message.js',
  'src/models/Feedback.js',
];

module.exports = {
  testEnvironment: 'node',
  // Évite les fuites de mocks / état Mongoose entre fichiers (exécution parallèle).
  maxWorkers: 1,
  // Timers / handles laissés par express-rate-limit ou intégrations — à investiguer avec --detectOpenHandles.
  forceExit: true,
  // Évite les spies (ex. Restaurant.findByIdAndUpdate) qui survivent mal à resetMocks entre tests.
  restoreMocks: true,
  roots: ['<rootDir>'],
  setupFiles: ['<rootDir>/tests/setup.js'],
  testMatch: [
    '<rootDir>/tests/unit/**/*.test.js',
    '<rootDir>/src/**/__tests__/**/*.test.js',
    '<rootDir>/src/**/*.test.js',
  ],
  testPathIgnorePatterns: ['/node_modules/'],
  collectCoverageFrom: criticalCoverageGlobs,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'text-summary', 'lcov', 'html'],
  /**
   * Seuils globaux sur collectCoverageFrom (le résumé text-summary peut différer légèrement).
   */
  coverageThreshold: {
    global: {
      branches: 87,
      functions: 100,
      lines: 99,
      statements: 99,
    },
    'src/middleware/errorHandler.js': {
      branches: 60,
      functions: 100,
      lines: 100,
      statements: 100,
    },
    'src/middleware/validateInput.js': {
      branches: 70,
      functions: 100,
      lines: 100,
      statements: 100,
    },
    'src/models/Feedback.js': {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
    'src/models/Message.js': {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
    'src/models/Restaurant.js': {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },
  verbose: true,
  testTimeout: 20000,
  clearMocks: true,
  resetMocks: true,
};
