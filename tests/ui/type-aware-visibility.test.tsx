import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CardAttributesSection } from '../../src/ui/components/editor/CardAttributesSection';
import {
  getSectionVisibility,
  countAuditFields,
  countMechanicsFields,
  countCombatFields,
  countLayoutFields,
  countPlayReqFields,
} from '../../src/ui/components/editor/card-attributes-utils';

describe('Type-Aware Field Visibility (DOM Removal) & Badges', () => {
  describe('getSectionVisibility helper', () => {
    it('returns all visible if showAll is true', () => {
      const vis = getSectionVisibility('treachery', true);
      expect(vis).toEqual({
        mechanics: true,
        combat: true,
        layout: true,
        playReqs: true,
      });
    });

    it('returns all visible if typeCode is undefined', () => {
      const vis = getSectionVisibility(undefined, false);
      expect(vis).toEqual({
        mechanics: true,
        combat: true,
        layout: true,
        playReqs: true,
      });
    });

    it('configures visibility correctly for ally', () => {
      const vis = getSectionVisibility('ally', false);
      expect(vis.combat).toBe(true);
      expect(vis.playReqs).toBe(true);
      expect(vis.mechanics).toBe(true);
      expect(vis.layout).toBe(false);
    });

    it('configures visibility correctly for side_scheme', () => {
      const vis = getSectionVisibility('side_scheme', false);
      expect(vis.layout).toBe(true);
      expect(vis.combat).toBe(false);
      expect(vis.playReqs).toBe(false);
      expect(vis.mechanics).toBe(true);
    });

    it('configures visibility correctly for treachery', () => {
      const vis = getSectionVisibility('treachery', false);
      expect(vis.mechanics).toBe(false);
      expect(vis.combat).toBe(false);
      expect(vis.layout).toBe(false);
      expect(vis.playReqs).toBe(false);
    });
  });

  describe('CardAttributesSection DOM visibility', () => {
    it('ally card shows Combat Properties and hides Layout & Display from DOM', () => {
      render(<CardAttributesSection supplemental={{}} onChange={vi.fn()} typeCode="ally" />);

      expect(screen.getByTestId('section-audit-metadata')).toBeDefined();
      expect(screen.getByTestId('section-card-mechanics')).toBeDefined();
      expect(screen.getByTestId('section-combat-properties')).toBeDefined();
      expect(screen.getByTestId('section-play-requirements')).toBeDefined();

      // Layout & Display should be completely removed from DOM
      expect(screen.queryByTestId('section-layout-display')).toBeNull();
    });

    it('side_scheme card shows Layout & Display and hides Combat Properties & Play Requirements', () => {
      render(<CardAttributesSection supplemental={{}} onChange={vi.fn()} typeCode="side_scheme" />);

      expect(screen.getByTestId('section-audit-metadata')).toBeDefined();
      expect(screen.getByTestId('section-card-mechanics')).toBeDefined();
      expect(screen.getByTestId('section-layout-display')).toBeDefined();

      // Combat and Play Requirements should be removed from DOM
      expect(screen.queryByTestId('section-combat-properties')).toBeNull();
      expect(screen.queryByTestId('section-play-requirements')).toBeNull();
    });

    it('treachery card hides Card Mechanics, Combat Properties, Layout & Display, and Play Requirements', () => {
      render(<CardAttributesSection supplemental={{}} onChange={vi.fn()} typeCode="treachery" />);

      expect(screen.getByTestId('section-audit-metadata')).toBeDefined();
      expect(screen.queryByTestId('section-card-mechanics')).toBeNull();
      expect(screen.queryByTestId('section-combat-properties')).toBeNull();
      expect(screen.queryByTestId('section-layout-display')).toBeNull();
      expect(screen.queryByTestId('section-play-requirements')).toBeNull();
    });

    it('Show all fields toggle overrides type visibility and reveals all sections', async () => {
      const user = userEvent.setup();
      render(<CardAttributesSection supplemental={{}} onChange={vi.fn()} typeCode="treachery" />);

      // Treachery initially hides mechanics, combat, layout, playReqs
      expect(screen.queryByTestId('section-card-mechanics')).toBeNull();
      expect(screen.queryByTestId('section-combat-properties')).toBeNull();
      expect(screen.queryByTestId('section-layout-display')).toBeNull();
      expect(screen.queryByTestId('section-play-requirements')).toBeNull();

      // Click "Show All" toggle
      await user.click(screen.getByTestId('toggle-show-all-fields-btn'));

      // All sections are now present in DOM
      expect(screen.getByTestId('section-audit-metadata')).toBeDefined();
      expect(screen.getByTestId('section-card-mechanics')).toBeDefined();
      expect(screen.getByTestId('section-combat-properties')).toBeDefined();
      expect(screen.getByTestId('section-layout-display')).toBeDefined();
      expect(screen.getByTestId('section-play-requirements')).toBeDefined();
    });

    it('hidden section becomes visible when its data fields have values', () => {
      // Treachery normally hides combat properties, but if attackCost is set, it forces visible
      render(
        <CardAttributesSection
          supplemental={{
            attackCost: 2,
            isLandscape: true,
          }}
          onChange={vi.fn()}
          typeCode="treachery"
        />,
      );

      // Even though treachery normally hides combat and layout, existing data keeps them visible
      expect(screen.getByTestId('section-combat-properties')).toBeDefined();
      expect(screen.getByTestId('section-layout-display')).toBeDefined();
    });
  });

  describe('Section Badges & Counting Helpers (Task 4.4)', () => {
    it('calculates counts per section correctly', () => {
      expect(
        countAuditFields(
          { comment: 'test', confidence: 100, reviewedBy: 'dev' },
          { errata: 'Official errata' },
        ),
      ).toBe(4);

      expect(
        countMechanicsFields({
          keywords: ['Tough'],
          traits: ['Gamma'],
          uses: { count: 2 },
          maxPerPlayer: 1,
          restrictedSlots: 1,
        }),
      ).toBe(5);

      expect(
        countCombatFields({
          attackCost: 1,
          thwartCost: 1,
          additionalBoostCards: 2,
        }),
      ).toBe(3);

      expect(
        countLayoutFields({
          isLandscape: true,
          victoryPoints: 2,
        }),
      ).toBe(2);

      expect(
        countPlayReqFields({
          playRequirements: {
            identityForm: 'HERO',
            formTrait: 'Giant',
            identityTraits: ['Avenger'],
            identityNames: ['Steve Rogers'],
            controlZones: ['tableau'],
            controlFilter: { traits: ['Tech'] },
          },
          playUnderAnyPlayerControl: true,
        }),
      ).toBe(7);
    });

    it('renders badges in title bars reactively when fields are configured and omits when 0', () => {
      const { rerender } = render(
        <CardAttributesSection
          supplemental={{
            traits: ['Avenger'],
            attackCost: 1,
            thwartCost: 2,
          }}
          onChange={vi.fn()}
        />,
      );

      // Card mechanics has 1 field configured (traits)
      const mechanicsBadge = screen.getByTestId('section-card-mechanics-badge');
      expect(mechanicsBadge.textContent).toBe('1');

      // Combat properties has 2 fields configured (attackCost, thwartCost)
      const combatBadge = screen.getByTestId('section-combat-properties-badge');
      expect(combatBadge.textContent).toBe('2');

      // Layout & Display has 0 fields configured -> no badge rendered
      expect(screen.queryByTestId('section-layout-display-badge')).toBeNull();

      // Update supplemental to add layout fields
      rerender(
        <CardAttributesSection
          supplemental={{
            traits: ['Avenger'],
            attackCost: 1,
            thwartCost: 2,
            victoryPoints: 3,
            isLandscape: true,
          }}
          onChange={vi.fn()}
        />,
      );

      const layoutBadge = screen.getByTestId('section-layout-display-badge');
      expect(layoutBadge.textContent).toBe('2');
    });

    it('resets section expansion when switching cardCode', () => {
      const { rerender } = render(
        <CardAttributesSection
          cardCode="01001a"
          supplemental={{
            traits: ['Avenger'],
          }}
          onChange={vi.fn()}
        />,
      );

      // Card 01001a has traits -> Card Mechanics is open
      expect(screen.getByTestId('card-traits-input')).toBeDefined();
      // Combat Properties is empty -> collapsed
      expect(screen.queryByTestId('card-attack-cost-input')).toBeNull();

      // Switch to card 01002 with combat data and no mechanics
      rerender(
        <CardAttributesSection
          cardCode="01002"
          supplemental={{
            attackCost: 3,
          }}
          onChange={vi.fn()}
        />,
      );

      // Card Mechanics is now empty -> collapsed
      expect(screen.queryByTestId('card-traits-input')).toBeNull();
      // Combat Properties is now filled -> open
      expect(screen.getByTestId('card-attack-cost-input')).toBeDefined();
    });
  });
});
