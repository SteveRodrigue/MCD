import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard } from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { getEffectiveHeroStats } from '@engine/pipeline/stat-calculator';
import { evaluateStepGate, isStepGateClosedByState } from '@engine/pipeline/step-gate-evaluator';
import { AbilityStep, StepResolutionResult } from '@engine/models/abilities';

describe('Shared step-gate evaluator (ADR-0080, Issues #289, #290)', () => {
  let state: GameState;
  let hero: HeroCard;

  beforeEach(() => {
    hero = cardCatalog.getCard('01001a') as HeroCard;
    const alterEgo = cardCatalog.getCard('01001b') as AlterEgoCard;
    state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero,
          alterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });
    state.players[0].currentForm = 'hero';
    state.players[0].activeFormCard = hero;
  });

  const ctx = { playerId: 'p1' };
  const evalGate = (
    step: AbilityStep,
    prev?: StepResolutionResult,
    extra: any = {},
    stepResultsMap?: Map<string, StepResolutionResult>,
  ) => evaluateStepGate(step, prev, state, { ...ctx, ...extra }, stepResultsMap);

  it('Ungated step always passes', () => {
    expect(evalGate({ effect: 'DRAW' } as AbilityStep)).toBe(true);
  });

  describe('THEN gate', () => {
    it('evaluates success and mutatedState on previous step', () => {
      const ok: StepResolutionResult = { success: true, mutatedState: true };
      const noMutation: StepResolutionResult = { success: true, mutatedState: false };
      const failed: StepResolutionResult = { success: false, mutatedState: false };
      const step: AbilityStep = { effect: 'DRAW', gate: 'THEN' };

      expect(evalGate(step, ok)).toBe(true);
      expect(evalGate(step, noMutation)).toBe(false);
      expect(evalGate(step, failed)).toBe(false);
      expect(evalGate(step, undefined)).toBe(false);
    });

    it('honors negate: true for fallbacks on failed/unmutated steps', () => {
      const ok: StepResolutionResult = { success: true, mutatedState: true };
      const failed: StepResolutionResult = { success: false, mutatedState: false };
      const step: AbilityStep = { effect: 'SURGE', gate: 'THEN', gateParams: { negate: true } };

      expect(evalGate(step, ok)).toBe(false);
      expect(evalGate(step, failed)).toBe(true);
      expect(evalGate(step, undefined)).toBe(true);
    });

    it('resolves explicit step reference from stepResultsMap (D12)', () => {
      const step1Result: StepResolutionResult = { success: false, mutatedState: false };
      const step2Result: StepResolutionResult = { success: true, mutatedState: true };
      const map = new Map<string, StepResolutionResult>([
        ['step_1', step1Result],
        ['step_2', step2Result],
      ]);

      const fallbackStep: AbilityStep = {
        effect: 'SURGE',
        gate: 'THEN',
        gateParams: { step: 'step_1', negate: true },
      };

      // Even if immediate prev is step2Result (success), the gate targets step_1 (failed) -> returns true
      expect(evalGate(fallbackStep, step2Result, {}, map)).toBe(true);
    });

    it('evaluates skipped previous step as closed for THEN (D18)', () => {
      const skippedPrev: StepResolutionResult = {
        success: false,
        mutatedState: false,
        skipped: true,
      };
      const step: AbilityStep = { effect: 'DRAW', gate: 'THEN' };
      expect(evalGate(step, skippedPrev)).toBe(false);

      const stepNegated: AbilityStep = {
        effect: 'DRAW',
        gate: 'THEN',
        gateParams: { negate: true },
      };
      expect(evalGate(stepNegated, skippedPrev)).toBe(true);
    });
  });

  describe('IF_RESULT gate', () => {
    it('evaluates specific result facts from prevResult', () => {
      const stepDefeated: AbilityStep = {
        effect: 'DRAW',
        gate: 'IF_RESULT',
        gateParams: { fact: 'defeated' },
      };
      expect(
        evalGate(stepDefeated, { success: true, mutatedState: true, facts: { defeated: true } }),
      ).toBe(true);
      expect(
        evalGate(stepDefeated, { success: true, mutatedState: true, facts: { defeated: false } }),
      ).toBe(false);
      expect(evalGate(stepDefeated, { success: true, mutatedState: true })).toBe(false);

      const stepThreatZero: AbilityStep = {
        effect: 'DRAW',
        gate: 'IF_RESULT',
        gateParams: { fact: 'threatZero' },
      };
      expect(
        evalGate(stepThreatZero, {
          success: true,
          mutatedState: true,
          facts: { threatZero: true },
        }),
      ).toBe(true);

      const stepAmountZero: AbilityStep = {
        effect: 'SURGE',
        gate: 'IF_RESULT',
        gateParams: { fact: 'amountZero' },
      };
      expect(
        evalGate(stepAmountZero, {
          success: true,
          mutatedState: false,
          facts: { amountZero: true },
        }),
      ).toBe(true);
    });

    it('honors negate: true on IF_RESULT', () => {
      const step: AbilityStep = {
        effect: 'DRAW',
        gate: 'IF_RESULT',
        gateParams: { fact: 'defeated', negate: true },
      };
      expect(evalGate(step, { success: true, mutatedState: true, facts: { defeated: true } })).toBe(
        false,
      );
      expect(
        evalGate(step, { success: true, mutatedState: true, facts: { defeated: false } }),
      ).toBe(true);
      expect(evalGate(step, undefined)).toBe(true);
    });

    it('resolves explicit step reference from stepResultsMap', () => {
      const map = new Map<string, StepResolutionResult>([
        ['step_strike', { success: true, mutatedState: true, facts: { excessDamage: 3 } }],
      ]);
      const step: AbilityStep = {
        effect: 'DRAW',
        gate: 'IF_RESULT',
        gateParams: { fact: 'excessDamage', step: 'step_strike' },
      };
      expect(evalGate(step, undefined, {}, map)).toBe(true);
    });
  });

  describe('IF_FORM gate', () => {
    it('compares the player identity form with case insensitivity', () => {
      const heroStep: AbilityStep = {
        effect: 'DRAW',
        gate: 'IF_FORM',
        gateParams: { form: 'HERO' },
      };
      const alterEgoStep: AbilityStep = {
        effect: 'DRAW',
        gate: 'IF_FORM',
        gateParams: { form: 'ALTER_EGO' },
      };

      expect(evalGate(heroStep)).toBe(true);
      expect(evalGate(alterEgoStep)).toBe(false);

      state.players[0].currentForm = 'alter_ego';
      expect(evalGate(heroStep)).toBe(false);
      expect(evalGate(alterEgoStep)).toBe(true);
    });

    it('honors negate: true', () => {
      const notHero: AbilityStep = {
        effect: 'DRAW',
        gate: 'IF_FORM',
        gateParams: { form: 'HERO', negate: true },
      };
      expect(evalGate(notHero)).toBe(false);
      state.players[0].currentForm = 'alter_ego';
      expect(evalGate(notHero)).toBe(true);
    });
  });

  describe('IF_PLAYER_HAS_TRAIT gate', () => {
    it('checks active traits on the player', () => {
      const avengerStep: AbilityStep = {
        effect: 'DRAW',
        gate: 'IF_PLAYER_HAS_TRAIT',
        gateParams: { trait: 'Avenger' },
      };
      const aerialStep: AbilityStep = {
        effect: 'DRAW',
        gate: 'IF_PLAYER_HAS_TRAIT',
        gateParams: { trait: 'Aerial' },
      };

      expect(evalGate(avengerStep)).toBe(true);
      expect(evalGate(aerialStep)).toBe(false);

      state.players[0].activeTraitModifiers = [{ trait: 'Aerial', duration: 'PHASE' }];
      expect(evalGate(aerialStep)).toBe(true);
    });

    it('honors negate: true', () => {
      const notAerial: AbilityStep = {
        effect: 'DRAW',
        gate: 'IF_PLAYER_HAS_TRAIT',
        gateParams: { trait: 'Aerial', negate: true },
      };
      expect(evalGate(notAerial)).toBe(true);
      state.players[0].activeTraitModifiers = [{ trait: 'Aerial', duration: 'PHASE' }];
      expect(evalGate(notAerial)).toBe(false);
    });
  });

  describe('IF_CARD_IN_PLAY gate', () => {
    it('looks across zones for the card id/code', () => {
      const inPlayStep: AbilityStep = {
        effect: 'DRAW',
        gate: 'IF_CARD_IN_PLAY',
        gateParams: { cardId: '01064' },
      };
      const notInPlayStep: AbilityStep = {
        effect: 'DRAW',
        gate: 'IF_CARD_IN_PLAY',
        gateParams: { cardId: '01064', negate: true },
      };

      expect(evalGate(inPlayStep)).toBe(false);
      expect(evalGate(notInPlayStep)).toBe(true);

      state.players[0].tableau.push(createCardInstance(cardCatalog.getCard('01064')!));
      expect(evalGate(inPlayStep)).toBe(true);
      expect(evalGate(notInPlayStep)).toBe(false);
    });
  });

  describe('IF_ZONE_EMPTY gate', () => {
    it('evaluates whether a zone has 0 cards', () => {
      const emptySides: AbilityStep = {
        effect: 'DRAW',
        gate: 'IF_ZONE_EMPTY',
        gateParams: { zone: 'SIDE_SCHEMES' },
      };
      expect(evalGate(emptySides)).toBe(true);

      state.sideSchemes = [{ instanceId: 'ss1', threat: 3 } as any];
      expect(evalGate(emptySides)).toBe(false);

      const notEmptySides: AbilityStep = {
        effect: 'DRAW',
        gate: 'IF_ZONE_EMPTY',
        gateParams: { zone: 'SIDE_SCHEMES', negate: true },
      };
      expect(evalGate(notEmptySides)).toBe(true);
    });
  });

  describe('IF_RESOURCE_MATCH gate', () => {
    it('evaluates resources spent from context', () => {
      const step: AbilityStep = {
        effect: 'DRAW',
        gate: 'IF_RESOURCE_MATCH',
        gateParams: { resource: 'mental' },
      };
      expect(evalGate(step, undefined, { resourcesSpent: ['mental'] })).toBe(true);
      expect(evalGate(step, undefined, { resourcesSpent: ['wild'] })).toBe(true);
      expect(evalGate(step, undefined, { resourcesSpent: ['physical'] })).toBe(false);
    });
  });

  describe('IF_UNDEFENDED_ATTACK gate', () => {
    it('evaluates undefended attack context', () => {
      const step: AbilityStep = {
        effect: 'ADD_THREAT',
        gate: 'IF_UNDEFENDED_ATTACK',
        gateParams: { attackerKind: 'VILLAIN' },
      };

      expect(
        evalGate(step, undefined, { attackerType: 'VILLAIN', defenderType: 'UNDEFENDED' }),
      ).toBe(true);
      expect(
        evalGate(step, undefined, { attackerType: 'MINION', defenderType: 'UNDEFENDED' }),
      ).toBe(false);
      expect(evalGate(step, undefined, { attackerType: 'VILLAIN', defenderType: 'HERO' })).toBe(
        false,
      );

      const stepNegated: AbilityStep = {
        effect: 'ADD_THREAT',
        gate: 'IF_UNDEFENDED_ATTACK',
        gateParams: { attackerKind: 'VILLAIN', negate: true },
      };
      expect(
        evalGate(stepNegated, undefined, { attackerType: 'VILLAIN', defenderType: 'HERO' }),
      ).toBe(true);
    });
  });

  describe('IF_ACTIVATION_DEALT_DAMAGE gate', () => {
    it('evaluates whether activation dealt damage > 0', () => {
      const step: AbilityStep = { effect: 'ADD_STATUS', gate: 'IF_ACTIVATION_DEALT_DAMAGE' };
      expect(evalGate(step, undefined, { activationDamage: 3 })).toBe(true);
      expect(evalGate(step, undefined, { activationDamage: 0 })).toBe(false);
      expect(evalGate(step, undefined, {})).toBe(false);
    });
  });

  describe('isStepGateClosedByState', () => {
    it('reports only state-evaluable gates that are currently closed', () => {
      const aerialStep: AbilityStep = {
        effect: 'DRAW',
        gate: 'IF_PLAYER_HAS_TRAIT',
        gateParams: { trait: 'Aerial' },
      };
      const notAerialStep: AbilityStep = {
        effect: 'DRAW',
        gate: 'IF_PLAYER_HAS_TRAIT',
        gateParams: { trait: 'Aerial', negate: true },
      };
      const alterEgoStep: AbilityStep = {
        effect: 'DRAW',
        gate: 'IF_FORM',
        gateParams: { form: 'ALTER_EGO' },
      };
      const thenStep: AbilityStep = { effect: 'DRAW', gate: 'THEN' };
      const ungated: AbilityStep = { effect: 'DRAW' };

      expect(isStepGateClosedByState(aerialStep, state, ctx)).toBe(true);
      expect(isStepGateClosedByState(notAerialStep, state, ctx)).toBe(false);
      expect(isStepGateClosedByState(alterEgoStep, state, ctx)).toBe(true);
      // Result & context gates are never closed by state
      expect(isStepGateClosedByState(thenStep, state, ctx)).toBe(false);
      expect(isStepGateClosedByState(ungated, state, ctx)).toBe(false);
    });
  });

  describe('CONSTANT steps honor gates in the stat calculator', () => {
    function withConstantAttack(gate?: any, gateParams?: any) {
      const upgrade = createCardInstance(cardCatalog.getCard('01093')!);
      upgrade.card = {
        ...upgrade.card,
        enrichment: {
          abilities: [
            {
              id: 'gated_attack',
              timing: 'CONSTANT',
              steps: [
                {
                  effect: 'MODIFY_STAT',
                  gate,
                  gateParams,
                  effectParams: { stat: 'ATTACK', amount: 2 },
                },
              ],
            },
          ],
        },
      } as any;
      state.players[0].tableau = [upgrade];
      return getEffectiveHeroStats(state, state.players[0]).attack;
    }

    it('IF_FORM hero applies in hero form and IF_FORM alter_ego does not', () => {
      const base = getEffectiveHeroStats(state, state.players[0]).attack;
      expect(withConstantAttack('IF_FORM', { form: 'HERO' })).toBe(base + 2);
      expect(withConstantAttack('IF_FORM', { form: 'ALTER_EGO' })).toBe(base);
    });

    it('result-based gates do not apply to CONSTANT steps (no previous step)', () => {
      const base = getEffectiveHeroStats(state, state.players[0]).attack;
      expect(withConstantAttack('THEN', {})).toBe(base);
    });

    it('ungated CONSTANT steps still apply', () => {
      const base = getEffectiveHeroStats(state, state.players[0]).attack;
      expect(withConstantAttack(undefined, undefined)).toBe(base + 2);
    });
  });
});
