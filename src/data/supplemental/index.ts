import { CardEnrichment } from '@engine/models';

import aoaEncounterPackSupplemental from '../../../content/packs/aoa/supplemental/aoa_encounter.json';
import corePackSupplemental from '../../../content/packs/core/supplemental/core.json';
import coreEncounterPackSupplemental from '../../../content/packs/core/supplemental/core_encounter.json';
import cwEncounterPackSupplemental from '../../../content/packs/cw/supplemental/cw_encounter.json';
import mtsPackSupplemental from '../../../content/packs/mts/supplemental/mts.json';

/**
 * Supplemental Registry: Maps upstream card code to rules enrichment data.
 * Structured pack-by-pack matching upstream zzorba datasets (data/upstream/pack/).
 */
export const supplementalRegistry: Record<string, CardEnrichment> = {
  ...(aoaEncounterPackSupplemental.cards as Record<string, CardEnrichment>),
  ...(corePackSupplemental.cards as Record<string, CardEnrichment>),
  ...(coreEncounterPackSupplemental.cards as Record<string, CardEnrichment>),
  ...(cwEncounterPackSupplemental.cards as Record<string, CardEnrichment>),
  ...(mtsPackSupplemental.cards as Record<string, CardEnrichment>),
};

/**
 * Helper to fetch enrichment data for a card code.
 */
export function getCardEnrichment(code: string): CardEnrichment | undefined {
  return supplementalRegistry[code];
}
