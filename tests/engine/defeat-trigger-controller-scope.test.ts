import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard, CardInstance, TriggerFilter } from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { dispatchDefeat } from '@engine/triggers/defeat-dispatch';

/**
 * #363: a defeat ability with no scope of its own belongs to its controller ("your ally" is never
 * another player's ally). `targetPlayerScope: ANY` opts out; abilities that already name who
 * defeated (`defeatedByAttackOf`) or which card (`targetScope`) keep their own scoping.
 */
describe('Defeat trigger default scope is the controller (#363)', () => {
  let state: GameState;

  function allyWithDefeatAbility(triggerFilter?: TriggerFilter): CardInstance {
    const instance = createCardInstance(cardCatalog.getCard('01058')!);
    instance.card = {
      ...instance.card,
      enrichment: {
        abilities: [
          {
            id: 'test_defeat_draw',
            timing: 'FORCED_RESPONSE',
            trigger: 'CHARACTER_DEFEATED',
            ...(triggerFilter ? { triggerFilter } : {}),
            steps: [{ effect: 'DRAW', effectParams: { count: 1, target: 'SELF' } }],
          },
        ],
      },
    } as CardInstance['card'];
    return instance;
  }

  function defeatAllyOf(playerId: string): void {
    dispatchDefeat(state, {
      targetPlayerId: playerId,
      targetInstanceId: `ally_of_${playerId}`,
      targetType: 'ALLY',
    });
  }

  beforeEach(() => {
    state = setupGame({
      catalog: cardCatalog,
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: cardCatalog.getCard('01001a') as HeroCard,
          alterEgo: cardCatalog.getCard('01001b') as AlterEgoCard,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
        {
          id: 'p2',
          name: 'Iron Man',
          hero: cardCatalog.getCard('01029a') as HeroCard,
          alterEgo: cardCatalog.getCard('01029b') as AlterEgoCard,
          deckCards: Array(10).fill(cardCatalog.getCard('01030')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as never,
      mainScheme: cardCatalog.getCard('01097b') as never,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });
  });

  it('fires for the controller when their own character is defeated', () => {
    state.players[0].tableau = [allyWithDefeatAbility()];
    const before = state.players[0].hand.length;

    defeatAllyOf('p1');

    expect(state.players[0].hand.length).toBe(before + 1);
  });

  it('does not fire when another player character is defeated', () => {
    state.players[0].tableau = [allyWithDefeatAbility()];
    const before = state.players[0].hand.length;

    defeatAllyOf('p2');

    expect(state.players[0].hand.length).toBe(before);
  });

  it('fires for every controller with targetPlayerScope ANY', () => {
    state.players[0].tableau = [allyWithDefeatAbility({ targetPlayerScope: 'ANY' })];
    const before = state.players[0].hand.length;

    defeatAllyOf('p2');

    expect(state.players[0].hand.length).toBe(before + 1);
  });
});
