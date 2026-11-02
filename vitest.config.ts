import { defineConfig } from 'vitest/config';
import path from 'path';
import { buildDefines } from './src/tools/build-define.ts';
import { ShardSequencer } from './tools/test-shards.ts';

const alias = {
  '@engine': path.resolve(import.meta.dirname, './src/engine'),
  '@data': path.resolve(import.meta.dirname, './src/data'),
  '@ui': path.resolve(import.meta.dirname, './src/ui'),
  '@assets': path.resolve(import.meta.dirname, './src/assets'),
};

const define = buildDefines(import.meta.dirname, false);

// Loads content once per run; each test file applies it through tests/setup/load-content.ts
const globalSetup = ['tests/setup/global-content.ts'];

// A shard covers part of the suite, so thresholds are checked only on the merged reports (CI test-merge)
const sharded = process.argv.some((arg) => arg.startsWith('--shard'));

export default defineConfig({
  test: {
    // --shard splits by recorded run time (tests/shard-timings.json, `npm run test:timings`)
    sequence: { sequencer: ShardSequencer },
    // Files no test imports still count, at 0 %, instead of disappearing from the report
    coverage: {
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.d.ts'],
      thresholds: sharded
        ? undefined
        : {
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
          globalSetup,
          setupFiles: [
            'tests/setup/boot-kernel.ts',
            'tests/setup/load-content.ts',
            'tests/setup/freeze-card-catalog.ts',
          ],
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
        define,
      },
      {
        // JSX UI component tests — browser-like DOM via happy-dom
        test: {
          name: 'ui',
          globals: true,
          environment: 'happy-dom',
          // A non-resolving origin, so UI tests never reach the dev server on port 3000 (#324)
          environmentOptions: { happyDOM: { url: 'http://mcd-ui-tests.invalid' } },
          globalSetup,
          setupFiles: [
            'tests/ui/setup/offline-dev-api.ts',
            'tests/setup/boot-kernel.ts',
            'tests/setup/load-content.ts',
            'tests/setup/freeze-card-catalog.ts',
          ],
          include: ['tests/ui/**/*.test.tsx'],
        },
        resolve: { alias },
        define,
      },
    ],
  },
});
