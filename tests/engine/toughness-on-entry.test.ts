import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard, StatusCard } from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { dispatchAction } from '@engine/pipeline';
import { executeEffect } from '@engine/effects';

const LUKE_CAGE = '01076'; // ally, "Toughness."
const SANDMAN = '01102'; // minion, "Toughness."

/** Toughness: "This character enters play with a tough status card" (RR v1.8, #253 / #283). */
describe('Toughness: a character enters play with a tough status card', () => {
  let state: GameState;

  beforeEach(() => {
    const hero = cardCatalog.getCard('01001a') as HeroCard;
    const alterEgo = cardCatalog.getCard('01001b') as AlterEgoCard;
    state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Player 1',
          hero,
          alterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });
    state.players[0].currentForm = 'hero';
    state.players[0].activeFormCard = hero;
  });

  it('an ally played from hand (Luke Cage) enters play tough', () => {
    const luke = createCardInstance(cardCatalog.getCard(LUKE_CAGE)!);
    const payment = [1, 2, 3, 4].map(() => createCardInstance(cardCatalog.getCard('01088')!));
    state.players[0].hand = [luke, ...payment];

    const res = dispatchAction(state, {
      type: 'PLAY_CARD',
      playerId: 'p1',
      cardInstanceId: luke.instanceId,
      paymentCardInstanceIds: payment.map((c) => c.instanceId),
    });

    expect(res.result.success).toBe(true);
    const inPlay = res.state.players[0].allies.find((a) => a.instanceId === luke.instanceId);
    expect(inPlay?.statusCards).toEqual([StatusCard.TOUGH]);
  });

  it('an ally put into play by an effect (PUT_INTO_PLAY from the discard pile) enters play tough', () => {
    const luke = createCardInstance(cardCatalog.getCard(LUKE_CAGE)!);
    state.players[0].discard = [luke];

    const result = executeEffect(
      state,
      {
        id: 'test_put_into_play',
        timing: 'ACTION' as const,
        steps: [
          {
            effect: 'PUT_INTO_PLAY',
            effectParams: { from: 'DISCARD', to: 'ALLIES', filter: { code: LUKE_CAGE } },
          },
        ],
      },
      { playerId: 'p1' },
    );

    expect(result.success).toBe(true);
    const inPlay = result.state.players[0].allies.find((a) => a.instanceId === luke.instanceId);
    expect(inPlay?.statusCards).toEqual([StatusCard.TOUGH]);
  });

  it('an ally without Toughness enters play with no status card', () => {
    const maria = createCardInstance(cardCatalog.getCard('01058')!); // Daredevil
    const payment = [1, 2, 3, 4].map(() => createCardInstance(cardCatalog.getCard('01088')!));
    state.players[0].hand = [maria, ...payment];

    const res = dispatchAction(state, {
      type: 'PLAY_CARD',
      playerId: 'p1',
      cardInstanceId: maria.instanceId,
      paymentCardInstanceIds: payment.map((c) => c.instanceId),
    });

    expect(res.result.success).toBe(true);
    expect(res.state.players[0].allies[0].statusCards ?? []).toEqual([]);
  });

  it('a minion with Toughness (Sandman) still enters play tough', () => {
    const sandman = createCardInstance(cardCatalog.getCard(SANDMAN)!);
    state.players[0].setAsideCards = [sandman];
    const second = executeEffect(
      state,
      {
        id: 'test_put_minion',
        timing: 'ACTION' as const,
        steps: [
          {
            effect: 'PUT_INTO_PLAY',
            effectParams: {
              from: 'SET_ASIDE',
              to: 'ENGAGED_WITH_PLAYER',
              filter: { code: SANDMAN },
            },
          },
        ],
      },
      { playerId: 'p1' },
    );
    const inPlay = second.state.players[0].engagedMinions.find(
      (m) => m.instanceId === sandman.instanceId,
    );
    expect(inPlay?.statusCards).toEqual([StatusCard.TOUGH]);
  });
});
