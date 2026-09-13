import { describe, it, expect } from 'vitest';
import { UniversalCardFilterSchema } from '../../src/data/supplemental/schema';

describe('UniversalCardFilter Contract Tests', () => {
  it('validates card filters created by editor builder against Zod schema', () => {
    expect(
      UniversalCardFilterSchema.safeParse({
        types: ['upgrade', 'ally'],
        traits: ['Tech'],
        aspects: ['aggression'],
      }).success,
    ).toBe(true);

    expect(
      UniversalCardFilterSchema.safeParse({
        codes: ['01002'],
        cost: { equals: 2 },
      }).success,
    ).toBe(true);
  });

  it('validates cost range bounds (min, max, equals)', () => {
    expect(
      UniversalCardFilterSchema.safeParse({
        cost: { min: 1, max: 4 },
      }).success,
    ).toBe(true);
  });

  it('validates resource icons and unicity criteria', () => {
    expect(
      UniversalCardFilterSchema.safeParse({
        resourceIcons: ['mental', 'wild'],
        isUnique: true,
      }).success,
    ).toBe(true);
  });

  it('validates composable boolean combinators (all, any, none)', () => {
    expect(
      UniversalCardFilterSchema.safeParse({
        all: [{ types: ['ally'] }, { traits: ['Avenger'] }],
        none: [{ codes: ['01012'] }],
      }).success,
    ).toBe(true);
  });

  it('rejects invalid or unknown property keys due to strict schema enforcement', () => {
    expect(
      UniversalCardFilterSchema.safeParse({
        unknownProp: 'invalid',
      }).success,
    ).toBe(false);

    expect(
      UniversalCardFilterSchema.safeParse({
        cardTypes: ['upgrade'], // Deprecated legacy key
      }).success,
    ).toBe(false);
  });
});
