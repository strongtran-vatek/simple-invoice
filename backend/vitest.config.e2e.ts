import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // Starts a PostgreSQL container for the run; needs Docker.
    globalSetup: ['./test/support/global-setup.ts'],
    hookTimeout: 120_000,
    testTimeout: 30_000,
  },
});
