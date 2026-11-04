import type { CardRepository, NormalizedCard } from '@engine/models';
import type { EncounterSetKind, EncounterSets } from '../../data/packs/scenario-definition';

export interface EncounterSetInfo {
  code: string;
  kind: EncounterSetKind;
  name: string;
  description: string;
  cardCount: number;
}

let encounterSets: EncounterSets = [];

/** Replaces the encounter sets offered at setup. Called by the content loader. */
export function setEncounterSets(sets: EncounterSets): void {
  encounterSets = sets;
}

/**
 * The cards a set adds to a deck, by printed quantity. The back of a double-sided card is the same
 * physical card, so it is not a card of its own.
 */
export function listEncounterDeckCards(catalog: CardRepository, setCode: string): NormalizedCard[] {
  return catalog.getExpandedCardsBySet(setCode).filter((card) => !card.raw?.hidden);
}

/** The codes of the enabled packs' sets of one kind, in load order (Core first). */
export function listEncounterSetCodes(kind: EncounterSetKind): string[] {
  return encounterSets.filter((set) => set.kind === kind).map((set) => set.code);
}

/**
 * Encounter sets of one kind offered at scenario setup. Names and descriptions are not in the
 * upstream card data; card counts are read from the catalog.
 */
export function listEncounterSets(
  catalog: CardRepository,
  kind: EncounterSetKind,
): EncounterSetInfo[] {
  return encounterSets
    .filter((set) => set.kind === kind)
    .map((set) => ({ ...set, cardCount: listEncounterDeckCards(catalog, set.code).length }));
}

/** The display name a pack gives an encounter set, if it lists that set. */
export function findEncounterSetName(code: string): string | undefined {
  return encounterSets.find((set) => set.code === code)?.name;
}
