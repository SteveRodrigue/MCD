import { describe, it, expect, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  artPackArt,
  artPackHasStatImages,
  artPackImageUrls,
  localArtUrl,
  remoteArtUrl,
} from '../../src/data/content/card-art';
import { NodeFsDriver } from '../../src/data/content/drivers/node-fs';
import { loadContent } from '../../src/data/content/loader';
import {
  getLoadedContent,
  setDisabledArtPacks,
  setLoadedContent,
} from '../../src/data/content/store';
import type { ArtPackManifest } from '../../src/data/packs/art-pack';
import { ScenarioRegistry } from '../../src/engine/scenarios';

const credit = { author: 'A', sourceUrl: 'https://example.com/a', unofficial: true };
const mk = (n: number) => ({ file: `mk${n}.png`, attack: n, hitPoints: n });
const manifest = (id: string, cards: ArtPackManifest['cards']): ArtPackManifest => ({
  id,
  name: id,
  description: `The ${id} test pack.`,
  credit,
  cards,
});

let root: string | undefined;

function contentFolder(artPacks: Record<string, unknown>, skipFiles: string[] = []): NodeFsDriver {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'mcd-art-packs-'));
  const write = (rel: string, data: unknown) => {
    const file = path.join(root as string, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, typeof data === 'string' ? data : JSON.stringify(data));
  };
  write('config.json', { enabledPacks: ['tmp'] });
  write('packs/tmp/pack.json', {
    id: 'tmp',
    name: 'tmp',
    kind: 'hero',
    origin: 'official-bundled',
    apiVersion: 1,
    version: '1.0.0',
    dependsOn: [],
  });
  write('packs/tmp/cards/tmp.json', [
    { code: '99001a', name: 'Hero', type_code: 'hero', pack_code: 'tmp', position: 1, quantity: 1 },
    { code: '99002', name: 'Ally', type_code: 'ally', pack_code: 'tmp', position: 2, quantity: 1 },
  ]);
  for (const [id, data] of Object.entries(artPacks)) {
    write(`art-packs/${id}/art-pack.json`, data);
    // Every image a valid manifest lists exists on disk (empty files), except the ones `skipFiles` names.
    const cards = (data as Partial<ArtPackManifest>).cards ?? {};
    for (const images of Object.values(cards)) {
      for (const image of images) {
        if (!skipFiles.includes(image.file)) write(`art-packs/${id}/${image.file}`, '');
      }
    }
  }
  return new NodeFsDriver(root);
}

/** An installed pack that config.json leaves off. Its cards file is whatever the test passes. */
function writeOffPack(
  cards: unknown = [
    { code: '12001a', name: 'Ant-Man', type_code: 'hero', pack_code: 'off', position: 1, quantity: 1 },
  ],
) {
  const dir = path.join(root as string, 'packs/off');
  fs.mkdirSync(path.join(dir, 'cards'), { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'pack.json'),
    JSON.stringify({
      id: 'off',
      name: 'off',
      kind: 'hero',
      origin: 'official-bundled',
      apiVersion: 1,
      version: '1.0.0',
      dependsOn: [],
    }),
  );
  fs.writeFileSync(path.join(dir, 'cards/off.json'), JSON.stringify(cards));
}

afterEach(() => {
  if (root) fs.rmSync(root, { recursive: true, force: true });
  root = undefined;
});

describe('loading art packs', () => {
  it('S1: tests and scripts never read art packs unless they ask', async () => {
    const driver = contentFolder({ one: manifest('one', { '99001a': [{ file: 'a.png' }] }) });
    const content = await loadContent(driver);
    expect(content.artPacks).toEqual([]);
    expect(content.failures).toEqual([]);
  });

  it('S2: finds a valid art pack with no config entry', async () => {
    const driver = contentFolder({ one: manifest('one', { '99001a': [{ file: 'a.png' }] }) });
    const content = await loadContent(driver, { artPacks: true });
    expect(content.artPacks.map((p) => p.id)).toEqual(['one']);
    expect(content.failures).toEqual([]);
    expect(content.artPackWarnings).toEqual([]);
  });

  it('S4: an empty content root has no art packs and no failures', async () => {
    const driver = contentFolder({});
    const content = await loadContent(driver, { artPacks: true });
    expect(content.artPacks).toEqual([]);
    expect(content.failures).toEqual([]);
  });

  it.each([
    ['invalid JSON', '{ not json'],
    ['a missing credit', { id: 'bad', name: 'bad', description: 'x', cards: {} }],
    [
      'a missing description',
      { id: 'bad', name: 'bad', credit, cards: { '99001a': [{ file: 'a.png' }] } },
    ],
    ['an empty description', { ...manifest('bad', {}), description: '  ' }],
    ['a description over 300 characters', { ...manifest('bad', {}), description: 'x'.repeat(301) }],
    [
      'a file name that leaves its folder',
      manifest('bad', { '99001a': [{ file: '../../secret.png' }] }),
    ],
    ['several images without stats', manifest('bad', { '99002': [{ file: 'a.png' }, mk(2)] })],
    ['one image with half its stats', manifest('bad', { '99002': [{ file: 'a.png', attack: 1 }] })],
    ['an id that is not the folder name', manifest('other', {})],
  ])('S4: %s is listed as a failure and the packs still load', async (_name, data) => {
    const driver = contentFolder({ bad: data, good: manifest('good', {}) });
    const content = await loadContent(driver, { artPacks: true });
    expect(content.failures.map((f) => f.packId)).toEqual(['art-pack:bad']);
    expect(content.artPacks.map((p) => p.id)).toEqual(['good']);
    expect(content.packs.map((p) => p.id)).toEqual(['tmp']);
  });

  it('S1: a code in no installed pack gives one warning', async () => {
    const driver = contentFolder({ one: manifest('one', { '99999': [{ file: 'a.png' }] }) });
    writeOffPack();
    const content = await loadContent(driver, { artPacks: true });
    expect(content.artPacks).toHaveLength(1);
    expect(content.artPackWarnings.map((w) => w.reason)).toEqual([
      'card 99999 is in no installed pack',
    ]);
    expect(content.artPackCardLabels['99999']).toBeUndefined();
  });

  it('S1: a card of an installed pack that is off gives no warning', async () => {
    const driver = contentFolder({ one: manifest('one', { '12001a': [{ file: 'a.png' }] }) });
    writeOffPack();
    const content = await loadContent(driver, { artPacks: true });
    expect(content.artPackWarnings).toEqual([]);
    expect(content.packs.map((p) => p.id)).toEqual(['tmp']);
    expect(content.artPackCardLabels['12001a']).toEqual({
      name: 'Ant-Man',
      type: 'hero',
      source: 'off-pack',
    });
  });

  it('S1: no off pack is read when every listed code is loaded', async () => {
    const driver = contentFolder({ one: manifest('one', { '99001a': [{ file: 'a.png' }] }) });
    writeOffPack();
    const read = vi.spyOn(driver, 'readJson');
    const content = await loadContent(driver, { artPacks: true });
    expect(content.artPackCardLabels['99001a']).toEqual({
      name: 'Hero',
      type: 'hero',
      source: 'card',
    });
    expect(read.mock.calls.filter(([file]) => file.startsWith('packs/off/cards'))).toEqual([]);
  });

  it('S1: an unreadable off pack does not stop the load', async () => {
    const driver = contentFolder({ one: manifest('one', { '12001a': [{ file: 'a.png' }] }) });
    writeOffPack('not a list of cards');
    const content = await loadContent(driver, { artPacks: true });
    expect(content.failures).toEqual([]);
    expect(content.packs.map((p) => p.id)).toEqual(['tmp']);
    expect(content.artPackWarnings.map((w) => w.reason)).toEqual([
      'card 12001a is in no installed pack',
    ]);
  });

  it('warns about stat images on a card type that has no stats to follow', async () => {
    const driver = contentFolder({ one: manifest('one', { '99001a': [mk(1), mk(2)] }) });
    const { artPackWarnings } = await loadContent(driver, { artPacks: true });
    expect(artPackWarnings[0].reason).toContain('cannot follow stats');
  });

  it('accepts stat images on an ally', async () => {
    const driver = contentFolder({ one: manifest('one', { '99002': [mk(1), mk(2)] }) });
    const { artPackWarnings } = await loadContent(driver, { artPacks: true });
    expect(artPackWarnings).toEqual([]);
  });

  it('warns about a listed image that is missing from the pack folder, and does not offer it', async () => {
    const driver = contentFolder(
      { one: manifest('one', { '99001a': [{ file: 'a.png' }], '99002': [mk(1), mk(2)] }) },
      ['mk2.png'],
    );
    const content = await loadContent(driver, { artPacks: true });
    expect(content.failures).toEqual([]);
    expect(content.artPackWarnings).toMatchObject([
      {
        packId: 'art-pack:one',
        reason: expect.stringMatching(/99002.*mk2\.png.*missing/),
      },
    ]);
    // The pack stays usable: the images that exist are still listed, the missing one is dropped.
    expect(content.artPacks[0].cards['99002'].map((image) => image.file)).toEqual(['mk1.png']);
    expect(content.artPacks[0].cards['99001a']).toHaveLength(1);
  });

  it('drops a card whose images are all missing, so it keeps its official art', async () => {
    const driver = contentFolder({ one: manifest('one', { '99001a': [{ file: 'a.png' }] }) }, [
      'a.png',
    ]);
    const content = await loadContent(driver, { artPacks: true });
    expect(content.artPacks[0].cards).toEqual({});
    expect(content.artPackWarnings).toHaveLength(1);
  });

  it('warns when two art packs list the same card, naming the one that comes first', async () => {
    const driver = contentFolder({
      zeta: manifest('zeta', { '99002': [{ file: 'z.png' }] }),
      alpha: manifest('alpha', { '99002': [{ file: 'a.png' }] }),
    });
    const content = await loadContent(driver, { artPacks: true });
    expect(content.artPacks.map((p) => p.id)).toEqual(['alpha', 'zeta']);
    expect(content.artPackWarnings).toMatchObject([
      { packId: 'art-pack:zeta', reason: expect.stringContaining('"alpha"') },
    ]);
  });

  it("S2: accepts stat images on a scenario's token, which has no printed card", async () => {
    const driver = contentFolder({ one: manifest('one', { ultron_drone: [mk(1), mk(2)] }) });
    const definition = ScenarioRegistry.get('ultron').definition;
    const file = path.join(root as string, 'packs/tmp/scenarios/ultron/definition.json');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(definition));
    const content = await loadContent(driver, { artPacks: true });
    expect(content.failures).toEqual([]);
    expect(content.artPackWarnings).toEqual([]);
  });
});

describe('choosing an art pack image', () => {
  const loaded = getLoadedContent();
  afterEach(() => {
    setLoadedContent(loaded);
    setDisabledArtPacks([]);
  });

  function withArtPacks(...artPacks: ArtPackManifest[]) {
    setLoadedContent({ ...loaded, artPacks });
  }

  const tokens = manifest('tokens', {
    ultron_drone: [mk(3), mk(1), mk(4), mk(2)],
    '01001a': [{ file: 'hero.png' }],
    '01137b': [{ file: 'side-b.png' }],
  });
  const url = (file: string) => `/card-art/_art-tokens/${file}`;

  it.each([
    [1, 1, 'mk1.png'],
    [2, 2, 'mk2.png'],
    [3, 3, 'mk3.png'],
    [4, 4, 'mk4.png'],
  ])('S3: ATK %i and %i hit points show their mark', (attack, hitPoints, file) => {
    withArtPacks(tokens);
    expect(artPackArt({ code: 'ultron_drone', artStats: { attack, hitPoints } })?.url).toBe(url(file));
  });

  it.each([
    ['a temporary ATK boost', 3, 2, 'mk2.png'],
    ['a hit point attachment', 1, 4, 'mk1.png'],
    ['ATK 0, below every mark', 0, 1, 'mk1.png'],
    ['stats above every mark', 7, 7, 'mk4.png'],
  ])('S3 edge: %s', (_name, attack, hitPoints, file) => {
    withArtPacks(tokens);
    expect(artPackArt({ code: 'ultron_drone', artStats: { attack, hitPoints } })?.url).toBe(url(file));
  });

  it('S3: with no known stats, shows the lowest image', () => {
    withArtPacks(tokens);
    expect(artPackArt('ultron_drone')?.url).toBe(url('mk1.png'));
  });

  it('S6: replaces the official art of a hero and of one main scheme side', () => {
    withArtPacks(tokens);
    expect(localArtUrl({ code: '01001a' })).toBe(url('hero.png'));
    expect(localArtUrl('01137b')).toBe(url('side-b.png'));
    expect(localArtUrl('01137a')).toBe('/card-art/core/01137a.png');
  });

  it('S6: the official art stays reachable, and remote art is never the art pack', () => {
    withArtPacks(tokens);
    expect(localArtUrl({ code: '01001a', officialArt: true })).toBe('/card-art/core/01001a.png');
    expect(remoteArtUrl('01001a')).toContain('marvelcdb.com');
  });

  it('S1: with no art pack, nothing changes', () => {
    withArtPacks();
    expect(artPackArt('ultron_drone')).toBeUndefined();
    expect(localArtUrl('ultron_drone')).toBe('');
    expect(localArtUrl('01001a')).toBe('/card-art/core/01001a.png');
    expect(artPackHasStatImages('ultron_drone')).toBe(false);
    expect(artPackImageUrls('ultron_drone')).toEqual([]);
  });

  it('knows which cards have stat images and lists them for preloading', () => {
    withArtPacks(tokens);
    expect(artPackHasStatImages('ultron_drone')).toBe(true);
    expect(artPackHasStatImages('01001a')).toBe(false);
    expect(artPackImageUrls('ultron_drone')).toHaveLength(4);
  });

  it('the first art pack by folder name wins', () => {
    withArtPacks(
      manifest('alpha', { '01001a': [{ file: 'a.png' }] }),
      manifest('zeta', { '01001a': [{ file: 'z.png' }] }),
    );
    expect(localArtUrl('01001a')).toBe('/card-art/_art-alpha/a.png');
  });

  describe('switching art packs off', () => {
    const alpha = manifest('alpha', { '01001a': [{ file: 'a.png' }], '01002': [mk(1), mk(2)] });
    const zeta = manifest('zeta', { '01001a': [{ file: 'z.png' }] });

    it('a pack that is switched off shows no art, so the card keeps its official art', () => {
      withArtPacks(alpha);
      setDisabledArtPacks(['alpha']);
      expect(artPackArt('01001a')).toBeUndefined();
      expect(localArtUrl('01001a')).toBe('/card-art/core/01001a.png');
      expect(artPackHasStatImages('01002')).toBe(false);
      expect(artPackImageUrls('01002')).toEqual([]);
    });

    it('the first pack that is still on wins', () => {
      withArtPacks(alpha, zeta);
      expect(localArtUrl('01001a')).toBe('/card-art/_art-alpha/a.png');
      setDisabledArtPacks(['alpha']);
      expect(localArtUrl('01001a')).toBe('/card-art/_art-zeta/z.png');
      setDisabledArtPacks(['alpha', 'zeta']);
      expect(localArtUrl('01001a')).toBe('/card-art/core/01001a.png');
    });

    it('switching back on restores the art, and an unknown id is ignored', () => {
      withArtPacks(alpha);
      setDisabledArtPacks(['alpha', 'not_installed']);
      expect(artPackArt('01001a')).toBeUndefined();
      setDisabledArtPacks(['not_installed']);
      expect(artPackArt('01001a')?.url).toBe('/card-art/_art-alpha/a.png');
    });

    it('a scenario token with its pack off has no art, which is the labelled card back', () => {
      withArtPacks(tokens);
      setDisabledArtPacks(['tokens']);
      expect(localArtUrl('ultron_drone')).toBe('');
    });
  });
});

describe('identity cards', () => {
  const loaded = getLoadedContent();
  afterEach(() => setLoadedContent(loaded));

  it('every identity side of a hero is its own card: several versions and a third face', () => {
    const identities = manifest('heroes', {
      '29001a': [{ file: '29001a.png' }],
      '29002b': [{ file: '29002b.png' }],
      '12001c': [{ file: '12001c.png' }],
      '31001a': [{ file: '31001a.png' }],
    });
    setLoadedContent({ ...loaded, artPacks: [identities] });
    const url = (file: string) => `/card-art/_art-heroes/${file}`;
    expect(artPackArt('29001a')?.url).toBe(url('29001a.png'));
    expect(artPackArt('29002b')?.url).toBe(url('29002b.png'));
    expect(artPackArt('12001c')?.url).toBe(url('12001c.png'));
    expect(artPackArt('31001a')?.url).toBe(url('31001a.png'));
    expect(artPackArt('29001b')).toBeUndefined();
    expect(artPackArt('01001a')).toBeUndefined();
  });
});


describe('packs tied to a hero', () => {
  const loaded = getLoadedContent();
  afterEach(() => {
    setLoadedContent(loaded);
    setDisabledArtPacks([]);
  });

  const IRON_MAN = '01029a';
  const SHE_HULK = '01019a';
  const BLACK_PANTHER = '01040a';
  const SHURI = '45001a';
  const SHARED_CARD = '01002';
  const heroPack = (id: string, heroes: string[], cards: ArtPackManifest['cards']) => ({
    ...manifest(id, cards),
    heroes,
  });
  const ironMan = heroPack('op_iron_man', [IRON_MAN], {
    [IRON_MAN]: [{ file: 'iron_man.png' }],
    [SHARED_CARD]: [{ file: 'iron_man_shared.png' }],
  });
  const sheHulk = heroPack('op_she_hulk', [SHE_HULK], {
    [SHE_HULK]: [{ file: 'she_hulk.png' }],
    [SHARED_CARD]: [{ file: 'she_hulk_shared.png' }],
  });
  const url = (id: string, file: string) => `/card-art/_art-${id}/${file}`;

  function withArtPacks(...artPacks: ArtPackManifest[]) {
    setLoadedContent({ ...loaded, artPacks });
  }

  it('Iron Man and She-Hulk seated: each hero shows its own hero pack on the shared card', () => {
    withArtPacks(ironMan, sheHulk);
    expect(artPackArt({ code: SHARED_CARD, heroCode: IRON_MAN })?.url).toBe(
      url('op_iron_man', 'iron_man_shared.png'),
    );
    expect(artPackArt({ code: SHARED_CARD, heroCode: SHE_HULK })?.url).toBe(
      url('op_she_hulk', 'she_hulk_shared.png'),
    );
  });

  it('She-Hulk alone: the Iron Man pack never applies, even when it is on', () => {
    withArtPacks(ironMan);
    expect(artPackArt({ code: SHARED_CARD, heroCode: SHE_HULK })).toBeUndefined();
    expect(localArtUrl({ code: IRON_MAN, heroCode: SHE_HULK })).toBe('/card-art/core/01029a.png');
    expect(artPackImageUrls({ code: SHARED_CARD, heroCode: SHE_HULK })).toEqual([]);
    expect(artPackHasStatImages({ code: SHARED_CARD, heroCode: SHE_HULK })).toBe(false);
  });

  it('a card with no hero owner never shows a pack tied to a hero, and a pack with none still does', () => {
    withArtPacks(ironMan, manifest('tokens', { [SHARED_CARD]: [{ file: 'plain.png' }] }));
    expect(artPackArt({ code: SHARED_CARD })?.url).toBe(url('tokens', 'plain.png'));
    expect(artPackArt({ code: IRON_MAN })).toBeUndefined();
  });

  it('the hero pack wins for its hero over a pack tied to no hero', () => {
    withArtPacks(
      manifest('aaa_plain', { [SHARED_CARD]: [{ file: 'plain.png' }] }),
      ironMan,
    );
    expect(artPackArt({ code: SHARED_CARD, heroCode: IRON_MAN })?.url).toBe(
      url('op_iron_man', 'iron_man_shared.png'),
    );
    expect(artPackArt({ code: SHARED_CARD, heroCode: SHE_HULK })?.url).toBe(
      url('aaa_plain', 'plain.png'),
    );
  });

  it('one pack listing both Black Panther versions applies to either, not to She-Hulk', () => {
    withArtPacks(
      heroPack('op_black_panther', [BLACK_PANTHER, SHURI], {
        [SHARED_CARD]: [{ file: 'panther.png' }],
      }),
    );
    expect(artPackArt({ code: SHARED_CARD, heroCode: BLACK_PANTHER })?.url).toBe(
      url('op_black_panther', 'panther.png'),
    );
    expect(artPackArt({ code: SHARED_CARD, heroCode: SHURI })?.url).toBe(
      url('op_black_panther', 'panther.png'),
    );
    expect(artPackArt({ code: SHARED_CARD, heroCode: SHE_HULK })).toBeUndefined();
  });

  it('two Black Panther packs, one per version: each applies only to its version', () => {
    withArtPacks(
      heroPack('op_tchalla', [BLACK_PANTHER], { [SHARED_CARD]: [{ file: 't.png' }] }),
      heroPack('op_shuri', [SHURI], { [SHARED_CARD]: [{ file: 's.png' }] }),
    );
    expect(artPackArt({ code: SHARED_CARD, heroCode: BLACK_PANTHER })?.url).toBe(
      url('op_tchalla', 't.png'),
    );
    expect(artPackArt({ code: SHARED_CARD, heroCode: SHURI })?.url).toBe(url('op_shuri', 's.png'));
  });

  it('a hero pack that is switched off shows official art, with its hero seated', () => {
    withArtPacks(ironMan);
    setDisabledArtPacks(['op_iron_man']);
    expect(localArtUrl({ code: IRON_MAN, heroCode: IRON_MAN })).toBe('/card-art/core/01029a.png');
  });

  it('two packs for one hero: the first by folder name wins a shared card', () => {
    withArtPacks(
      heroPack('op_a', [IRON_MAN], { [SHARED_CARD]: [{ file: 'a.png' }] }),
      heroPack('op_b', [IRON_MAN], { [SHARED_CARD]: [{ file: 'b.png' }] }),
    );
    expect(artPackArt({ code: SHARED_CARD, heroCode: IRON_MAN })?.url).toBe(url('op_a', 'a.png'));
  });
});

describe('loading packs tied to a hero', () => {
  it.each([
    ['an empty hero list', []],
    ['a duplicate hero code', ['99001a', '99001a']],
  ])('%s is an invalid art pack', async (_name, heroes) => {
    const driver = contentFolder({
      bad: { ...manifest('bad', { '99002': [{ file: 'a.png' }] }), heroes },
    });
    const content = await loadContent(driver, { artPacks: true });
    expect(content.failures.map((f) => f.packId)).toEqual(['art-pack:bad']);
  });

  it('a hero code in no installed pack, or on a card that is not a hero, gives one warning each', async () => {
    const driver = contentFolder({
      one: {
        ...manifest('one', { '99002': [{ file: 'a.png' }] }),
        heroes: ['99001a', '99999a', '99002'],
      },
    });
    const content = await loadContent(driver, { artPacks: true });
    expect(content.artPackWarnings.map((w) => w.reason)).toEqual([
      'hero 99999a is in no installed pack',
      'hero 99002 is not a hero card',
    ]);
  });

  it('the hero of an installed pack that is off gives no warning', async () => {
    const driver = contentFolder({
      one: { ...manifest('one', { '99002': [{ file: 'a.png' }] }), heroes: ['12001a'] },
    });
    writeOffPack();
    const content = await loadContent(driver, { artPacks: true });
    expect(content.artPackWarnings).toEqual([]);
  });

  it('packs tied to different heroes may list the same card without a warning', async () => {
    const driver = contentFolder({
      alpha: { ...manifest('alpha', { '99002': [{ file: 'a.png' }] }), heroes: ['99001a'] },
      zeta: { ...manifest('zeta', { '99002': [{ file: 'z.png' }] }), heroes: ['12001a'] },
    });
    writeOffPack();
    const content = await loadContent(driver, { artPacks: true });
    expect(content.artPackWarnings).toEqual([]);
  });

  it('packs that share a hero, and a card, still warn about the one that comes second', async () => {
    const driver = contentFolder({
      alpha: { ...manifest('alpha', { '99002': [{ file: 'a.png' }] }), heroes: ['99001a'] },
      zeta: { ...manifest('zeta', { '99002': [{ file: 'z.png' }] }), heroes: ['99001a'] },
    });
    const content = await loadContent(driver, { artPacks: true });
    expect(content.artPackWarnings).toMatchObject([
      { packId: 'art-pack:zeta', reason: expect.stringContaining('"alpha"') },
    ]);
  });
});