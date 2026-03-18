/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js', '**/*.test.js'],
  collectCoverageFrom: ['src/**/*.js', '!src/**/__tests__/**'],
  coverageDirectory: 'coverage',
  // Seuils sur modules critiques (auth, radio, webtv, messages). Objectif à terme : 60% sur chacun.
  coverageThreshold: {
    'src/routes/auth.js': { branches: 22, functions: 55, lines: 45, statements: 43 },
    'src/routes/radio.js': { branches: 11, functions: 50, lines: 30, statements: 27 },
    'src/routes/webtv.js': { branches: 2, functions: 20, lines: 20, statements: 18 },
    'src/routes/messages.js': { branches: 0, functions: 0, lines: 20, statements: 19 },
    'src/middleware/auth.js': { branches: 50, functions: 62, lines: 55, statements: 55 },
  },
  verbose: true,
  testTimeout: 10000,
};
