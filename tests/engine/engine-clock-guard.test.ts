import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * ADR-0081 guard: the engine reads no wall clock. Log entries go through `appendLog` and ids
 * through `nextEngineId`, so the same seed replays byte-identically (AUD-20261017-232534 F009).
 */
const ENGINE_ROOT = path.resolve(__dirname, '../../src/engine');

function listSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) listSourceFiles(full, out);
    else if (entry.name.endsWith('.ts')) out.push(full);
  }
  return out;
}

describe('engine clock guard (ADR-0081)', () => {
  it('no engine file calls Date.now() or pushes to the log directly', () => {
    const offenders = listSourceFiles(ENGINE_ROOT).flatMap((file) => {
      const source = fs.readFileSync(file, 'utf8');
      const rel = path.relative(ENGINE_ROOT, file).replace(/\\/g, '/');
      return [
        ...(source.includes('Date.now()') ? [`${rel}: Date.now()`] : []),
        ...(/\.log\.push\(/.test(source) && !rel.endsWith('state/game-log.ts')
          ? [`${rel}: log.push`]
          : []),
      ];
    });
    expect(offenders).toEqual([]);
  });
});
