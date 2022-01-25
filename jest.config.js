module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  projects: ['<rootDir>/packages/*/jest.config.js'],
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.base.json',
    },
  },
};
