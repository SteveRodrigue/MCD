import { describe, it, expect, afterEach } from 'vitest';
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
import { getLoadedContent, setLoadedContent } from '../../src/data/content/store';
import type { ArtPackManifest } from '../../src/data/packs/art-pack';
import { ScenarioRegistry } from '../../src/engine/scenarios';

const credit = { author: 'A', sourceUrl: 'https://example.com/a', unofficial: true };
const mk = (n: number) => ({ file: `mk${n}.png`, attack: n, hitPoints: n });
const manifest = (id: string, cards: ArtPackManifest['cards']): ArtPackManifest => ({
  id,
  name: id,
  credit,
  cards,
});

let root: string | undefined;

function contentFolder(artPacks: Record<string, unknown>): NodeFsDriver {
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
  for (const [id, data] of Object.entries(artPacks)) write(`art-packs/${id}/art-pack.json`, data);
  return new NodeFsDriver(root);
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
    ['a missing credit', { id: 'bad', name: 'bad', cards: {} }],
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

  it('warns about a card that is not loaded', async () => {
    const driver = contentFolder({ one: manifest('one', { '99999': [{ file: 'a.png' }] }) });
    const content = await loadContent(driver, { artPacks: true });
    expect(content.artPacks).toHaveLength(1);
    expect(content.artPackWarnings[0].reason).toContain('99999');
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

  it('warns when two art packs list the same card, naming the one used', async () => {
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
  afterEach(() => setLoadedContent(loaded));

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
    expect(artPackArt('ultron_drone', { attack, hitPoints })?.url).toBe(url(file));
  });

  it.each([
    ['a temporary ATK boost', 3, 2, 'mk2.png'],
    ['a hit point attachment', 1, 4, 'mk1.png'],
    ['ATK 0, below every mark', 0, 1, 'mk1.png'],
    ['stats above every mark', 7, 7, 'mk4.png'],
  ])('S3 edge: %s', (_name, attack, hitPoints, file) => {
    withArtPacks(tokens);
    expect(artPackArt('ultron_drone', { attack, hitPoints })?.url).toBe(url(file));
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
});
