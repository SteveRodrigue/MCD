import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * #194 architecture guard: `GameState.villain` / `GameState.mainScheme` are legacy pointers that
 * diverge from `villains[]` / `mainSchemes[]` after the JSON clone in `dispatchAction`. New code
 * must read and write through the accessors in `src/engine/models/state.ts`.
 *
 * The baseline below is the number of legacy accesses still allowed per file. It may only shrink:
 * every migration batch lowers or deletes entries, and the final state allows only
 * `models/state.ts` (the accessors' own fallback) and `state/game-setup.ts` (initial construction).
 * Physical removal of the fields is tracked in #215.
 */
const LEGACY_ACCESS = /\b\w*[sS]tate\??\.(?:villain|mainScheme)\b/g;
const LEGACY_DESTRUCTURE = /\{[^}]*\b(?:villain|mainScheme)\b[^}]*\}\s*=\s*\w*[sS]tate\b/g;

export function countLegacyAccesses(source: string): number {
  return (
    (source.match(LEGACY_ACCESS) ?? []).length + (source.match(LEGACY_DESTRUCTURE) ?? []).length
  );
}

const BASELINE: Record<string, number> = {
  'src/engine/models/state.ts': 12,
};

const SRC_ROOT = path.resolve(__dirname, '../../src');

function listSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) listSourceFiles(full, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

describe('legacy villain / main scheme pointer guard (#194)', () => {
  it('scanner flags legacy property access and destructuring, not accessor calls', () => {
    expect(countLegacyAccesses('nextState.villain.health -= 1;')).toBe(1);
    expect(countLegacyAccesses('const t = state.mainScheme.threat + state.villain.health;')).toBe(
      2,
    );
    expect(countLegacyAccesses('const { villain } = poppedState;')).toBe(1);
    expect(countLegacyAccesses('getActiveVillain(state).health -= 1;')).toBe(0);
    expect(countLegacyAccesses("params: { villain: card.name }, key: 'overkill.villain.hit'")).toBe(
      0,
    );
    expect(countLegacyAccesses('state.villains[0]; state.mainSchemes.length')).toBe(0);
    expect(countLegacyAccesses('(gameState?.mainScheme?.threat || 0) > 0')).toBe(1);
  });

  it('no file exceeds its legacy-access baseline and no new file adds one', () => {
    const counts: Record<string, number> = {};
    for (const file of listSourceFiles(SRC_ROOT)) {
      const n = countLegacyAccesses(fs.readFileSync(file, 'utf8'));
      if (n > 0) counts[path.relative(path.resolve(SRC_ROOT, '..'), file).replace(/\\/g, '/')] = n;
    }
    const regressions = Object.entries(counts)
      .filter(([file, n]) => n > (BASELINE[file] ?? 0))
      .map(([file, n]) => `${file}: ${n} (allowed ${BASELINE[file] ?? 0})`);
    expect(regressions).toEqual([]);
  });

  it('baseline has no stale entries (lower it as files are migrated)', () => {
    const stale: string[] = [];
    for (const [file, allowed] of Object.entries(BASELINE)) {
      const full = path.resolve(SRC_ROOT, '..', file);
      const n = fs.existsSync(full) ? countLegacyAccesses(fs.readFileSync(full, 'utf8')) : 0;
      if (n < allowed) stale.push(`${file}: ${n} (baseline ${allowed})`);
    }
    expect(stale).toEqual([]);
  });
});
