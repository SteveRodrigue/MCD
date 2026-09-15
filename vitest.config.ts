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
    projects: [
      {
        // Engine, data, tools, and non-JSX UI tests — pure Node environment
        test: {
          name: 'engine',
          globals: true,
          environment: 'node',
          include: [
            'tests/engine/**/*.test.ts',
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
          include: ['tests/ui/**/*.test.tsx'],
        },
        resolve: { alias },
      },
    ],
  },
});
