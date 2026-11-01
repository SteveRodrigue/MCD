import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadContent } from '../../src/data/content/loader';
import { NodeFsDriver } from '../../src/data/content/drivers/node-fs';
import { cardDetails, listCards, packMetadata, prepareSave } from '../../src/data/content/editor-model';

let root: string;
const write = (rel: string, data: unknown) => {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data));
};
const manifest = (id: string, origin: string) => ({
  id,
  name: id.toUpperCase(),
  kind: 'hero',
  origin,
  apiVersion: 1,
  version: '1.0.0',
  dependsOn: [],
});
const card = (code: string, extra: Record<string, unknown> = {}) => ({
  code,
  name: `Card ${code}`,
  pack_code: 'x',
  position: 1,
  quantity: 1,
  type_code: 'upgrade',
  faction_code: 'hero',
  ...extra,
});

afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

async function content() {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'mcd-editor-model-'));
  write('packs/mine/pack.json', manifest('mine', 'user'));
  write('packs/mine/cards/mine.json', [card('m1', { set_code: 'a' }), card('m2', { name: 'Zed' })]);
  write('packs/mine/supplemental/mine.json', { cards: { m1: { noSupplementalNeeded: true } } });
  write('packs/bundled/pack.json', manifest('bundled', 'official-bundled'));
  write('packs/bundled/cards/b_encounter.json', [card('b1', { type_code: 'event' })]);
  write('packs/synced/pack.json', manifest('synced', 'official-sync'));
  write('packs/synced/cards/s.json', [card('s1')]);
  return loadContent(new NodeFsDriver(root), { packs: ['mine', 'bundled', 'synced'] });
}

describe('editor model', () => {
  it('lists the cards of every loaded pack with the pack, file and writable flag', async () => {
    const all = listCards(await content(), {});
    expect(all.cards.map((c) => [c.code, c.packId, c.packFile, c.writable])).toEqual([
      ['b1', 'bundled', 'b_encounter.json', true],
      ['m1', 'mine', 'mine.json', true],
      ['m2', 'mine', 'mine.json', true],
      ['s1', 'synced', 's.json', false],
    ]);
  });

  it('filters by pack id, file, search and supplemental status', async () => {
    const c = await content();
    expect(listCards(c, { packId: 'mine' }).total).toBe(2);
    expect(listCards(c, { packFile: 's.json' }).cards.map((x) => x.code)).toEqual(['s1']);
    expect(listCards(c, { search: 'zed' }).cards.map((x) => x.code)).toEqual(['m2']);
    expect(listCards(c, { packId: 'mine', status: 'has_supplemental' }).cards.map((x) => x.code)).toEqual(['m1']);
    expect(listCards(c, { packId: 'mine', status: 'missing_supplemental' }).cards.map((x) => x.code)).toEqual(['m2']);
    expect(listCards(c, { limit: 2, page: 2 }).cards.map((x) => x.code)).toEqual(['m2', 's1']);
  });

  it('gives the pack selector every enabled pack and the writable rule per origin', async () => {
    const meta = packMetadata(await content(), { packs: [], sets: [], factions: [] });
    expect(meta.editorPacks.map((p) => [p.id, p.writable])).toEqual([
      ['mine', true],
      ['bundled', true],
      ['synced', false],
    ]);
    expect(meta.packFiles).toEqual(['b_encounter.json', 'mine.json', 's.json']);
  });

  it('returns details, including the owning pack', async () => {
    const d = cardDetails(await content(), 'm1');
    expect(d).toMatchObject({ packId: 'mine', packFile: 'mine.json', writable: true });
    expect(d?.validation.valid).toBe(true);
    expect(cardDetails(await content(), 'nope')).toBeNull();
  });

  it('prepares a save beside the card file and refuses a synced pack', async () => {
    const c = await content();
    const ok = prepareSave(c, 'b1', { supplemental: { noSupplementalNeeded: true } });
    expect(ok).toMatchObject({ ok: true, path: 'packs/bundled/supplemental/b_encounter.json' });
    expect(prepareSave(c, 's1', { supplemental: {} })).toMatchObject({ ok: false });
    expect(prepareSave(c, 'missing', { supplemental: {} })).toMatchObject({ ok: false });
  });

  it('applies the event rule: an event card cannot discard itself as a cost', async () => {
    const res = prepareSave(await content(), 'b1', {
      supplemental: { abilities: [{ id: 'a', timing: 'ACTION', cost: { discardSelf: true }, steps: [{ effect: 'DRAW' }] }] },
    });
    expect(res.ok).toBe(false);
  });
});
