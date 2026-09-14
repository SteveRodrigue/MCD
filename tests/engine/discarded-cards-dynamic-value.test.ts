import { describe, it, expect } from 'vitest';
import { evaluateDynamicAmount } from '../../src/engine/effects/dynamic-formula-evaluator';
import type { CardInstance } from '../../src/engine/models';

describe('DISCARDED_CARDS Dynamic Value Resolution (ADR-0052, Issue #117)', () => {
  const createMockCard = (
    name: string,
    overrides: {
      type?: string;
      traits?: string[];
      resources?: {
        physical?: number;
        energy?: number;
        mental?: number;
        wild?: number;
        total?: number;
      };
      boostIcons?: number;
      cost?: number;
    } = {},
  ): CardInstance => {
    const phys = overrides.resources?.physical ?? 0;
    const energy = overrides.resources?.energy ?? 0;
    const mental = overrides.resources?.mental ?? 0;
    const wild = overrides.resources?.wild ?? 0;
    const total = overrides.resources?.total ?? phys + energy + mental + wild;

    return {
      instanceId: `inst-${name}-${Math.random()}`,
      card: {
        code: `code-${name}`,
        name,
        type: (overrides.type as any) || 'event',
        faction: 'basic',
        packCode: 'core',
        position: 1,
        quantity: 1,
        deckLimit: 3,
        isUnique: false,
        text: '',
        traits: overrides.traits || [],
        keywords: [],
        resources: {
          physical: phys,
          energy,
          mental,
          wild,
          total,
        },
        boostIcons: overrides.boostIcons,
        cost: overrides.cost,
        raw: {
          code: `code-${name}`,
          name,
          type_code: overrides.type || 'event',
          resource_physical: phys,
          resource_energy: energy,
          resource_mental: mental,
          resource_wild: wild,
          boost: overrides.boostIcons,
          cost: overrides.cost,
        },
      } as any,
    };
  };

  describe('1. Empty Discard & Null Safety', () => {
    it('returns 0 safely when no cards were discarded in execution context', () => {
      const attributes = [
        'COUNT',
        'RESOURCE_ICONS',
        'DIFFERENT_RESOURCES',
        'BOOST_ICONS',
        'DIFFERENT_CARD_TYPES',
        'PRINTED_COST',
      ] as const;

      for (const attr of attributes) {
        expect(evaluateDynamicAmount({ from: 'DISCARDED_CARDS', discardAttribute: attr }, {})).toBe(
          0,
        );

        expect(
          evaluateDynamicAmount(
            { from: 'DISCARDED_CARDS', discardAttribute: attr },
            { discardedCards: [] },
          ),
        ).toBe(0);

        expect(
          evaluateDynamicAmount(
            { from: 'DISCARDED_CARDS', discardAttribute: attr },
            { previousResult: { discardedCards: [] } as any },
          ),
        ).toBe(0);
      }
    });
  });

  describe('2. COUNT Inspection Attribute', () => {
    it('counts total cards discarded without filter', () => {
      const cards = [createMockCard('Card 1'), createMockCard('Card 2'), createMockCard('Card 3')];

      const result = evaluateDynamicAmount(
        { from: 'DISCARDED_CARDS', discardAttribute: 'COUNT' },
        { discardedCards: cards },
      );
      expect(result).toBe(3);
    });

    it('defaults to COUNT when discardAttribute and resourceType are omitted', () => {
      const cards = [createMockCard('Card 1'), createMockCard('Card 2')];

      const result = evaluateDynamicAmount({ from: 'DISCARDED_CARDS' }, { discardedCards: cards });
      expect(result).toBe(2);
    });
  });

  describe('3. RESOURCE_ICONS Inspection Attribute', () => {
    it('returns 0 bonus when discarded cards contain 0 matching resource icons', () => {
      const cards = [
        createMockCard('Card 1', { resources: { physical: 1 } }),
        createMockCard('Card 2', { resources: { mental: 2 } }),
      ];

      const result = evaluateDynamicAmount(
        { from: 'DISCARDED_CARDS', discardAttribute: 'RESOURCE_ICONS', resourceType: 'energy' },
        { discardedCards: cards },
      );
      expect(result).toBe(0);
    });

    it('sums specific resource type icons across multiple cards including double resources', () => {
      const cards = [
        createMockCard('Energy 1', { resources: { energy: 1 } }),
        createMockCard('Double Energy', { resources: { energy: 2 } }),
        createMockCard('Mental 1', { resources: { mental: 1 } }),
      ];

      const result = evaluateDynamicAmount(
        {
          from: 'DISCARDED_CARDS',
          discardAttribute: 'RESOURCE_ICONS',
          resourceType: 'energy',
          multiplier: 2,
        },
        { discardedCards: cards },
      );
      // 3 energy icons * 2 multiplier = 6
      expect(result).toBe(6);
    });

    it('does NOT count wild resource icons when looking for a specific type (e.g. energy)', () => {
      const cards = [
        createMockCard('Wild Card', { resources: { wild: 1 } }),
        createMockCard('Energy Card', { resources: { energy: 1 } }),
      ];

      const result = evaluateDynamicAmount(
        { from: 'DISCARDED_CARDS', discardAttribute: 'RESOURCE_ICONS', resourceType: 'energy' },
        { discardedCards: cards },
      );
      // Only energy counts, wild is ignored
      expect(result).toBe(1);
    });

    it('counts wild resource icons when resourceType is explicitly "wild"', () => {
      const cards = [
        createMockCard('Wild 1', { resources: { wild: 1 } }),
        createMockCard('Wild 2', { resources: { wild: 2 } }),
        createMockCard('Energy 1', { resources: { energy: 1 } }),
      ];

      const result = evaluateDynamicAmount(
        { from: 'DISCARDED_CARDS', discardAttribute: 'RESOURCE_ICONS', resourceType: 'wild' },
        { discardedCards: cards },
      );
      expect(result).toBe(3);
    });

    it('sums ALL printed resource icons when resourceType is omitted', () => {
      const cards = [
        createMockCard('Card 1', { resources: { physical: 1, energy: 1 } }),
        createMockCard('Card 2', { resources: { mental: 1, wild: 1 } }),
      ];

      const result = evaluateDynamicAmount(
        { from: 'DISCARDED_CARDS', discardAttribute: 'RESOURCE_ICONS' },
        { discardedCards: cards },
      );
      // 1 physical + 1 energy + 1 mental + 1 wild = 4
      expect(result).toBe(4);
    });

    it('infers RESOURCE_ICONS when resourceType is present even if discardAttribute is omitted', () => {
      const cards = [createMockCard('Energy 1', { resources: { energy: 2 } })];

      const result = evaluateDynamicAmount(
        { from: 'DISCARDED_CARDS', resourceType: 'energy' },
        { discardedCards: cards },
      );
      expect(result).toBe(2);
    });
  });

  describe('4. DIFFERENT_RESOURCES Inspection Attribute', () => {
    it('returns 1 when all discarded cards share the same single resource type', () => {
      const cards = [
        createMockCard('Card 1', { resources: { energy: 1 } }),
        createMockCard('Card 2', { resources: { energy: 2 } }),
      ];

      const result = evaluateDynamicAmount(
        { from: 'DISCARDED_CARDS', discardAttribute: 'DIFFERENT_RESOURCES' },
        { discardedCards: cards },
      );
      expect(result).toBe(1);
    });

    it('returns count of unique printed resource types across cards (up to 4)', () => {
      const cards = [
        createMockCard('Card 1', { resources: { physical: 1, energy: 1 } }),
        createMockCard('Card 2', { resources: { mental: 1 } }),
        createMockCard('Card 3', { resources: { wild: 1 } }),
      ];

      const result = evaluateDynamicAmount(
        { from: 'DISCARDED_CARDS', discardAttribute: 'DIFFERENT_RESOURCES' },
        { discardedCards: cards },
      );
      expect(result).toBe(4);
    });

    it('returns 0 when cards have no printed resources', () => {
      const cards = [createMockCard('No Res 1', { resources: { total: 0 } })];

      const result = evaluateDynamicAmount(
        { from: 'DISCARDED_CARDS', discardAttribute: 'DIFFERENT_RESOURCES' },
        { discardedCards: cards },
      );
      expect(result).toBe(0);
    });
  });

  describe('5. BOOST_ICONS Inspection Attribute', () => {
    it('sums boost icons on discarded cards', () => {
      const cards = [
        createMockCard('Encounter 1', { boostIcons: 2 }),
        createMockCard('Encounter 2', { boostIcons: 1 }),
        createMockCard('Encounter 3', { boostIcons: 0 }),
      ];

      const result = evaluateDynamicAmount(
        { from: 'DISCARDED_CARDS', discardAttribute: 'BOOST_ICONS' },
        { discardedCards: cards },
      );
      expect(result).toBe(3);
    });

    it('treats missing or undefined boost icons as 0', () => {
      const cards = [createMockCard('Player Card', {})];

      const result = evaluateDynamicAmount(
        { from: 'DISCARDED_CARDS', discardAttribute: 'BOOST_ICONS' },
        { discardedCards: cards },
      );
      expect(result).toBe(0);
    });
  });

  describe('6. DIFFERENT_CARD_TYPES Inspection Attribute', () => {
    it('counts unique card types across discarded cards', () => {
      const cards = [
        createMockCard('Event 1', { type: 'event' }),
        createMockCard('Event 2', { type: 'event' }),
        createMockCard('Upgrade 1', { type: 'upgrade' }),
        createMockCard('Ally 1', { type: 'ally' }),
      ];

      const result = evaluateDynamicAmount(
        { from: 'DISCARDED_CARDS', discardAttribute: 'DIFFERENT_CARD_TYPES' },
        { discardedCards: cards },
      );
      expect(result).toBe(3);
    });
  });

  describe('7. PRINTED_COST Inspection Attribute', () => {
    it('sums printed cost across discarded cards', () => {
      const cards = [
        createMockCard('Card A', { cost: 3 }),
        createMockCard('Card B', { cost: 2 }),
        createMockCard('Card C', { cost: 0 }),
      ];

      const result = evaluateDynamicAmount(
        { from: 'DISCARDED_CARDS', discardAttribute: 'PRINTED_COST' },
        { discardedCards: cards },
      );
      expect(result).toBe(5);
    });
  });

  describe('8. Filtered Discard Counting', () => {
    it('filters candidate discarded cards matching filter criteria before evaluation', () => {
      const cards = [
        createMockCard('Tech Upgrade', { type: 'upgrade', traits: ['Tech'] }),
        createMockCard('Weapon Upgrade', { type: 'upgrade', traits: ['Weapon'] }),
        createMockCard('Event Card', { type: 'event' }),
      ];

      const result = evaluateDynamicAmount(
        {
          from: 'DISCARDED_CARDS',
          discardAttribute: 'COUNT',
          filter: {
            types: ['upgrade'],
            traits: ['Tech'],
          },
        },
        { discardedCards: cards },
      );
      expect(result).toBe(1);
    });
  });

  describe('9. Mathematical Modifiers, Clamping & Scaling', () => {
    it('applies multiplier, offset, and clamping correctly', () => {
      const cards = [createMockCard('Card 1'), createMockCard('Card 2'), createMockCard('Card 3')];

      // baseValue = 3, * 2 = 6, offset -1 = 5, clamped to max 4
      const result = evaluateDynamicAmount(
        {
          from: 'DISCARDED_CARDS',
          discardAttribute: 'COUNT',
          multiplier: 2,
          offset: -1,
          clamp: { max: 4 },
        },
        { discardedCards: cards },
      );
      expect(result).toBe(4);
    });

    it('never returns below 0 even with large negative offset', () => {
      const cards = [createMockCard('Card 1')];

      const result = evaluateDynamicAmount(
        {
          from: 'DISCARDED_CARDS',
          discardAttribute: 'COUNT',
          offset: -10,
        },
        { discardedCards: cards },
      );
      expect(result).toBe(0);
    });
  });
});
