import { GameState, CardInstance } from '@engine/models';

/**
 * Generic Auxiliary Scenario Deck Primitives (ADR-0034, RR v1.8 Scenario Rules).
 * Supports modular named draw piles used by campaign scenarios (e.g. Thanos'
 * Infinity Gauntlet Deck, M.O.D.O.K.'s Holding Cell Deck, GMW's Market Deck,
 * Agents of S.H.I.E.L.D.'s Evidence Decks) without hardcoding any scenario-specific
 * state fields on GameState.
 */

/** Initializes (or resets) a named auxiliary deck and its matching discard pile. */
export function initializeAuxiliaryDeck(
  state: GameState,
  deckName: string,
  cards: CardInstance[],
): void {
  state.auxiliaryDecks[deckName] = [...cards];
  state.auxiliaryDiscards[deckName] = state.auxiliaryDiscards[deckName] || [];
}

/** Draws the top card from a named auxiliary deck, returning undefined if empty or unknown. */
export function drawFromAuxiliaryDeck(
  state: GameState,
  deckName: string,
): CardInstance | undefined {
  const deck = state.auxiliaryDecks[deckName];
  if (!deck || deck.length === 0) return undefined;
  return deck.shift();
}

/** Moves a card into a named auxiliary deck's discard pile. */
export function discardToAuxiliaryDeck(
  state: GameState,
  deckName: string,
  cardInstance: CardInstance,
): void {
  if (!state.auxiliaryDiscards[deckName]) state.auxiliaryDiscards[deckName] = [];
  state.auxiliaryDiscards[deckName].push(cardInstance);
}
