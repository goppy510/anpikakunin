import type { Config } from 'jest';
import nextJest from 'next/jest';

const createJestConfig = nextJest({
  // next.config.jsのパス
  dir: './',
});

const config: Config = {
  displayName: 'anpikakunin',
  testEnvironment: 'jest-environment-jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/__tests__/**/*.test.tsx',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.tsx',
    '!src/**/__tests__/**',
  ],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/.next/',
    '/coverage/',
  ],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: {
        jsx: 'react',
      },
    }],
  },
};

export default createJestConfig(config);
