module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
    jest: true,
  },
  extends: ['eslint:recommended', 'plugin:jsdoc/recommended', 'prettier'],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'script',
  },
  plugins: ['jsdoc'],
  rules: {
    'no-console': 'off',
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
    'no-var': 'error',
    'prefer-const': 'error',
    'prefer-arrow-callback': 'error',
    'max-len': 'off',
    curly: ['error', 'all'],
    'jsdoc/require-jsdoc': 'off',
    'jsdoc/require-param': 'off',
    'jsdoc/require-returns': 'off',
    'jsdoc/require-param-description': 'off',
    'jsdoc/require-returns-description': 'off',
    'jsdoc/check-tag-names': [
      'warn',
      {
        definedTags: ['swagger'],
      },
    ],
    eqeqeq: ['error', 'always', { null: 'ignore' }],
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-return-await': 'off',
    'no-useless-escape': 'off',
    'no-empty': ['warn', { allowEmptyCatch: true }],
    // Handlers Express souvent async sans await
    'require-await': 'off',
    'no-throw-literal': 'error',
  },
  ignorePatterns: ['node_modules/', 'coverage/', 'dist/', '*.min.js'],
  overrides: [
    {
      files: ['src/**/*.js', 'server.js'],
      rules: {
        // Logs via Pino (logger / logRouteError) — scripts/ et tests exclus
        'no-console': 'error',
      },
    },
    {
      files: ['src/utils/**/*.js', 'src/middleware/**/*.js', 'src/lib/**/*.js'],
      rules: {
        'jsdoc/require-jsdoc': [
          'warn',
          {
            publicOnly: false,
            require: {
              FunctionDeclaration: true,
              ClassDeclaration: true,
            },
          },
        ],
      },
    },
  ],
};
