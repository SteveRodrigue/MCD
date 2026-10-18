import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * The engine reads the supplemental schema only through `data/supplemental/runtime.ts`; schema
 * modules are imported for types only, so Zod stays in the lazy Card Editor chunk
 * (AUD-20261017-232534 F014-A).
 */
const ENGINE_ROOT = path.resolve(__dirname, '../../src/engine');
const ZOD_MODULE =
  /from '(zod|[./]*data\/supplemental\/(schema|schema-primitives|gate-params|effect-params))'/;

function listSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) listSourceFiles(full, out);
    else if (entry.name.endsWith('.ts')) out.push(full);
  }
  return out;
}

describe('engine / Zod boundary', () => {
  it('no engine module imports a Zod schema module at runtime', () => {
    const offenders = listSourceFiles(ENGINE_ROOT).flatMap((file) => {
      const source = fs.readFileSync(file, 'utf8');
      const statements = source.match(/^(import|export)[^;]*?from '[^']+';/gms) ?? [];
      return statements
        .filter((s) => ZOD_MODULE.test(s) && !/^(import|export) type\b/.test(s))
        .map((s) => `${path.relative(ENGINE_ROOT, file)}: ${s.split('\n')[0]}`);
    });
    expect(offenders).toEqual([]);
  });
});
