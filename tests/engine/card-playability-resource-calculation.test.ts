import { describe, it, expect } from 'vitest';
import { setupGame, createCardInstance } from '../../src/engine/state/game-setup';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { dispatchAction } from '../../src/engine/pipeline/action-dispatcher';
import { evaluateCardPlayability } from '../../src/engine/pipeline/legality-checker';
import { getEffectiveCardCost } from '../../src/engine/pipeline/cost-engine';
import { HeroCard, AlterEgoCard } from '../../src/engine/models';

describe('Card Playability Potential Resource Calculation (Issue #153, RR v1.8 p. 4, 15-16, 24)', () => {
  const smHero = cardCatalog.getCard('01001a') as HeroCard;
  const peterParkerAlterEgo = cardCatalog.getCard('01001b') as AlterEgoCard;

  function createTestState() {
    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: smHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      skipMulligan: true,
    });
    // Switch to Hero form so alter-ego Scientist ability is not active
    const heroState = dispatchAction(state, { type: 'CHANGE_FORM', playerId: 'p1' }).state;
    return heroState;
  }

  it('1. Helicarrier in tableau unused does NOT count toward maxPotentialResources (Issue #153)', () => {
    const state = createTestState();
    const player = state.players[0];

    // Put Helicarrier (01092, Action: reduce next card cost by 1) in tableau, ready and unused
    const helicarrier = createCardInstance(cardCatalog.getCard('01092')!);
    helicarrier.exhausted = false;
    player.tableau = [helicarrier];

    // Surveillance Team (01064, Cost 2 Support) and Haymaker (01074, 1 resource) in hand
    const surveillanceTeam = createCardInstance(cardCatalog.getCard('01064')!);
    const paymentCard = createCardInstance(cardCatalog.getCard('01074')!);
    player.hand = [surveillanceTeam, paymentCard];

    const playability = evaluateCardPlayability(state, player.id, surveillanceTeam);

    // Helicarrier is an Action ability, NOT a resource ability; it must not inflate maxPotentialResources
    expect(playability.maxPotentialResources).toBe(1);
    expect(playability.isPlayable).toBe(false);
    expect(playability.reasons).toContain('Cannot afford cost (Need 2, max available 1)');
  });

  it("2. When Helicarrier's action is triggered, getEffectiveCardCost reduces cost and card becomes playable", () => {
    const state = createTestState();
    const player = state.players[0];

    const helicarrier = createCardInstance(cardCatalog.getCard('01092')!);
    helicarrier.exhausted = false;
    player.tableau = [helicarrier];

    const surveillanceTeam = createCardInstance(cardCatalog.getCard('01064')!);
    const paymentCard = createCardInstance(cardCatalog.getCard('01074')!);
    player.hand = [surveillanceTeam, paymentCard];

    // Trigger Helicarrier's action ability
    const res = dispatchAction(state, {
      type: 'USE_CARD_ABILITY',
      playerId: player.id,
      cardInstanceId: helicarrier.instanceId,
      abilityId: 'helicarrier_action',
    });

    expect(res.result.success).toBe(true);
    const updatedState = res.state;
    const updatedPlayer = updatedState.players[0];

    // Helicarrier is now exhausted and player has active cost reduction
    expect(updatedPlayer.tableau[0].exhausted).toBe(true);
    expect(updatedPlayer.activeCostReductions?.length).toBe(1);

    // Effective cost is reduced from 2 to 1
    const costInfo = getEffectiveCardCost(updatedState, updatedPlayer, surveillanceTeam);
    expect(costInfo.effectiveCost).toBe(1);
    expect(costInfo.baseCost).toBe(2);
    expect(costInfo.totalReduction).toBe(1);

    // Surveillance Team is now playable with 1 resource in hand
    const playability = evaluateCardPlayability(updatedState, updatedPlayer.id, surveillanceTeam);
    expect(playability.maxPotentialResources).toBe(1);
    expect(playability.isPlayable).toBe(true);
    expect(playability.reasons).toEqual([]);
  });

  it('3. Other non-resource ACTION cards in tableau (e.g. Avengers Mansion 01091) do not count toward maxPotentialResources', () => {
    const state = createTestState();
    const player = state.players[0];

    // Avengers Mansion (01091, Action: exhaust to draw 1 card) ready in tableau
    const avengersMansion = createCardInstance(cardCatalog.getCard('01091')!);
    avengersMansion.exhausted = false;
    player.tableau = [avengersMansion];

    const surveillanceTeam = createCardInstance(cardCatalog.getCard('01064')!);
    const paymentCard = createCardInstance(cardCatalog.getCard('01074')!);
    player.hand = [surveillanceTeam, paymentCard];

    const playability = evaluateCardPlayability(state, player.id, surveillanceTeam);

    expect(playability.maxPotentialResources).toBe(1);
    expect(playability.isPlayable).toBe(false);
    expect(playability.reasons).toContain('Cannot afford cost (Need 2, max available 1)');
  });

  it('4. Genuine resource generators (Web-Shooter 01008 with counters) properly count toward maxPotentialResources when ready, but not when exhausted or at 0 counters', () => {
    const state = createTestState();
    const player = state.players[0];

    const webShooter = createCardInstance(cardCatalog.getCard('01008')!);
    webShooter.exhausted = false;
    webShooter.counters = { web: 3 };
    webShooter.tokens = { damage: 0, threat: 0, counters: 3 };
    player.tableau = [webShooter];

    const surveillanceTeam = createCardInstance(cardCatalog.getCard('01064')!);
    const paymentCard = createCardInstance(cardCatalog.getCard('01074')!);
    player.hand = [surveillanceTeam, paymentCard];

    // Subtest 4A: Ready with counters -> provides +1 resource (total: 1 from hand + 1 from Web-Shooter = 2)
    const playabilityReady = evaluateCardPlayability(state, player.id, surveillanceTeam);
    expect(playabilityReady.maxPotentialResources).toBe(2);
    expect(playabilityReady.isPlayable).toBe(true);
    expect(playabilityReady.reasons).toEqual([]);

    // Subtest 4B: Exhausted -> provides 0 resources
    webShooter.exhausted = true;
    const playabilityExhausted = evaluateCardPlayability(state, player.id, surveillanceTeam);
    expect(playabilityExhausted.maxPotentialResources).toBe(1);
    expect(playabilityExhausted.isPlayable).toBe(false);
    expect(playabilityExhausted.reasons).toContain('Cannot afford cost (Need 2, max available 1)');

    // Subtest 4C: Ready but 0 counters -> provides 0 resources
    webShooter.exhausted = false;
    webShooter.counters = { web: 0 };
    webShooter.tokens = { damage: 0, threat: 0, counters: 0 };
    const playabilityEmpty = evaluateCardPlayability(state, player.id, surveillanceTeam);
    expect(playabilityEmpty.maxPotentialResources).toBe(1);
    expect(playabilityEmpty.isPlayable).toBe(false);
    expect(playabilityEmpty.reasons).toContain('Cannot afford cost (Need 2, max available 1)');
  });
});
