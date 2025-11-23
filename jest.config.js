/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    testMatch: ['**/tests/**/*.test.ts'],
    verbose: true,
    collectCoverage: true,
    collectCoverageFrom: ['src/**/*.ts', '!src/core/types.ts', '!src/index.ts'],
};