import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import {
  buildRuntimeImportGraph,
  findStronglyConnectedComponents,
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

/** Sizes of the allowed cycles. Only ever shrinks; the target is []. */
const CYCLE_RATCHET: number[] = [];

describe('src/engine runtime import graph', () => {
  it('has no more import cycles than the ratchet (target 0, ADR-0088)', () => {
    const cycles = findStronglyConnectedComponents(buildRuntimeImportGraph());
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
    const graph = buildRuntimeImportGraph();
    const missing: string[] = [];
    for (const file of graph.keys()) {
      if (file === 'src/engine/kernel.ts' || file.endsWith('special-registry.ts')) continue;
      const source = fs.readFileSync(path.join(root, file), 'utf8');
      if (!/\b(bindKernel|registerSpecialHandler)\(/.test(source)) continue;
      const stem = file.replace(/\.ts$/, '').replace(/\/index$/, '');
      if (!booted.has(stem)) missing.push(file);
    }
    expect(missing).toEqual([]);
  });
});
