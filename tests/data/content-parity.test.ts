import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { supplementalRegistry } from '../../src/data/supplemental';
import { getLoadedContent } from '../../src/data/content/store';
import { listStarterDecks } from '../../src/engine/decks';
import { listModularEncounterSets } from '../../src/engine/scenarios';
import { cardFile, packDir, supplementalFile } from '../../src/tools/content-paths';

// The loader must hand the engine exactly what the old static imports did: the Core Set cards
// (both files), their supplemental data, the five starter decks in the original order and the
// Core modular sets. Expected values are read straight from the files, not through the loader.
const read = (file: string) => JSON.parse(fs.readFileSync(file, 'utf-8'));

describe('content loader parity with the files on disk', () => {
  it('registers every Core Set card and nothing else', () => {
    const expected = [...read(cardFile('core')), ...read(cardFile('core_encounter'))].map(
      (c: { code: string }) => c.code,
    );
    expect(
      cardCatalog
        .getAllCards()
        .map((c) => c.code)
        .sort(),
    ).toEqual([...expected].sort());
  });

  it('registers the Core supplemental data of the enabled packs only', () => {
    const expected = Object.keys({
      ...read(supplementalFile('core')).cards,
      ...read(supplementalFile('core_encounter')).cards,
    });
    expect(Object.keys(supplementalRegistry).sort()).toEqual([...expected].sort());
  });

  it('keeps each supplemental entry exactly as written, key order included', () => {
    // The ability data hash (npm run simulate) is a JSON.stringify of these objects.
    const written = {
      ...read(supplementalFile('core')).cards,
      ...read(supplementalFile('core_encounter')).cards,
    };
    for (const [code, entry] of Object.entries(written)) {
      expect(JSON.stringify(supplementalRegistry[code]), code).toBe(JSON.stringify(entry));
    }
  });

  it('lists the starter decks in their original order', () => {
    expect(listStarterDecks().map((d) => d.id)).toEqual([
      'spider_man_justice',
      'captain_marvel_leadership',
      'she_hulk_aggression',
      'iron_man_aggression',
      'black_panther_protection',
    ]);
  });

  it('lists the modular sets of the Core pack', () => {
    const expected = read(path.join(packDir('core'), 'modular-sets.json')).map(
      (s: { code: string }) => s.code,
    );
    expect(listModularEncounterSets(cardCatalog).map((s) => s.code)).toEqual(expected);
  });

  it('loads only the packs enabled in content/config.json, without failures', () => {
    const loaded = getLoadedContent();
    expect(loaded.failures).toEqual([]);
    expect(loaded.packs.map((p) => p.id)).toEqual(['core']);
  });
});
