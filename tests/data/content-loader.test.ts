import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadContent } from '../../src/data/content/loader';
import { NodeFsDriver } from '../../src/data/content/drivers/node-fs';

let root: string;
const driver = () => new NodeFsDriver(root);
const write = (rel: string, data: unknown) => {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof data === 'string' ? data : JSON.stringify(data));
};
const manifest = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  name: id,
  kind: 'hero',
  origin: 'official-bundled',
  apiVersion: 1,
  version: '1.0.0',
  dependsOn: [],
  ...extra,
});
const card = (code: string) => ({ code, name: code, pack_code: 'x', position: 1, quantity: 1 });
const config = (enabledPacks: string[]) => write('config.json', { enabledPacks });
const ids = (content: Awaited<ReturnType<typeof loadContent>>) => content.packs.map((p) => p.id);

function fresh() {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'mcd-content-loader-'));
}

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe('loadContent', () => {
  it('boots with zero packs from an empty content root', async () => {
    fresh();
    expect(await loadContent(driver())).toEqual({ packs: [], failures: [] });
  });

  it('boots with zero packs when none is enabled', async () => {
    fresh();
    config([]);
    write('packs/core/pack.json', manifest('core'));
    expect(await loadContent(driver())).toEqual({ packs: [], failures: [] });
  });

  it('loads the enabled packs with cards, supplemental data, modular sets and decks', async () => {
    fresh();
    config(['core']);
    write('packs/core/pack.json', manifest('core', { kind: 'core' }));
    write('packs/core/cards/core.json', [card('00001'), card('00002')]);
    write('packs/core/cards/core_encounter.json', [card('00100')]);
    write('packs/core/supplemental/core.json', {
      cards: { '00001': { noSupplementalNeeded: true } },
    });
    write('packs/core/modular-sets.json', [
      { code: 'bomb_scare', name: 'Bomb Scare', description: '' },
    ]);
    write('packs/core/decks/a.json', {
      id: 2,
      name: 'B',
      hero_code: '00001',
      hero_name: 'B',
      slots: { '00002': 1 },
    });
    write('packs/core/decks/b.json', {
      id: 1,
      name: 'A',
      hero_code: '00001',
      hero_name: 'A',
      slots: { '00002': 1 },
    });

    const content = await loadContent(driver());
    expect(content.failures).toEqual([]);
    const [pack] = content.packs;
    expect(pack.cardCount).toBe(3);
    expect(pack.supplementalCount).toBe(1);
    expect(pack.modularSets.map((s) => s.code)).toEqual(['bomb_scare']);
    expect(pack.decks.map((d) => d.name)).toEqual(['A', 'B']);
  });

  it('lets options.packs replace the configured list', async () => {
    fresh();
    config(['pa']);
    write('packs/pa/pack.json', manifest('pa'));
    write('packs/pb/pack.json', manifest('pb'));
    expect(ids(await loadContent(driver(), { packs: ['pb'] }))).toEqual(['pb']);
  });

  it('disables only the pack whose manifest is invalid', async () => {
    fresh();
    config(['good', 'bad']);
    write('packs/good/pack.json', manifest('good'));
    write('packs/bad/pack.json', { id: 'bad' });
    const content = await loadContent(driver());
    expect(ids(content)).toEqual(['good']);
    expect(content.failures).toHaveLength(1);
    expect(content.failures[0].packId).toBe('bad');
  });

  it('adds dependencies, loads them first, and disables dependents of a failed pack', async () => {
    fresh();
    config(['hero', 'orphan']);
    write('packs/base/pack.json', manifest('base'));
    write('packs/hero/pack.json', manifest('hero', { dependsOn: ['base'] }));
    write('packs/orphan/pack.json', manifest('orphan', { dependsOn: ['missing'] }));
    const content = await loadContent(driver());
    expect(ids(content)).toEqual(['base', 'hero']);
    expect(content.failures.map((f) => f.packId).sort()).toEqual(['missing', 'orphan']);
    expect(content.failures.find((f) => f.packId === 'orphan')?.reason).toContain('missing');
  });

  it('disables packs in a dependency cycle', async () => {
    fresh();
    config(['aa', 'bb']);
    write('packs/aa/pack.json', manifest('aa', { dependsOn: ['bb'] }));
    write('packs/bb/pack.json', manifest('bb', { dependsOn: ['aa'] }));
    const content = await loadContent(driver());
    expect(content.packs).toEqual([]);
    expect(content.failures.length).toBeGreaterThan(0);
  });

  it('rejects a pack whose apiVersion is newer than the engine', async () => {
    fresh();
    config(['future']);
    write('packs/future/pack.json', manifest('future', { apiVersion: 99 }));
    const content = await loadContent(driver());
    expect(content.packs).toEqual([]);
    expect(content.failures[0].reason).toContain('apiVersion');
  });

  it('disables a pack that duplicates a card code of an earlier pack', async () => {
    fresh();
    config(['first', 'second']);
    write('packs/first/pack.json', manifest('first'));
    write('packs/first/cards/a.json', [card('00001')]);
    write('packs/second/pack.json', manifest('second'));
    write('packs/second/cards/a.json', [card('00001')]);
    const content = await loadContent(driver());
    expect(ids(content)).toEqual(['first']);
    expect(content.failures[0].reason).toContain('00001');
  });

  it('reports an invalid config.json and still boots empty', async () => {
    fresh();
    write('config.json', { enabledPacks: 'core' });
    const content = await loadContent(driver());
    expect(content.packs).toEqual([]);
    expect(content.failures[0].reason).toContain('config.json');
  });
});
