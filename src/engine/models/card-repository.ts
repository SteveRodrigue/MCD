import type { GameState } from './state';
import type { CardType } from './enums';
import type { MainSchemeCard, NormalizedCard, VillainCard } from './card';

/**
 * The card catalog as the engine sees it (ADR-0087). The engine reads card definitions only
 * through this port, so a test or a future pack can hand it any catalog.
 */
export interface CardRepository {
  getCard(code: string): NormalizedCard | undefined;
  getCardsBySet(setCode: string): NormalizedCard[];
  getCardsByType(type: CardType): NormalizedCard[];
  getExpandedCardsBySet(setCode: string): NormalizedCard[];
  getNemesisCardsForHero(heroSetCode: string): NormalizedCard[];
  getVillainByStage(scenarioSetCode: string, stage: string): VillainCard | undefined;
  getMainSchemeByStage(scenarioSetCode: string, stage: string): MainSchemeCard | undefined;
}

/** The catalog a game was set up with (`setupGame`), kept by reference in `state.options`. */
export function getCatalog(state: GameState): CardRepository {
  const catalog = state.options?.catalog;
  if (!catalog) {
    throw new Error('GameState has no card catalog: create the game with setupGame({ catalog }).');
  }
  return catalog;
}
