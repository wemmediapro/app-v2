module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:jsx-a11y/recommended',
    'plugin:jsdoc/recommended',
    'prettier',
  ],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
  plugins: ['react', 'react-hooks', 'jsx-a11y', 'jsdoc'],
  rules: {
    // Console fréquente en debug PWA — garder warn/error côté prod via revue ou règle ciblée plus tard
    'no-console': 'off',
    // Legacy React : beaucoup de handlers / catch vides — warnings pour ne pas bloquer le lint global
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
    'no-empty': ['warn', { allowEmptyCatch: true }],
    'no-var': 'error',
    'prefer-const': 'error',
    'react/react-in-jsx-scope': 'off',
    // Pas de PropTypes dans le projet — la règle recommended inonde le rapport (~500+ warnings)
    'react/prop-types': 'off',
    'react-hooks/rules-of-hooks': 'error',
    // Legacy : dépendances de hooks incomplètes — à corriger au cas par cas si besoin
    'react-hooks/exhaustive-deps': 'off',
    // react-hooks v7 : règles « compiler » / strictes — legacy React 18 sans compiler
    'react-hooks/set-state-in-effect': 'off',
    'react-hooks/refs': 'off',
    'react-hooks/preserve-manual-memoization': 'off',
    'no-constant-binary-expression': 'off',
    'jsx-a11y/media-has-caption': 'off',
    'jsx-a11y/no-redundant-roles': 'off',
    'jsx-a11y/click-events-have-key-events': 'off',
    'jsx-a11y/no-noninteractive-element-interactions': 'off',
    'max-len': 'off',
    'jsdoc/require-jsdoc': 'off',
    'jsdoc/require-param': 'off',
    'jsdoc/require-returns': 'off',
    'jsdoc/require-param-description': 'off',
    'jsdoc/require-returns-description': 'off',
  },
  ignorePatterns: [
    'node_modules/',
    'dist/',
    'build/',
    'coverage/',
    'dashboard/',
    'tests/load/',
    '*.config.js',
    '*.config.cjs',
  ],
  overrides: [
    {
      files: ['tests/**/*.js'],
      rules: {
        // Playwright utilise `use` (fixtures) — pas les hooks React
        'react-hooks/rules-of-hooks': 'off',
      },
    },
    {
      files: ['src/utils/**/*.js', 'src/services/**/*.js'],
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
