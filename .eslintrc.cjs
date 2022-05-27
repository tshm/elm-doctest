module.exports = {
  root: true,
  extends: ['eslint:recommended', 'prettier'],
  settings: {},
  rules: {
    'no-unused-vars': [2, { argsIgnorePattern: '^_' }],
  },
  ignorePatterns: ['elm.js'],
  parserOptions: {
    sourceType: 'module',
    ecmaVersion: 2019,
  },
  env: {
    browser: false,
    es2017: true,
    node: true,
  },
}
