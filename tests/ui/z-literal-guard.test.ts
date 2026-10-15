import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const REPO_ROOT = join(__dirname, '..', '..');
const UI_ROOT = join(REPO_ROOT, 'src', 'ui');
const ALLOWED: Record<string, string[]> = {
  'src/ui/components/cards/FacedownEncounterCard.tsx': ['-z-10', '-z-20'],
};

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

describe('z-index literal guard (Issue #312)', () => {
  it('has no numeric or arbitrary z literals in src/ui outside the allowlist', () => {
    const classRe = /(?<![\w-])-?z-(\d+|\[)/g;
    // A numeric literal as the value or as a ternary branch (e.g. `isHovered ? 60 : 10`).
    const inlineRe = /zIndex:\s*(-?\d|[^,}]*[?:]\s*-?\d)/;
    const offenders: string[] = [];
    for (const file of walk(UI_ROOT)) {
      const rel = relative(REPO_ROOT, file).replace(/\\/g, '/');
      const allowed = ALLOWED[rel] ?? [];
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          for (const m of line.matchAll(classRe)) {
            const literal = /^-?z-(\d+|\[[^\]]*\])/.exec(line.slice(m.index))?.[0] ?? m[0];
            if (!allowed.includes(literal)) offenders.push(`${rel}:${i + 1} ${literal}`);
          }
          if (inlineRe.test(line)) offenders.push(`${rel}:${i + 1} inline zIndex`);
        });
    }
    expect(offenders).toEqual([]);
  });
});
