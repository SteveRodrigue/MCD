import { describe, expect, it } from 'vitest';
import { setupGame } from '@engine/state/game-setup';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { StatusCard } from '@engine/models';
import { executeEffect } from '@engine/effects';

describe('REMOVE_STATUS additive effect (ADR-0058, RR v1.8 p. 28)', () => {
  it('removes a selected status and leaves other status cards intact', () => {
    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: cardCatalog.getCard('01001a')! as any,
          alterEgo: cardCatalog.getCard('01001b')! as any,
          deckCards: [cardCatalog.getCard('01005')!],
        },
      ],
      villain: cardCatalog.getCard('01094')! as any,
      mainScheme: cardCatalog.getCard('01097')! as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

    state.villain.statusCards = [StatusCard.STUNNED, StatusCard.CONFUSED];

    const result = executeEffect(
      state,
      {
        id: 'remove_stun',
        timing: 'ACTION',
        steps: [
          { effect: 'REMOVE_STATUS', effectParams: { status: 'STUNNED', target: 'VILLAIN' } },
        ],
      },
      { playerId: 'p1' },
    );

    expect(result.success).toBe(true);
    expect(result.mutatedState).toBe(true);
    expect(state.villain.statusCards).toEqual([StatusCard.CONFUSED]);
  });

  it('removes all supported statuses without mutating an already-clear target', () => {
    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: cardCatalog.getCard('01001a')! as any,
          alterEgo: cardCatalog.getCard('01001b')! as any,
          deckCards: [cardCatalog.getCard('01005')!],
        },
      ],
      villain: cardCatalog.getCard('01094')! as any,
      mainScheme: cardCatalog.getCard('01097')! as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

    state.villain.statusCards = [StatusCard.STUNNED, StatusCard.CONFUSED, StatusCard.TOUGH];

    const result = executeEffect(
      state,
      {
        id: 'remove_all_statuses',
        timing: 'ACTION',
        steps: [{ effect: 'REMOVE_STATUS', effectParams: { status: 'ALL', target: 'VILLAIN' } }],
      },
      { playerId: 'p1' },
    );

    expect(result.success).toBe(true);
    expect(state.villain.statusCards).toEqual([]);

    const noOp = executeEffect(
      state,
      {
        id: 'remove_missing_status',
        timing: 'ACTION',
        steps: [{ effect: 'REMOVE_STATUS', effectParams: { status: 'TOUGH', target: 'VILLAIN' } }],
      },
      { playerId: 'p1' },
    );

    expect(noOp.success).toBe(true);
    expect(noOp.mutatedState).toBe(false);
  });
});
