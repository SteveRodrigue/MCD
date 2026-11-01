import type { CardRepository } from '@engine/models';

export interface ModularEncounterSetInfo {
  code: string;
  name: string;
  description: string;
  cardCount: number;
}

interface ModularSetEntry {
  code: string;
  name: string;
  description: string;
}

let modularSets: ModularSetEntry[] = [];

/** Replaces the modular sets offered at setup. Called by the content loader. */
export function setModularSets(sets: ModularSetEntry[]): void {
  modularSets = sets;
}

/**
 * Modular encounter sets offered at scenario setup. Names and descriptions are not in the
 * upstream card data; card counts are read from the catalog.
 */
export function listModularEncounterSets(catalog: CardRepository): ModularEncounterSetInfo[] {
  return modularSets.map((set) => ({
    ...set,
    cardCount: catalog.getExpandedCardsBySet(set.code).length,
  }));
}
