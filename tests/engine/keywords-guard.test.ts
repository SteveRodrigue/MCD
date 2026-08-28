import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard } from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { canBasicAttack } from '@engine/pipeline/legality-checker';
import { dispatchAction } from '@engine/pipeline';

describe('Keyword: Guard (Rules Reference v1.8 p. 16)', () => {
  let state: GameState;
  let spiderManHero: HeroCard;
  let peterParkerAlterEgo: AlterEgoCard;

  beforeEach(() => {
    spiderManHero = cardCatalog.getCard('01001a') as HeroCard;
    peterParkerAlterEgo = cardCatalog.getCard('01001b') as AlterEgoCard;

    state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Player 1',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

    state.players[0].currentForm = 'hero';
    state.players[0].activeFormCard = spiderManHero;
  });

  it('Hydra Mercenary (01101) with Guard prevents attacking the villain', () => {
    const minionCard = cardCatalog.getCard('01101')!;
    const minionInstance = createCardInstance(minionCard);

    state.players[0].engagedMinions = [minionInstance];

    // Cannot basic attack villain
    const check = canBasicAttack(state, 'p1', 'villain');
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain('Guard');

    // Attempting to dispatch attack on villain fails
    const res = dispatchAction(state, {
      type: 'BASIC_ATTACK',
      playerId: 'p1',
      targetType: 'villain',
    });
    expect(res.result.success).toBe(false);

    // Can attack the Guard minion directly
    const minionCheck = canBasicAttack(state, 'p1', 'minion', minionInstance.instanceId);
    expect(minionCheck.allowed).toBe(true);

    // Defeating minion unlocks attack on villain
    state.players[0].engagedMinions = [];
    const unlockedCheck = canBasicAttack(state, 'p1', 'villain');
    expect(unlockedCheck.allowed).toBe(true);
  });
});
