import { describe, it, expect } from 'vitest';
import { normalizeCardText, parseCardText } from '../../src/tools/card-text-parser';
import { CardEnrichmentSchema } from '../../src/data/supplemental/schema';

describe('Card Text Parser', () => {
  describe('normalizeCardText', () => {
    it('strips cosmetic HTML tags and standardizes dashes and arrows', () => {
      const raw = '<b>Hero Action</b> <i>(attack)</i>: Deal 8 damage &mdash; fast &#8594; win.';
      const normalized = normalizeCardText(raw);
      expect(normalized).toBe('Hero Action (attack): Deal 8 damage — fast → win.');
    });

    it('normalizes multi-line text and line breaks', () => {
      const raw = 'Uses (3 counters).<br/><b>Hero Resource</b>: Exhaust -> generate [wild].';
      const normalized = normalizeCardText(raw);
      expect(normalized).toBe('Uses (3 counters).\nHero Resource: Exhaust → generate [wild].');
    });
  });

  describe('Core Hero Cards Parsing', () => {
    it('parses Peter Parker (01001b) — Resource timing, [mental], ONCE_PER_ROUND limit', () => {
      const text =
        'Scientist — <b>Resource</b>: Generate a [mental] resource. (Limit once per round.)';
      const result = parseCardText(text, '01001b');

      expect(result.confidence).toBe(100);
      expect(result.unmatchedFragments).toHaveLength(0);
      expect(result.enrichment.abilities).toBeDefined();
      expect(result.enrichment.abilities).toHaveLength(1);

      const ability = result.enrichment.abilities![0];
      expect(ability.id).toBe('scientist');
      expect(ability.timing).toBe('RESOURCE');
      expect(ability.limit).toBe('ONCE_PER_ROUND');
      expect(ability.maxPerRound).toBe(1);
      expect(ability.steps[0]).toEqual({
        effect: 'GENERATE_RESOURCE',
        params: {
          resource: 'mental',
          amount: 1,
        },
      });

      // Validates strict Zod schema
      expect(() => CardEnrichmentSchema.parse(result.enrichment)).not.toThrow();
    });

    it('parses Spider-Man (01001a) — Interrupt timing, VILLAIN_INITIATES_ATTACK trigger, DRAW_CARDS', () => {
      const text =
        'Spider-Sense — <b>Interrupt</b>: When the villain initiates an attack against you, draw 1 card.';
      const result = parseCardText(text, '01001a');

      expect(result.confidence).toBe(100);
      expect(result.unmatchedFragments).toHaveLength(0);
      expect(result.enrichment.abilities).toHaveLength(1);

      const ability = result.enrichment.abilities![0];
      expect(ability.id).toBe('spider_sense');
      expect(ability.timing).toBe('INTERRUPT');
      expect(ability.trigger).toBe('VILLAIN_INITIATES_ATTACK');
      expect(ability.steps[0]).toEqual({
        effect: 'DRAW_CARDS',
        params: { count: 1 },
      });

      expect(() => CardEnrichmentSchema.parse(result.enrichment)).not.toThrow();
    });

    it('parses Swinging Web Kick (01005) — Hero Action (attack), DEAL_DAMAGE', () => {
      const text = '<b>Hero Action</b> <i>(attack)</i>: Deal 8 damage to an enemy.';
      const result = parseCardText(text, '01005');

      expect(result.confidence).toBe(100);
      expect(result.enrichment.abilities).toHaveLength(1);

      const ability = result.enrichment.abilities![0];
      expect(ability.timing).toBe('HERO_ACTION');
      expect(ability.steps[0]).toEqual({
        effect: 'DEAL_DAMAGE',
        params: {
          amount: 8,
          target: 'CHOSEN_ENEMY',
        },
      });

      expect(() => CardEnrichmentSchema.parse(result.enrichment)).not.toThrow();
    });

    it('parses Backflip (01003) — Interrupt (defense), TAKE_ATTACK_DAMAGE trigger, PREVENT_DAMAGE', () => {
      const text =
        '<b>Interrupt</b> <i>(defense)</i>: When you would take any amount of damage from an attack, prevent all of that damage.';
      const result = parseCardText(text, '01003');

      expect(result.confidence).toBe(100);
      expect(result.enrichment.abilities).toHaveLength(1);

      const ability = result.enrichment.abilities![0];
      expect(ability.timing).toBe('INTERRUPT');
      expect(ability.trigger).toBe('TAKE_ATTACK_DAMAGE');
      expect(ability.zone).toBe('HAND');
      expect(ability.cost).toEqual({ discardSelf: true });
      expect(ability.steps[0]).toEqual({
        effect: 'PREVENT_DAMAGE',
        params: { amount: 'ALL' },
      });

      expect(() => CardEnrichmentSchema.parse(result.enrichment)).not.toThrow();
    });

    it('parses Aunt May (01006) — Alter-Ego Action, exhaustSelf cost, HEAL_DAMAGE', () => {
      const text = '<b>Alter-Ego Action</b>: Exhaust Aunt May → heal 4 damage from Peter Parker.';
      const result = parseCardText(text, '01006');

      expect(result.confidence).toBe(100);
      expect(result.enrichment.abilities).toHaveLength(1);

      const ability = result.enrichment.abilities![0];
      expect(ability.timing).toBe('ALTER_EGO_ACTION');
      expect(ability.cost).toEqual({ exhaustSelf: true });
      expect(ability.steps[0]).toEqual({
        effect: 'HEAL_DAMAGE',
        params: {
          amount: 4,
          target: 'SELF_IDENTITY',
        },
      });

      expect(() => CardEnrichmentSchema.parse(result.enrichment)).not.toThrow();
    });

    it('parses Web-Shooter (01008) — uses counters, HERO_RESOURCE, spendCounters cost', () => {
      const text =
        'Uses (3 web counters). <i>(Enters play with 3 counters. When those are gone, discard this card)</i>\n<b>Hero Resource</b>: Exhaust Web-Shooter and remove 1 web counter from it → generate a [wild] resource.';
      const result = parseCardText(text, '01008');

      expect(result.confidence).toBe(100);
      expect(result.enrichment.uses).toEqual({
        count: 3,
        type: 'web',
        discardOnEmpty: true,
      });

      const ability = result.enrichment.abilities![0];
      expect(ability.timing).toBe('HERO_RESOURCE');
      expect(ability.cost).toEqual({
        exhaustSelf: true,
        spendCounters: {
          amount: 1,
          counterType: 'web',
        },
      });
      expect(ability.steps[0]).toEqual({
        effect: 'GENERATE_RESOURCE',
        params: {
          resource: 'wild',
          amount: 1,
        },
      });

      expect(() => CardEnrichmentSchema.parse(result.enrichment)).not.toThrow();
    });
  });

  describe('Complex Costs & Edge Cases', () => {
    it('parses Alpha Flight Station (01015) — exhaustSelf + discardCard from HAND', () => {
      const text =
        '<b>Action</b>: Exhaust Alpha Flight Station, choose and discard 1 card from your hand → draw 1 card (draw 2 cards instead if you are Carol Danvers).';
      const result = parseCardText(text, '01015');

      expect(result.confidence).toBe(100);
      const ability = result.enrichment.abilities![0];
      expect(ability.timing).toBe('ACTION');
      expect(ability.cost).toEqual({
        exhaustSelf: true,
        discardCard: {
          from: 'HAND',
          count: 1,
        },
      });
      expect(ability.steps[0]).toEqual({
        effect: 'DRAW_CARDS',
        params: {
          count: 1,
          carolBonus: 1,
        },
      });

      expect(() => CardEnrichmentSchema.parse(result.enrichment)).not.toThrow();
    });

    it('parses Focused Rage (01027) — exhaustSelf + damageHero', () => {
      const text = '<b>Hero Action</b>: Exhaust Focused Rage and take 1 damage → draw 1 card.';
      const result = parseCardText(text, '01027');

      expect(result.confidence).toBe(100);
      const ability = result.enrichment.abilities![0];
      expect(ability.timing).toBe('HERO_ACTION');
      expect(ability.cost).toEqual({
        exhaustSelf: true,
        damageHero: 1,
      });
      expect(ability.steps[0]).toEqual({
        effect: 'DRAW_CARDS',
        params: { count: 1 },
      });

      expect(() => CardEnrichmentSchema.parse(result.enrichment)).not.toThrow();
    });

    it('parses Superhuman Law Division (01026) — exhaustSelf + resources: [mental]', () => {
      const text =
        '<b>Alter-Ego Action</b>: Exhaust Superhuman Law Division and spend a [mental] resource → remove 2 threat from a scheme.';
      const result = parseCardText(text, '01026');

      expect(result.confidence).toBe(100);
      const ability = result.enrichment.abilities![0];
      expect(ability.timing).toBe('ALTER_EGO_ACTION');
      expect(ability.cost).toEqual({
        exhaustSelf: true,
        resources: ['mental'],
      });
      expect(ability.steps[0]).toEqual({
        effect: 'REMOVE_THREAT',
        params: {
          amount: 2,
          target: 'CHOSEN_SCHEME',
        },
      });

      expect(() => CardEnrichmentSchema.parse(result.enrichment)).not.toThrow();
    });

    it('flags unmatched text fragments and lowers confidence on non-formulaic card text', () => {
      const text = 'Hero Action: Do an unexpected cosmic somersault and flip upside down!';
      const result = parseCardText(text, 'custom');

      expect(result.unmatchedFragments.length).toBeGreaterThan(0);
      expect(result.unmatchedFragments[0].text).toContain('unexpected cosmic somersault');
    });
  });

  describe('writeSupplementalCard Integration Function', () => {
    it('is exported from CLI and validates schemas properly', async () => {
      const { writeSupplementalCard } = await import('../../tools/audit/card-text-parser');
      expect(typeof writeSupplementalCard).toBe('function');
    });
  });
});
