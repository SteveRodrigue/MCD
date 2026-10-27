import { describe, it, expect } from 'vitest';
import { overrideCard } from '../../support/card-overrides';
import { setupGame, createCardInstance } from '../../../src/engine/state/game-setup';
import { cardCatalog } from '../../../src/data/importer/card-loader';
import { dispatchAction } from '../../../src/engine/pipeline/action-dispatcher';
import { HeroCard, AlterEgoCard, getActiveVillain } from '../../../src/engine/models';
import { thaw } from '../../support/thaw-state';

describe('Powered Gauntlets (01038) Ability Cost & Resolution Contract (RR v1.8 p. 9, Issue #139)', () => {
  const ironManHero = cardCatalog.getCard('01029a') as HeroCard;
  const tonyStarkAlterEgo = cardCatalog.getCard('01029b') as AlterEgoCard;

  it('verifies Iron Man can activate Powered Gauntlets with 0 cards in hand and 0 resources, exhausts card, deals 1 damage (2 if Aerial), and fails when exhausted or in Alter-Ego', () => {
    const state = setupGame({
      catalog: cardCatalog,
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

    const initialVillainHp = getActiveVillain(heroState).health;

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
    expect(getActiveVillain(activationRes.state).health).toBe(initialVillainHp - 1);

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
    const armed = thaw(activationRes.state);
    armed.players[0].tableau.find((c) => c.instanceId === gauntletsInst.instanceId)!.exhausted =
      false;
    const currentHero = armed.players[0].hero as HeroCard;
    overrideCard(armed, currentHero, {
      traits: [...(currentHero.traits || []), 'Aerial'],
    });

    const aerialActivationRes = dispatchAction(armed, {
      type: 'USE_CARD_ABILITY',
      playerId: 'p1',
      cardInstanceId: gauntletsInst.instanceId,
      abilityId: 'powered_gauntlets',
    });

    expect(aerialActivationRes.result.success).toBe(true);
    // 2 damage dealt (initialVillainHp - 1 - 2 = initialVillainHp - 3)
    expect(getActiveVillain(aerialActivationRes.state).health).toBe(initialVillainHp - 3);
    expect(
      aerialActivationRes.state.players[0].tableau.find(
        (c) => c.instanceId === gauntletsInst.instanceId,
      )!.exhausted,
    ).toBe(true);
  });

  it('prompts to select enemy without leaking player seat designations into minion labels (Fixes #459)', () => {
    const blackPantherHero = cardCatalog.getCard('01040a') as HeroCard;
    const tChallaAlterEgo = cardCatalog.getCard('01040b') as AlterEgoCard;

    const state = setupGame({
      catalog: cardCatalog,
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Hero Seat 1 (Black Panther)',
          hero: blackPantherHero,
          alterEgo: tChallaAlterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
        {
          id: 'p2',
          name: 'Hero Seat 2 (Iron Man)',
          hero: ironManHero,
          alterEgo: tonyStarkAlterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      skipMulligan: true,
    });

    const ironManPlayer = state.players[1];
    ironManPlayer.currentForm = 'hero';

    // Put Powered Gauntlets in Iron Man's tableau
    const gauntletsInst = createCardInstance(cardCatalog.getCard('01038')!);
    ironManPlayer.tableau.push(gauntletsInst);

    // Engage Sandman with Player 1 and Hydra Mercenary with Player 2
    const sandman = createCardInstance(cardCatalog.getCard('01102')!);
    state.players[0].engagedMinions.push(sandman);

    const hydraMerc = createCardInstance(cardCatalog.getCard('01101')!);
    ironManPlayer.engagedMinions.push(hydraMerc);

    // Activate Powered Gauntlets
    const activationRes = dispatchAction(state, {
      type: 'USE_CARD_ABILITY',
      playerId: 'p2',
      cardInstanceId: gauntletsInst.instanceId,
      abilityId: 'powered_gauntlets',
    });

    expect(activationRes.result.success).toBe(true);
    expect(activationRes.state.pendingDecisionQueue?.length).toBe(1);

    const prompt = activationRes.state.pendingDecisionQueue![0];
    expect(prompt.title).toBe('Choose Target for Powered Gauntlets');

    // Labels should identify the enemy only, without seat prefix leakage like (Hero Seat 1 (Black Panther))
    const labels = prompt.options.map((o) => o.label);
    expect(labels).toContain('Sandman');
    expect(labels).toContain('Hydra Mercenary');
    expect(labels.some((l) => l.includes('Hero Seat'))).toBe(false);

    // Duplicate minions with identical names disambiguate with engaged hero
    const nextState = thaw(activationRes.state);
    const hydraMerc2 = createCardInstance(cardCatalog.getCard('01101')!);
    nextState.players[0].engagedMinions.push(hydraMerc2);

    // Ready Powered Gauntlets and re-activate
    nextState.players[1].tableau.find((c) => c.instanceId === gauntletsInst.instanceId)!.exhausted =
      false;
    nextState.players[1].usedAbilitiesThisRound = {};
    nextState.players[1].usedAbilitiesThisPhase = {};

    const dupRes = dispatchAction(nextState, {
      type: 'USE_CARD_ABILITY',
      playerId: 'p2',
      cardInstanceId: gauntletsInst.instanceId,
      abilityId: 'powered_gauntlets',
    });
    expect(dupRes.result.success).toBe(true);
    const dupPrompt = dupRes.state.pendingDecisionQueue![1];
    const dupLabels = dupPrompt.options.map((o) => o.label);
    expect(dupLabels).toContain('Sandman');
    expect(dupLabels).toContain('Hydra Mercenary (engaged with Black Panther)');
    expect(dupLabels).toContain('Hydra Mercenary (engaged with Iron Man)');
    expect(dupLabels.some((l) => l.includes('Hero Seat'))).toBe(false);
  });
});
