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

  it('multiplayer: Guard minion engaged with Player 1 does NOT prevent Player 2 from attacking the villain (RR v1.8 p. 15)', () => {
    const captainMarvelHero = cardCatalog.getCard('01010a') as HeroCard;
    const carolDanversAlterEgo = cardCatalog.getCard('01010b') as AlterEgoCard;

    const multiplayerState = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Player 1 (Spider-Man)',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
        {
          id: 'p2',
          name: 'Player 2 (Captain Marvel)',
          hero: captainMarvelHero,
          alterEgo: carolDanversAlterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

    multiplayerState.players[0].currentForm = 'hero';
    multiplayerState.players[0].activeFormCard = spiderManHero;
    multiplayerState.players[1].currentForm = 'hero';
    multiplayerState.players[1].activeFormCard = captainMarvelHero;

    // Engage Guard minion with Player 1 ONLY
    const guardMinion = createCardInstance(cardCatalog.getCard('01101')!); // Hydra Mercenary (Guard)
    multiplayerState.players[0].engagedMinions = [guardMinion];
    expect(multiplayerState.players[1].engagedMinions).toHaveLength(0);

    // Player 1 turn: Player 1 is blocked from attacking the villain
    multiplayerState.activePlayerIndex = 0;
    const p1VillainCheck = canBasicAttack(multiplayerState, 'p1', 'villain');
    expect(p1VillainCheck.allowed).toBe(false);
    expect(p1VillainCheck.reason).toContain('Guard');

    const p1MinionCheck = canBasicAttack(multiplayerState, 'p1', 'minion', guardMinion.instanceId);
    expect(p1MinionCheck.allowed).toBe(true);

    const p1AttackVillainRes = dispatchAction(multiplayerState, {
      type: 'BASIC_ATTACK',
      playerId: 'p1',
      targetType: 'villain',
    });
    expect(p1AttackVillainRes.result.success).toBe(false);

    // Player 2 turn: Player 2 is NOT engaged with Guard minion -> CAN attack villain!
    multiplayerState.activePlayerIndex = 1;
    const p2VillainCheck = canBasicAttack(multiplayerState, 'p2', 'villain');
    expect(p2VillainCheck.allowed).toBe(true);

    // Player 2 can also choose to attack Player 1's engaged minion
    const p2MinionCheck = canBasicAttack(multiplayerState, 'p2', 'minion', guardMinion.instanceId);
    expect(p2MinionCheck.allowed).toBe(true);

    // Dispatching attack on villain as Player 2 succeeds
    const p2AttackVillainRes = dispatchAction(multiplayerState, {
      type: 'BASIC_ATTACK',
      playerId: 'p2',
      targetType: 'villain',
    });
    expect(p2AttackVillainRes.result.success).toBe(true);
  });
});
