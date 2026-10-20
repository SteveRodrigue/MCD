import { defineConfig } from 'vitest/config';
import path from 'path';

const alias = {
  '@engine': path.resolve(__dirname, './src/engine'),
  '@data': path.resolve(__dirname, './src/data'),
  '@ui': path.resolve(__dirname, './src/ui'),
  '@assets': path.resolve(__dirname, './src/assets'),
};

export default defineConfig({
  test: {
    // Files no test imports still count, at 0 %, instead of disappearing from the report
    coverage: {
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.d.ts'],
      thresholds: {
        'src/engine/**': {
          statements: 85,
          branches: 71,
          functions: 89,
          lines: 87,
        },
        'src/ui/**': {
          statements: 74,
          branches: 67,
          functions: 66,
          lines: 76,
        },
      },
    },
    projects: [
      {
        // Engine, data, tools, and non-JSX UI tests — pure Node environment
        test: {
          name: 'engine',
          globals: true,
          environment: 'node',
          setupFiles: ['tests/setup/boot-kernel.ts', 'tests/setup/freeze-card-catalog.ts'],
          include: [
            'tests/engine/**/*.test.ts',
            'tests/cards/**/*.test.ts',
            'tests/data/**/*.test.ts',
            'tests/tools/**/*.test.ts',
            'tests/ui/**/*.test.ts',
            'tests/smoke.test.ts',
          ],
        },
        resolve: { alias },
      },
      {
        // JSX UI component tests — browser-like DOM via happy-dom
        test: {
          name: 'ui',
          globals: true,
          environment: 'happy-dom',
          // A non-resolving origin, so UI tests never reach the dev server on port 3000 (#324)
          environmentOptions: { happyDOM: { url: 'http://mcd-ui-tests.invalid' } },
          setupFiles: [
            'tests/ui/setup/offline-dev-api.ts',
            'tests/setup/boot-kernel.ts',
            'tests/setup/freeze-card-catalog.ts',
          ],
          include: ['tests/ui/**/*.test.tsx'],
        },
        resolve: { alias },
      },
    ],
  },
});
