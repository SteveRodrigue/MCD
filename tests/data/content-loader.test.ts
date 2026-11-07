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
    expect(await loadContent(driver())).toEqual({
      packs: [],
      failures: [],
      descriptions: [],
      artPacks: [],
      artPackWarnings: [],
      artPackCardLabels: {},
    });
  });

  it('boots with zero packs when none is enabled', async () => {
    fresh();
    config([]);
    write('packs/core/pack.json', manifest('core'));
    const content = await loadContent(driver());
    expect({ packs: content.packs, failures: content.failures }).toEqual({ packs: [], failures: [] });
    expect(content.descriptions).toMatchObject([{ id: 'core', enabled: false, state: 'playable' }]);
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
    write('packs/core/encounter-sets.json', [
      { code: 'bomb_scare', kind: 'modular', name: 'Bomb Scare', description: '' },
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
    expect(pack.encounterSets.map((s) => s.code)).toEqual(['bomb_scare']);
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

  describe('scenarios', () => {
    const definition = (id: string, extra: Record<string, unknown> = {}) => ({
      id,
      name: id,
      scenarioCardCode: '00100',
      supportedDifficulties: ['SKIRMISH', 'STANDARD', 'EXPERT'],
      villainSetup: {
        villainName: 'V',
        stages: { SKIRMISH: ['00100'], STANDARD: ['00100'], EXPERT: ['00100'] },
      },
      mainSchemeSetup: {
        stages: ['00101a', '00101b'],
      },
      modularEncounterSets: { mandatory: [] },
      ...extra,
    });

    it('loads the definition of every scenario folder, in folder order', async () => {
      fresh();
      config(['core']);
      write('packs/core/pack.json', manifest('core'));
      write('packs/core/scenarios/zeta/definition.json', definition('zeta'));
      write(
        'packs/core/scenarios/alpha/definition.json',
        definition('alpha', { setupOnomatopoeia: 'BOOM!' }),
      );
      const content = await loadContent(driver());
      expect(content.failures).toEqual([]);
      const scenarios = content.packs[0].scenarios;
      expect(scenarios.map((s) => s.id)).toEqual(['alpha', 'zeta']);
      expect(scenarios[0].setupOnomatopoeia).toBe('BOOM!');
    });

    it('loads a pack without scenarios', async () => {
      fresh();
      config(['core']);
      write('packs/core/pack.json', manifest('core'));
      expect((await loadContent(driver())).packs[0].scenarios).toEqual([]);
    });

    it('disables only the pack whose scenario definition is invalid', async () => {
      fresh();
      config(['good', 'bad']);
      write('packs/good/pack.json', manifest('good'));
      write('packs/good/scenarios/a/definition.json', definition('a'));
      write('packs/bad/pack.json', manifest('bad'));
      write('packs/bad/scenarios/b/definition.json', { id: 'b' });
      const content = await loadContent(driver());
      expect(ids(content)).toEqual(['good']);
      expect(content.failures).toHaveLength(1);
      expect(content.failures[0].packId).toBe('bad');
      expect(content.failures[0].reason).toContain('scenarios/b/definition.json');
    });

    it('disables a pack whose scenario folder has no definition.json', async () => {
      fresh();
      config(['core']);
      write('packs/core/pack.json', manifest('core'));
      write('packs/core/scenarios/a/README.md', 'x');
      const content = await loadContent(driver());
      expect(content.packs).toEqual([]);
      expect(content.failures[0].reason).toContain('missing definition.json');
    });

    it('disables a pack that duplicates a scenario id of an earlier pack', async () => {
      fresh();
      config(['first', 'second']);
      write('packs/first/pack.json', manifest('first'));
      write('packs/first/scenarios/a/definition.json', definition('same'));
      write('packs/second/pack.json', manifest('second'));
      write('packs/second/scenarios/b/definition.json', definition('same'));
      const content = await loadContent(driver());
      expect(ids(content)).toEqual(['first']);
      expect(content.failures[0].reason).toContain('same');
    });
  });

  it('reports an invalid config.json and still boots empty', async () => {
    fresh();
    write('config.json', { enabledPacks: 'core' });
    const content = await loadContent(driver());
    expect(content.packs).toEqual([]);
    expect(content.failures[0].reason).toContain('config.json');
  });
});

describe('pack descriptions (what the Content screen shows)', () => {
  const threeCardPack = (id: string, covered: string[]) => {
    write(`packs/${id}/pack.json`, manifest(id));
    write(`packs/${id}/cards/${id}.json`, [card(`${id}1`), card(`${id}2`), card(`${id}3`)]);
    write(`packs/${id}/supplemental/${id}.json`, {
      cards: Object.fromEntries(covered.map((code) => [code, {}])),
    });
  };
  const describeOnly = async (id: string) =>
    (await loadContent(driver())).descriptions.find((d) => d.id === id);

  it('a hand-listed pack with no supplemental data still loads, tagged no-supplemental', async () => {
    fresh();
    config(['core', 'thor']);
    write('packs/core/pack.json', manifest('core', { kind: 'core', name: 'Core Set' }));
    write('packs/core/cards/core.json', [card('00001')]);
    write('packs/core/supplemental/core.json', { cards: { '00001': {} } });
    write('packs/thor/pack.json', manifest('thor', { dependsOn: ['core'] }));
    write('packs/thor/cards/thor.json', [card('45001')]);
    const content = await loadContent(driver());
    expect(ids(content)).toEqual(['core', 'thor']);
    expect(content.failures).toEqual([]);
    expect(content.descriptions).toMatchObject([
      { id: 'core', name: 'Core Set', enabled: true, state: 'playable', supplementalCount: 1 },
      {
        id: 'thor',
        enabled: true,
        state: 'no-supplemental',
        reason: 'no supplemental data',
        cardCount: 1,
      },
    ]);
  });

  it('a switched-off pack with cards and no supplemental data is no-supplemental', async () => {
    fresh();
    config([]);
    write('packs/thor/pack.json', manifest('thor'));
    write('packs/thor/cards/thor.json', [card('45001')]);
    expect(await describeOnly('thor')).toMatchObject({
      enabled: false,
      state: 'no-supplemental',
      reason: 'no supplemental data',
    });
  });

  it('Green Goblin-style partial data is incomplete with the count, on or off', async () => {
    fresh();
    threeCardPack('gob', ['gob1', 'gob2']);
    const partial = { state: 'incomplete', reason: '2 of 3 cards have supplemental data' };
    config([]);
    expect(await describeOnly('gob')).toMatchObject({ ...partial, enabled: false });
    config(['gob']);
    expect(await describeOnly('gob')).toMatchObject({ ...partial, enabled: true });
  });

  it('a complete pack is playable, on or off', async () => {
    fresh();
    threeCardPack('core', ['core1', 'core2', 'core3']);
    config([]);
    expect(await describeOnly('core')).toMatchObject({ state: 'playable', enabled: false });
    config(['core']);
    expect(await describeOnly('core')).toMatchObject({ state: 'playable', enabled: true });
  });

  it('supplemental data for another pack does not make a pack complete', async () => {
    fresh();
    config(['aoa']);
    write('packs/aoa/pack.json', manifest('aoa'));
    write('packs/aoa/cards/aoa.json', [card('45001')]);
    write('packs/aoa/supplemental/aoa.json', { cards: { '01001': {} } });
    expect(await describeOnly('aoa')).toMatchObject({ state: 'no-supplemental' });
  });

  it('a pack with no cards is playable', async () => {
    fresh();
    config([]);
    write('packs/decks/pack.json', manifest('decks'));
    const description = await describeOnly('decks');
    expect(description).toMatchObject({ state: 'playable' });
    expect(description?.reason).toBeUndefined();
    expect(description?.imageNote).toBeUndefined();
  });

  it('a switched-off pack with broken supplemental data is failed with the reason', async () => {
    fresh();
    config([]);
    write('packs/bad/pack.json', manifest('bad'));
    write('packs/bad/cards/bad.json', [card('45001')]);
    write('packs/bad/supplemental/bad.json', { cards: { '45001': { abilities: 5 } } });
    const description = await describeOnly('bad');
    expect(description).toMatchObject({ state: 'failed', enabled: false });
    expect(description?.reason).toContain('supplemental/bad.json');
  });

  it('an official pack with no image on disk notes "no images downloaded yet" and stays playable', async () => {
    fresh();
    threeCardPack('core', ['core1', 'core2', 'core3']);
    config([]);
    expect(await describeOnly('core')).toMatchObject({
      state: 'playable',
      imageCount: 0,
      imageNote: 'no images downloaded yet',
    });
  });

  it('a user pack with no image on disk notes "no images" and stays playable', async () => {
    fresh();
    threeCardPack('mine', ['mine1', 'mine2', 'mine3']);
    write('packs/mine/pack.json', manifest('mine', { origin: 'user' }));
    config([]);
    expect(await describeOnly('mine')).toMatchObject({
      state: 'playable',
      imageCount: 0,
      imageNote: 'no images',
    });
  });

  it.each([
    ['in the pack assets', 'packs/core/assets/cards/core1.png'],
    ['in the cache', '.cache/images/core/core1.png'],
  ])('a pack with one image %s has no image note', async (_where, file) => {
    fresh();
    threeCardPack('core', ['core1', 'core2', 'core3']);
    write(file, 'generated');
    config([]);
    const description = await describeOnly('core');
    expect(description?.imageCount).toBe(1);
    expect(description?.imageNote).toBeUndefined();
  });

  it('marks a pack Needs pack when its dependency is disabled, and lists its scenarios as locked', async () => {
    fresh();
    config(['aoa']);
    write('packs/aoa/pack.json', manifest('aoa', { name: 'Age of Apocalypse', dependsOn: ['core'] }));
    write('packs/aoa/scenarios/apoc/definition.json', { id: 'apoc', name: 'Apocalypse' });
    const { descriptions } = await loadContent(driver());
    expect(descriptions).toMatchObject([
      {
        id: 'aoa',
        enabled: true,
        state: 'needs-pack',
        lockedScenarios: [{ id: 'apoc', name: 'Apocalypse' }],
      },
    ]);
    expect(descriptions[0].reason).toContain('core');
  });

  it('marks a pack with a broken pack.json Failed with the reason, and the others still load', async () => {
    fresh();
    config(['core', 'bad']);
    write('packs/core/pack.json', manifest('core', { kind: 'core' }));
    write('packs/bad/pack.json', '{ not json');
    const content = await loadContent(driver());
    expect(content.packs.map((p) => p.id)).toEqual(['core']);
    const bad = content.descriptions.find((d) => d.id === 'bad');
    expect(bad).toMatchObject({ enabled: true, state: 'failed' });
    expect(bad?.reason).toBeTruthy();
  });
});
