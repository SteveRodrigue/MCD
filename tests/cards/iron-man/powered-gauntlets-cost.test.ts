import { describe, it, expect } from 'vitest';
import { setupGame, createCardInstance } from '../../../src/engine/state/game-setup';
import { cardCatalog } from '../../../src/data/importer/card-loader';
import { dispatchAction } from '../../../src/engine/pipeline/action-dispatcher';
import { HeroCard, AlterEgoCard } from '../../../src/engine/models';

describe('Powered Gauntlets (01038) Ability Cost & Resolution Contract (RR v1.8 p. 9, Issue #139)', () => {
  const ironManHero = cardCatalog.getCard('01029a') as HeroCard;
  const tonyStarkAlterEgo = cardCatalog.getCard('01029b') as AlterEgoCard;

  it('verifies Iron Man can activate Powered Gauntlets with 0 cards in hand and 0 resources, exhausts card, deals 1 damage (2 if Aerial), and fails when exhausted or in Alter-Ego', () => {
    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Iron Man',
          hero: ironManHero,
          alterEgo: tonyStarkAlterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      skipMulligan: true,
    });

    const player = state.players[0];

    // Put Powered Gauntlets (01038) into play in player's tableau
    const gauntletsCard = cardCatalog.getCard('01038')!;
    const gauntletsInst = createCardInstance(gauntletsCard);
    player.tableau.push(gauntletsInst);

    // Empty hand so player has 0 cards in hand and 0 resources
    player.hand = [];
    expect(player.hand.length).toBe(0);

    // 1. Cannot activate in Alter-Ego form (timing: HERO_ACTION)
    expect(player.currentForm).toBe('alter_ego');
    const alterEgoAttempt = dispatchAction(state, {
      type: 'USE_CARD_ABILITY',
      playerId: 'p1',
      cardInstanceId: gauntletsInst.instanceId,
      abilityId: 'powered_gauntlets',
    });
    expect(alterEgoAttempt.result.success).toBe(false);
    expect(alterEgoAttempt.result.error).toContain('Can only use this ability in Hero form');

    // 2. Change to Hero form
    const heroState = dispatchAction(state, { type: 'CHANGE_FORM', playerId: 'p1' }).state;
    const heroPlayer = heroState.players[0];
    expect(heroPlayer.currentForm).toBe('hero');
    expect(heroPlayer.hand.length).toBe(0);

    const initialVillainHp = heroState.villain.health;

    // 3. Activate Powered Gauntlets with 0 cards in hand and 0 resources
    const activationRes = dispatchAction(heroState, {
      type: 'USE_CARD_ABILITY',
      playerId: 'p1',
      cardInstanceId: gauntletsInst.instanceId,
      abilityId: 'powered_gauntlets',
    });

    expect(activationRes.result.success).toBe(true);

    // Verify Powered Gauntlets is exhausted in tableau
    const updatedGauntlets = activationRes.state.players[0].tableau.find(
      (c) => c.instanceId === gauntletsInst.instanceId,
    )!;
    expect(updatedGauntlets.exhausted).toBe(true);

    // Verify dealt 1 damage to Villain (Rhino)
    expect(activationRes.state.villain.health).toBe(initialVillainHp - 1);

    // 4. Cannot activate again while exhausted
    const exhaustedAttempt = dispatchAction(activationRes.state, {
      type: 'USE_CARD_ABILITY',
      playerId: 'p1',
      cardInstanceId: gauntletsInst.instanceId,
      abilityId: 'powered_gauntlets',
    });
    expect(exhaustedAttempt.result.success).toBe(false);
    expect(exhaustedAttempt.result.error).toContain('exhausted');

    // 5. Ready Powered Gauntlets, give Iron Man the Aerial trait, and verify 2 damage is dealt
    updatedGauntlets.exhausted = false;
    const currentHero = activationRes.state.players[0].hero as HeroCard;
    currentHero.traits = [...(currentHero.traits || []), 'Aerial'];

    const aerialActivationRes = dispatchAction(activationRes.state, {
      type: 'USE_CARD_ABILITY',
      playerId: 'p1',
      cardInstanceId: gauntletsInst.instanceId,
      abilityId: 'powered_gauntlets',
    });

    expect(aerialActivationRes.result.success).toBe(true);
    // 2 damage dealt (initialVillainHp - 1 - 2 = initialVillainHp - 3)
    expect(aerialActivationRes.state.villain.health).toBe(initialVillainHp - 3);
    expect(
      aerialActivationRes.state.players[0].tableau.find(
        (c) => c.instanceId === gauntletsInst.instanceId,
      )!.exhausted,
    ).toBe(true);
  });
});
