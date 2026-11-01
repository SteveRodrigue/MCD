import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { hasDifferences, materializeUpstream, parseArgs } from '../../scripts/content-sync';

let root: string;
let upstream: string;
let base: string;

function write(file: string, text: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}

function read(...parts: string[]): string {
  return fs.readFileSync(path.join(base, 'content', ...parts), 'utf-8');
}

const PACKS = [
  { code: 'core', name: 'Core Set', pack_type_code: 'core' },
  { code: 'hlk', name: 'Hulk', pack_type_code: 'hero' },
  { code: 'new', name: 'Brand New', pack_type_code: 'encounter' },
];

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'content-sync-'));
  upstream = path.join(root, 'upstream');
  base = path.join(root, 'repo');
  fs.mkdirSync(base);
  write(path.join(upstream, 'packs.json'), JSON.stringify(PACKS, null, '\t'));
  write(path.join(upstream, 'sets.json'), '[ {"code":"a"} ]\n');
  for (const name of ['factions', 'types', 'subtypes', 'packtypes', 'settypes']) {
    write(path.join(upstream, `${name}.json`), '[]');
  }
  write(path.join(upstream, 'schema', 'card_schema.json'), '{"x":1}');
  write(path.join(upstream, 'pack', 'core.json'), '[ {"code":"01001"} ]');
  write(path.join(upstream, 'pack', 'core_encounter.json'), '[]');
  write(path.join(upstream, 'pack', 'hlk.json'), '[ {"code":"21001"} ]');
  write(path.join(upstream, 'pack', 'new_encounter.json'), '[ {"code":"99001"} ]');
  write(path.join(upstream, 'translations', 'de', 'pack', 'core.json'), '[ "de" ]');
  write(path.join(upstream, 'translations', 'de', 'pack', 'nrawler_encounter.json'), '[]');
  write(path.join(upstream, 'translations', 'de', 'factions.json'), '[ "f" ]');
  write(path.join(base, 'content', 'packs', 'core', 'pack.json'), '{"custom":true}\n');
  write(path.join(base, 'content', 'packs', 'core', 'supplemental', 'core.json'), 'mine');
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe('materializeUpstream', () => {
  it('materializes cards, meta, schema and translations byte for byte', () => {
    const report = materializeUpstream(upstream, base);
    expect(read('packs', 'core', 'cards', 'core.json')).toBe('[ {"code":"01001"} ]');
    expect(fs.existsSync(path.join(base, 'content/packs/core/cards/core_encounter.json'))).toBe(
      true,
    );
    expect(read('packs', 'hlk', 'cards', 'hlk.json')).toBe('[ {"code":"21001"} ]');
    expect(read('meta', 'sets.json')).toBe('[ {"code":"a"} ]\n');
    expect(read('meta', 'schema', 'card_schema.json')).toBe('{"x":1}');
    expect(read('packs', 'core', 'translations', 'de', 'core.json')).toBe('[ "de" ]');
    expect(read('meta', 'translations', 'de', 'factions.json')).toBe('[ "f" ]');
    expect(report.written.length).toBeGreaterThan(0);
  });

  it('preserves existing pack.json and supplemental data', () => {
    materializeUpstream(upstream, base);
    expect(read('packs', 'core', 'pack.json')).toBe('{"custom":true}\n');
    expect(read('packs', 'core', 'supplemental', 'core.json')).toBe('mine');
  });

  it('creates pack.json for new packs only', () => {
    const report = materializeUpstream(upstream, base);
    expect(report.createdPacks).toEqual(['hlk', 'new']);
    expect(JSON.parse(read('packs', 'new', 'pack.json'))).toEqual({
      id: 'new',
      name: 'Brand New',
      kind: 'scenario',
      origin: 'official-bundled',
      apiVersion: 1,
      version: '1.0.0',
      dependsOn: ['core'],
      source: 'zzorba/marvelsdb-json-data',
    });
    expect(read('packs', 'new', 'pack.json').endsWith('}\n')).toBe(true);
  });

  it('skips files whose pack code is not in packs.json', () => {
    const report = materializeUpstream(upstream, base);
    expect(report.skipped).toHaveLength(1);
    expect(report.skipped[0]).toContain('nrawler_encounter.json');
    expect(fs.existsSync(path.join(base, 'content/packs/nrawler'))).toBe(false);
  });

  it('--check reports differences without writing', () => {
    const report = materializeUpstream(upstream, base, { check: true });
    expect(hasDifferences(report)).toBe(true);
    expect(report.written.length).toBeGreaterThan(0);
    expect(fs.existsSync(path.join(base, 'content/meta'))).toBe(false);
    expect(fs.existsSync(path.join(base, 'content/packs/hlk'))).toBe(false);
  });

  it('a second run is a no-op', () => {
    materializeUpstream(upstream, base);
    const second = materializeUpstream(upstream, base, { check: true });
    expect(second.written).toEqual([]);
    expect(second.unchanged).toBeGreaterThan(0);
    expect(hasDifferences(second)).toBe(false);
  });

  it('reports files upstream dropped and only deletes them with prune', () => {
    materializeUpstream(upstream, base);
    fs.rmSync(path.join(upstream, 'pack', 'hlk.json'));
    const kept = materializeUpstream(upstream, base);
    expect(kept.stale).toEqual(['packs/hlk/cards/hlk.json']);
    expect(read('packs', 'hlk', 'cards', 'hlk.json')).toContain('21001');
    const pruned = materializeUpstream(upstream, base, { prune: true });
    expect(pruned.removed).toEqual(['packs/hlk/cards/hlk.json']);
    expect(fs.existsSync(path.join(base, 'content/packs/hlk/cards/hlk.json'))).toBe(false);
  });
});

describe('parseArgs', () => {
  it('parses flags', () => {
    expect(parseArgs(['--check', '--prune', '--from', 'x'])).toEqual({
      check: true,
      prune: true,
      from: 'x',
    });
    expect(() => parseArgs(['--bogus'])).toThrow();
  });
});
