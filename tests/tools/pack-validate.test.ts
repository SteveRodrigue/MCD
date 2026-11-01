import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { readCardSchema, validatePackSet } from '../../scripts/pack-validate';

const official = ['core', 'gob'];
const cardSchema = readCardSchema(path.resolve('.'));
const card = (code: string, name = 'Card') => ({
  code,
  name,
  pack_code: 'xx',
  faction_code: 'hero',
  type_code: 'hero',
  position: 1,
  quantity: 1,
});

let root: string;
const write = (rel: string, data: unknown) => {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof data === 'string' ? data : JSON.stringify(data, null, 2));
};
const manifest = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  name: id,
  kind: 'hero',
  origin: 'user',
  apiVersion: 1,
  version: '1.0.0',
  dependsOn: [],
  ...extra,
});
const checks = (findings: ReturnType<typeof validatePackSet>) => findings.map((f) => f.check);
const run = (onlyPack?: string) =>
  validatePackSet(root, { officialPackCodes: official, cardSchema, onlyPack });

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'mcd-pack-validate-'));
});
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe('validatePackSet', () => {
  it('rejects a card that breaks the upstream card schema', () => {
    write('my-pack/pack.json', manifest('my-pack'));
    write('my-pack/cards/raw.json', [{ ...card('my-pack-0001'), position: undefined }]);
    expect(run().some((f) => f.check === 'cards' && f.message.includes('position'))).toBe(true);
  });

  it('passes a minimal valid user pack', () => {
    write('my-pack/pack.json', manifest('my-pack'));
    write('my-pack/cards/raw.json', [card('my-pack-0001')]);
    write('my-pack/supplemental/s.json', { cards: {} });
    expect(run()).toEqual([]);
  });

  it('rejects a user pack with scripts/', () => {
    write('my-pack/pack.json', manifest('my-pack'));
    write('my-pack/scripts/index.ts', 'export {};');
    expect(checks(run())).toContain('user-code');
  });

  it('requires an official pack with scripts to have an index.ts and a generated hook map entry', () => {
    write('pack-a/pack.json', manifest('pack-a', { origin: 'official-bundled' }));
    write('pack-a/scripts/helper.ts', 'export {};');
    write('pack-b/pack.json', manifest('pack-b', { origin: 'official-bundled' }));
    write('pack-b/scripts/index.ts', 'export default {};');
    write('pack-c/pack.json', manifest('pack-c', { origin: 'official-bundled' }));
    write('pack-c/scripts/index.ts', 'export default {};');
    const found = validatePackSet(root, {
      officialPackCodes: official,
      cardSchema,
      hookPackIds: ['pack-c'],
    });
    const byPack = (pack: string) => found.filter((f) => f.pack === pack).map((f) => f.check);
    expect(byPack('pack-a')).toEqual(['hooks-index']);
    expect(byPack('pack-b')).toEqual(['hooks-map']);
    expect(byPack('pack-c')).toEqual([]);
  });

  it('skips the hook map check when no map is given', () => {
    write('pack-b/pack.json', manifest('pack-b', { origin: 'official-bundled' }));
    write('pack-b/scripts/index.ts', 'export default {};');
    expect(checks(run())).toEqual([]);
  });

  it('rejects a user pack that reuses an official pack code', () => {
    write('gob/pack.json', manifest('gob'));
    expect(checks(run())).toContain('reserved-id');
  });

  it('rejects an apiVersion newer than the engine', () => {
    write('my-pack/pack.json', manifest('my-pack', { apiVersion: 99 }));
    expect(checks(run())).toContain('api-version');
  });

  it('rejects user cards with official-style codes and duplicate codes across packs', () => {
    write('pack-a/pack.json', manifest('pack-a'));
    write('pack-a/cards/raw.json', [card('01001')]);
    write('pack-b/pack.json', manifest('pack-b', { origin: 'official-bundled' }));
    write('pack-b/cards/raw.json', [card('01001')]);
    write('pack-c/pack.json', manifest('pack-c', { origin: 'official-bundled' }));
    write('pack-c/cards/raw.json', [card('01001')]);
    const found = checks(run());
    expect(found).toContain('card-code');
    expect(found).toContain('duplicate-card');
  });

  it('rejects a supplemental key that has no card', () => {
    write('my-pack/pack.json', manifest('my-pack'));
    write('my-pack/cards/raw.json', [card('my-pack-0001')]);
    write('my-pack/supplemental/s.json', { cards: { '99999': {} } });
    expect(checks(run())).toContain('supplemental-key');
  });

  it('reports unresolved dependencies and dependency cycles', () => {
    write('pack-a/pack.json', manifest('pack-a', { dependsOn: ['pack-b'] }));
    write('pack-b/pack.json', manifest('pack-b', { dependsOn: ['pack-a', 'missing'] }));
    const found = run();
    expect(found.some((f) => f.check === 'dependency' && f.message.includes('missing'))).toBe(true);
    expect(found.some((f) => f.check === 'dependency' && f.message.includes('cycle'))).toBe(true);
  });

  it('reports a schema failure with its path for a bad scenario', () => {
    write('my-pack/pack.json', manifest('my-pack'));
    write('my-pack/scenarios/bad/definition.json', { id: 'bad' });
    const found = run();
    expect(found.some((f) => f.check === 'schema' && f.file.includes('definition.json'))).toBe(
      true,
    );
  });

  it('limits findings to one pack with onlyPack', () => {
    write('pack-a/pack.json', manifest('pack-a', { apiVersion: 99 }));
    write('pack-b/pack.json', manifest('pack-b', { apiVersion: 99 }));
    expect(new Set(run('pack-a').map((f) => f.pack))).toEqual(new Set(['pack-a']));
  });
});
