import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { setupGame, createCardInstance } from '../../src/engine/state/game-setup';
import { dispatchAction } from '../../src/engine/pipeline/action-dispatcher';
import { canInitiateAbility } from '../../src/engine/pipeline/legality-checker';
import { GameState, HeroCard, AlterEgoCard, AllyCard, CardInstance } from '../../src/engine/models';

describe('Med Team (01080): heal 2 damage from a friendly character', () => {
  let state: GameState;
  let medTeam: CardInstance;

  beforeEach(() => {
    const spiderMan = cardCatalog.getCard('01001a') as HeroCard;
    const peter = cardCatalog.getCard('01001b') as AlterEgoCard;
    const captainMarvel = cardCatalog.getCard('01010a') as HeroCard;
    const carol = cardCatalog.getCard('01010b') as AlterEgoCard;

    state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Player 1',
          hero: spiderMan,
          alterEgo: peter,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
        {
          id: 'p2',
          name: 'Player 2',
          hero: captainMarvel,
          alterEgo: carol,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      skipMulligan: true,
    });
    state.players[0].currentForm = 'hero';
    state.players[0].activeFormCard = spiderMan;
    state.players[1].currentForm = 'hero';
    state.players[1].activeFormCard = captainMarvel;

    medTeam = createCardInstance(cardCatalog.getCard('01080')!);
    medTeam.tokens = { ...medTeam.tokens, counters: 3 };
    medTeam.counters = { medical: 3 };
    state.players[0].tableau.push(medTeam);
  });

  const ability = () => medTeam.card.enrichment!.abilities![0];

  it('is not usable when only the villain is damaged', () => {
    state.villain.health = state.villain.maxHealth - 3;

    const check = canInitiateAbility(state, 'p1', ability(), medTeam);

    expect(check.allowed).toBe(false);
    expect(check.reason).toMatch(/damage to heal/i);
  });

  it('cannot be aimed at the villain, and spends nothing when rejected', () => {
    state.villain.health = state.villain.maxHealth - 3;
    const villainHp = state.villain.health;

    const res = dispatchAction(state, {
      type: 'USE_CARD_ABILITY',
      playerId: 'p1',
      cardInstanceId: medTeam.instanceId,
      abilityId: 'med_team_heal',
      targetInstanceId: state.villain.instanceId,
    });

    expect(res.result.success).toBe(false);
    expect(res.state.villain.health).toBe(villainHp);
    expect(medTeam.exhausted).toBeFalsy();
    expect(medTeam.tokens?.counters).toBe(3);
  });

  it("heals another player's damaged ally by 2 and spends one medical counter", () => {
    const ally = createCardInstance(cardCatalog.getCard('01002') as AllyCard);
    ally.tokens = { damage: 2 };
    state.players[1].allies.push(ally);

    const res = dispatchAction(state, {
      type: 'USE_CARD_ABILITY',
      playerId: 'p1',
      cardInstanceId: medTeam.instanceId,
      abilityId: 'med_team_heal',
      targetInstanceId: ally.instanceId,
    });

    expect(res.result.success).toBe(true);
    const healed = res.state.players[1].allies.find((a) => a.instanceId === ally.instanceId)!;
    expect(healed.tokens?.damage ?? 0).toBe(0);
    const inPlay = res.state.players[0].tableau.find((c) => c.instanceId === medTeam.instanceId)!;
    expect(inPlay.exhausted).toBe(true);
    expect(inPlay.counters?.medical).toBe(2);
  });

  it('can heal a damaged hero identity in alter-ego form', () => {
    const p2 = state.players[1];
    p2.currentForm = 'alter_ego';
    p2.health = p2.maxHealth - 3;
    const before = p2.health;

    const res = dispatchAction(state, {
      type: 'USE_CARD_ABILITY',
      playerId: 'p1',
      cardInstanceId: medTeam.instanceId,
      abilityId: 'med_team_heal',
      targetInstanceId: p2.id,
    });

    expect(res.result.success).toBe(true);
    expect(res.state.players[1].health).toBe(before + 2);
  });
});
