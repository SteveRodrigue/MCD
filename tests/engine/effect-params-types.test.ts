import { describe, it, expect, expectTypeOf } from 'vitest';
import { getStepEffectParams } from '../../src/data/supplemental/runtime';
import type { EffectParamsMap } from '../../src/data/supplemental/effect-params';
import { isStep, type TypedStep } from '../../src/engine/effects/handlers/types';
import type { AbilityStep } from '../../src/engine/models';

describe('effect-params-types (Issue #127, R5)', () => {
  it('types getStepEffectParams on DEAL_DAMAGE as EffectParamsMap["DEAL_DAMAGE"]', () => {
    const step: TypedStep<'DEAL_DAMAGE'> = {
      effect: 'DEAL_DAMAGE',
      effectParams: { amount: 3 },
    };
    const params = getStepEffectParams(step);

    expectTypeOf(params).toEqualTypeOf<EffectParamsMap['DEAL_DAMAGE']>();
    expect(params.amount).toBe(3);
  });

  it('types getStepEffectParams on SURGE as EffectParamsMap["SURGE"]', () => {
    const step: TypedStep<'SURGE'> = {
      effect: 'SURGE',
    };
    const params = getStepEffectParams(step);

    expectTypeOf(params).toEqualTypeOf<EffectParamsMap['SURGE']>();
    expect(params).toEqual({});
  });

  it('types a step with an unnarrowed effect as Record<string, unknown>', () => {
    const step: AbilityStep = { effect: 'DEAL_DAMAGE', effectParams: { amount: 3 } };
    const params = getStepEffectParams(step);

    expectTypeOf(params).toEqualTypeOf<Record<string, unknown>>();
    expect(params.amount).toBe(3);
  });

  it('isStep narrows a generic step to its effect params', () => {
    const step: AbilityStep = { effect: 'DEAL_DAMAGE', effectParams: { amount: 3 } };

    if (!isStep(step, 'DEAL_DAMAGE')) throw new Error('expected DEAL_DAMAGE');
    expectTypeOf(getStepEffectParams(step)).toEqualTypeOf<EffectParamsMap['DEAL_DAMAGE']>();
    expect(isStep(step, 'SURGE')).toBe(false);
  });

  it('rejects keys the effect schema does not declare', () => {
    const step: TypedStep<'DEAL_DAMAGE'> = { effect: 'DEAL_DAMAGE' };
    const params = getStepEffectParams(step);

    // @ts-expect-error piercing is not a DEAL_DAMAGE param
    expect(params.piercing).toBeUndefined();
  });
});
