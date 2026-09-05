import { describe, it, expect } from 'vitest';
import { CardAbilitySchema, CardEnrichmentSchema } from '../../src/data/supplemental/schema';
import * as fs from 'fs';
import * as path from 'path';

describe('Ability Limits, Activation Zone & maxPerRound Deprecation (Contract Tests)', () => {
  it('loads 01001b (Peter Parker Scientist) with limit: "ONCE_PER_ROUND"', () => {
    const corePackPath = path.resolve(__dirname, '../../src/data/supplemental/pack/core.json');
    const corePack = JSON.parse(fs.readFileSync(corePackPath, 'utf8'));
    const card01001b = corePack.cards['01001b'];

    expect(card01001b).toBeDefined();
    expect(card01001b.abilities).toBeDefined();
    expect(card01001b.abilities).toHaveLength(1);

    const scientistAbility = card01001b.abilities[0];
    expect(scientistAbility.id).toBe('scientist');
    expect(scientistAbility.timing).toBe('RESOURCE');
    expect(scientistAbility.limit).toBe('ONCE_PER_ROUND');
    expect((scientistAbility as any).maxPerRound).toBeUndefined();

    // Validates against CardEnrichmentSchema
    expect(() => CardEnrichmentSchema.parse(card01001b)).not.toThrow();
  });

  it('accepts ONCE_PER_ROUND, ONCE_PER_PHASE, or undefined on CardAbilitySchema', () => {
    const baseAbility = {
      id: 'test_limit',
      timing: 'ACTION',
      steps: [{ effect: 'DRAW_CARDS', params: { amount: 1 } }],
    };

    // Valid with ONCE_PER_ROUND
    const parsedRound = CardAbilitySchema.parse({
      ...baseAbility,
      limit: 'ONCE_PER_ROUND',
    });
    expect(parsedRound.limit).toBe('ONCE_PER_ROUND');

    // Valid with ONCE_PER_PHASE
    const parsedPhase = CardAbilitySchema.parse({
      ...baseAbility,
      limit: 'ONCE_PER_PHASE',
    });
    expect(parsedPhase.limit).toBe('ONCE_PER_PHASE');

    // Valid without limit
    const parsedUnlimited = CardAbilitySchema.parse({
      ...baseAbility,
    });
    expect(parsedUnlimited.limit).toBeUndefined();

    // Rejects invalid limit string
    expect(() =>
      CardAbilitySchema.parse({
        ...baseAbility,
        limit: 'ONCE_PER_TURN',
      }),
    ).toThrow();
  });

  it('strictly rejects maxPerRound on CardAbilitySchema as an unrecognized property', () => {
    const invalidAbility = {
      id: 'test_legacy_max',
      timing: 'ACTION',
      limit: 'ONCE_PER_ROUND',
      maxPerRound: 1, // Dead-weight property removed from schema
      steps: [{ effect: 'DRAW_CARDS', params: { amount: 1 } }],
    };

    expect(() => CardAbilitySchema.parse(invalidAbility)).toThrow();
  });

  it('accepts valid zone values HAND, PLAY, DISCARD, or undefined on CardAbilitySchema', () => {
    const baseAbility = {
      id: 'test_zone',
      timing: 'INTERRUPT',
      steps: [{ effect: 'DRAW_CARDS', params: { amount: 1 } }],
    };

    const parsedHand = CardAbilitySchema.parse({
      ...baseAbility,
      zone: 'HAND',
    });
    expect(parsedHand.zone).toBe('HAND');

    const parsedPlay = CardAbilitySchema.parse({
      ...baseAbility,
      zone: 'PLAY',
    });
    expect(parsedPlay.zone).toBe('PLAY');

    const parsedDiscard = CardAbilitySchema.parse({
      ...baseAbility,
      zone: 'DISCARD',
    });
    expect(parsedDiscard.zone).toBe('DISCARD');

    // Rejects invalid zone
    expect(() =>
      CardAbilitySchema.parse({
        ...baseAbility,
        zone: 'DECK',
      }),
    ).toThrow();
  });

  it('allows switching limits and zones on card enrichment while keeping schema valid', () => {
    const enrichment = {
      comment: 'Scientist ability limit test',
      abilities: [
        {
          id: 'scientist',
          timing: 'RESOURCE',
          limit: 'ONCE_PER_ROUND',
          zone: 'PLAY',
          steps: [
            {
              effect: 'GENERATE_RESOURCE',
              params: { resource: 'mental', amount: 1 },
            },
          ],
        },
      ],
    };

    // Initial valid
    expect(CardEnrichmentSchema.safeParse(enrichment).success).toBe(true);

    // Switch to ONCE_PER_PHASE and zone: HAND
    const updated = {
      ...enrichment,
      abilities: [
        {
          ...enrichment.abilities[0],
          limit: 'ONCE_PER_PHASE',
          zone: 'HAND',
        },
      ],
    };
    expect(CardEnrichmentSchema.safeParse(updated).success).toBe(true);

    // Clear limit and zone
    const cleared = {
      ...enrichment,
      abilities: [
        {
          ...enrichment.abilities[0],
          limit: undefined,
          zone: undefined,
        },
      ],
    };
    expect(CardEnrichmentSchema.safeParse(cleared).success).toBe(true);
  });
});
