import { CardEnrichment } from '@engine/models';

/**
 * Supplemental Registry: Maps upstream card code to rules enrichment data.
 * Filled by the content loader (`applyContent`) from each pack's `supplemental/` folder.
 */
export const supplementalRegistry: Record<string, CardEnrichment> = {};

/** Replaces every registry entry, keeping the exported object identity stable. */
export function replaceSupplementalRegistry(entries: Record<string, CardEnrichment>): void {
  for (const code of Object.keys(supplementalRegistry)) delete supplementalRegistry[code];
  Object.assign(supplementalRegistry, entries);
}

/**
 * Helper to fetch enrichment data for a card code.
 */
export function getCardEnrichment(code: string): CardEnrichment | undefined {
  return supplementalRegistry[code];
}
