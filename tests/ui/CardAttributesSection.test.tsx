import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CardAttributesSection } from '../../src/ui/components/editor/CardAttributesSection';

const StatefulCardAttributesSection: React.FC<{
  initial: any;
  onChange?: (val: any) => void;
  hasErrors?: boolean;
  errors?: string[];
  cardCode?: string;
}> = ({ initial, onChange, hasErrors, errors, cardCode }) => {
  const [data, setData] = React.useState(initial);
  return (
    <CardAttributesSection
      supplemental={data}
      hasErrors={hasErrors}
      errors={errors}
      cardCode={cardCode}
      onChange={(updated) => {
        setData(updated);
        onChange?.(updated);
      }}
    />
  );
};

describe('CardAttributesSection', () => {
  it('renders section headers and reveals all inputs when Show All is activated', async () => {
    const user = userEvent.setup();
    render(<CardAttributesSection supplemental={{}} onChange={vi.fn()} />);

    expect(screen.getByText(/CARD-LEVEL ATTRIBUTES & AUDIT/i)).toBeDefined();
    expect(screen.getByTestId('no-supplemental-needed-checkbox')).toBeDefined();

    // Verify all 3 section headers exist
    expect(screen.getByTestId('section-audit-metadata')).toBeDefined();
    expect(screen.getByTestId('section-card-mechanics')).toBeDefined();
    expect(screen.queryByTestId('section-combat-properties')).toBeNull();
    expect(screen.queryByTestId('section-layout-display')).toBeNull();
    expect(screen.getByTestId('section-play-requirements')).toBeDefined();

    // In default Smart View, collapsed sections do not render inputs
    expect(screen.queryByPlaceholderText(/e\.g\. Hero attack/i)).toBeNull();

    // Toggle Show All
    const toggleShowAllBtn = screen.getByTestId('toggle-show-all-fields-btn');
    await user.click(toggleShowAllBtn);

    // Now all inputs across all sections should be accessible
    expect(screen.getByPlaceholderText(/e\.g\. Hero attack/i)).toBeDefined();
    expect(screen.getByTestId('toggle-uses-btn')).toBeDefined();
    // Upstream-derived fields are not authored here
    expect(screen.queryByPlaceholderText(/Leave empty if unrestricted/i)).toBeNull();
    expect(screen.queryByTestId('card-traits-input')).toBeNull();
    expect(screen.queryByTestId('card-restricted-slots-input')).toBeNull();
    expect(screen.queryByTestId('card-additional-boost-cards-input')).toBeNull();
    expect(screen.queryByTestId('card-victory-points-input')).toBeNull();
    expect(screen.queryByTestId('card-is-landscape-checkbox')).toBeNull();
    expect(screen.queryByTestId('keyword-guard')).toBeNull();
    expect(screen.getByTestId('play-req-identity-form-select')).toBeDefined();
  });

  it('updates basic card metadata (comment)', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(<StatefulCardAttributesSection initial={{}} onChange={handleChange} />);

    // Expand Audit & Metadata to edit comments
    await user.click(screen.getByTestId('section-audit-metadata-toggle'));
    const commentInput = screen.getByPlaceholderText(/e\.g\. Hero attack/i);
    fireEvent.change(commentInput, { target: { value: 'Updated comment' } });
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        audit: expect.objectContaining({ comment: 'Updated comment' }),
      }),
    );
  });

  it('manages uses counters lifecycle (configure, update, remove)', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <StatefulCardAttributesSection
        initial={{ audit: { comment: 'Counters card' } }}
        onChange={handleChange}
      />,
    );

    // Expand Card Mechanics
    await user.click(screen.getByTestId('section-card-mechanics-toggle'));

    // Toggle Configure Uses
    const toggleBtn = screen.getByTestId('toggle-uses-btn');
    await user.click(toggleBtn);
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        uses: { count: 3, counterType: 'charge', discardOnEmpty: true },
      }),
    );

    // Update count, counterType, max, discardOnEmpty
    fireEvent.change(screen.getByTestId('uses-count-input'), { target: { value: '5' } });
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        uses: expect.objectContaining({ count: 5 }),
      }),
    );

    fireEvent.change(screen.getByTestId('uses-type-input'), {
      target: { value: 'web' },
    });
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        uses: expect.objectContaining({ counterType: 'web' }),
      }),
    );

    expect(screen.queryByTestId('uses-max-input')).toBeNull();

    await user.click(screen.getByTestId('uses-discard-on-empty-checkbox'));
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        uses: expect.objectContaining({ discardOnEmpty: undefined }),
      }),
    );

    // Remove Uses
    await user.click(screen.getByTestId('toggle-uses-btn'));
    expect(handleChange).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ uses: expect.anything() }),
    );
  });

  it('configures play requirements (identity form, form trait, traits, control filter)', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(<StatefulCardAttributesSection initial={{}} onChange={handleChange} />);

    // Expand Play Requirements
    await user.click(screen.getByTestId('section-play-requirements-toggle'));

    // Select identity form
    const formSelect = screen.getByTestId('play-req-identity-form-select');
    await user.selectOptions(formSelect, 'HERO');
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        playRequirements: expect.objectContaining({ identityForm: 'HERO' }),
      }),
    );

    // Form trait
    const formTraitInput = screen.getByTestId('play-req-form-trait-input');
    fireEvent.change(formTraitInput, { target: { value: 'Giant' } });
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        playRequirements: expect.objectContaining({ formTrait: 'Giant' }),
      }),
    );

    // Identity traits
    const identityTraitsInput = screen.getByTestId('play-req-identity-traits-input');
    fireEvent.change(identityTraitsInput, { target: { value: 'Avenger, Mystic' } });
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        playRequirements: expect.objectContaining({
          identityTraits: ['Avenger', 'Mystic'],
        }),
      }),
    );

    // Open control filter accordion
    const toggleControlFilter = screen.getByTestId('toggle-play-req-control-filter-btn');
    await user.click(toggleControlFilter);
    expect(screen.getByText(/Required Controlled Card Criteria/i)).toBeDefined();
  });

  it('renders validation error callout and auto-expands section with errors', () => {
    render(
      <CardAttributesSection
        supplemental={{}}
        onChange={vi.fn()}
        hasErrors={true}
        errors={['uses.count must be a number', 'playRequirements is invalid']}
      />,
    );

    expect(screen.getByText(/Attributes Issue/i)).toBeDefined();
    expect(screen.getByTestId('card-attributes-errors')).toBeDefined();
    expect(screen.getByText(/uses\.count must be a number/i)).toBeDefined();
    expect(screen.getByText(/playRequirements is invalid/i)).toBeDefined();

    // Card Mechanics should auto-expand because the uses error is routed to it
    expect(screen.getByTestId('toggle-uses-btn')).toBeDefined();
  });

  it('configures playUnderAnyPlayerControl and errata', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(<StatefulCardAttributesSection initial={{}} onChange={handleChange} />);

    // Expand Play Requirements for cross-player control
    await user.click(screen.getByTestId('section-play-requirements-toggle'));
    await user.click(screen.getByTestId('card-play-under-any-player-control-checkbox'));
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        playUnderAnyPlayerControl: true,
      }),
    );

    // Expand Audit & Metadata for errata
    await user.click(screen.getByTestId('section-audit-metadata-toggle'));
    fireEvent.change(screen.getByTestId('card-errata-input'), {
      target: { value: 'Official errata text' },
    });
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        errata: 'Official errata text',
      }),
    );
  });

  it('configures playRequirements identityNames and controlZones', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(<StatefulCardAttributesSection initial={{}} onChange={handleChange} />);

    // Expand Play Requirements
    await user.click(screen.getByTestId('section-play-requirements-toggle'));

    // identityNames
    fireEvent.change(screen.getByTestId('play-req-identity-names-input'), {
      target: { value: 'Peter Parker, Tony Stark' },
    });
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        playRequirements: expect.objectContaining({
          identityNames: ['Peter Parker', 'Tony Stark'],
        }),
      }),
    );

    // controlZones
    await user.click(screen.getByTestId('play-req-zone-tableau'));
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        playRequirements: expect.objectContaining({
          controlZones: ['tableau'],
        }),
      }),
    );

    await user.click(screen.getByTestId('play-req-zone-allies'));
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        playRequirements: expect.objectContaining({
          controlZones: ['tableau', 'allies'],
        }),
      }),
    );
  });

  it('renders rulesVersion badge and originalText preview in audit', () => {
    render(
      <CardAttributesSection
        supplemental={{
          audit: {
            rulesVersion: 'v1.8',
            originalText: 'Hero Action: Exhaust to do something.',
          },
        }}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId('card-audit-rules-version')).toBeDefined();

    // Audit & Metadata auto-expands due to originalText
    expect(screen.getByTestId('card-audit-original-text').textContent).toContain(
      'Hero Action: Exhaust to do something.',
    );
  });

  it('renders originalText formatted without raw HTML tags (Bug #143 regression)', () => {
    render(
      <CardAttributesSection
        supplemental={{
          audit: {
            rulesVersion: 'v1.8',
            confidence: 90,
            originalText: '<b>Hero Action</b>: Deal 3 [physical] damage to an enemy.',
          },
        }}
        onChange={vi.fn()}
      />,
    );

    // Audit & Metadata auto-expands due to originalText and confidence
    const originalTextContainer = screen.getByTestId('card-audit-original-text');
    expect(originalTextContainer.innerHTML).toContain('<b>Hero Action</b>');
    expect(originalTextContainer.textContent).not.toContain('<b>');
    expect(originalTextContainer.textContent).toContain('Hero Action');
    expect(originalTextContainer.textContent).toContain('Physical');
  });

  it('auto-expands sections when data is present on initial load', () => {
    render(
      <CardAttributesSection
        supplemental={{
          uses: { count: 2, counterType: 'charge' },
          playRequirements: { identityForm: 'HERO' },
        }}
        onChange={vi.fn()}
      />,
    );

    // Card Mechanics auto-expanded
    expect(screen.getByTestId('toggle-uses-btn')).toBeDefined();
    // Play Requirements auto-expanded
    expect(screen.getByTestId('play-req-identity-form-select')).toBeDefined();
    // Audit & Metadata remains collapsed
    expect(screen.queryByTestId('audit-ambiguity-file')).toBeNull();
  });

  it('resets showAllFields state when cardCode changes', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <CardAttributesSection cardCode="01001a" supplemental={{}} onChange={vi.fn()} />,
    );

    // Turn on Show All
    await user.click(screen.getByTestId('toggle-show-all-fields-btn'));
    expect(screen.getByText('Smart View')).toBeDefined();
    expect(screen.getByTestId('toggle-uses-btn')).toBeDefined();

    // Switch card
    rerender(<CardAttributesSection cardCode="01002a" supplemental={{}} onChange={vi.fn()} />);

    // State reset to Show All (Smart View active)
    expect(screen.getByText('Show All')).toBeDefined();
    expect(screen.queryByTestId('toggle-uses-btn')).toBeNull();
  });

  it('renders read-only audit timestamp badges when present, and omits them when absent', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <CardAttributesSection
        supplemental={{
          audit: {
            createdAt: '2026-08-27T23:00:00Z',
            updatedAt: '2026-09-14T18:37:00Z',
            reviewedAt: '2026-09-30T12:00:00Z',
          },
        }}
        onChange={vi.fn()}
      />,
    );

    // Expand Audit & Metadata
    await user.click(screen.getByTestId('section-audit-metadata-toggle'));

    const createdBadge = screen.getByTestId('audit-created-at');
    const updatedBadge = screen.getByTestId('audit-updated-at');
    const reviewedBadge = screen.getByTestId('audit-reviewed-at');

    expect(createdBadge.textContent).toContain('Created:');
    expect(updatedBadge.textContent).toContain('Updated:');
    expect(reviewedBadge.textContent).toContain('Reviewed:');

    // Verify badges are non-editable (spans, not inputs)
    expect(createdBadge.tagName.toLowerCase()).toBe('span');
    expect(updatedBadge.tagName.toLowerCase()).toBe('span');
    expect(reviewedBadge.tagName.toLowerCase()).toBe('span');

    // Rerender without timestamps
    rerender(
      <CardAttributesSection
        supplemental={{
          audit: {
            comment: 'No timestamps',
          },
        }}
        onChange={vi.fn()}
      />,
    );

    expect(screen.queryByTestId('audit-created-at')).toBeNull();
    expect(screen.queryByTestId('audit-updated-at')).toBeNull();
    expect(screen.queryByTestId('audit-reviewed-at')).toBeNull();
  });

  it('reads, writes, and clears audit.ambiguityFile correctly', () => {
    const handleChange = vi.fn();

    render(
      <StatefulCardAttributesSection
        initial={{
          audit: {
            comment: 'Spider-Sense',
            ambiguityFile: 'docs/ambiguities/spider-sense.md',
          },
        }}
        onChange={handleChange}
      />,
    );

    // Audit & Metadata is auto-expanded due to comment and ambiguityFile
    const ambiguityInput = screen.getByTestId('audit-ambiguity-file') as HTMLInputElement;
    expect(ambiguityInput.value).toBe('docs/ambiguities/spider-sense.md');

    // Update value
    fireEvent.change(ambiguityInput, {
      target: { value: 'docs/ambiguities/spider-sense-timing.md' },
    });
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        audit: expect.objectContaining({
          ambiguityFile: 'docs/ambiguities/spider-sense-timing.md',
        }),
      }),
    );

    // Clear value
    fireEvent.change(ambiguityInput, { target: { value: '' } });
    const lastCall = handleChange.mock.calls[handleChange.mock.calls.length - 1][0];
    expect(lastCall.audit.ambiguityFile).toBeUndefined();
    expect('ambiguityFile' in lastCall.audit).toBe(false);
  });
});
