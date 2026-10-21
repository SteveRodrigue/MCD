import { describe, it, expect } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { setupGame } from '@engine/state/game-setup';
import { dispatchAction } from '@engine/pipeline/action-dispatcher';
import { updateGameState, getActiveVillain } from '@engine/models';
import { createCardInstance } from '@engine/state/card-instance';
import type { AlterEgoCard, GameState, HeroCard } from '@engine/models';

// updateGameState shares every branch an update leaves alone and never changes the previous state
// (ADR-0089, AUD-20261017-232534 R12).
describe('updateGameState', () => {
  const newState = (): GameState =>
    setupGame({
      catalog: cardCatalog,
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

  it('copies only the changed branch and leaves the previous state untouched', () => {
    const state = newState();
    const hand = state.players[0].hand;
    const health = state.players[0].health;

    const next = updateGameState(state, (draft) => {
      draft.players[0].health -= 3;
    });

    expect(state.players[0].health).toBe(health);
    expect(next.players[0].health).toBe(health - 3);
    expect(next.players[0]).not.toBe(state.players[0]);
    expect(next.players[0].hand).toBe(hand);
    expect(next.villains).toBe(state.villains);
    expect(next.players[0].hand[0].card).toBe(state.players[0].hand[0].card);
  });

  it('shares every branch when the update changes nothing', () => {
    const state = newState();

    const next = updateGameState(state, () => undefined);

    expect(next).toEqual(state);
    expect(next.players).toBe(state.players);
    expect(next.encounterDeck).toBe(state.encounterDeck);
  });

  it('freezes the next state so a later in-place write throws', () => {
    const next = updateGameState(newState(), (draft) => {
      draft.roundNumber += 1;
    });

    expect(() => {
      next.players[0].health = 1;
    }).toThrow();
  });

  it('a write to the active villain lands in the villains collection', () => {
    const before = newState();
    const next = updateGameState(before, (draft) => {
      getActiveVillain(draft).health -= 4;
    });

    expect(getActiveVillain(next).health).toBe(getActiveVillain(before).health - 4);
    expect(getActiveVillain(next)).toBe(
      next.villains.find((v) => v.instanceId === getActiveVillain(before).instanceId),
    );
  });

  it('a rejected action returns the previous state unchanged', () => {
    const state = newState();

    const rejected = dispatchAction(state, { type: 'END_PLAYER_TURN', playerId: 'nobody' });

    expect(rejected.result.success).toBe(false);
    expect(rejected.state).toBe(state);
  });

  it('an accepted action leaves the previous state untouched', () => {
    const state = newState();
    const before = JSON.stringify(state.players[0]);

    const accepted = dispatchAction(state, { type: 'END_PLAYER_TURN', playerId: 'p1' });

    expect(accepted.result.success).toBe(true);
    expect(JSON.stringify(state.players[0])).toBe(before);
    expect(accepted.state).not.toBe(state);
  });
  it('a recipe that returns another state after editing the draft keeps that state', () => {
    const state = newState();
    const replacement = updateGameState(state, (draft) => {
      draft.roundNumber += 5;
    });

    const next = updateGameState(state, (draft) => {
      draft.players[0].health = 1;
      return replacement;
    });

    expect(next.roundNumber).toBe(replacement.roundNumber);
    expect(next.players[0].health).toBe(replacement.players[0].health);
  });

  it('a rejected action dispatched from inside an update leaves the draft untouched', () => {
    const state = newState();
    const health = state.players[0].health;

    const next = updateGameState(state, (draft) => {
      const outcome = dispatchAction(draft, { type: 'END_PLAYER_TURN', playerId: 'nobody' });
      expect(outcome.result.success).toBe(false);
      expect(outcome.state).toBe(draft);
    });

    expect(next).toEqual(state);
    expect(next.players[0].health).toBe(health);
  });

  it('an empty-enrichment copy of a non-catalog card stays a plain, draftable object', () => {
    const plain = { ...(cardCatalog.getCard('01005') as object) } as never;
    const instance = createCardInstance(plain);
    expect(Object.getPrototypeOf(instance.card)).toBe(Object.prototype);
  });
});
