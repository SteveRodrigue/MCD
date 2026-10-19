import { describe, it, expect } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { setupGame } from '@engine/state/game-setup';
import { dispatchAction } from '@engine/pipeline/action-dispatcher';
import { ACTION_HANDLERS } from '@engine/pipeline/actions';
import type { AlterEgoCard, GameAction, HeroCard } from '@engine/models';

describe('action dispatch registry', () => {
  const newState = () =>
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

  const ALL_ACTION_TYPES: GameAction['type'][] = [
    'RESOLVE_MULLIGAN',
    'CHANGE_FORM',
    'BASIC_RECOVER',
    'BASIC_ATTACK',
    'BASIC_THWART',
    'ALLY_ATTACK',
    'ALLY_THWART',
    'PLAY_CARD',
    'USE_CARD_ABILITY',
    'RESOLVE_DECISION_PROMPT',
    'DECLARE_DEFENDER',
    'END_PLAYER_TURN',
    'DEV_ADD_CARD_TO_HAND',
    'MINION_ENGAGES_PLAYER',
    'REVEAL_ENCOUNTER_CARD',
    'ADVANCE_VILLAIN_PHASE',
  ];

  it('registers a handler for every GameAction type', () => {
    expect(Object.keys(ACTION_HANDLERS).sort()).toEqual([...ALL_ACTION_TYPES].sort());
  });

  it.each(ALL_ACTION_TYPES)('has a function handler for %s', (actionType) => {
    expect(ACTION_HANDLERS[actionType]).toBeTypeOf('function');
  });

  it('fails an action that has no handler and leaves the state untouched', () => {
    const state = newState();
    const action = { type: 'NOT_A_REAL_ACTION', playerId: 'p1' } as unknown as GameAction;
    const { state: next, result } = dispatchAction(state, action);

    expect(result).toEqual({ success: false, error: 'Unknown action type' });
    expect(next).toBe(state);
  });
});
