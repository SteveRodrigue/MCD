import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard, getActiveVillain, MinionCard } from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import {
  applyDamageToTarget,
  defeatMinionsBeyondHitPoints,
} from '@engine/pipeline/damage-pipeline';
import { isVillainAttackBlockedByGuard } from '@engine/pipeline/target-restrictions';

describe('Hydra Soldier (01182) Integration & Damage Pipeline Defeat', () => {
  let state: GameState;
  let spiderManHero: HeroCard;
  let peterParkerAlterEgo: AlterEgoCard;
  let hydraSoldierCard: MinionCard;

  beforeEach(() => {
    spiderManHero = cardCatalog.getCard('01001a') as HeroCard;
    peterParkerAlterEgo = cardCatalog.getCard('01001b') as AlterEgoCard;
    hydraSoldierCard = cardCatalog.getCard('01182') as MinionCard;

    state = setupGame({
      catalog: cardCatalog,
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Player 1',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: [cardCatalog.getCard('01005')!],
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

  it('enforces Guard keyword: player engaged with Hydra Soldier cannot attack the villain', () => {
    const soldierInstance = createCardInstance(hydraSoldierCard);
    state.players[0].engagedMinions.push(soldierInstance);

    expect(isVillainAttackBlockedByGuard(state.players[0])).toBe(true);
  });

  it('deals 1 facedown encounter card to the engaged player when defeated via combat damage', () => {
    const soldierInstance = createCardInstance(hydraSoldierCard);
    state.players[0].engagedMinions.push(soldierInstance);
    expect(state.players[0].dealtEncounterCards.length).toBe(0);

    const minionTarget = {
      type: 'minion' as const,
      entity: soldierInstance,
      name: soldierInstance.card.name,
      targetPlayerId: 'p1',
    };

    const res = applyDamageToTarget(state, {
      target: minionTarget,
      amount: 4,
      isAttack: true,
      sourcePlayerId: 'p1',
    });

    // Minion is defeated and moved to discard
    expect(res.result.targetDefeated).toBe(true);
    expect(
      state.players[0].engagedMinions.some((m) => m.instanceId === soldierInstance.instanceId),
    ).toBe(false);
    expect(state.encounterDiscard.some((c) => c.instanceId === soldierInstance.instanceId)).toBe(
      true,
    );

    // Engaged player received 1 facedown encounter card
    expect(state.players[0].dealtEncounterCards.length).toBe(1);
  });

  it('preserves Overkill: excess damage spills over to villain and When Defeated deals encounter card', () => {
    const soldierInstance = createCardInstance(hydraSoldierCard);
    state.players[0].engagedMinions.push(soldierInstance);

    const villain = getActiveVillain(state);
    const initialVillainHp = villain.health;

    const minionTarget = {
      type: 'minion' as const,
      entity: soldierInstance,
      name: soldierInstance.card.name,
      targetPlayerId: 'p1',
    };

    // Deal 7 damage with overkill to 4 HP minion
    const res = applyDamageToTarget(state, {
      target: minionTarget,
      amount: 7,
      isAttack: true,
      hasOverkill: true,
      sourcePlayerId: 'p1',
    });

    // Minion is defeated with 3 excess damage
    expect(res.result.targetDefeated).toBe(true);
    expect(res.result.excessDamage).toBe(3);

    // Villain takes 3 overkill damage
    expect(villain.health).toBe(initialVillainHp - 3);

    // Engaged player received 1 facedown encounter card
    expect(state.players[0].dealtEncounterCards.length).toBe(1);
  });

  it('deals 1 facedown encounter card when Hydra Soldier is defeated by defeatMinionsBeyondHitPoints', () => {
    const soldierInstance = createCardInstance(hydraSoldierCard);
    soldierInstance.tokens = { damage: 4 };
    state.players[0].engagedMinions.push(soldierInstance);

    defeatMinionsBeyondHitPoints(state);

    // Minion is defeated and discarded
    expect(
      state.players[0].engagedMinions.some((m) => m.instanceId === soldierInstance.instanceId),
    ).toBe(false);
    expect(state.encounterDiscard.some((c) => c.instanceId === soldierInstance.instanceId)).toBe(
      true,
    );

    // Engaged player received 1 facedown encounter card
    expect(state.players[0].dealtEncounterCards.length).toBe(1);
  });

  it('triggers encounter deck exhaustion (+1 acceleration token) if encounter deck is empty when dealing', () => {
    const soldierInstance = createCardInstance(hydraSoldierCard);
    state.players[0].engagedMinions.push(soldierInstance);

    // Empty encounter deck, put filler card in encounter discard
    const fillerCard = state.encounterDeck.pop()!;
    state.encounterDeck = [];
    state.encounterDiscard = [fillerCard];
    const initialAccel = state.accelerationTokens || 0;

    const minionTarget = {
      type: 'minion' as const,
      entity: soldierInstance,
      name: soldierInstance.card.name,
      targetPlayerId: 'p1',
    };

    applyDamageToTarget(state, {
      target: minionTarget,
      amount: 4,
      isAttack: true,
      sourcePlayerId: 'p1',
    });

    // Acceleration token placed due to deck exhaustion during dealing
    expect(state.accelerationTokens).toBe(initialAccel + 1);
    expect(state.players[0].dealtEncounterCards.length).toBe(1);
  });
});
