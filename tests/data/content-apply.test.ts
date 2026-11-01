import { describe, it, expect, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { getCardEnrichment } from '../../src/data/supplemental';
import { applyContent, bootContent, resetContent } from '../../src/data/content/apply';
import { getLoadedContent } from '../../src/data/content/store';
import { NodeFsDriver } from '../../src/data/content/drivers/node-fs';
import type { LoadedContent } from '../../src/data/content/types';
import { listStarterDecks } from '../../src/engine/decks';
import { getSpecialHandler } from '../../src/engine/specials/special-registry';
import { listModularEncounterSets } from '../../src/engine/scenarios';
import { contentDriver } from '../helpers/content';

const manifest = {
  id: 'tmp',
  name: 'tmp',
  kind: 'hero' as const,
  origin: 'user' as const,
  apiVersion: 1,
  version: '1.0.0',
  dependsOn: [],
};

const content: LoadedContent = {
  failures: [],
  packs: [
    {
      id: 'tmp',
      manifest,
      cards: [
        {
          code: '99001',
          name: 'Tester',
          pack_code: 'tmp',
          set_code: 'tester',
          faction_code: 'hero',
          type_code: 'hero',
          position: 1,
          quantity: 1,
        },
      ] as never,
      supplemental: { '99001': { noSupplementalNeeded: true } } as never,
      modularSets: [{ code: 'tmp_set', name: 'Tmp Set', description: 'x' }],
      decks: [{ id: 1, name: 'Tmp deck', hero_code: '99001', hero_name: 'Tester', slots: {} }] as never,
      cardCount: 1,
      supplementalCount: 1,
    },
  ],
};

// The shared setup file loaded the real content; put it back after this file's tests.
afterAll(async () => {
  await bootContent(contentDriver);
});

describe('applyContent', () => {
  it('fills the catalog, supplemental registry, modular sets and starter decks', () => {
    applyContent(content);
    expect(cardCatalog.getAllCards().map((c) => c.code)).toEqual(['99001']);
    expect(getCardEnrichment('99001')).toBeDefined();
    expect(listModularEncounterSets(cardCatalog).map((s) => s.code)).toEqual(['tmp_set']);
    expect(listStarterDecks().map((d) => d.heroName)).toEqual(['Tester']);
    expect(getLoadedContent()).toBe(content);
  });

  it('registers supplemental data before cards, so each card carries its enrichment', () => {
    applyContent(content);
    expect(cardCatalog.getCard('99001')?.enrichment).toEqual({ noSupplementalNeeded: true });
  });

  it('replaces earlier content instead of adding to it', () => {
    applyContent(content);
    applyContent({ packs: [], failures: [] });
    expect(cardCatalog.getAllCards()).toEqual([]);
    expect(getCardEnrichment('99001')).toBeUndefined();
    expect(listStarterDecks()).toEqual([]);
  });
});

describe('pack hooks', () => {
  it('registers the special handlers of the loaded packs and clears them on reset', async () => {
    await bootContent(contentDriver);
    expect(getSpecialHandler('WAKANDA_FOREVER')).toBeDefined();
    resetContent();
    expect(getSpecialHandler('WAKANDA_FOREVER')).toBeUndefined();
  });

  it('does not register the hooks of a pack that is not loaded', () => {
    applyContent(content);
    expect(getSpecialHandler('WAKANDA_FOREVER')).toBeUndefined();
  });
});

describe('resetContent', () => {
  it('leaves every singleton empty', () => {
    applyContent(content);
    resetContent();
    expect(cardCatalog.getAllCards()).toEqual([]);
    expect(listStarterDecks()).toEqual([]);
    expect(listModularEncounterSets(cardCatalog)).toEqual([]);
    expect(getLoadedContent()).toEqual({ packs: [], failures: [] });
  });

  it('is what an empty content root boots into', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mcd-content-empty-'));
    try {
      const booted = await bootContent(new NodeFsDriver(root));
      expect(booted).toEqual({ packs: [], failures: [] });
      expect(cardCatalog.getAllCards()).toEqual([]);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
