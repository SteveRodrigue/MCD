import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import {
  HeroCard,
  AlterEgoCard,
  VillainCard,
  MainSchemeCard,
  CardType,
  NormalizedCard,
  GamePhase,
  GameState,
  CardInstance,
} from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { getEffectiveAllyStats, getEffectiveHeroStats } from '@engine/pipeline/stat-calculator';
import { canInitiateAbility } from '@engine/pipeline/legality-checker';
import { dispatchAction } from '@engine/pipeline/action-dispatcher';
import { resolveDecisionPrompt } from '@engine/pipeline/prompt-queue';
import { endPlayerPhase } from '@engine/pipeline/player-phase';
import { executeVillainPhase } from '@engine/pipeline/villain-phase';
import { executeEffect } from '@engine/effects';

describe('Feature Delivery: Vision (01068) Once-Per-Round Limit & Temporary Stat Modifiers (Issue #119)', () => {
  const spiderManHero = cardCatalog.getCard('01001a') as HeroCard;
  const peterParkerAlterEgo = cardCatalog.getCard('01001b') as AlterEgoCard;
  const rhinoVillain = cardCatalog.getCard('01094') as VillainCard;
  const mainScheme = cardCatalog.getCard('01097b') as MainSchemeCard;

  const energyCard: NormalizedCard = {
    ...cardCatalog.getCard('01005')!,
    code: 'test_energy_resource',
    name: 'Energy Resource',
    type: CardType.RESOURCE,
    cost: 0,
    resources: { physical: 0, energy: 1, mental: 0, wild: 0, total: 1 },
  };

  let gameState: GameState;
  let visionInstance: CardInstance;

  beforeEach(() => {
    gameState = setupGame({
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: [],
        },
      ],
      villain: rhinoVillain,
      mainScheme: mainScheme,
      skipMulligan: true,
    });
    gameState.phase = GamePhase.PLAYER_PHASE;
    gameState.activePlayerIndex = 0;

    const visionDef = cardCatalog.getCard('01068')!;
    visionInstance = createCardInstance(visionDef);
    gameState.players[0].allies.push(visionInstance);
  });

  it('1. Vision starts with printed base stats (2 ATK, 1 THW)', () => {
    const stats = getEffectiveAllyStats(gameState, visionInstance);
    expect(stats.attack).toBe(2);
    expect(stats.thwart).toBe(1);
  });

  it('2. Triggering Vision spends 1 energy resource and opens decision prompt', () => {
    const player = gameState.players[0];
    const energyInstance = createCardInstance(energyCard);
    player.hand.push(energyInstance);

    const visionAbility = visionInstance.card.enrichment!.abilities![0];
    expect(visionAbility.limit).toBe('ONCE_PER_ROUND');

    // Verify ability is legal to trigger
    const legality = canInitiateAbility(gameState, player.id, visionAbility, visionInstance);
    expect(legality.allowed).toBe(true);

    // Trigger action via action-dispatcher
    const actionRes = dispatchAction(gameState, {
      type: 'USE_CARD_ABILITY',
      playerId: player.id,
      abilityId: visionAbility.id,
      cardInstanceId: visionInstance.instanceId,
      paymentCardInstanceIds: [energyInstance.instanceId],
    });
    expect(actionRes.result.success).toBe(true);
    gameState = actionRes.state;

    // Verify energy was spent from hand
    expect(gameState.players[0].hand.some((c) => c.instanceId === energyInstance.instanceId)).toBe(
      false,
    );

    // Verify decision prompt is opened
    expect(gameState.pendingDecisionPrompt).toBeDefined();
    expect(gameState.pendingDecisionPrompt?.sourceCardName).toBe('Vision');
    expect(gameState.pendingDecisionPrompt?.options.length).toBe(2);

    const thwOption = gameState.pendingDecisionPrompt?.options.find((o) => o.id === 'boost_thw');
    const atkOption = gameState.pendingDecisionPrompt?.options.find((o) => o.id === 'boost_atk');
    expect(thwOption).toBeDefined();
    expect(atkOption).toBeDefined();
  });

  it('3. Selecting +2 THW gives Vision +2 THW (total 3 THW, 2 ATK) for this phase', () => {
    const player = gameState.players[0];
    player.hand.push(createCardInstance(energyCard));
    const visionAbility = visionInstance.card.enrichment!.abilities![0];

    const actionRes = dispatchAction(gameState, {
      type: 'USE_CARD_ABILITY',
      playerId: player.id,
      abilityId: visionAbility.id,
      cardInstanceId: visionInstance.instanceId,
      paymentCardInstanceIds: [player.hand[0].instanceId],
    });
    expect(actionRes.result.success).toBe(true);
    gameState = actionRes.state;

    // Resolve prompt by picking boost_thw
    const resolveRes = resolveDecisionPrompt(gameState, player.id, 'boost_thw');
    expect(resolveRes.result.success).toBe(true);
    gameState = resolveRes.state;

    // Re-fetch visionInstance from player allies
    const updatedVision = gameState.players[0].allies.find(
      (a) => a.instanceId === visionInstance.instanceId,
    )!;

    const stats = getEffectiveAllyStats(gameState, updatedVision);
    expect(stats.thwart).toBe(3); // 1 printed + 2 bonus
    expect(stats.attack).toBe(2); // 2 printed

    expect(updatedVision.activeStatModifiers).toBeDefined();
    expect(updatedVision.activeStatModifiers?.length).toBe(1);
    expect(updatedVision.activeStatModifiers?.[0].stat).toBe('THW');
    expect(updatedVision.activeStatModifiers?.[0].amount).toBe(2);
    expect(updatedVision.activeStatModifiers?.[0].duration).toBe('PHASE');
  });

  it('4. Enforces limit ONCE_PER_ROUND: cannot trigger a second time in same round', () => {
    const player = gameState.players[0];
    player.hand.push(createCardInstance(energyCard));
    player.hand.push(createCardInstance(energyCard));
    const visionAbility = visionInstance.card.enrichment!.abilities![0];

    // First activation
    const firstRes = dispatchAction(gameState, {
      type: 'USE_CARD_ABILITY',
      playerId: player.id,
      abilityId: visionAbility.id,
      cardInstanceId: visionInstance.instanceId,
      paymentCardInstanceIds: [player.hand[0].instanceId],
    });
    expect(firstRes.result.success).toBe(true);
    gameState = firstRes.state;

    const resolveRes = resolveDecisionPrompt(gameState, player.id, 'boost_thw');
    expect(resolveRes.result.success).toBe(true);
    gameState = resolveRes.state;

    // Re-fetch updated player and vision instance
    const updatedPlayer = gameState.players[0];
    const updatedVision = updatedPlayer.allies.find(
      (a) => a.instanceId === visionInstance.instanceId,
    )!;

    // Attempt second activation
    const secondLegality = canInitiateAbility(
      gameState,
      updatedPlayer.id,
      visionAbility,
      updatedVision,
    );
    expect(secondLegality.allowed).toBe(false);
    expect(secondLegality.reason).toContain('once per round');
  });

  it('5. Phase-end cleans up Vision stat modifier (resets to base 1 THW, 2 ATK)', () => {
    const player = gameState.players[0];
    player.hand.push(createCardInstance(energyCard));
    const visionAbility = visionInstance.card.enrichment!.abilities![0];

    const actionRes = dispatchAction(gameState, {
      type: 'USE_CARD_ABILITY',
      playerId: player.id,
      abilityId: visionAbility.id,
      cardInstanceId: visionInstance.instanceId,
      paymentCardInstanceIds: [player.hand[0].instanceId],
    });
    expect(actionRes.result.success).toBe(true);
    gameState = actionRes.state;

    const resolveRes = resolveDecisionPrompt(gameState, player.id, 'boost_atk');
    expect(resolveRes.result.success).toBe(true);
    gameState = resolveRes.state;

    let updatedVision = gameState.players[0].allies.find(
      (a) => a.instanceId === visionInstance.instanceId,
    )!;

    let stats = getEffectiveAllyStats(gameState, updatedVision);
    expect(stats.attack).toBe(4); // 2 + 2

    // End player phase
    gameState = endPlayerPhase(gameState);

    // Verify stat modifier expired
    updatedVision = gameState.players[0].allies.find(
      (a) => a.instanceId === visionInstance.instanceId,
    )!;
    stats = getEffectiveAllyStats(gameState, updatedVision);
    expect(stats.attack).toBe(2); // reset to base
    expect(stats.thwart).toBe(1); // base
  });

  it('6. Lead from the Front (01070) buffs hero and ally, then expires at phase end', () => {
    gameState.players[0].currentForm = 'hero';
    const player = gameState.players[0];

    // Execute Lead from the Front
    const effectRes = executeEffect(
      gameState,
      {
        effect: 'MODIFY_STAT',
        effectParams: {
          target: 'ALL_FRIENDLY_CHARACTERS',
          atkBonus: 1,
          thwBonus: 1,
          duration: 'PHASE',
        },
      },
      { playerId: player.id },
    );
    expect(effectRes.success).toBe(true);
    gameState = effectRes.state;

    // Verify Hero is buffed
    let heroStats = getEffectiveHeroStats(gameState, gameState.players[0]);
    expect(heroStats.attack).toBe((player.hero.attack || 0) + 1);
    expect(heroStats.thwart).toBe((player.hero.thwart || 0) + 1);

    // Verify Vision is buffed
    let allyStats = getEffectiveAllyStats(gameState, gameState.players[0].allies[0]);
    expect(allyStats.attack).toBe(3); // 2 + 1
    expect(allyStats.thwart).toBe(2); // 1 + 1

    // Transition to Villain Phase (end of Player Phase)
    gameState = executeVillainPhase(gameState);

    // Verify both are back to printed stats
    heroStats = getEffectiveHeroStats(gameState, gameState.players[0]);
    expect(heroStats.attack).toBe(player.hero.attack || 0);
    expect(heroStats.thwart).toBe(player.hero.thwart || 0);

    allyStats = getEffectiveAllyStats(gameState, gameState.players[0].allies[0]);
    expect(allyStats.attack).toBe(2);
    expect(allyStats.thwart).toBe(1);
  });
});
