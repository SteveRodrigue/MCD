import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CardAttributesSection } from '../../src/ui/components/editor/CardAttributesSection';
import {
  getSectionVisibility,
  countAuditFields,
  countMechanicsFields,
  countPlayReqFields,
} from '../../src/ui/components/editor/card-attributes-utils';

describe('Type-Aware Field Visibility (DOM Removal) & Badges', () => {
  describe('getSectionVisibility helper', () => {
    it('returns all visible if showAll is true', () => {
      const vis = getSectionVisibility('treachery', true);
      expect(vis).toEqual({
        mechanics: true,
        playReqs: true,
      });
    });

    it('returns all visible if typeCode is undefined', () => {
      const vis = getSectionVisibility(undefined, false);
      expect(vis).toEqual({
        mechanics: true,
        playReqs: true,
      });
    });

    it('configures visibility correctly for ally', () => {
      const vis = getSectionVisibility('ally', false);
      expect(vis.playReqs).toBe(true);
      expect(vis.mechanics).toBe(true);
    });

    it('configures visibility correctly for side_scheme', () => {
      const vis = getSectionVisibility('side_scheme', false);
      expect(vis.playReqs).toBe(false);
      expect(vis.mechanics).toBe(true);
    });

    it('configures visibility correctly for treachery', () => {
      const vis = getSectionVisibility('treachery', false);
      expect(vis.mechanics).toBe(false);
      expect(vis.playReqs).toBe(false);
    });
  });

  describe('CardAttributesSection DOM visibility', () => {
    it('ally card shows Card Mechanics and Play Requirements and has no Combat or Layout sections', () => {
      render(<CardAttributesSection supplemental={{}} onChange={vi.fn()} typeCode="ally" />);

      expect(screen.getByTestId('section-audit-metadata')).toBeDefined();
      expect(screen.getByTestId('section-card-mechanics')).toBeDefined();
      expect(screen.getByTestId('section-play-requirements')).toBeDefined();

      // The upstream-derived Combat and Layout sections no longer exist
      expect(screen.queryByTestId('section-combat-properties')).toBeNull();
      expect(screen.queryByTestId('section-layout-display')).toBeNull();
    });

    it('side_scheme card hides Play Requirements', () => {
      render(<CardAttributesSection supplemental={{}} onChange={vi.fn()} typeCode="side_scheme" />);

      expect(screen.getByTestId('section-audit-metadata')).toBeDefined();
      expect(screen.getByTestId('section-card-mechanics')).toBeDefined();

      // Play Requirements should be removed from DOM
      expect(screen.queryByTestId('section-play-requirements')).toBeNull();
    });

    it('treachery card hides Card Mechanics and Play Requirements', () => {
      render(<CardAttributesSection supplemental={{}} onChange={vi.fn()} typeCode="treachery" />);

      expect(screen.getByTestId('section-audit-metadata')).toBeDefined();
      expect(screen.queryByTestId('section-card-mechanics')).toBeNull();
      expect(screen.queryByTestId('section-play-requirements')).toBeNull();
    });

    it('Show all fields toggle overrides type visibility and reveals all sections', async () => {
      const user = userEvent.setup();
      render(<CardAttributesSection supplemental={{}} onChange={vi.fn()} typeCode="treachery" />);

      // Treachery initially hides mechanics and playReqs
      expect(screen.queryByTestId('section-card-mechanics')).toBeNull();
      expect(screen.queryByTestId('section-play-requirements')).toBeNull();

      // Click "Show All" toggle
      await user.click(screen.getByTestId('toggle-show-all-fields-btn'));

      // All sections are now present in DOM
      expect(screen.getByTestId('section-audit-metadata')).toBeDefined();
      expect(screen.getByTestId('section-card-mechanics')).toBeDefined();
      expect(screen.getByTestId('section-play-requirements')).toBeDefined();
    });

    it('hidden section becomes visible when its data fields have values', () => {
      // Treachery normally hides card mechanics and play requirements, but data forces them visible
      render(
        <CardAttributesSection
          supplemental={{
            uses: { count: 2, counterType: 'charge' },
            playUnderAnyPlayerControl: true,
          }}
          onChange={vi.fn()}
          typeCode="treachery"
        />,
      );

      expect(screen.getByTestId('section-card-mechanics')).toBeDefined();
      expect(screen.getByTestId('section-play-requirements')).toBeDefined();
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
          uses: { count: 2 },
          recipient: { type: 'FIRST_PLAYER' },
          attachTo: { host: { type: 'VILLAIN' } },
        }),
      ).toBe(3);

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
            uses: { count: 2, counterType: 'charge' },
          }}
          onChange={vi.fn()}
        />,
      );

      // Card mechanics has 1 field configured (uses)
      const mechanicsBadge = screen.getByTestId('section-card-mechanics-badge');
      expect(mechanicsBadge.textContent).toBe('1');

      // Play requirements has 0 fields configured -> no badge rendered
      expect(screen.queryByTestId('section-play-requirements-badge')).toBeNull();

      // Update supplemental to add play requirement fields
      rerender(
        <CardAttributesSection
          supplemental={{
            uses: { count: 2, counterType: 'charge' },
            playRequirements: { identityForm: 'HERO', formTrait: 'Giant' },
          }}
          onChange={vi.fn()}
        />,
      );

      const playReqBadge = screen.getByTestId('section-play-requirements-badge');
      expect(playReqBadge.textContent).toBe('2');
    });

    it('resets section expansion when switching cardCode', () => {
      const { rerender } = render(
        <CardAttributesSection
          cardCode="01001a"
          supplemental={{
            uses: { count: 2, counterType: 'charge' },
          }}
          onChange={vi.fn()}
        />,
      );

      // Card 01001a has uses -> Card Mechanics is open
      expect(screen.getByTestId('toggle-uses-btn')).toBeDefined();
      // Play Requirements is empty -> collapsed
      expect(screen.queryByTestId('play-req-identity-form-select')).toBeNull();

      // Switch to card 01002 with play requirements and no mechanics
      rerender(
        <CardAttributesSection
          cardCode="01002"
          supplemental={{
            playRequirements: { identityForm: 'HERO' },
          }}
          onChange={vi.fn()}
        />,
      );

      // Card Mechanics is now empty -> collapsed
      expect(screen.queryByTestId('toggle-uses-btn')).toBeNull();
      // Play Requirements is now filled -> open
      expect(screen.getByTestId('play-req-identity-form-select')).toBeDefined();
    });
  });
});
