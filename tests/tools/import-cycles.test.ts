import fs from 'fs';
import os from 'os';
import path from 'path';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  buildRuntimeImportGraph,
  findEngineCycles,
  findStronglyConnectedComponents,
  readAliasMap,
  type ImportGraph,
} from '../../tools/audit/import-cycles';

function graphOf(edges: Record<string, string[]>): ImportGraph {
  return new Map(
    Object.entries(edges).map(([from, tos]) => [
      from,
      tos.map((to) => ({ to, line: 1, names: ['x'] })),
    ]),
  );
}

describe('findStronglyConnectedComponents', () => {
  it('reports nothing for an acyclic graph', () => {
    expect(findStronglyConnectedComponents(graphOf({ a: ['b'], b: ['c'], c: [] }))).toEqual([]);
  });

  it('reports a two-module cycle and a three-module cycle, largest first', () => {
    const graph = graphOf({ a: ['b'], b: ['a'], c: ['d'], d: ['e'], e: ['c'] });
    expect(findStronglyConnectedComponents(graph)).toEqual([
      ['c', 'd', 'e'],
      ['a', 'b'],
    ]);
  });

  it('reports a self-import', () => {
    expect(findStronglyConnectedComponents(graphOf({ a: ['a'] }))).toEqual([['a']]);
  });
});

describe('alias-aware graph (#339)', () => {
  let root: string;
  const write = (file: string, content: string): void => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), content);
  };

  beforeAll(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'import-cycles-'));
    write(
      'tsconfig.json',
      '{ // comments are allowed\n "compilerOptions": { "paths": { "@engine/*": ["./src/engine/*"], "@data/*": ["./src/data/*"], "@ui/*": ["./src/ui/*"] } } }',
    );
    // engine -> @data -> @engine: a cycle that leaves the engine through an alias.
    write('src/engine/a.ts', "import { b } from '@data/b';\nexport const a = () => b;\n");
    write('src/data/b.ts', "import { a } from '@engine/a';\nexport const b = () => a;\n");
    // ui <-> ui cycle that never touches the engine, and a type-only import that is elided.
    write('src/ui/x.tsx', "import { y } from '@ui/y';\nexport const x = () => y;\n");
    write('src/ui/y.tsx', "import { x } from './x';\nexport const y = () => x;\n");
    write('src/engine/t.ts', "import type { b } from '@data/b';\nexport type T = typeof b;\n");
  }, GRAPH_BUILD_TIMEOUT_MS);

  it('reads the aliases from tsconfig.json paths', () => {
    expect([...readAliasMap(root)]).toEqual([
      ['@engine/', 'src/engine/'],
      ['@data/', 'src/data/'],
      ['@ui/', 'src/ui/'],
    ]);
  });

  it('finds an engine to data to engine cycle and ignores cycles outside the engine', () => {
    const graph = buildRuntimeImportGraph(root);
    expect(findStronglyConnectedComponents(graph)).toEqual([
      ['src/data/b.ts', 'src/engine/a.ts'],
      ['src/ui/x.tsx', 'src/ui/y.tsx'],
    ]);
    expect(findEngineCycles(graph)).toEqual([['src/data/b.ts', 'src/engine/a.ts']]);
  });
});

/** Sizes of the allowed cycles. Only ever shrinks; the target is []. */
const CYCLE_RATCHET: number[] = [];

/** The first build pays the cold TypeScript compiler; under CI coverage it passes the 5 s default. */
const GRAPH_BUILD_TIMEOUT_MS = 30_000;

let engineGraph: ImportGraph;
beforeAll(() => {
  engineGraph = buildRuntimeImportGraph();
}, GRAPH_BUILD_TIMEOUT_MS);

describe('src runtime import graph, cycles through src/engine', () => {
  it('has no more import cycles than the ratchet (target 0, ADR-0088)', () => {
    const cycles = findEngineCycles(engineGraph);
    expect(cycles.map((c) => c.length)).toEqual(CYCLE_RATCHET);
  });
});

describe('engine boot reachability (ADR-0088)', () => {
  it('imports every module that binds a kernel entry or registers a special handler', () => {
    const root = path.resolve(__dirname, '../..');
    const boot = fs.readFileSync(path.join(root, 'src/engine/boot.ts'), 'utf8');
    const booted = new Set(
      [...boot.matchAll(/^import '\.\/(.+)';$/gm)].map((m) =>
        path.posix.normalize(`src/engine/${m[1]}`),
      ),
    );
    const missing: string[] = [];
    for (const file of engineGraph.keys()) {
      if (!file.startsWith('src/engine/')) continue;
      if (file === 'src/engine/kernel.ts' || file.endsWith('special-registry.ts')) continue;
      const source = fs.readFileSync(path.join(root, file), 'utf8');
      if (!/\b(bindKernel|registerSpecialHandler)\(/.test(source)) continue;
      const stem = file.replace(/\.ts$/, '').replace(/\/index$/, '');
      if (!booted.has(stem)) missing.push(file);
    }
    expect(missing).toEqual([]);
  });
});
