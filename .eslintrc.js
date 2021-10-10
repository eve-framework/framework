let OFF = 0;
let ERROR = 2;

module.exports = {
  rules: {
    '@typescript-eslint/explicit-function-return-type': OFF,
    '@typescript-eslint/explicit-module-boundary-types': OFF,
    '@typescript-eslint/camelcase': OFF,
    '@typescript-eslint/no-use-before-define': OFF,
    'import/order': ERROR,
    'import/first': ERROR,
    'import/no-default-export': ERROR,
    camelcase: ERROR,
    'no-param-reassign': ERROR,
    'prefer-arrow-functions/prefer-arrow-functions': ERROR,
    'prettier/prettier': ['error', { singleQuote: true }],
    'no-console': [ERROR, { allow: ['error'] }],
    '@typescript-eslint/no-unused-vars': [
      ERROR,
      { ignoreRestSiblings: true, argsIgnorePattern: '^_' },
    ],
    'arrow-body-style': ERROR,
    eqeqeq: 'error',
  },
  overrides: [
    {
      files: ['*.js'],
      parser: 'espree',
      rules: {
        '@typescript-eslint/no-var-requires': OFF,
        'no-undef': OFF,
      },
    },
  ],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  plugins: ['prettier', 'import', 'prefer-arrow-functions', '@typescript-eslint'],
  env: { node: true },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
    project: 'tsconfig.json',
  },
};
