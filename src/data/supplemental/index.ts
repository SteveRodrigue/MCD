import { CardEnrichment } from '@engine/models';

import corePackSupplemental from './pack/core.json';
import coreEncounterPackSupplemental from './pack/core_encounter.json';

export interface PackSupplementalData {
  $schema?: string;
  cards: Record<string, CardEnrichment>;
}

/**
 * Supplemental Registry: Maps upstream card code to rules enrichment data.
 * Structured pack-by-pack matching upstream zzorba datasets (data/upstream/pack/).
 */
export const supplementalRegistry: Record<string, CardEnrichment> = {
  ...(corePackSupplemental.cards as Record<string, CardEnrichment>),
  ...(coreEncounterPackSupplemental.cards as Record<string, CardEnrichment>),
};

/**
 * Helper to fetch enrichment data for a card code.
 */
export function getCardEnrichment(code: string): CardEnrichment | undefined {
  return supplementalRegistry[code];
}
