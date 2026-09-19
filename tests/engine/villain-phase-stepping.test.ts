import { describe, it, expect, beforeEach } from 'vitest';
import { CardCatalog } from '@data/importer/card-loader';
import {
  setupGame,
  resetInstanceCounter,
  VillainCard,
  MainSchemeCard,
  createCardInstance,
  GamePhase,
  VillainPhaseStep,
  dispatchAction,
  advanceVillainPhaseStep,
  executeVillainPhase,
} from '@engine/index';

import corePack from '../../data/upstream/pack/core.json';
import coreEncounterPack from '../../data/upstream/pack/core_encounter.json';

describe('Villain Phase Stepping & Pacing Engine (ADR-0068 / Issue #140)', () => {
  const catalog = new CardCatalog([...corePack, ...coreEncounterPack]);
  let gameState: ReturnType<typeof setupGame>;

  beforeEach(() => {
    resetInstanceCounter();

    const identity = catalog.getHeroIdentity('spider_man')!;
    const signatureCards = catalog.getCardsBySet('spider_man').flatMap((c) => {
      if (c.type === 'hero' || c.type === 'alter_ego') return [];
      return Array(c.quantity).fill(c);
    });
    const justiceCards = catalog
      .getCardsByFaction('justice' as any)
      .flatMap((c) => Array(c.quantity).fill(c));
    const basicCards = catalog
      .getCardsByFaction('basic' as any)
      .flatMap((c) => Array(c.quantity).fill(c));
    const deck = [...signatureCards, ...justiceCards, ...basicCards].slice(0, 40);

    const rhinoCards = catalog.getCardsBySet('rhino').filter((c) => c.type !== 'villain');
    const standardCards = catalog.getCardsBySet('standard');
    const bombScareCards = catalog.getCardsBySet('bomb_scare');
    const encounterCards = [...rhinoCards, ...standardCards, ...bombScareCards].flatMap((c) =>
      Array(c.quantity).fill(c),
    );

    const villain = catalog.getCard('01094') as VillainCard; // Rhino I (ATK 2, SCH 1, HP 14)
    const mainScheme = catalog.getCard('01097b') as MainSchemeCard; // The Break-In! (Threat 0, Target 7)

    gameState = setupGame({
      players: [
        {
          id: 'p1',
          name: 'Peter Parker',
          hero: identity.hero,
          alterEgo: identity.alterEgo,
          deckCards: deck,
        },
      ],
      villain,
      mainScheme,
      encounterCards,
      shuffleFn: (arr) => arr,
    });

    gameState.phase = GamePhase.PLAYER_PHASE;
    gameState.players[0].currentForm = 'hero';
    gameState.players[0].activeFormCard = gameState.players[0].hero;
    gameState.players[0].hand = [];
  });

  it('advances step-by-step: threat -> activation -> deal cards -> reveal cards -> round upkeep', () => {
    // 1. Initial State: Player Phase
    expect(gameState.phase).toBe(GamePhase.PLAYER_PHASE);
    expect(gameState.mainScheme.threat).toBe(0);

    // Provide a known boost card for the attack
    const boostCard = createCardInstance({
      ...catalog.getCard('01107')!,
      boostIcons: 1,
    });
    // Provide a known encounter card for Step 4 & 5
    const encounterCard = createCardInstance(catalog.getCard('01112')!); // False Alarm treachery
    gameState.encounterDeck = [boostCard, encounterCard];

    // Step 1: Advance from PLAYER_PHASE to VILLAIN_PHASE -> executes Step 1 (Threat)
    let nextState = advanceVillainPhaseStep(gameState, { synchronousPolicy: 'TAKE_UNDEFENDED' });
    expect(nextState.phase).toBe(GamePhase.VILLAIN_PHASE);
    expect(nextState.mainScheme.threat).toBe(1);
    expect(nextState.villainPhaseStepEvent).toBeDefined();
    expect(nextState.villainPhaseStepEvent?.type).toBe('THREAT_PLACED');
    expect(nextState.villainPhaseStepEvent?.amount).toBe(1);
    expect(nextState.villainPhaseStep).toBe(VillainPhaseStep.VILLAIN_ACTIVATIONS);

    // Step 2: Advance to execute Villain activation (Rhino ATK 2 + Boost 1 = 3 vs DEF 0)
    const playerBefore = nextState.players[0];
    const initialHealth = playerBefore.health;
    nextState = advanceVillainPhaseStep(nextState, { synchronousPolicy: 'TAKE_UNDEFENDED' });

    expect(nextState.villainPhaseStepEvent?.type).toBe('VILLAIN_ATTACK');
    expect(nextState.lastCombatOutcome).toBeDefined();
    expect(nextState.lastCombatOutcome?.attackerName).toBe('Rhino');
    expect(nextState.lastCombatOutcome?.baseAttack).toBe(2);
    expect(nextState.lastCombatOutcome?.totalBoostIcons).toBe(1);
    expect(nextState.lastCombatOutcome?.finalDamage).toBe(3);
    expect(nextState.players[0].health).toBe(initialHealth - 3);
    expect(nextState.villainPhaseStep).toBe(VillainPhaseStep.DEAL_ENCOUNTER_CARDS);

    // Step 4: Advance to deal encounter cards
    nextState = advanceVillainPhaseStep(nextState, { synchronousPolicy: 'TAKE_UNDEFENDED' });
    expect(nextState.villainPhaseStepEvent?.type).toBe('DEAL_ENCOUNTER_CARD');
    expect(nextState.villainPhaseStepEvent?.amount).toBe(1);
    expect(nextState.players[0].dealtEncounterCards.length).toBe(1);
    expect(nextState.villainPhaseStep).toBe(VillainPhaseStep.REVEAL_ENCOUNTER_CARDS);

    // Step 5: Advance to reveal encounter card
    nextState = advanceVillainPhaseStep(nextState, { synchronousPolicy: 'TAKE_UNDEFENDED' });
    expect(nextState.villainPhaseStepEvent?.type).toBe('REVEAL_ENCOUNTER_CARD');
    expect(nextState.villainPhaseStepEvent?.sourceName).toBe(encounterCard.card.name);
    expect(nextState.players[0].dealtEncounterCards.length).toBe(0);
    expect(nextState.villainPhaseStep).toBe(VillainPhaseStep.PASS_FIRST_PLAYER);

    // Step 6: Advance to complete round upkeep & return to PLAYER_PHASE
    nextState = advanceVillainPhaseStep(nextState, { synchronousPolicy: 'TAKE_UNDEFENDED' });
    expect(nextState.phase).toBe(GamePhase.PLAYER_PHASE);
    expect(nextState.villainPhaseStepEvent?.type).toBe('PASS_FIRST_PLAYER');
  });

  it('dispatches ADVANCE_VILLAIN_PHASE via action dispatcher', () => {
    // Put game in VILLAIN_PHASE
    gameState.phase = GamePhase.VILLAIN_PHASE;
    gameState.villainPhaseStep = VillainPhaseStep.MAIN_SCHEME_THREAT;

    const actionResult = dispatchAction(gameState, {
      type: 'ADVANCE_VILLAIN_PHASE',
    });

    expect(actionResult.result.success).toBe(true);
    expect(actionResult.state.villainPhaseStep).toBe(VillainPhaseStep.VILLAIN_ACTIVATIONS);
  });

  it('halts stepping when an interactive decision prompt is opened', () => {
    // Transition to VILLAIN_PHASE Step 1
    let state = advanceVillainPhaseStep(gameState, { synchronousPolicy: 'TAKE_UNDEFENDED' });
    expect(state.villainPhaseStep).toBe(VillainPhaseStep.VILLAIN_ACTIVATIONS);

    // Without synchronousPolicy and with acceptOptionalTriggers: true, Spider-Sense auto-resolves and attack triggers DECLARE_DEFENDER prompt
    state = advanceVillainPhaseStep(state, { acceptOptionalTriggers: true });

    expect(state.pendingDecisionPrompt).toBeDefined();
    expect(state.pendingDecisionPrompt?.options.some((o) => o.effect === 'DECLARE_DEFENDER')).toBe(
      true,
    );

    // Calling advanceVillainPhaseStep while prompt is pending yields state without advancing
    const haltedState = advanceVillainPhaseStep(state);
    expect(haltedState.pendingDecisionPrompt).toBeDefined();

    // Calling ADVANCE_VILLAIN_PHASE via dispatcher fails with error
    const dispatchRes = dispatchAction(state, { type: 'ADVANCE_VILLAIN_PHASE' });
    expect(dispatchRes.result.success).toBe(false);
    expect(dispatchRes.result.error).toContain('decision prompt is pending');
  });

  it('executes continuously without pausing when stepping is omitted in executeVillainPhase', () => {
    const boostCard = createCardInstance({
      ...catalog.getCard('01107')!,
      boostIcons: 1,
    });
    const encounterCard = createCardInstance(catalog.getCard('01111')!);
    gameState.encounterDeck = [boostCard, encounterCard];

    // executeVillainPhase runs through to PLAYER_PHASE in one call when stepping is omitted
    const completedState = executeVillainPhase(gameState, {
      synchronousPolicy: 'TAKE_UNDEFENDED',
    });

    expect(completedState.phase).toBe(GamePhase.PLAYER_PHASE);
    expect(completedState.roundNumber).toBe(2);
  });
});
