import { defineConfig } from 'vitest/config';

// API (e2e) suite: Vitest + Supertest against a real PostgreSQL test database.
// Run with `npm run test:e2e` (start the database first: `npm run test:db:up`).
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    setupFiles: ['./test/setup/load-env.ts'],
    globalSetup: ['./test/setup/global-setup.ts'],
    // All suites share one database, so run the files one at a time.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
