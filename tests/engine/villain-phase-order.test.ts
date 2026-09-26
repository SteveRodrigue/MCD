import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { CardCatalog } from '@data/importer/card-loader';
import {
  setupGame,
  resetInstanceCounter,
  VillainCard,
  MainSchemeCard,
  GamePhase,
  VillainPhaseStep,
} from '@engine/index';
import * as triggers from '@engine/triggers';
import {
  step3_dealEncounterCards,
  step4_dealEncounterCards,
  step4_revealEncounterCards,
  step5_revealEncounterCards,
  step5_passFirstPlayerToken,
  step6_endVillainPhaseAndRound,
  step6_passFirstPlayerAndRoundUpkeep,
} from '../../src/engine/pipeline/villain-phase';
import * as villainPhase from '../../src/engine/pipeline/villain-phase';
import * as roundUpkeep from '../../src/engine/pipeline/round-upkeep';

import corePack from '../../data/upstream/pack/core.json';
import coreEncounterPack from '../../data/upstream/pack/core_encounter.json';

describe('Villain Phase End Ordering & RR v1.8 Step Alignment (Issue #145)', () => {
  const catalog = new CardCatalog([...corePack, ...coreEncounterPack]);
  let gameState: ReturnType<typeof setupGame>;

  beforeEach(() => {
    resetInstanceCounter();

    const identity = catalog.getHeroIdentity('spider_man')!;
    const cmIdentity = catalog.getHeroIdentity('captain_marvel')!;
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

    const villain = catalog.getCard('01094') as VillainCard; // Rhino I
    const mainScheme = catalog.getCard('01097b') as MainSchemeCard; // The Break-In!

    // Setup 2-player game: P1 (index 0, first player) and P2 (index 1)
    gameState = setupGame({
      players: [
        {
          id: 'p1',
          name: 'Peter Parker',
          hero: identity.hero,
          alterEgo: identity.alterEgo,
          deckCards: [...deck],
        },
        {
          id: 'p2',
          name: 'Carol Danvers',
          hero: cmIdentity.hero,
          alterEgo: cmIdentity.alterEgo,
          deckCards: [...deck],
        },
      ],
      villain,
      mainScheme,
      encounterCards,
      shuffleFn: (arr) => arr,
    });

    gameState.firstPlayerIndex = 0;
    gameState.activePlayerIndex = 0;
    gameState.phase = GamePhase.VILLAIN_PHASE;
    gameState.villainPhaseStep = VillainPhaseStep.PASS_FIRST_PLAYER;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('a) In a 2-player game, when VILLAIN_PHASE_ENDED and ROUND_ENDED fire, state.firstPlayerIndex is already 1 (P2), and triggers fire in P2->P1 order', () => {
    const capturedCalls: Array<{
      trigger: string;
      targetPlayerId?: string;
      firstPlayerIndex: number;
    }> = [];

    const originalDispatch = triggers.dispatchTrigger;
    vi.spyOn(triggers, 'dispatchTrigger').mockImplementation((state, trigger, context) => {
      if (trigger === 'VILLAIN_PHASE_ENDED' || trigger === 'ROUND_ENDED') {
        capturedCalls.push({
          trigger: String(trigger),
          targetPlayerId: context?.targetPlayerId,
          firstPlayerIndex: state.firstPlayerIndex,
        });
      }
      return originalDispatch(state, trigger, context);
    });

    // Advance through Step 5 (Token Pass) and Step 6 (Round Upkeep)
    villainPhase.advanceVillainPhaseStep(gameState);

    // Verify VILLAIN_PHASE_ENDED calls
    const vpCalls = capturedCalls.filter((c) => c.trigger === 'VILLAIN_PHASE_ENDED');
    expect(vpCalls).toHaveLength(2);
    // Token was passed in Step 5, so state.firstPlayerIndex MUST already be 1 (P2)
    expect(vpCalls[0].firstPlayerIndex).toBe(1);
    expect(vpCalls[1].firstPlayerIndex).toBe(1);
    // Triggers MUST resolve in player turn order starting from new First Player (P2 -> P1)
    expect(vpCalls.map((c) => c.targetPlayerId)).toEqual(['p2', 'p1']);

    // Verify ROUND_ENDED calls
    const roundCalls = capturedCalls.filter((c) => c.trigger === 'ROUND_ENDED');
    expect(roundCalls).toHaveLength(2);
    expect(roundCalls[0].firstPlayerIndex).toBe(1);
    expect(roundCalls[1].firstPlayerIndex).toBe(1);
    expect(roundCalls.map((c) => c.targetPlayerId)).toEqual(['p2', 'p1']);
  });

  it("b) Active stat modifiers and cost reductions with duration: 'PHASE', and usedAbilitiesThisPhase, are expired/reset in Step 6a before VILLAIN_PHASE_ENDED triggers fire in Step 6b", () => {
    // Give P1 phase-duration stat modifier and cost reduction, and usedAbilitiesThisPhase
    gameState.players[0].activeStatModifiers = [
      {
        stat: 'ATK',
        amount: 2,
        duration: 'PHASE',
        sourceCardName: 'test_phase_buff',
      },
      {
        stat: 'DEF',
        amount: 1,
        duration: 'ROUND',
        sourceCardName: 'test_round_buff',
      },
    ];
    gameState.players[0].activeCostReductions = [
      {
        id: 'red_phase',
        sourceCardName: 'test_phase_cost',
        amount: 1,
        duration: 'PHASE',
        appliesTo: 'NEXT_CARD',
      },
      {
        id: 'red_round',
        sourceCardName: 'test_round_cost',
        amount: 1,
        duration: 'ROUND',
        appliesTo: 'NEXT_CARD',
      },
    ];
    gameState.players[0].costReductions = 2;
    gameState.players[0].usedAbilitiesThisPhase = { ability_1: 1 };

    const capturedStatesAtTrigger: Array<{
      activeStatModifiers: any[];
      activeCostReductions: any[];
      costReductions: number;
      usedAbilitiesThisPhase: Record<string, number>;
    }> = [];

    const originalDispatch = triggers.dispatchTrigger;
    vi.spyOn(triggers, 'dispatchTrigger').mockImplementation((state, trigger, context) => {
      if (trigger === 'VILLAIN_PHASE_ENDED') {
        const p1 = state.players.find((p) => p.id === 'p1')!;
        capturedStatesAtTrigger.push({
          activeStatModifiers: [...(p1.activeStatModifiers || [])],
          activeCostReductions: [...(p1.activeCostReductions || [])],
          costReductions: p1.costReductions ?? 0,
          usedAbilitiesThisPhase: { ...(p1.usedAbilitiesThisPhase || {}) },
        });
      }
      return originalDispatch(state, trigger, context);
    });

    villainPhase.advanceVillainPhaseStep(gameState);

    expect(capturedStatesAtTrigger.length).toBeGreaterThan(0);
    const snapshot = capturedStatesAtTrigger[0];
    // In Step 6a, PHASE duration modifiers must have expired before Step 6b VILLAIN_PHASE_ENDED triggers fire
    expect(snapshot.activeStatModifiers.some((m) => m.duration === 'PHASE')).toBe(false);
    expect(snapshot.activeCostReductions.some((r) => r.duration === 'PHASE')).toBe(false);
    expect(snapshot.usedAbilitiesThisPhase).toEqual({});
  });

  it('c) Step function exports and backward-compatible aliases exist', () => {
    // Named imports check
    expect(typeof step3_dealEncounterCards).toBe('function');
    expect(typeof step4_dealEncounterCards).toBe('function');
    expect(step4_dealEncounterCards).toBe(step3_dealEncounterCards);
    expect(typeof step4_revealEncounterCards).toBe('function');
    expect(typeof step5_revealEncounterCards).toBe('function');
    expect(step5_revealEncounterCards).toBe(step4_revealEncounterCards);
    expect(typeof step5_passFirstPlayerToken).toBe('function');
    expect(typeof step6_endVillainPhaseAndRound).toBe('function');
    expect(typeof step6_passFirstPlayerAndRoundUpkeep).toBe('function');

    const vp = villainPhase as any;
    const ru = roundUpkeep as any;

    // Step 3 / 4 deal encounter cards
    expect(typeof vp.step3_dealEncounterCards).toBe('function');
    expect(typeof vp.step4_dealEncounterCards).toBe('function');
    expect(vp.step4_dealEncounterCards).toBe(vp.step3_dealEncounterCards);

    // Step 4 / 5 reveal encounter cards
    expect(typeof vp.step4_revealEncounterCards).toBe('function');
    expect(typeof vp.step5_revealEncounterCards).toBe('function');
    expect(vp.step5_revealEncounterCards).toBe(vp.step4_revealEncounterCards);

    // Step 5 pass first player token
    expect(typeof vp.step5_passFirstPlayerToken).toBe('function');
    expect(typeof ru.step5_passFirstPlayerToken).toBe('function');
    expect(vp.step5_passFirstPlayerToken).toBe(ru.step5_passFirstPlayerToken);

    // Step 6 end villain phase and round
    expect(typeof vp.step6_endVillainPhaseAndRound).toBe('function');
    expect(typeof ru.step6_endVillainPhaseAndRound).toBe('function');
    expect(vp.step6_endVillainPhaseAndRound).toBe(ru.step6_endVillainPhaseAndRound);

    // Step 6 legacy composite wrapper
    expect(typeof vp.step6_passFirstPlayerAndRoundUpkeep).toBe('function');
    expect(typeof ru.step6_passFirstPlayerAndRoundUpkeep).toBe('function');
  });
});
