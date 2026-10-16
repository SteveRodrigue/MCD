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

const CHIP_KEYS = [
  'playRequirements',
  'uses',
  'attachTo',
  'recipient',
  'playUnderAnyPlayerControl',
  'errata',
] as const;

describe('CardAttributesSection card-level chip bar', () => {
  it('offers one chip per CardEnrichment key and no Smart View / Show All toggle', () => {
    render(<CardAttributesSection supplemental={{}} onChange={vi.fn()} />);

    expect(screen.getByText(/CARD-LEVEL ATTRIBUTES & AUDIT/i)).toBeDefined();
    expect(screen.getByTestId('no-supplemental-needed-checkbox')).toBeDefined();
    expect(screen.queryByTestId('toggle-show-all-fields-btn')).toBeNull();
    for (const key of CHIP_KEYS) {
      expect(screen.getByTestId(`card-chip-add-${key}`)).toBeDefined();
      expect(screen.queryByTestId(`card-section-${key}`)).toBeNull();
    }
    expect(screen.getByText('Play Requirements')).toBeDefined();
    expect(screen.getByText('Uses / Counters')).toBeDefined();
    expect(screen.getByText('Attachment Host')).toBeDefined();
    expect(screen.getByText('Obligation Recipient')).toBeDefined();
    expect(screen.getByText('Cross-Player Control')).toBeDefined();
    expect(screen.getByText('Errata')).toBeDefined();

    // Upstream-derived fields are not authored here
    expect(screen.queryByTestId('card-traits-input')).toBeNull();
    expect(screen.queryByTestId('card-restricted-slots-input')).toBeNull();
    expect(screen.queryByTestId('card-victory-points-input')).toBeNull();
    expect(screen.queryByTestId('card-is-landscape-checkbox')).toBeNull();
  });

  it('renders populated keys expanded, with no chip for them', () => {
    render(
      <CardAttributesSection
        supplemental={{
          uses: { count: 2, counterType: 'charge' },
          playRequirements: { identityForm: 'HERO' },
          errata: 'Official text',
        }}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId('card-section-uses')).toBeDefined();
    expect(screen.getByTestId('card-section-playRequirements')).toBeDefined();
    expect(screen.getByTestId('card-section-errata')).toBeDefined();
    expect(screen.queryByTestId('card-chip-add-uses')).toBeNull();
    expect(screen.queryByTestId('card-chip-add-playRequirements')).toBeNull();
    expect(screen.queryByTestId('card-chip-add-errata')).toBeNull();
    expect(screen.getByTestId('card-chip-add-attachTo')).toBeDefined();
    expect((screen.getByTestId('play-req-identity-form') as HTMLSelectElement).value).toBe('HERO');
    expect((screen.getByTestId('card-errata-input') as HTMLInputElement).value).toBe(
      'Official text',
    );
  });

  it.each([
    ['playRequirements', {}],
    ['uses', { count: 3, counterType: 'charge', discardOnEmpty: true }],
    ['attachTo', { host: { type: 'VILLAIN' } }],
    ['recipient', { type: 'REVEALING_PLAYER' }],
    ['playUnderAnyPlayerControl', true],
    ['errata', ''],
  ])('adding the %s chip writes its default value and renders its form', async (key, initial) => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(<StatefulCardAttributesSection initial={{}} onChange={handleChange} />);

    await user.click(screen.getByTestId(`card-chip-add-${key}`));

    expect(handleChange).toHaveBeenLastCalledWith({ [key]: initial });
    expect(screen.getByTestId(`card-section-${key}`)).toBeDefined();
    expect(screen.queryByTestId(`card-chip-add-${key}`)).toBeNull();
  });

  it.each(CHIP_KEYS)('the remove control of the %s section deletes the key', async (key) => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    const initial: Record<string, unknown> = {
      playRequirements: { identityForm: 'HERO' },
      uses: { count: 1 },
      attachTo: { host: { type: 'VILLAIN' } },
      recipient: { type: 'FIRST_PLAYER' },
      playUnderAnyPlayerControl: true,
      errata: 'x',
      abilities: [],
    };
    render(<StatefulCardAttributesSection initial={initial} onChange={handleChange} />);

    await user.click(screen.getByTestId(`card-chip-remove-${key}`));

    const next = handleChange.mock.calls[handleChange.mock.calls.length - 1][0];
    expect(key in next).toBe(false);
    expect(next.abilities).toEqual([]);
    expect(screen.queryByTestId(`card-section-${key}`)).toBeNull();
    expect(screen.getByTestId(`card-chip-add-${key}`)).toBeDefined();
  });

  it('manages uses counters (update fields, unset discardOnEmpty)', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(
      <StatefulCardAttributesSection
        initial={{ audit: { comment: 'Counters card' } }}
        onChange={handleChange}
      />,
    );

    await user.click(screen.getByTestId('card-chip-add-uses'));
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({ uses: { count: 3, counterType: 'charge', discardOnEmpty: true } }),
    );

    fireEvent.change(screen.getByTestId('uses-count'), { target: { value: '5' } });
    expect(handleChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ uses: expect.objectContaining({ count: 5 }) }),
    );

    fireEvent.change(screen.getByTestId('uses-counter-type'), { target: { value: 'web' } });
    expect(handleChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ uses: expect.objectContaining({ counterType: 'web' }) }),
    );

    await user.click(screen.getByTestId('uses-discard-on-empty'));
    const last = handleChange.mock.calls[handleChange.mock.calls.length - 1][0];
    expect(last.uses).toEqual({ count: 5, counterType: 'web' });
    expect('discardOnEmpty' in last.uses).toBe(false);
  });

  it('configures play requirements (identity form, traits, names, zones)', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(
      <StatefulCardAttributesSection initial={{ playRequirements: {} }} onChange={handleChange} />,
    );

    await user.selectOptions(screen.getByTestId('play-req-identity-form'), 'HERO');
    expect(handleChange).toHaveBeenLastCalledWith({ playRequirements: { identityForm: 'HERO' } });

    fireEvent.change(screen.getByTestId('play-req-form-trait'), { target: { value: 'Giant' } });
    expect(handleChange).toHaveBeenLastCalledWith({
      playRequirements: { identityForm: 'HERO', formTrait: 'Giant' },
    });

    fireEvent.change(screen.getByTestId('play-req-identity-traits'), {
      target: { value: 'Avenger, Mystic' },
    });
    expect(handleChange).toHaveBeenLastCalledWith({
      playRequirements: {
        identityForm: 'HERO',
        formTrait: 'Giant',
        identityTraits: ['Avenger', 'Mystic'],
      },
    });

    fireEvent.change(screen.getByTestId('play-req-identity-names'), {
      target: { value: 'Peter Parker, Tony Stark' },
    });
    expect(handleChange).toHaveBeenLastCalledWith({
      playRequirements: expect.objectContaining({
        identityNames: ['Peter Parker', 'Tony Stark'],
      }),
    });

    await user.click(screen.getByTestId('play-req-control-zones-tableau'));
    await user.click(screen.getByTestId('play-req-control-zones-allies'));
    expect(handleChange).toHaveBeenLastCalledWith({
      playRequirements: expect.objectContaining({ controlZones: ['tableau', 'allies'] }),
    });

    // The controlled-card criteria is a card-filter field
    await user.click(screen.getByTestId('play-req-control-filter-toggle'));
    expect(screen.getByTestId('filter-codes-input')).toBeDefined();
  });

  it('clearing the last play requirement keeps the (now empty) section until it is removed', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(
      <StatefulCardAttributesSection
        initial={{ playRequirements: { formTrait: 'Giant' } }}
        onChange={handleChange}
      />,
    );

    fireEvent.change(screen.getByTestId('play-req-form-trait'), { target: { value: '' } });
    expect(handleChange).toHaveBeenLastCalledWith({ playRequirements: {} });
    expect(screen.getByTestId('card-section-playRequirements')).toBeDefined();

    await user.click(screen.getByTestId('card-chip-remove-playRequirements'));
    expect('playRequirements' in handleChange.mock.calls.at(-1)![0]).toBe(false);
  });

  it('configures playUnderAnyPlayerControl and errata', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(<StatefulCardAttributesSection initial={{}} onChange={handleChange} />);

    await user.click(screen.getByTestId('card-chip-add-playUnderAnyPlayerControl'));
    expect(screen.getByTestId('card-play-under-any-player-control-checkbox')).toBeDefined();

    await user.click(screen.getByTestId('card-chip-add-errata'));
    fireEvent.change(screen.getByTestId('card-errata-input'), {
      target: { value: 'Official errata text' },
    });
    expect(handleChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ playUnderAnyPlayerControl: true, errata: 'Official errata text' }),
    );
  });

  it('renders validation error callout', () => {
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
  });

  it('keeps the Vanilla Card checkbox, removing abilities after confirmation', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    const originalConfirm = window.confirm;
    const confirm = vi.fn(() => true);
    window.confirm = confirm;
    render(
      <StatefulCardAttributesSection
        initial={{ abilities: [{ id: 'a', timing: 'ACTION', steps: [] }] }}
        onChange={handleChange}
      />,
    );

    await user.click(screen.getByTestId('no-supplemental-needed-checkbox'));
    expect(confirm).toHaveBeenCalled();
    const next = handleChange.mock.calls.at(-1)![0];
    expect(next.noSupplementalNeeded).toBe(true);
    expect('abilities' in next).toBe(false);
    window.confirm = originalConfirm;
  });
});

describe('CardAttributesSection audit & metadata', () => {
  it('updates the internal developer comment', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(<StatefulCardAttributesSection initial={{}} onChange={handleChange} />);

    await user.click(screen.getByTestId('section-audit-metadata-toggle'));
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Hero attack/i), {
      target: { value: 'Updated comment' },
    });
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({ audit: expect.objectContaining({ comment: 'Updated comment' }) }),
    );
  });

  it('renders rulesVersion badge and originalText preview', () => {
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

    const originalTextContainer = screen.getByTestId('card-audit-original-text');
    expect(originalTextContainer.innerHTML).toContain('<b>Hero Action</b>');
    expect(originalTextContainer.textContent).not.toContain('<b>');
    expect(originalTextContainer.textContent).toContain('Hero Action');
    expect(originalTextContainer.textContent).toContain('Physical');
  });

  it('keeps Audit & Metadata collapsed when it holds no data', () => {
    render(<CardAttributesSection supplemental={{ uses: { count: 2 } }} onChange={vi.fn()} />);
    expect(screen.queryByTestId('audit-ambiguity-file')).toBeNull();
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

    await user.click(screen.getByTestId('section-audit-metadata-toggle'));

    const createdBadge = screen.getByTestId('audit-created-at');
    const updatedBadge = screen.getByTestId('audit-updated-at');
    const reviewedBadge = screen.getByTestId('audit-reviewed-at');
    expect(createdBadge.textContent).toContain('Created:');
    expect(updatedBadge.textContent).toContain('Updated:');
    expect(reviewedBadge.textContent).toContain('Reviewed:');
    // Non-editable: spans, not inputs
    expect(createdBadge.tagName.toLowerCase()).toBe('span');
    expect(updatedBadge.tagName.toLowerCase()).toBe('span');
    expect(reviewedBadge.tagName.toLowerCase()).toBe('span');

    rerender(
      <CardAttributesSection
        supplemental={{ audit: { comment: 'No timestamps' } }}
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
          audit: { comment: 'Spider-Sense', ambiguityFile: 'docs/ambiguities/spider-sense.md' },
        }}
        onChange={handleChange}
      />,
    );

    const ambiguityInput = screen.getByTestId('audit-ambiguity-file') as HTMLInputElement;
    expect(ambiguityInput.value).toBe('docs/ambiguities/spider-sense.md');

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

    fireEvent.change(ambiguityInput, { target: { value: '' } });
    const lastCall = handleChange.mock.calls[handleChange.mock.calls.length - 1][0];
    expect(lastCall.audit.ambiguityFile).toBeUndefined();
    expect('ambiguityFile' in lastCall.audit).toBe(false);
  });

  it('preserves read-only audit fields when an editable one changes', () => {
    const handleChange = vi.fn();
    render(
      <StatefulCardAttributesSection
        initial={{
          audit: { comment: 'c', updatedAt: '2026-09-14T18:37:00Z', rulesVersion: 'v1.8' },
        }}
        onChange={handleChange}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Hero attack/i), {
      target: { value: 'changed' },
    });
    expect(handleChange.mock.calls.at(-1)![0].audit).toEqual({
      comment: 'changed',
      updatedAt: '2026-09-14T18:37:00Z',
      rulesVersion: 'v1.8',
    });
  });
});
