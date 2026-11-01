import type { CardEnrichment } from '@engine/models';
import { clearStarterDecks, registerStarterDecks } from '@engine/decks/starter-decks';
import { setModularSets } from '@engine/scenarios/modular-sets';
import { cardCatalog } from '../importer/card-loader';
import { replaceSupplementalRegistry } from '../supplemental';
import { clearLoadedContent, setLoadedContent } from './store';
import type { ContentDriver, LoadContentOptions, LoadedContent } from './types';
import { loadContent } from './loader';

/** Empties every singleton the content loader fills. */
export function resetContent(): void {
  replaceSupplementalRegistry({});
  cardCatalog.clear();
  setModularSets([]);
  clearStarterDecks();
  clearLoadedContent();
}

/**
 * Puts loaded packs into the engine singletons. Supplemental data goes first because card
 * registration bakes each card's enrichment in (`normalizeRawCard`).
 */
export function applyContent(content: LoadedContent): void {
  resetContent();
  const supplemental: Record<string, CardEnrichment> = {};
  for (const pack of content.packs) Object.assign(supplemental, pack.supplemental);
  replaceSupplementalRegistry(supplemental);
  cardCatalog.registerCards(content.packs.flatMap((pack) => pack.cards));
  setModularSets(content.packs.flatMap((pack) => pack.modularSets));
  registerStarterDecks(content.packs.flatMap((pack) => pack.decks));
  setLoadedContent(content);
}

/** Loads content once at startup and applies it. Never throws; failures are in the result. */
export async function bootContent(
  driver: ContentDriver,
  options?: LoadContentOptions,
): Promise<LoadedContent> {
  const content = await loadContent(driver, options);
  applyContent(content);
  return content;
}
