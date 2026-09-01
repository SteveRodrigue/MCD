import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard, SideSchemeCard } from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { executeEffect } from '@engine/effects';
import { resolveDefenderDeclaration } from '@engine/pipeline/combat-pipeline';

describe('Standard Set & Modular Extra Activation Treacheries', () => {
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

  it('01186 Advance: Causes villain to scheme on demand', () => {
    const advanceCard = cardCatalog.getCard('01186')!;
    const advanceInst = createCardInstance(advanceCard);
    const initialThreat = state.mainScheme.threat;

    // Execute Advance
    const ability = advanceCard.enrichment!.abilities![0];
    const res = executeEffect(state, ability, { playerId: 'p1', sourceCardInstance: advanceInst });

    expect(res.success).toBe(true);
    // Scheme threat placed (base SCH 1 + boost cards)
    expect(res.state.mainScheme.threat).toBeGreaterThanOrEqual(initialThreat + 1);
  });

  it('01187 Assault: Causes villain to attack hero; surges if in alter-ego', () => {
    const assaultCard = cardCatalog.getCard('01187')!;
    const assaultInst = createCardInstance(assaultCard);
    const initialHp = state.players[0].health;

    // 1. In Hero Form -> Villain attacks
    const ability = assaultCard.enrichment!.abilities![0];
    const resHero = executeEffect(state, ability, { playerId: 'p1', sourceCardInstance: assaultInst });
    expect(resHero.success).toBe(true);
    expect(resHero.state.pendingDecisionPrompt).toBeDefined();

    // Resolve defender declaration to complete attack
    const resolvedHeroState = resolveDefenderDeclaration(resHero.state, { type: 'UNDEFENDED', playerId: 'p1' });
    expect(resolvedHeroState.players[0].health).toBeLessThan(initialHp);

    // 2. In Alter-Ego Form -> Surges (deals encounter card)
    state.players[0].currentForm = 'alter_ego';
    state.players[0].activeFormCard = peterParkerAlterEgo;
    const initialDealtCount = state.players[0].dealtEncounterCards.length;

    const resAlterEgo = executeEffect(state, ability, { playerId: 'p1', sourceCardInstance: assaultInst });
    expect(resAlterEgo.success).toBe(true);
    expect(resAlterEgo.state.players[0].dealtEncounterCards.length).toBe(initialDealtCount + 1);
  });

  it('01189 Gang-Up: Causes villain and each engaged minion to attack hero', () => {
    const gangUpCard = cardCatalog.getCard('01189')!;
    const gangUpInst = createCardInstance(gangUpCard);

    // Engage a minion
    const minionCard = cardCatalog.getCard('01101')!; // 1 ATK
    const minionInst = createCardInstance(minionCard);
    state.players[0].engagedMinions = [minionInst];

    const initialHp = state.players[0].health;
    const ability = gangUpCard.enrichment!.abilities![0];

    const res = executeEffect(state, ability, { playerId: 'p1', sourceCardInstance: gangUpInst });
    expect(res.success).toBe(true);
    expect(res.state.pendingDecisionPrompt).toBeDefined();

    // Resolve villain attack
    const resAfterVillain = resolveDefenderDeclaration(res.state, { type: 'UNDEFENDED', playerId: 'p1' });
    // Resolve minion attack
    const resAfterMinion = resolveDefenderDeclaration(resAfterVillain, { type: 'UNDEFENDED', playerId: 'p1' });

    // Both villain and minion attacked
    expect(resAfterMinion.players[0].health).toBeLessThanOrEqual(initialHp - 3);
  });

  it('01111 Explosion: Deals threat damage if Bomb Scare is in play, otherwise surges', () => {
    const explosionCard = cardCatalog.getCard('01111')!;
    const explosionInst = createCardInstance(explosionCard);
    const ability = explosionCard.enrichment!.abilities![0];

    // 1. When Bomb Scare (01109) is in play with 3 threat
    const bombScareCard = cardCatalog.getCard('01109') as SideSchemeCard;
    const bombScareInst = createCardInstance(bombScareCard);
    state.sideSchemes = [{ instanceId: bombScareInst.instanceId, card: bombScareCard, threat: 3 }];

    const initialHp = state.players[0].health;
    const resWithScheme = executeEffect(state, ability, { playerId: 'p1', sourceCardInstance: explosionInst });
    expect(resWithScheme.success).toBe(true);
    expect(resWithScheme.state.players[0].health).toBe(initialHp - 3);

    // 2. When Bomb Scare is not in play -> Surges
    state.sideSchemes = [];
    const initialDealt = state.players[0].dealtEncounterCards.length;
    const resNoScheme = executeEffect(state, ability, { playerId: 'p1', sourceCardInstance: explosionInst });
    expect(resNoScheme.success).toBe(true);
    expect(resNoScheme.state.players[0].dealtEncounterCards.length).toBe(initialDealt + 1);
  });

  it('01192 Masterplan: Places 4 threat on each side scheme, or searches encounter deck for one', () => {
    const masterplanCard = cardCatalog.getCard('01192')!;
    const masterplanInst = createCardInstance(masterplanCard);
    const ability = masterplanCard.enrichment!.abilities![0];

    // 1. With a side scheme in play
    const crowdControlCard = cardCatalog.getCard('01108') as SideSchemeCard;
    const crowdControlInst = createCardInstance(crowdControlCard);
    state.sideSchemes = [{ instanceId: crowdControlInst.instanceId, card: crowdControlCard, threat: 2 }];

    const resWithScheme = executeEffect(state, ability, { playerId: 'p1', sourceCardInstance: masterplanInst });
    expect(resWithScheme.success).toBe(true);
    expect(resWithScheme.state.sideSchemes[0].threat).toBe(6);

    // 2. Without side scheme -> finds side scheme in deck and reveals it
    state.sideSchemes = [];
    state.encounterDeck = [createCardInstance(crowdControlCard)];

    const resNoScheme = executeEffect(state, ability, { playerId: 'p1', sourceCardInstance: masterplanInst });
    expect(resNoScheme.success).toBe(true);
    expect(resNoScheme.state.sideSchemes.length).toBe(1);
  });

  it('01193 Under Fire: Deals 1 extra encounter card via surge and reveals top card', () => {
    const underFireCard = cardCatalog.getCard('01193')!;
    const underFireInst = createCardInstance(underFireCard);
    const ability = underFireCard.enrichment!.abilities![0];

    const initialDealt = state.players[0].dealtEncounterCards.length;
    const res = executeEffect(state, ability, { playerId: 'p1', sourceCardInstance: underFireInst });

    expect(res.success).toBe(true);
    expect(res.state.players[0].dealtEncounterCards.length).toBe(initialDealt + 2);
  });
});
