import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CardLocationSelectorForm } from '../../src/ui/components/editor/CardLocationSelectorForm';
import { sanitizeCardLocation } from '../../src/ui/components/editor/card-location-selector-utils';
import {
  CardLocationZoneSchema,
  CardLocationSelectorSchema,
} from '../../src/data/supplemental/schema';

describe('CardLocationSelectorForm Component', () => {
  it('renders zone dropdown with all 9 options', () => {
    const handleChange = vi.fn();
    render(
      <CardLocationSelectorForm
        value={undefined}
        onChange={handleChange}
        label="Test Card Location"
        testIdPrefix="test-loc"
      />,
    );

    expect(screen.getByText('Test Card Location')).toBeDefined();
    const zoneSelect = screen.getByTestId('test-loc-zone-select') as HTMLSelectElement;
    expect(zoneSelect).toBeDefined();

    for (const zone of CardLocationZoneSchema.options) {
      expect(screen.getByRole('option', { name: zone })).toBeDefined();
    }
  });

  it('hides secondary fields when zone is not set', () => {
    const handleChange = vi.fn();
    render(
      <CardLocationSelectorForm
        value={undefined}
        onChange={handleChange}
        testIdPrefix="test-loc"
      />,
    );

    expect(screen.getByTestId('test-loc-zone-select')).toBeDefined();
    expect(screen.queryByTestId('test-loc-position-select')).toBeNull();
    expect(screen.queryByTestId('test-loc-target-select')).toBeNull();
    expect(screen.queryByTestId('test-loc-card-code-input')).toBeNull();
    expect(screen.queryByTestId('test-loc-filter-accordion')).toBeNull();
  });

  it('selecting a zone reveals position, target, cardCode, and filter accordion', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    const { rerender } = render(
      <CardLocationSelectorForm
        value={undefined}
        onChange={handleChange}
        testIdPrefix="test-loc"
      />,
    );

    const zoneSelect = screen.getByTestId('test-loc-zone-select');
    await user.selectOptions(zoneSelect, 'PLAYER_DISCARD');

    expect(handleChange).toHaveBeenCalledWith({ zone: 'PLAYER_DISCARD' });

    // Rerender with the selected zone to verify progressive disclosure
    rerender(
      <CardLocationSelectorForm
        value={{ zone: 'PLAYER_DISCARD' }}
        onChange={handleChange}
        testIdPrefix="test-loc"
      />,
    );

    expect(screen.getByTestId('test-loc-position-select')).toBeDefined();
    expect(screen.getByTestId('test-loc-target-select')).toBeDefined();
    expect(screen.getByTestId('test-loc-card-code-input')).toBeDefined();
    expect(screen.getByTestId('test-loc-filter-accordion')).toBeDefined();
  });

  it('setting cardCode writes to value.cardCode', () => {
    const handleChange = vi.fn();

    render(
      <CardLocationSelectorForm
        value={{ zone: 'PLAYER_DECK' }}
        onChange={handleChange}
        testIdPrefix="test-loc"
      />,
    );

    const cardCodeInput = screen.getByTestId('test-loc-card-code-input');
    fireEvent.change(cardCodeInput, { target: { value: '01001a' } });

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        zone: 'PLAYER_DECK',
        cardCode: '01001a',
      }),
    );
  });

  it('selecting target from dropdown writes to value.target', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <CardLocationSelectorForm
        value={{ zone: 'TABLEAU' }}
        onChange={handleChange}
        testIdPrefix="test-loc"
      />,
    );

    const targetSelect = screen.getByTestId('test-loc-target-select');
    await user.selectOptions(targetSelect, 'ATTACHED_CARD');

    expect(handleChange).toHaveBeenCalledWith({
      zone: 'TABLEAU',
      target: 'ATTACHED_CARD',
    });
  });

  it('selecting position from dropdown writes to value.position', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <CardLocationSelectorForm
        value={{ zone: 'ENCOUNTER_DECK' }}
        onChange={handleChange}
        testIdPrefix="test-loc"
      />,
    );

    const posSelect = screen.getByTestId('test-loc-position-select');
    await user.selectOptions(posSelect, 'BOTTOM');

    expect(handleChange).toHaveBeenCalledWith({
      zone: 'ENCOUNTER_DECK',
      position: 'BOTTOM',
    });
  });

  it('filter accordion opens and renders UniversalCardFilterBuilder', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <CardLocationSelectorForm
        value={{ zone: 'IN_PLAY' }}
        onChange={handleChange}
        testIdPrefix="test-loc"
      />,
    );

    expect(screen.queryByTestId('test-loc-filter-content')).toBeNull();

    const toggleBtn = screen.getByTestId('test-loc-filter-accordion-toggle');
    await user.click(toggleBtn);

    expect(screen.getByTestId('test-loc-filter-content')).toBeDefined();
    expect(screen.getByText('Location Card Filter')).toBeDefined();
  });

  it('clearing all fields calls onChange(undefined)', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <CardLocationSelectorForm
        value={{ zone: 'PLAYER_DISCARD' }}
        onChange={handleChange}
        testIdPrefix="test-loc"
      />,
    );

    const zoneSelect = screen.getByTestId('test-loc-zone-select');
    await user.selectOptions(zoneSelect, '');

    expect(handleChange).toHaveBeenCalledWith(undefined);
  });

  it('data sanitization removes empty/undefined keys and passes schema validation', () => {
    expect(sanitizeCardLocation(undefined)).toBeUndefined();
    expect(sanitizeCardLocation({})).toBeUndefined();
    expect(
      sanitizeCardLocation({
        zone: undefined,
        position: undefined,
        cardCode: '   ',
        target: undefined,
        filter: {},
      }),
    ).toBeUndefined();

    const sanitized = sanitizeCardLocation({
      zone: 'SIDE_SCHEMES',
      position: 'TOP',
      cardCode: '01109',
      target: 'TARGET_CARD',
      filter: { types: ['side_scheme'] },
    });

    expect(sanitized).toEqual({
      zone: 'SIDE_SCHEMES',
      position: 'TOP',
      cardCode: '01109',
      target: 'TARGET_CARD',
      filter: { types: ['side_scheme'] },
    });

    const parseResult = CardLocationSelectorSchema.safeParse(sanitized);
    expect(parseResult.success).toBe(true);
  });
});
