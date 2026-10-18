import type { CardCatalog } from '../../data/importer/card-loader';
import modularSetData from './modular-sets.json';

export interface ModularEncounterSetInfo {
  code: string;
  name: string;
  description: string;
  cardCount: number;
}

/**
 * Modular encounter sets offered at scenario setup. Names and descriptions are not in the
 * upstream card data; card counts are read from the catalog.
 */
export function listModularEncounterSets(catalog: CardCatalog): ModularEncounterSetInfo[] {
  return modularSetData.map((set) => ({
    ...set,
    cardCount: catalog.getExpandedCardsBySet(set.code).length,
  }));
}
