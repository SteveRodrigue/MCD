import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard, StatusCard, SideSchemeState } from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { dispatchAction } from '@engine/pipeline';
import { step2_villainActivations } from '@engine/pipeline/villain-phase';
import { getEffectiveAllyStats } from '@engine/pipeline/stat-calculator';

describe('Player Attachments & Upgrades Subsystem (Inspired, Webbed Up, Spider-Tracer)', () => {
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
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!), // 10 Swinging Web Kicks to prevent deck cycle in upkeep
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

  it('01074 Inspired: Grants +1 THW and +1 ATK to attached ally', () => {
    const daredevilCard = cardCatalog.getCard('01058')!; // 2 THW, 2 ATK
    const daredevilInstance = createCardInstance(daredevilCard);
    const inspiredCard = cardCatalog.getCard('01074')!;
    const inspiredInstance = createCardInstance(inspiredCard);

    // Attach Inspired to Daredevil
    daredevilInstance.attachments = [inspiredInstance];
    state.players[0].allies = [daredevilInstance];

    const stats = getEffectiveAllyStats(state, daredevilInstance);
    // Base 2 + 1 Inspired = 3 THW & 3 ATK
    expect(stats.thwart).toBe(3);
    expect(stats.attack).toBe(3);

    // Perform Ally Attack
    state.mainScheme.threat = 5;
    const initialVillainHp = state.villain.health;

    const res = dispatchAction(state, {
      type: 'ALLY_ATTACK',
      playerId: 'p1',
      allyInstanceId: daredevilInstance.instanceId,
      targetType: 'villain',
    });

    expect(res.result.success).toBe(true);
    // Daredevil attacks for 3
    expect(res.state.villain.health).toBe(initialVillainHp - 3);
  });

  it('01009 Webbed Up: Cancels villain attack, discards itself, and stuns the villain', () => {
    const webbedUpCard = cardCatalog.getCard('01009')!;
    const webbedUpInstance = createCardInstance(webbedUpCard);
    state.villain.attachments = [webbedUpInstance];
    state.villains[0].attachments = state.villain.attachments;

    const initialHeroHp = state.players[0].health;

    // Execute step 2 villain activations (Rhino would attack Spider-Man in hero form)
    const nextState = step2_villainActivations(state);

    // Attack must be cancelled
    expect(nextState.players[0].health).toBe(initialHeroHp);
    // Webbed Up must be discarded to player discard
    expect(nextState.villain.attachments.some((c) => c.card.code === '01009')).toBe(false);
    expect(nextState.players[0].discard.some((c) => c.card.code === '01009')).toBe(true);
    // Villain must now have STUNNED status
    expect(nextState.villain.statusCards).toContain(StatusCard.STUNNED);
  });

  it('01007 Spider-Tracer: Removes 3 threat from scheme when attached minion is defeated (Single Scheme Auto-Targeting)', () => {
    const minionCard = cardCatalog.getCard('01101')!; // Hydra Mercenary (3 HP)
    const minionInstance = createCardInstance(minionCard);
    const tracerCard = cardCatalog.getCard('01007')!;
    const tracerInstance = createCardInstance(tracerCard);

    minionInstance.attachments = [tracerInstance];
    state.players[0].engagedMinions = [minionInstance];
    state.mainScheme.threat = 6;

    // Player attacks minion with 3 damage (basic attack 2 ATK against minion with 2 damage)
    minionInstance.tokens = { damage: 2 };

    const res = dispatchAction(state, {
      type: 'BASIC_ATTACK',
      playerId: 'p1',
      targetType: 'minion',
      targetInstanceId: minionInstance.instanceId,
    });

    expect(res.result.success).toBe(true);
    // Minion is defeated
    expect(res.state.players[0].engagedMinions.length).toBe(0);
    // Spider-Tracer triggers and removes 3 threat from main scheme (6 - 3 = 3)
    expect(res.state.mainScheme.threat).toBe(3);
    // Spider-Tracer placed in player discard
    expect(res.state.players[0].discard.some((c) => c.card.code === '01007')).toBe(true);
  });

  it('01007 Spider-Tracer: Enqueues decision prompt when multiple schemes are in play (CHOSEN_SCHEME)', () => {
    const minionCard = cardCatalog.getCard('01101')!;
    const minionInstance = createCardInstance(minionCard);
    const tracerCard = cardCatalog.getCard('01007')!;
    const tracerInstance = createCardInstance(tracerCard);

    const sideSchemeCard = cardCatalog.getCard('01107')! as any; // Bomb Scare (3 threat)
    const sideSchemeInstance: SideSchemeState = {
      instanceId: 'side_scheme_bomb_scare',
      card: sideSchemeCard,
      threat: 3,
    };

    state.sideSchemes = [sideSchemeInstance];
    minionInstance.attachments = [tracerInstance];
    state.players[0].engagedMinions = [minionInstance];
    state.mainScheme.threat = 5;

    minionInstance.tokens = { damage: 2 };

    const res = dispatchAction(state, {
      type: 'BASIC_ATTACK',
      playerId: 'p1',
      targetType: 'minion',
      targetInstanceId: minionInstance.instanceId,
    });

    expect(res.result.success).toBe(true);
    // Minion defeated and removed
    expect(res.state.players[0].engagedMinions.length).toBe(0);

    // Decision prompt enqueued because 2 schemes are in play
    expect(res.state.pendingDecisionPrompt).toBeDefined();
    expect(res.state.pendingDecisionPrompt!.options.length).toBe(2);

    // Player chooses Bomb Scare
    const sideSchemeOpt = res.state.pendingDecisionPrompt!.options.find(
      (o) => o.id === sideSchemeInstance.instanceId,
    );
    expect(sideSchemeOpt).toBeDefined();

    const resolveRes = dispatchAction(res.state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'p1',
      selectedOptionId: sideSchemeOpt!.id,
    });

    expect(resolveRes.result.success).toBe(true);
    expect(resolveRes.state.pendingDecisionPrompt).toBeUndefined();
    // 3 threat removed from Bomb Scare (3 - 3 = 0)
    expect(resolveRes.state.sideSchemes[0].threat).toBe(0);
    // Main scheme threat untouched
    expect(resolveRes.state.mainScheme.threat).toBe(5);
    // Spider-Tracer placed in player discard
    expect(resolveRes.state.players[0].discard.some((c) => c.card.code === '01007')).toBe(true);
  });

  it('01007 Spider-Tracer: Routes attachment to correct ownerId discard upon host defeat', () => {
    const minionCard = cardCatalog.getCard('01101')!;
    const minionInstance = createCardInstance(minionCard);
    const tracerCard = cardCatalog.getCard('01007')!;
    const tracerInstance = createCardInstance(tracerCard);
    (tracerInstance as any).ownerId = 'p1';

    minionInstance.attachments = [tracerInstance];
    // Engaged with dummy player 2
    state.players.push({
      ...state.players[0],
      id: 'p2',
      name: 'Player 2',
      engagedMinions: [minionInstance],
      discard: [],
    });
    minionInstance.tokens = { damage: 2 };
    state.mainScheme.threat = 4;

    const res = dispatchAction(state, {
      type: 'BASIC_ATTACK',
      playerId: 'p1',
      targetType: 'minion',
      targetInstanceId: minionInstance.instanceId,
    });

    expect(res.result.success).toBe(true);
    // Discarded to p1 (owner), NOT p2
    expect(res.state.players[0].discard.some((c) => c.card.code === '01007')).toBe(true);
    expect(res.state.players[1].discard.some((c) => c.card.code === '01007')).toBe(false);
  });

  it('01007 Spider-Tracer: Triggers HOST_DEFEATED when attached minion is defeated by an event effect (DEAL_DAMAGE)', async () => {
    const { executeEffect } = await import('@engine/effects');

    const minionCard = cardCatalog.getCard('01101')!; // 3 HP
    const minionInstance = createCardInstance(minionCard);
    const tracerCard = cardCatalog.getCard('01007')!;
    const tracerInstance = createCardInstance(tracerCard);

    minionInstance.attachments = [tracerInstance];
    state.players[0].engagedMinions = [minionInstance];
    state.mainScheme.threat = 6;

    // Execute DEAL_DAMAGE effect dealing 3 damage to the minion (e.g. Haymaker)
    const attackAbility = {
      id: 'event_attack',
      timing: 'HERO_ACTION' as const,
      steps: [
        {
          effect: 'DEAL_DAMAGE',
          params: { amount: 3, target: 'CHOSEN_MINION' },
        },
      ],
    };

    const res = executeEffect(state, attackAbility, {
      playerId: 'p1',
      targetType: 'minion',
      targetInstanceId: minionInstance.instanceId,
    });

    expect(res.success).toBe(true);
    // Minion defeated and removed
    expect(res.state.players[0].engagedMinions.length).toBe(0);
    // Spider-Tracer triggered and removed 3 threat (6 - 3 = 3)
    expect(res.state.mainScheme.threat).toBe(3);
    // Spider-Tracer discarded to player's discard
    expect(res.state.players[0].discard.some((c) => c.card.code === '01007')).toBe(true);
  });

  it('strictly rejects deprecated ATTACHED_MINION_DEFEATED and validates HOST_DEFEATED in CardAbilitySchema', async () => {
    const { CardAbilitySchema } = await import('../../src/data/supplemental/schema');

    // Valid with HOST_DEFEATED
    const validAbility = {
      id: 'test_host_defeated',
      timing: 'FORCED_INTERRUPT',
      trigger: 'HOST_DEFEATED',
      steps: [{ effect: 'REMOVE_THREAT', params: { amount: 3, target: 'CHOSEN_SCHEME' } }],
    };
    expect(CardAbilitySchema.safeParse(validAbility).success).toBe(true);

    // Rejects deprecated ATTACHED_MINION_DEFEATED
    const deprecatedAbility = {
      id: 'test_deprecated_trigger',
      timing: 'FORCED_INTERRUPT',
      trigger: 'ATTACHED_MINION_DEFEATED',
      steps: [{ effect: 'REMOVE_THREAT', params: { amount: 3 } }],
    };
    expect(CardAbilitySchema.safeParse(deprecatedAbility).success).toBe(false);
  });
});
