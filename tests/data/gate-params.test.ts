import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  GATE_REGISTRY,
  StepGateSchema,
  ResultFactSchema,
  IdentityFormSchema,
  canEffectProduceFact,
} from '../../src/data/supplemental/gate-params';
import {
  CardAbilitySchema,
  AbilityStepSchema,
} from '../../src/data/supplemental/schema';

describe('Step Gate Registry and Param Schemas (ADR-0080, Issues #289, #290)', () => {
  it('defines the 9 canonical StepGateSchema values', () => {
    const canonicalGates = [
      'THEN',
      'IF_RESULT',
      'IF_FORM',
      'IF_PLAYER_HAS_TRAIT',
      'IF_ZONE_EMPTY',
      'IF_CARD_IN_PLAY',
      'IF_RESOURCE_MATCH',
      'IF_UNDEFENDED_ATTACK',
      'IF_ACTIVATION_DEALT_DAMAGE',
    ];
    for (const gate of canonicalGates) {
      expect(StepGateSchema.safeParse(gate).success).toBe(true);
    }
  });

  it('rejects retired and non-canonical step gates', () => {
    const retiredGates = [
      'ALWAYS',
      'IF_PREVIOUS_SUCCESS',
      'IF_AMOUNT_ZERO',
      'IF_ZERO_HEALED',
      'IF_FAILED',
      'IF_ALREADY_HAS_STATUS',
      'IF_CONDITION_MET',
      'IF_CONDITION_NOT_MET',
      'IF_CARD_NOT_IN_PLAY',
      'CUSTOM',
    ];
    for (const gate of retiredGates) {
      expect(StepGateSchema.safeParse(gate).success).toBe(false);
    }
  });

  it('defines canonical ResultFactSchema values', () => {
    const canonicalFacts = [
      'TARGET_DEFEATED',
      'EXCESS_DAMAGE_DEALT',
      'FULLY_HEALED',
      'SCHEME_EMPTY',
      'STATUS_APPLIED',
      'ALREADY_HAD_STATUS',
      'STATUS_REMOVED',
      'AMOUNT_ZERO',
    ];
    for (const fact of canonicalFacts) {
      expect(ResultFactSchema.safeParse(fact).success).toBe(true);
    }
    expect(ResultFactSchema.safeParse('UNKNOWN_FACT').success).toBe(false);
  });

  it('validates IdentityFormSchema values', () => {
    expect(IdentityFormSchema.safeParse('HERO').success).toBe(true);
    expect(IdentityFormSchema.safeParse('ALTER_EGO').success).toBe(true);
    expect(IdentityFormSchema.safeParse('CIVILIAN').success).toBe(false);
  });

  describe('GATE_REGISTRY parameter schemas', () => {
    it('validates THEN gate params', () => {
      const thenSchema = GATE_REGISTRY.THEN.schema;
      expect(thenSchema.safeParse(undefined).success).toBe(false);
      expect(thenSchema.safeParse({}).success).toBe(true);
      expect(thenSchema.safeParse({ step: 'step_1', negate: false }).success).toBe(true);
    });

    it('validates IF_RESULT gate params', () => {
      const resultSchema = GATE_REGISTRY.IF_RESULT.schema;
      expect(resultSchema.safeParse({ result: 'TARGET_DEFEATED' }).success).toBe(true);
      expect(resultSchema.safeParse({ result: 'SCHEME_EMPTY', step: 'step_prev', negate: true }).success).toBe(true);
      expect(resultSchema.safeParse({}).success).toBe(false);
      expect(resultSchema.safeParse({ result: 'INVALID_FACT' }).success).toBe(false);
    });

    it('validates IF_FORM gate params', () => {
      const formSchema = GATE_REGISTRY.IF_FORM.schema;
      expect(formSchema.safeParse({ form: 'HERO' }).success).toBe(true);
      expect(formSchema.safeParse({ form: 'ALTER_EGO' }).success).toBe(true);
      expect(formSchema.safeParse({ form: 'INVALID' }).success).toBe(false);
      expect(formSchema.safeParse({}).success).toBe(false);
    });

    it('validates IF_PLAYER_HAS_TRAIT gate params', () => {
      const traitSchema = GATE_REGISTRY.IF_PLAYER_HAS_TRAIT.schema;
      expect(traitSchema.safeParse({ trait: 'Avenger' }).success).toBe(true);
      expect(traitSchema.safeParse({}).success).toBe(false);
      expect(traitSchema.safeParse({ trait: '' }).success).toBe(false);
    });

    it('validates IF_ZONE_EMPTY gate params', () => {
      const zoneSchema = GATE_REGISTRY.IF_ZONE_EMPTY.schema;
      expect(zoneSchema.safeParse({ zone: 'SIDE_SCHEMES' }).success).toBe(true);
      expect(zoneSchema.safeParse({ zone: 'ENCOUNTER_DECK' }).success).toBe(true);
      expect(zoneSchema.safeParse({}).success).toBe(false);
    });

    it('validates IF_CARD_IN_PLAY gate params', () => {
      const cardSchema = GATE_REGISTRY.IF_CARD_IN_PLAY.schema;
      expect(cardSchema.safeParse({ cardCode: '01064' }).success).toBe(true);
      expect(cardSchema.safeParse({}).success).toBe(false);
    });

    it('validates IF_RESOURCE_MATCH gate params', () => {
      const resSchema = GATE_REGISTRY.IF_RESOURCE_MATCH.schema;
      expect(resSchema.safeParse({ resource: 'physical' }).success).toBe(true);
      expect(resSchema.safeParse({ resource: 'energy', count: 2, printedResource: true, only: true }).success).toBe(true);
      expect(resSchema.safeParse({}).success).toBe(false);
      expect(resSchema.safeParse({ resource: '' }).success).toBe(false);
    });

    it('validates IF_UNDEFENDED_ATTACK gate params', () => {
      const undefSchema = GATE_REGISTRY.IF_UNDEFENDED_ATTACK.schema;
      expect(undefSchema.safeParse({}).success).toBe(true);
      expect(undefSchema.safeParse({ attackerKind: 'VILLAIN' }).success).toBe(true);
      expect(undefSchema.safeParse({ attackerKind: 'MINION' }).success).toBe(true);
      expect(undefSchema.safeParse({ attackerKind: 'ANY_ENEMY' }).success).toBe(true);
    });

    it('validates IF_ACTIVATION_DEALT_DAMAGE gate params', () => {
      const actSchema = GATE_REGISTRY.IF_ACTIVATION_DEALT_DAMAGE.schema;
      expect(actSchema.safeParse({}).success).toBe(true);
      expect(actSchema.safeParse({ negate: true }).success).toBe(true);
    });
  });

  describe('FACT_PRODUCERS and canEffectProduceFact', () => {
    it('accurately maps fact producers', () => {
      expect(canEffectProduceFact('DEAL_DAMAGE', 'TARGET_DEFEATED')).toBe(true);
      expect(canEffectProduceFact('DEAL_DAMAGE', 'EXCESS_DAMAGE_DEALT')).toBe(true);
      expect(canEffectProduceFact('REMOVE_THREAT', 'TARGET_DEFEATED')).toBe(false);
      expect(canEffectProduceFact('HEAL_DAMAGE', 'FULLY_HEALED')).toBe(true);
      expect(canEffectProduceFact('REMOVE_THREAT', 'SCHEME_EMPTY')).toBe(true);
      expect(canEffectProduceFact('ADD_STATUS', 'STATUS_APPLIED')).toBe(true);
      expect(canEffectProduceFact('ADD_STATUS', 'ALREADY_HAD_STATUS')).toBe(true);
      expect(canEffectProduceFact('REMOVE_STATUS', 'STATUS_REMOVED')).toBe(true);
      expect(canEffectProduceFact('DEAL_DAMAGE', 'AMOUNT_ZERO')).toBe(true);
      expect(canEffectProduceFact('REMOVE_THREAT', 'AMOUNT_ZERO')).toBe(true);
    });
  });

  describe('CardAbilitySchema superRefine validation', () => {
    it('rejects step 0 with THEN gate', () => {
      const ability = {
        id: 'test_step0_then',
        timing: 'ACTION',
        steps: [
          {
            id: 's0',
            effect: 'DRAW',
            gate: 'THEN',
          },
        ],
      };
      const result = CardAbilitySchema.safeParse(ability);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toContain("RESULT gate 'THEN' cannot be used on the first step");
    });

    it('rejects step 0 with IF_RESULT gate without explicit valid step', () => {
      const ability = {
        id: 'test_step0_if_result',
        timing: 'ACTION',
        steps: [
          {
            id: 's0',
            effect: 'DRAW',
            gate: 'IF_RESULT',
            gateParams: { result: 'TARGET_DEFEATED' },
          },
        ],
      };
      const result = CardAbilitySchema.safeParse(ability);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toContain("RESULT gate 'IF_RESULT' cannot be used on the first step");
    });

    it('rejects RESULT or CONTEXT gate on CONSTANT abilities', () => {
      const ability = {
        id: 'test_constant_gate',
        timing: 'CONSTANT',
        steps: [
          {
            id: 's0',
            effect: 'MODIFY_STAT',
            gate: 'IF_UNDEFENDED_ATTACK',
          },
        ],
      };
      const result = CardAbilitySchema.safeParse(ability);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toContain("cannot be used in a CONSTANT ability");
    });

    it('rejects gateParams step forward references or unknown step references', () => {
      const abilityForward = {
        id: 'test_forward_ref',
        timing: 'ACTION',
        steps: [
          {
            id: 's0',
            effect: 'DEAL_DAMAGE',
            effectParams: { amount: 3 },
          },
          {
            id: 's1',
            effect: 'DRAW',
            gate: 'IF_RESULT',
            gateParams: { result: 'TARGET_DEFEATED', step: 's2' },
          },
          {
            id: 's2',
            effect: 'DEAL_DAMAGE',
            effectParams: { amount: 3 },
          },
        ],
      };
      const result = CardAbilitySchema.safeParse(abilityForward);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toContain("must name an earlier step with an id");
    });

    it('rejects D16 fact producer mismatch (e.g. IF_RESULT TARGET_DEFEATED following REMOVE_THREAT)', () => {
      const abilityMismatch = {
        id: 'test_fact_mismatch',
        timing: 'ACTION',
        steps: [
          {
            id: 's0',
            effect: 'REMOVE_THREAT',
            effectParams: { amount: 2 },
          },
          {
            id: 's1',
            effect: 'DRAW',
            gate: 'IF_RESULT',
            gateParams: { result: 'TARGET_DEFEATED' },
          },
        ],
      };
      const result = CardAbilitySchema.safeParse(abilityMismatch);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toContain("cannot be produced by referenced step effect");
    });

    it('accepts valid multi-step sequence with matching fact producer', () => {
      const abilityValid = {
        id: 'test_valid_seq',
        timing: 'ACTION',
        steps: [
          {
            id: 's0',
            effect: 'DEAL_DAMAGE',
            effectParams: { amount: 4, target: 'CHOSEN_ENEMY' },
          },
          {
            id: 's1',
            effect: 'DRAW',
            gate: 'IF_RESULT',
            gateParams: { result: 'TARGET_DEFEATED' },
            effectParams: { count: 1 },
          },
        ],
      };
      const result = CardAbilitySchema.safeParse(abilityValid);
      expect(result.success).toBe(true);
    });

    it('rejects obsolete condition field on AbilityStepSchema', () => {
      const invalidStep = {
        id: 'step_with_condition',
        effect: 'DRAW',
        condition: 'IF_HERO',
      };
      const result = AbilityStepSchema.safeParse(invalidStep);
      expect(result.success).toBe(false);
    });
  });

  describe('Old-Name & Obsolete Field Guard across Supplemental Pack Files', () => {
    const packDir = path.resolve('src/data/supplemental/pack');
    const packFiles = fs.readdirSync(packDir).filter((f) => f.endsWith('.json'));

    const forbiddenGateNames = [
      'ALWAYS',
      'IF_PREVIOUS_SUCCESS',
      'IF_AMOUNT_ZERO',
      'IF_ZERO_HEALED',
      'IF_FAILED',
      'IF_ALREADY_HAS_STATUS',
      'IF_CONDITION_MET',
      'IF_CONDITION_NOT_MET',
      'IF_CARD_NOT_IN_PLAY',
    ];

    for (const file of packFiles) {
      it(`Ensures ${file} contains zero legacy gate names and zero "condition" step fields`, () => {
        const rawContent = fs.readFileSync(path.join(packDir, file), 'utf8');
        const json = JSON.parse(rawContent);

        for (const [cardId, cardData] of Object.entries<any>(json)) {
          if (!cardData.abilities) continue;
          for (const ability of cardData.abilities) {
            if (!ability.steps) continue;
            for (const step of ability.steps) {
              expect(
                step.condition,
                `Card ${cardId} in ${file} has obsolete "condition" field on step ${step.id}`,
              ).toBeUndefined();

              if (step.gate) {
                expect(
                  forbiddenGateNames,
                  `Card ${cardId} in ${file} uses forbidden/retired gate "${step.gate}" on step ${step.id}`,
                ).not.toContain(step.gate);
              }
            }
          }
        }
      });
    }
  });
});
