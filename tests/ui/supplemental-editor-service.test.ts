import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchPacksMetadata,
  fetchCards,
  fetchCardDetails,
  saveCardSupplemental,
  type EditorStorage,
} from '../../src/ui/services/supplemental-editor-service';
import { getLoadedContent } from '../../src/data/content/store';

/** An in-memory content root: reads come from `files`, writes land in `written`. */
function memoryStorage(files: Record<string, unknown> = {}) {
  const written: Record<string, unknown> = {};
  const storage: EditorStorage = {
    listFiles: async () => [],
    listDirs: async () => [],
    exists: async (p) => p in files,
    readJson: async (p) => {
      if (p in written) return written[p];
      if (p in files) return files[p];
      throw new Error(`missing ${p}`);
    },
    writeJson: vi.fn(async (p, data) => {
      written[p] = data;
    }),
  };
  return { storage, written };
}

// Rhino's existing entry: valid by construction (the loader checked it).
const validSupplemental = structuredClone(
  getLoadedContent().packs.find((p) => p.id === 'core')!.supplemental['01094'],
) as any;

describe('supplemental-editor-service', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('lists the loaded packs with their origin and whether the editor may write them', async () => {
    const { storage } = memoryStorage({
      'meta/packs.json': [{ code: 'core', name: 'Core Set' }],
      'meta/sets.json': [{ code: 'rhino', name: 'Rhino' }],
      'meta/factions.json': [{ code: 'hero', name: 'Hero' }],
    });
    const meta = await fetchPacksMetadata(storage);
    expect(meta.packs[0].code).toBe('core');
    expect(meta.sets.find((s) => s.code === 'rhino')?.pack_codes).toContain('core');
    expect(meta.packFiles).toContain('core.json');
    expect(meta.editorPacks).toContainEqual({
      id: 'core',
      name: 'Core Set',
      origin: 'official-bundled',
      writable: true,
    });
  });

  it('filters by pack id, set, faction and search, and pages the result', async () => {
    const byPack = await fetchCards({ packId: 'core' });
    expect(byPack.total).toBeGreaterThan(0);
    expect(byPack.cards.every((c) => c.packId === 'core')).toBe(true);
    expect((await fetchCards({ packId: 'nope' })).total).toBe(0);

    const rhino = await fetchCards({ set: 'rhino' });
    expect(rhino.cards.every((c) => c.setCode === 'rhino')).toBe(true);
    expect((await fetchCards({ search: '01001a' })).cards.map((c) => c.code)).toContain('01001a');

    const page = await fetchCards({ page: 2, limit: 25 });
    expect(page.cards).toHaveLength(25);
    expect(page.page).toBe(2);
    expect(page.total).toBeGreaterThan(25);
  });

  it('returns card details with the pack that owns the card', async () => {
    const details = await fetchCardDetails('01001a');
    expect(details.packId).toBe('core');
    expect(details.writable).toBe(true);
    expect(details.validation.valid).toBe(true);
    await expect(fetchCardDetails('no-such-card')).rejects.toThrow('no-such-card');
  });

  it('saves into the existing supplemental file of the card, keeping the other cards', async () => {
    const { storage, written } = memoryStorage({
      'packs/core/supplemental/core_encounter.json': {
        $schema: 'x',
        cards: { other: { comment: 'kept' } },
      },
    });
    const res = await saveCardSupplemental('01094', { supplemental: validSupplemental }, storage);
    expect(res.error).toBeUndefined();
    expect(res.success).toBe(true);
    expect(res.packFile).toBe('core_encounter.json');
    const file = written['packs/core/supplemental/core_encounter.json'] as any;
    expect(file.cards.other).toEqual({ comment: 'kept' });
    expect(file.cards['01094'].noSupplementalNeeded).toBe(true);
    expect(file.cards['01094'].audit.updatedAt).toBe(res.updatedAt);
  });

  it('refuses invalid data and unsafe file names without writing', async () => {
    const { storage } = memoryStorage();
    const bad = await saveCardSupplemental('01094', { supplemental: { abilities: 5 } }, storage);
    expect(bad.success).toBe(false);
    expect(bad.errors?.length).toBeGreaterThan(0);

    const escape = await saveCardSupplemental(
      '01094',
      { packFile: '../../escaped.json', supplemental: validSupplemental },
      storage,
    );
    expect(escape.success).toBe(false);
    expect(escape.error).toContain('Invalid pack file name');
    expect(storage.writeJson).not.toHaveBeenCalled();
  });

  it('reports a write the endpoint refused', async () => {
    const { storage } = memoryStorage();
    vi.mocked(storage.writeJson).mockRejectedValueOnce(new Error('Pack "core" is read-only'));
    const res = await saveCardSupplemental('01094', { supplemental: validSupplemental }, storage);
    expect(res).toEqual({ success: false, error: 'Pack "core" is read-only' });
  });

  it('keeps the loaded data in step so the list shows the saved card', async () => {
    const { storage } = memoryStorage();
    const pack = getLoadedContent().packs.find((p) => p.id === 'core')!;
    const before = pack.supplemental['01094'];
    try {
      delete pack.supplemental['01094'];
      expect((await fetchCardDetails('01094')).supplemental).toBeUndefined();
      await saveCardSupplemental('01094', { supplemental: validSupplemental }, storage);
      expect((await fetchCardDetails('01094')).supplemental.noSupplementalNeeded).toBe(true);
    } finally {
      pack.supplemental['01094'] = before;
    }
  });
});
