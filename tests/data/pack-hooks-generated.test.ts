import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { packHooks } from '../../src/data/content/pack-hooks.generated';
import {
  HOOKS_OUTPUT,
  generatePackHooksSource,
  packsWithHooks,
} from '../../tools/generate-pack-hooks';

const REPO_ROOT = path.resolve(__dirname, '../..');

describe('generated pack hook map', () => {
  it('matches what the generator writes for the content folder (run npm run schema:generate)', () => {
    const onDisk = fs.readFileSync(path.join(REPO_ROOT, HOOKS_OUTPUT), 'utf-8');
    expect(onDisk).toBe(generatePackHooksSource(REPO_ROOT));
  });

  it('lists every pack that has scripts/index.ts, and only those', () => {
    expect(Object.keys(packHooks).sort()).toEqual(packsWithHooks(REPO_ROOT));
  });

  it('gives the Core pack its Wakanda Forever handler', () => {
    expect(packHooks.core.specialHandlers?.map((h) => h.id)).toEqual(['WAKANDA_FOREVER']);
  });

  it('generates an empty map for a content folder without scripts', () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'mcd-hooks-empty-'));
    try {
      fs.mkdirSync(path.join(base, 'content', 'packs', 'core'), { recursive: true });
      expect(packsWithHooks(base)).toEqual([]);
      expect(generatePackHooksSource(base)).toContain('packHooks: Record<string, PackHooks> = {};');
    } finally {
      fs.rmSync(base, { recursive: true, force: true });
    }
  });
});
