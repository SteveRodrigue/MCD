import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DynamicValueBuilder } from '../../src/ui/components/editor/DynamicValueBuilder';
import { DynamicValueSourceSchema } from '../../src/data/supplemental/schema';

describe('DynamicValueSource Contract Tests', () => {
  it('validates static numbers and dynamic value formulas against schema', () => {
    expect(DynamicValueSourceSchema.safeParse({ from: 'PREVIOUS_RESULT' }).success).toBe(true);
    expect(
      DynamicValueSourceSchema.safeParse({
        from: 'STAT_VALUE',
        stat: 'ATTACK',
        multiplier: 2,
        offset: 1,
      }).success,
    ).toBe(true);
    expect(
      DynamicValueSourceSchema.safeParse({
        from: 'COUNTERS',
        counterType: 'web',
      }).success,
    ).toBe(true);
    expect(
      DynamicValueSourceSchema.safeParse({
        from: 'ENTITY_COUNT',
        filter: { traits: ['Tech'] },
      }).success,
    ).toBe(true);
  });
});

describe('DynamicValueBuilder Interactive UI Component', () => {
  it('renders fixed number mode by default for numeric values', () => {
    render(<DynamicValueBuilder label="Damage Amount" value={3} onChange={vi.fn()} />);

    const numInput = screen.getByTestId('dynamic-value-number-input') as HTMLInputElement;
    expect(numInput).toBeDefined();
    expect(numInput.value).toBe('3');
    expect(screen.queryByTestId('mode-entire-pool-btn')).toBeNull();
  });

  it('switches between Fixed Number, Entire Pool ("ALL"), and Dynamic Formula', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    const { rerender } = render(
      <DynamicValueBuilder
        label="Discard Count"
        value={1}
        allowAll={true}
        onChange={handleChange}
      />,
    );

    // Switch to ALL
    const allBtn = screen.getByTestId('mode-entire-pool-btn');
    await user.click(allBtn);
    expect(handleChange).toHaveBeenCalledWith('ALL');

    // Re-render with value='ALL'
    rerender(
      <DynamicValueBuilder
        label="Discard Count"
        value="ALL"
        allowAll={true}
        onChange={handleChange}
      />,
    );
    expect(screen.getByTestId('dynamic-value-all-notice')).toBeDefined();

    // Switch to Formula
    const formulaBtn = screen.getByTestId('mode-dynamic-formula-btn');
    await user.click(formulaBtn);
    expect(handleChange).toHaveBeenCalledWith({ from: 'PREVIOUS_RESULT' });
  });

  it('configures STAT_VALUE formula subfields', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <DynamicValueBuilder
        label="Damage Amount"
        value={{ from: 'STAT_VALUE', stat: 'ATTACK' }}
        onChange={handleChange}
      />,
    );

    const statSelect = screen.getByTestId('dynamic-value-stat-select');
    await user.selectOptions(statSelect, 'THWART');

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'STAT_VALUE',
        stat: 'THWART',
      }),
    );
  });

  it('configures COUNTERS formula subfields', () => {
    const handleChange = vi.fn();

    render(
      <DynamicValueBuilder
        label="Remove Counters"
        value={{ from: 'COUNTERS' }}
        onChange={handleChange}
      />,
    );

    const counterInput = screen.getByTestId('dynamic-value-counter-type-input');
    fireEvent.change(counterInput, { target: { value: 'charge' } });

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'COUNTERS',
        counterType: 'charge',
      }),
    );
  });

  it('configures ENTITY_COUNT with collapsible filter accordion', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <DynamicValueBuilder
        label="Scaler Amount"
        value={{ from: 'ENTITY_COUNT', filter: { traits: ['Tech'] } }}
        onChange={handleChange}
      />,
    );

    expect(screen.getByTestId('entity-count-filter-accordion')).toBeDefined();
    expect(screen.getByText('1 criterion')).toBeDefined();

    // Toggle open the filter accordion
    const toggleBtn = screen.getByTestId('toggle-entity-filter-btn');
    await user.click(toggleBtn);

    // The nested UniversalCardFilterBuilder is rendered
    expect(screen.getByTestId('filter-traits-input')).toBeDefined();
  });

  it('configures multipliers, offsets, and clamping', () => {
    const handleChange = vi.fn();

    render(
      <DynamicValueBuilder
        label="Calculated Damage"
        value={{ from: 'STAT_VALUE', stat: 'ATTACK' }}
        onChange={handleChange}
      />,
    );

    const multInput = screen.getByTestId('dynamic-value-multiplier-input');
    fireEvent.change(multInput, { target: { value: '2' } });

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'STAT_VALUE',
        stat: 'ATTACK',
        multiplier: 2,
      }),
    );

    const clampMinInput = screen.getByTestId('dynamic-value-clamp-min-input');
    fireEvent.change(clampMinInput, { target: { value: '1' } });

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'STAT_VALUE',
        stat: 'ATTACK',
        clamp: { min: 1 },
      }),
    );
  });

  it('configures DISCARDED_CARDS formula subfields', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <DynamicValueBuilder
        label="Bonus Damage"
        value={{
          from: 'DISCARDED_CARDS',
          discardAttribute: 'RESOURCE_ICONS',
          resourceType: 'energy',
        }}
        onChange={handleChange}
      />,
    );

    expect(screen.getByTestId('dynamic-value-discard-attribute-select')).toBeDefined();
    expect(screen.getByTestId('dynamic-value-resource-type-select')).toBeDefined();

    const attrSelect = screen.getByTestId('dynamic-value-discard-attribute-select');
    await user.selectOptions(attrSelect, 'COUNT');

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'DISCARDED_CARDS',
        discardAttribute: 'COUNT',
      }),
    );
  });
});
