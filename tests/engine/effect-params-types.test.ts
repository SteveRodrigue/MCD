import { describe, it, expect, expectTypeOf } from 'vitest';
import { getStepEffectParams } from '../../src/data/supplemental/runtime';
import type { EffectParamsMap } from '../../src/data/supplemental/effect-params';
import type { TypedStep } from '../../src/engine/effects/handlers/types';

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

  it('preserves untyped Record<string, any> when no specific EffectType is provided', () => {
    const step = { effectParams: { foo: 'bar' } };
    const params = getStepEffectParams(step);

    expectTypeOf(params).toEqualTypeOf<Record<string, any>>();
    expect(params.foo).toBe('bar');
  });
});
