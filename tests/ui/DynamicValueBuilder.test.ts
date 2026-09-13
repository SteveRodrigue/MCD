import { describe, it, expect } from 'vitest';
import { DynamicValueSourceSchema } from '../../src/data/supplemental/schema';

describe('DynamicValueSource Contract Tests', () => {
  it('validates static numbers and dynamic value formulas against schema', () => {
    expect(DynamicValueSourceSchema.safeParse({ from: 'PREVIOUS_RESULT' }).success).toBe(true);
    expect(
      DynamicValueSourceSchema.safeParse({
        from: 'STAT_VALUE',
        stat: 'ATTACK',
        multiplier: 2,
        offset: 1,
      }).success,
    ).toBe(true);
    expect(
      DynamicValueSourceSchema.safeParse({
        from: 'COUNTERS',
        counterType: 'web',
      }).success,
    ).toBe(true);
  });
});
