import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Phase 6 of the fonts plan: the design lab (`/templates`) and its fonts are built only for the dev
 * server. This builds the app for production (the `vite build` of `npm run build`) and checks
 * that no lab chunk and no lab-only font ends up in it, while the game's own fonts stay.
 */

const REPO = path.resolve(__dirname, '../..');
let outDir = '';
let assets: string[] = [];

/** Fonts that only the lab lists (none is a theme font), by the file name Vite gives them. */
const LAB_ONLY_FONTS = [
  'fredoka',
  'baloo-2',
  'literata',
  'sigmar-one',
  'ibm-plex-sans',
  'work-sans',
];

/** Fonts the themes use, which the game must keep. */
const THEME_FONTS = [
  'kalam',
  'merriweather',
  'jetbrains-mono',
  'lexend',
  'special-elite',
  'boogaloo',
  'lilita-one',
  'nunito',
];

beforeAll(async () => {
  outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcd-prod-build-'));
  // The same command as `npm run build`, run apart from this test process (which is in test mode).
  const result = spawnSync(
    process.execPath,
    [
      path.join(REPO, 'node_modules/vite/bin/vite.js'),
      'build',
      '--outDir',
      outDir,
      '--emptyOutDir',
      '--logLevel',
      'error',
    ],
    { cwd: REPO, encoding: 'utf8', env: { ...process.env, NODE_ENV: 'production' } },
  );
  if (result.status !== 0)
    throw new Error(`vite build failed:
${result.stdout}
${result.stderr}`);
  assets = fs.readdirSync(path.join(outDir, 'assets'));
}, 180_000);

afterAll(() => {
  if (outDir) fs.rmSync(outDir, { recursive: true, force: true });
});

describe('production build: the design lab is dev only', () => {
  it('has the game, and no lab chunk', () => {
    expect(assets.some((f) => f.startsWith('index-') && f.endsWith('.js'))).toBe(true);
    expect(assets.filter((f) => f.startsWith('ModalTemplatesScreen'))).toEqual([]);
  });

  it('ships no lab-only font', () => {
    for (const font of LAB_ONLY_FONTS) {
      const shipped = assets.filter((f) => f.endsWith('.woff2') && f.startsWith(`${font}-`));
      expect(shipped, `${font} is a lab-only font`).toEqual([]);
    }
  });

  it('keeps every font the themes use', () => {
    for (const font of THEME_FONTS) {
      expect(
        assets.some((f) => f.endsWith('.woff2') && f.includes(font)),
        `${font} is missing from the build`,
      ).toBe(true);
    }
  });

  it('names no lab code in the entry bundle', () => {
    const entry = assets.find((f) => f.startsWith('index-') && f.endsWith('.js'))!;
    const code = fs.readFileSync(path.join(outDir, 'assets', entry), 'utf8');
    expect(code).not.toContain('ModalTemplatesScreen');
    expect(code).not.toContain('Lab Kalam');
  });
});
