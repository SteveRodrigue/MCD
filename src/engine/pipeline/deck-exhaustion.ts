import { GameState, CardInstance } from '@engine/models';

/**
 * Executes Encounter Deck Exhaustion (RR v1.8 p. 11).
 * 1. Unconditionally places 1 permanent acceleration token on the Main Scheme.
 * 2. Shuffles the encounter discard pile into the encounter deck.
 */
export function exhaustEncounterDeck(state: GameState): void {
  // 1. Unconditional penalty: +1 permanent acceleration token on Main Scheme
  state.accelerationTokens = (state.accelerationTokens || 0) + 1;

  state.log.push({
    id: `log_${Date.now()}_accel`,
    timestamp: Date.now(),
    round: state.roundNumber,
    phase: state.phase,
    category: 'phase',
    key: 'encounter.deck.empty',
    onomatopoeia: 'ACCELERATION!',
  });

  // 2. Reshuffle discard pile into encounter deck
  if (state.encounterDiscard.length > 0) {
    state.encounterDeck = [...state.encounterDiscard].sort(() => Math.random() - 0.5);
    state.encounterDiscard = [];
  }
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
 * Executes Player Deck Exhaustion (RR v1.8 p. 18).
 * 1. Shuffles the player's discard pile into their draw deck.
 * 2. Unconditionally deals 1 facedown encounter card to that player.
 */
export function exhaustPlayerDeck(state: GameState, playerId: string): void {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return;

  // 1. Reshuffle discard pile into player deck
  if (player.discard.length > 0) {
    player.deck = [...player.discard].sort(() => Math.random() - 0.5);
    player.discard = [];
  }

  // 2. Unconditional penalty: Deal 1 facedown encounter card to that player
  const extraEncounter = drawEncounterCard(state);
  if (extraEncounter) {
    player.dealtEncounterCards.push(extraEncounter);
  }

  state.log.push({
    id: `log_${Date.now()}_player_exhaust_${player.id}`,
    timestamp: Date.now(),
    round: state.roundNumber,
    phase: state.phase,
    category: 'phase',
    key: 'player.deck.exhausted',
    params: { player: player.name },
    onomatopoeia: 'EXTRA ENCOUNTER CARD!',
  });
}

/**
 * Draws the top card from a player's draw deck.
 * If the deck is empty, triggers Player Deck Exhaustion before drawing (RR v1.8 p. 18).
 */
export function drawPlayerCard(state: GameState, playerId: string): CardInstance | undefined {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return undefined;

  if (player.deck.length === 0) {
    exhaustPlayerDeck(state, playerId);
  }

  return player.deck.shift();
}

/**
 * Discards cards from the encounter deck one by one until a condition is met (RR v1.8 p. 11, 26).
 *
 * Invariant: If the encounter deck runs out of cards before finding a matching card,
 * the search/discard loop immediately STOPS and terminates with found: null.
 * Standard encounter deck exhaustion triggers sequentially AFTER the discard loop terminates.
 */
export function discardFromEncounterDeckUntil(
  state: GameState,
  predicate: (card: CardInstance) => boolean,
): { found: CardInstance | null; discarded: CardInstance[] } {
  const discarded: CardInstance[] = [];

  while (state.encounterDeck.length > 0) {
    const card = state.encounterDeck.shift()!;
    discarded.push(card);

    if (predicate(card)) {
      return { found: card, discarded };
    }
  }

  // Target wasn't found and deck emptied. Action terminates.
  // Sequential exhaustion triggers:
  exhaustEncounterDeck(state);

  return { found: null, discarded };
}

/**
 * Discards cards from a player's deck one by one until a condition is met (RR v1.8 p. 18, 26).
 *
 * Invariant: If the player deck runs out of cards before finding a matching card,
 * the search/discard loop immediately STOPS and terminates with found: null.
 * Standard player deck exhaustion triggers sequentially AFTER the discard loop terminates.
 */
export function discardFromPlayerDeckUntil(
  state: GameState,
  playerId: string,
  predicate: (card: CardInstance) => boolean,
): { found: CardInstance | null; discarded: CardInstance[] } {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return { found: null, discarded: [] };

  const discarded: CardInstance[] = [];

  while (player.deck.length > 0) {
    const card = player.deck.shift()!;
    player.discard.push(card);
    discarded.push(card);

    if (predicate(card)) {
      return { found: card, discarded };
    }
  }

  // Target wasn't found and deck emptied. Action terminates.
  // Sequential exhaustion triggers:
  exhaustPlayerDeck(state, playerId);

  return { found: null, discarded };
}
