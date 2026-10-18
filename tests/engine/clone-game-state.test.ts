import { describe, it, expect } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { setupGame } from '@engine/state/game-setup';
import { cloneGameState } from '@engine/models';
import type { AlterEgoCard, GameState, HeroCard } from '@engine/models';

// cloneGameState copies game data and shares immutable catalog card definitions
// (AUD-20261017-232534 F005).
describe('cloneGameState', () => {
  const newState = (): GameState =>
    setupGame({
      scenarioId: 'rhino',
      skipMulligan: true,
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: cardCatalog.getCard('01001a') as HeroCard,
          alterEgo: cardCatalog.getCard('01001b') as AlterEgoCard,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
    });

  it('shares catalog card definitions and copies everything else', () => {
    const state = newState();
    const clone = cloneGameState(state);

    expect(clone.players[0].hero).toBe(state.players[0].hero);
    expect(clone.players[0].hand[0].card).toBe(state.players[0].hand[0].card);
    expect(clone.players[0]).not.toBe(state.players[0]);
    expect(clone.players[0].hand[0]).not.toBe(state.players[0].hand[0]);

    clone.players[0].health -= 3;
    expect(state.players[0].health).toBe(clone.players[0].health + 3);
  });

  it('keeps JSON semantics: functions and undefined properties are dropped', () => {
    const state = newState();
    state.options = { ...state.options, shuffleFn: (cards) => cards };
    (state as unknown as Record<string, unknown>).leftover = undefined;

    const clone = cloneGameState(state);

    expect(clone).toEqual(JSON.parse(JSON.stringify(state)));
    expect('shuffleFn' in clone.options!).toBe(false);
    expect('leftover' in clone).toBe(false);
  });

  it('deep-copies a card object that is not a catalog definition', () => {
    const state = newState();
    const custom = { ...state.players[0].hand[0].card, cost: 9 };
    state.players[0].hand[0].card = custom;

    expect(cloneGameState(state).players[0].hand[0].card).not.toBe(custom);
  });
});
