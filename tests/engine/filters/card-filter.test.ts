import { describe, it, expect } from 'vitest';
import { matchesCardFilter } from '../../../src/engine/filters/card-filter';

describe('matchesCardFilter (ADR-0046 Universal Card Filtering Engine)', () => {
  const sampleCard = {
    code: '01046',
    name: 'Avengers Mansion',
    type: 'support',
    traits: ['Avenger', 'S.H.I.E.L.D.'],
    cost: 4,
    isUnique: true,
    resources: { mental: 1 },
    raw: {
      type_code: 'support',
      faction_code: 'basic',
      card_set_code: 'iron_man',
      text: 'Support. Avenger.',
    },
  };

  const sampleMinion = {
    code: '01100',
    name: 'Armored Rhino Suit',
    type: 'attachment',
    traits: ['Armor', 'Tech'],
    cost: 0,
    isUnique: false,
    resources: { physical: 1 },
    raw: {
      type_code: 'attachment',
      faction_code: 'encounter',
      card_set_code: 'rhino',
      text: 'Toughness. Guard.',
    },
    isExhausted: true,
    statusTokens: ['TOUGH'],
  };

  describe('Empty and Undefined Filters', () => {
    it('returns true when filter is undefined', () => {
      expect(matchesCardFilter(sampleCard, undefined)).toBe(true);
    });

    it('returns true when filter is empty object', () => {
      expect(matchesCardFilter(sampleCard, {})).toBe(true);
    });
  });

  describe('Codes & Names Matching', () => {
    it('matches exact card codes in array', () => {
      expect(matchesCardFilter(sampleCard, { codes: ['01046', '01047'] })).toBe(true);
      expect(matchesCardFilter(sampleCard, { codes: ['99999'] })).toBe(false);
    });

    it('matches card names case-insensitively', () => {
      expect(matchesCardFilter(sampleCard, { names: ['avengers mansion'] })).toBe(true);
      expect(matchesCardFilter(sampleCard, { names: ['Daily Bugle'] })).toBe(false);
    });
  });

  describe('Types & Factions Matching', () => {
    it('matches card types against normalized and raw type', () => {
      expect(matchesCardFilter(sampleCard, { types: ['support'] })).toBe(true);
      expect(matchesCardFilter(sampleCard, { types: ['upgrade', 'support'] })).toBe(true);
      expect(matchesCardFilter(sampleCard, { types: ['event'] })).toBe(false);
    });

    it('matches aspects / factions', () => {
      expect(matchesCardFilter(sampleCard, { aspects: ['basic'] })).toBe(true);
      expect(matchesCardFilter(sampleCard, { aspects: ['leadership', 'basic'] })).toBe(true);
      expect(matchesCardFilter(sampleCard, { aspects: ['aggression'] })).toBe(false);
    });
  });

  describe('Traits Matching (Punctuation and Casing Resilience)', () => {
    it('matches exact trait case-insensitively', () => {
      expect(matchesCardFilter(sampleCard, { traits: ['Avenger'] })).toBe(true);
      expect(matchesCardFilter(sampleCard, { traits: ['avenger'] })).toBe(true);
    });

    it('matches punctuation-stripped traits (S.H.I.E.L.D. vs SHIELD)', () => {
      expect(matchesCardFilter(sampleCard, { traits: ['SHIELD'] })).toBe(true);
      expect(matchesCardFilter(sampleCard, { traits: ['s.h.i.e.l.d.'] })).toBe(true);
      expect(matchesCardFilter(sampleCard, { traits: ['Wakanda'] })).toBe(false);
    });
  });

  describe('Cost Comparisons', () => {
    it('matches min cost bound', () => {
      expect(matchesCardFilter(sampleCard, { cost: { min: 3 } })).toBe(true);
      expect(matchesCardFilter(sampleCard, { cost: { min: 5 } })).toBe(false);
    });

    it('matches max cost bound', () => {
      expect(matchesCardFilter(sampleCard, { cost: { max: 4 } })).toBe(true);
      expect(matchesCardFilter(sampleCard, { cost: { max: 3 } })).toBe(false);
    });

    it('matches exact cost equality', () => {
      expect(matchesCardFilter(sampleCard, { cost: { equals: 4 } })).toBe(true);
      expect(matchesCardFilter(sampleCard, { cost: { equals: 2 } })).toBe(false);
    });
  });

  describe('Resource Icons & Unicity', () => {
    it('matches resource icons', () => {
      expect(matchesCardFilter(sampleCard, { resourceIcons: ['mental'] })).toBe(true);
      expect(matchesCardFilter(sampleCard, { resourceIcons: ['physical'] })).toBe(false);
    });

    it('matches unicity flag', () => {
      expect(matchesCardFilter(sampleCard, { isUnique: true })).toBe(true);
      expect(matchesCardFilter(sampleCard, { isUnique: false })).toBe(false);
      expect(matchesCardFilter(sampleMinion, { isUnique: false })).toBe(true);
    });
  });

  describe('In-Play Orientation and Status Tokens', () => {
    it('evaluates isExhausted', () => {
      expect(matchesCardFilter(sampleMinion, { isExhausted: true })).toBe(true);
      expect(matchesCardFilter(sampleMinion, { isExhausted: false })).toBe(false);
    });

    it('evaluates hasStatus tokens', () => {
      expect(matchesCardFilter(sampleMinion, { hasStatus: ['TOUGH'] })).toBe(true);
      expect(matchesCardFilter(sampleMinion, { hasStatus: ['STUNNED'] })).toBe(false);
    });
  });

  describe('Boolean Combinators (all, any, none)', () => {
    it('evaluates any (Logical OR)', () => {
      const orFilter = {
        any: [{ traits: ['Tech'] }, { traits: ['Avenger'] }],
      };
      expect(matchesCardFilter(sampleCard, orFilter)).toBe(true);
      expect(matchesCardFilter(sampleMinion, orFilter)).toBe(true); // Tech matches
      expect(matchesCardFilter({ code: 'x', traits: ['Civilian'] }, orFilter)).toBe(false);
    });

    it('evaluates all (Logical AND)', () => {
      const andFilter = {
        all: [{ types: ['support'] as any }, { traits: ['Avenger'] }],
      };
      expect(matchesCardFilter(sampleCard, andFilter)).toBe(true);
      expect(matchesCardFilter(sampleMinion, andFilter)).toBe(false);
    });

    it('evaluates none (Logical NOT / Exclusion)', () => {
      const notFilter = {
        types: ['support'] as any,
        none: [{ isUnique: true }],
      };
      // sampleCard is unique, so should be excluded
      expect(matchesCardFilter(sampleCard, notFilter)).toBe(false);
    });

    it('evaluates nested combinators', () => {
      const complexFilter = {
        any: [
          {
            all: [{ types: ['attachment'] as any }, { traits: ['Tech'] }],
          },
          {
            all: [{ types: ['support'] as any }, { cost: { min: 5 } }],
          },
        ],
      };
      expect(matchesCardFilter(sampleMinion, complexFilter)).toBe(true); // matches first branch
      expect(matchesCardFilter(sampleCard, complexFilter)).toBe(false); // cost is 4, not 5
    });
  });
});
