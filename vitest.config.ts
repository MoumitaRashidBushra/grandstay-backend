import { defineConfig } from 'vitest/config';

// Coverage targets from NFR-OPS-03 (enforced by `npm run test:cov` in CI).
// Branches are not gated: decorators compile to synthetic branches that tests cannot reach.
const critical = { lines: 80, statements: 80, functions: 80 };

export default defineConfig({
  // Resolves the path aliases declared in tsconfig.json, including the ones
  // added by `nest g library`. Requires Vite 8, which ships this option.
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/main.ts',
        'src/**/*.module.ts',
        'src/**/*.spec.ts',
        'src/**/*.dto.ts',
      ],
      reporter: ['text-summary', 'text', 'lcov'],
      thresholds: {
        // ≥ 60% overall
        lines: 60,
        statements: 60,
        functions: 60,
        // ≥ 80% on availability, booking and booking state-machine services
        'src/**/availability*.service.ts': critical,
        'src/**/booking*.service.ts': critical,
        'src/**/*state-machine*.ts': critical,
      },
    },
  },
});
