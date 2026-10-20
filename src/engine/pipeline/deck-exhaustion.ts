import { GameState, CardInstance } from '@engine/models';
import { shuffleArray } from '../state/rng';
import { appendLog } from '../state/game-log';

/**
 * Executes Encounter Deck Exhaustion (RR v1.8 p. 11).
 * 1. Unconditionally places 1 permanent acceleration token on the Main Scheme.
 * 2. Shuffles the encounter discard pile into the encounter deck.
 */
export function exhaustEncounterDeck(state: GameState): boolean {
  // 1. Unconditional penalty: +1 permanent acceleration token on Main Scheme
  state.accelerationTokens = (state.accelerationTokens || 0) + 1;

  appendLog(state, {
    category: 'phase',
    key: 'encounter.deck.empty',
    onomatopoeia: 'ACCELERATION!',
  });

  // 2. Reshuffle discard pile into encounter deck
  if (state.encounterDiscard.length > 0) {
    state.encounterDeck = shuffleArray(state, state.encounterDiscard);
    state.encounterDiscard = [];
    return true;
  }

  return false;
}

/**
 * Draws the top card from the encounter deck.
 * If the encounter deck is empty, triggers Encounter Deck Exhaustion before drawing (RR v1.8 p. 11).
 */
export function drawEncounterCard(state: GameState): CardInstance | undefined {
  if (state.encounterDeck.length === 0) {
    exhaustEncounterDeck(state);
  }
  return state.encounterDeck.shift();
}

/**
 * Checks if a player's deck is empty and resets it if discard pile has cards (RR v1.8 p. 18).
 * If discard pile is empty, marks deckEmptiedWithEmptyDiscard for deferred reset.
 * Returns true if the deck was reset, false otherwise.
 */
export function checkAndResetPlayerDeck(state: GameState, playerId: string): boolean {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return false;
  if (player.deck.length === 0) {
    if (player.discard.length > 0) {
      player.deckEmptiedWithEmptyDiscard = false;
      return exhaustPlayerDeck(state, playerId);
    } else {
      player.deckEmptiedWithEmptyDiscard = true;
    }
  }
  return false;
}

/**
 * Executes Player Deck Exhaustion (RR v1.8 p. 18).
 * 1. Guard: if player.discard.length === 0, marks deckEmptiedWithEmptyDiscard and returns false
 *    (do not reset, do not deal encounter card until a card enters discard).
 * 2. Shuffles the player's discard pile into their draw deck.
 * 3. Deals 1 facedown encounter card to that player.
 * 4. Logs player.deck.exhausted.
 * Returns true if reset executed.
 */
export function exhaustPlayerDeck(state: GameState, playerId: string): boolean {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return false;

  // Guard: if discard pile is empty, deck does not reset and no encounter card is dealt
  // until at least one card enters the discard pile (RR v1.8 glossary "Player Deck").
  if (player.discard.length === 0) {
    player.deckEmptiedWithEmptyDiscard = true;
    return false;
  }

  player.deckEmptiedWithEmptyDiscard = false;

  // 1. Reshuffle discard pile into player deck
  player.deck = shuffleArray(state, player.discard);
  player.discard = [];

  // 2. Penalty: Deal 1 facedown encounter card to that player
  const extraEncounter = drawEncounterCard(state);
  if (extraEncounter) {
    player.dealtEncounterCards.push(extraEncounter);
  }

  appendLog(state, {
    category: 'phase',
    key: 'player.deck.exhausted',
    params: { actor: player.name },
    onomatopoeia: 'EXTRA ENCOUNTER CARD!',
  });

  return true;
}

/**
 * Draws the top card from a player's draw deck.
 * If the deck is empty, triggers Player Deck Exhaustion before drawing (RR v1.8 p. 18).
 * If drawing empties the player deck, triggers immediate deck reset.
 */
export function drawPlayerCard(state: GameState, playerId: string): CardInstance | undefined {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return undefined;

  if (player.deck.length === 0) {
    if (player.discard.length > 0) {
      exhaustPlayerDeck(state, playerId);
    }
  }
  if (player.deck.length === 0) {
    return undefined;
  }

  const card = player.deck.shift();
  if (player.deck.length === 0) {
    checkAndResetPlayerDeck(state, playerId);
  }

  return card;
}

/**
 * Discards cards from the encounter deck one by one until a condition is met (RR v1.8 p. 11, 26).
 *
 * Every discarded card that does not match is put into `state.encounterDiscard` here, before any
 * reset, so it is part of the reshuffled deck if the deck runs out. The matching card is returned
 * in `found` (and is the last entry of `discarded`) but is not put into the discard pile: the
 * caller routes it. Its text decides where it goes (e.g. revealed).
 *
 * Invariant (RR v1.8 glossary "Encounter Deck"): if the encounter deck runs out before a matching
 * card is found, the discard STOPS with found: null and the effect is fulfilled; encounter deck
 * exhaustion (acceleration token and reshuffle) then triggers, and the discard does not continue
 * into the new deck.
 * If the target matches on the exact last card of the deck, deck exhaustion also triggers immediately.
 */
export function discardFromEncounterDeckUntil(
  state: GameState,
  predicate: (card: CardInstance) => boolean,
): { found: CardInstance | null; discarded: CardInstance[] } {
  const discarded: CardInstance[] = [];

  if (state.encounterDeck.length === 0) {
    exhaustEncounterDeck(state);
  }

  while (state.encounterDeck.length > 0) {
    const card = state.encounterDeck.shift()!;
    discarded.push(card);

    if (predicate(card)) {
      if (state.encounterDeck.length === 0) {
        exhaustEncounterDeck(state);
      }
      return { found: card, discarded };
    }
    state.encounterDiscard.push(card);

    if (state.encounterDeck.length === 0) {
      exhaustEncounterDeck(state);
      return { found: null, discarded };
    }
  }

  if (state.encounterDeck.length === 0) {
    exhaustEncounterDeck(state);
  }

  return { found: null, discarded };
}

/**
 * Discards cards from a player's deck one by one until a condition is met (RR v1.8 p. 18, 26).
 *
 * Invariant: If the player deck runs out of cards before finding a matching card,
 * the search/discard loop immediately STOPS and terminates with found: null.
 * Standard player deck exhaustion triggers sequentially AFTER the discard loop terminates.
 * If the target matches on the exact last card of the deck, deck exhaustion also triggers immediately.
 */
export function discardFromPlayerDeckUntil(
  state: GameState,
  playerId: string,
  predicate: (card: CardInstance) => boolean,
): { found: CardInstance | null; discarded: CardInstance[] } {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return { found: null, discarded: [] };

  if (player.deck.length === 0) {
    checkAndResetPlayerDeck(state, playerId);
  }

  const discarded: CardInstance[] = [];

  while (player.deck.length > 0) {
    const card = player.deck.shift()!;
    player.discard.push(card);
    discarded.push(card);

    if (predicate(card)) {
      if (player.deck.length === 0) {
        checkAndResetPlayerDeck(state, playerId);
      }
      return { found: card, discarded };
    }

    if (player.deck.length === 0) {
      checkAndResetPlayerDeck(state, playerId);
      return { found: null, discarded };
    }
  }

  if (player.deck.length === 0) {
    checkAndResetPlayerDeck(state, playerId);
  }

  return { found: null, discarded };
}

/**
 * Checks all players for deferred deck resets waiting for cards to enter their discard pile (RR v1.8 p. 18).
 */
export function checkDeckExhaustionInvariants(state: GameState): void {
  for (const player of state.players) {
    if (player.deckEmptiedWithEmptyDiscard && player.discard.length > 0) {
      player.deckEmptiedWithEmptyDiscard = false;
      exhaustPlayerDeck(state, player.id);
    }
  }
}
