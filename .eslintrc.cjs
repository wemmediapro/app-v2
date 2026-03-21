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
  plugins: ['react', 'react-hooks', 'jsx-a11y'],
  rules: {
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    // Legacy React : beaucoup de handlers / catch vides — warnings pour ne pas bloquer le lint global
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
    'no-empty': ['warn', { allowEmptyCatch: true }],
    'no-var': 'error',
    'prefer-const': 'error',
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'warn',
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    // react-hooks v7 : règles « compiler » / strictes — legacy React 18 sans compiler
    'react-hooks/set-state-in-effect': 'off',
    'react-hooks/refs': 'off',
    'react-hooks/preserve-manual-memoization': 'off',
    'no-constant-binary-expression': 'warn',
    'jsx-a11y/media-has-caption': 'warn',
    'jsx-a11y/no-redundant-roles': 'warn',
    'jsx-a11y/click-events-have-key-events': 'warn',
    'jsx-a11y/no-noninteractive-element-interactions': 'warn',
    'quotes': ['error', 'single', { avoidEscape: true }],
    'semi': ['error', 'always'],
    'indent': ['error', 2, { SwitchCase: 1 }],
    'max-len': ['warn', { code: 120, ignoreUrls: true, ignoreStrings: true, ignoreTemplateLiterals: true }],
    'object-curly-spacing': ['error', 'always'],
    'array-bracket-spacing': ['error', 'never'],
    'comma-dangle': ['error', 'always-multiline'],
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
  ],
};
