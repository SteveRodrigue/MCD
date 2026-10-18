import { describe, it, expect } from 'vitest';
import { matchesCardFilter } from '../../../src/engine/filters/card-filter';
import {
  CardTypeSchema,
  KeywordSchema,
  ResourceTypeSchema,
  UniversalCardFilterSchema,
} from '../../../src/data/supplemental/schema';
import { CardType, Keyword, ResourceType } from '../../../src/engine/models/enums';
import { cardCatalog } from '../../../src/data/importer/card-loader';
import type { CardInstance, NormalizedCard, PlayerState } from '../../../src/engine/models';

describe('matchesCardFilter (ADR-0046 Universal Card Filtering Engine)', () => {
  const sampleCard = {
    code: '01046',
    name: 'Avengers Mansion',
    type: 'support',
    traits: ['Avenger', 'S.H.I.E.L.D.'],
    cost: 4,
    isUnique: true,
    resources: { mental: 1 },
    faction: 'basic',
    setCode: 'iron_man',
  } as unknown as NormalizedCard;

  // A card in play: exhaustion and status cards live on the instance
  const sampleMinion = {
    instanceId: 'inst_suit',
    card: {
      code: '01100',
      name: 'Armored Rhino Suit',
      type: 'attachment',
      traits: ['Armor', 'Tech'],
      cost: 0,
      isUnique: false,
      resources: { physical: 1 },
      faction: 'encounter',
      setCode: 'rhino',
    },
    exhausted: true,
    statusCards: ['TOUGH'],
  } as unknown as CardInstance;

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
    it('matches card types', () => {
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
      expect(matchesCardFilter({ code: 'x', traits: ['Civilian'] } as never, orFilter)).toBe(false);
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

  describe('In-play criteria on a card that is not in play', () => {
    it('a card definition is neither exhausted nor holding a status', () => {
      const definition = (sampleMinion as CardInstance).card;
      expect(matchesCardFilter(definition, { isExhausted: true })).toBe(false);
      expect(matchesCardFilter(definition, { isExhausted: false })).toBe(false);
      expect(matchesCardFilter(definition, { hasStatus: ['TOUGH'] })).toBe(false);
    });
  });

  describe('Sets and identity (AUD-20261017-232534 F008)', () => {
    const spiderMan = { hero: cardCatalog.getCard('01001a')! } as unknown as PlayerState;
    const spiderManCard = cardCatalog.getCard('01005')!; // Black Cat, Spider-Man set
    const sheHulkCard = cardCatalog.getCard('01023')!; // Legal Practice, She-Hulk set
    const vulture = cardCatalog.getCard('01167')!; // Spider-Man nemesis set

    it('isIdentitySpecific matches only the context hero set', () => {
      expect(spiderManCard.setCode).toBe(spiderMan.hero.setCode);
      expect(
        matchesCardFilter(spiderManCard, { isIdentitySpecific: true }, { player: spiderMan }),
      ).toBe(true);
      expect(
        matchesCardFilter(sheHulkCard, { isIdentitySpecific: true }, { player: spiderMan }),
      ).toBe(false);
      expect(
        matchesCardFilter(sheHulkCard, { isIdentitySpecific: false }, { player: spiderMan }),
      ).toBe(true);
    });

    it('PLAYER_NEMESIS is the nemesis set of the context hero', () => {
      expect(matchesCardFilter(vulture, { sets: ['PLAYER_NEMESIS'] }, { player: spiderMan })).toBe(
        true,
      );
      expect(
        matchesCardFilter(sheHulkCard, { sets: ['PLAYER_NEMESIS'] }, { player: spiderMan }),
      ).toBe(false);
      expect(matchesCardFilter(vulture, { sets: ['PLAYER_NEMESIS'] })).toBe(false);
    });

    it('a set code matches exactly, not as a prefix', () => {
      expect(matchesCardFilter(vulture, { sets: ['spider_man_nemesis'] })).toBe(true);
      expect(matchesCardFilter(vulture, { sets: ['spider_man'] })).toBe(false);
    });
  });

  describe('Toughness keyword vs tough status card (RR v1.8)', () => {
    it('hasKeyword Toughness matches Sandman (01102)', () => {
      const sandman = cardCatalog.getCard('01102')!;
      expect(matchesCardFilter(sandman as any, { hasKeyword: Keyword.TOUGHNESS })).toBe(true);
    });

    it('the schema accepts hasKeyword Toughness and rejects Tough', () => {
      expect(UniversalCardFilterSchema.safeParse({ hasKeyword: Keyword.TOUGHNESS }).success).toBe(
        true,
      );
      expect(UniversalCardFilterSchema.safeParse({ hasKeyword: 'Tough' }).success).toBe(false);
    });

    it('KeywordSchema is derived from every engine Keyword', () => {
      expect([...KeywordSchema.options].sort()).toEqual(Object.values(Keyword).sort());
    });

    it('card type and resource schemas carry every engine enum value (F015)', () => {
      expect([...CardTypeSchema.options].sort()).toEqual(Object.values(CardType).sort());
      expect([...ResourceTypeSchema.options].sort()).toEqual(Object.values(ResourceType).sort());
      expect(UniversalCardFilterSchema.safeParse({ types: ['player_side_scheme'] }).success).toBe(
        true,
      );
    });

    it.each([
      'Guard',
      'Patrol',
      'Hazard',
      'Amplify',
      'Acceleration',
      'Toughness',
      'Overkill',
      'Piercing',
      'Quickstrike',
      'Ranged',
      'Retaliate',
      'Surge',
      'Permanent',
      'Restricted',
      'Uses',
      'Victory',
      'Setup',
      'Teamwork',
      'Stalwart',
      'Steady',
      'Villainous',
      'Incite',
      'Hinder',
    ] as const)('hasKeyword %s matches a card holding that keyword only', (name) => {
      const keyword = name as Keyword;
      const card = { code: 'k1', name: 'Keyword Holder', type: 'minion', keywords: [name] };
      expect(UniversalCardFilterSchema.safeParse({ hasKeyword: keyword }).success).toBe(true);
      expect(matchesCardFilter(card as any, { hasKeyword: keyword })).toBe(true);
      expect(matchesCardFilter({ ...card, keywords: [] } as any, { hasKeyword: keyword })).toBe(
        false,
      );
    });

    it('a character holding only a tough status does not match hasKeyword Toughness', () => {
      const statusOnly = {
        instanceId: 'inst_plain',
        card: { code: 'x1', name: 'Plain Minion', type: 'minion', keywords: [] },
        statusCards: ['TOUGH'],
      };
      expect(matchesCardFilter(statusOnly as any, { hasKeyword: Keyword.TOUGHNESS })).toBe(false);
      expect(matchesCardFilter(statusOnly as any, { hasStatus: ['TOUGH'] })).toBe(true);
    });
  });
});
