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

  it('configures CARD_ATTRIBUTE location zone, position, card code, and attribute', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <DynamicValueBuilder
        label="Bomb Scare Threat Scaler"
        value={{
          from: 'CARD_ATTRIBUTE',
          attribute: 'THREAT',
          fromCard: {
            zone: 'IN_PLAY',
            cardCode: '01109',
          },
        }}
        onChange={handleChange}
      />,
    );

    const attrSelect = screen.getByTestId('dynamic-value-attribute-select');
    expect(attrSelect).toBeDefined();

    const zoneSelect = screen.getByTestId('dynamic-value-card-zone-select');
    expect(zoneSelect).toBeDefined();
    await user.selectOptions(zoneSelect, 'PLAYER_DISCARD');

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'CARD_ATTRIBUTE',
        fromCard: expect.objectContaining({
          zone: 'PLAYER_DISCARD',
        }),
      }),
    );

    const posSelect = screen.getByTestId('dynamic-value-card-position-select');
    await user.selectOptions(posSelect, 'TOP');

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'CARD_ATTRIBUTE',
        fromCard: expect.objectContaining({
          position: 'TOP',
        }),
      }),
    );

    // Verify round-trip validity against schema
    expect(
      DynamicValueSourceSchema.safeParse({
        from: 'CARD_ATTRIBUTE',
        attribute: 'THREAT',
        fromCard: {
          zone: 'IN_PLAY',
          cardCode: '01109',
        },
      }).success,
    ).toBe(true);
  });

  it('renders targetCard sub-form for relevant sources and hides for others', () => {
    const handleChange = vi.fn();

    // CARD_ATTRIBUTE renders targetCard sub-form
    const { rerender } = render(
      <DynamicValueBuilder
        label="Target Card Test"
        value={{ from: 'CARD_ATTRIBUTE', attribute: 'THREAT' }}
        onChange={handleChange}
      />,
    );
    expect(screen.getByTestId('dynamic-value-target-card-form')).toBeDefined();

    // COUNTERS renders targetCard sub-form
    rerender(
      <DynamicValueBuilder
        label="Target Card Test"
        value={{ from: 'COUNTERS', counterType: 'all-purpose' }}
        onChange={handleChange}
      />,
    );
    expect(screen.getByTestId('dynamic-value-target-card-form')).toBeDefined();

    // STAT_VALUE renders targetCard sub-form
    rerender(
      <DynamicValueBuilder
        label="Target Card Test"
        value={{ from: 'STAT_VALUE', stat: 'ATTACK' }}
        onChange={handleChange}
      />,
    );
    expect(screen.getByTestId('dynamic-value-target-card-form')).toBeDefined();

    // DISCARDED_CARDS hides targetCard sub-form
    rerender(
      <DynamicValueBuilder
        label="Target Card Test"
        value={{ from: 'DISCARDED_CARDS' }}
        onChange={handleChange}
      />,
    );
    expect(screen.queryByTestId('dynamic-value-target-card-form')).toBeNull();
  });

  it('configures and clears targetCard in DynamicValueBuilder', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    const { rerender } = render(
      <DynamicValueBuilder
        label="Target Card Config"
        value={{
          from: 'CARD_ATTRIBUTE',
          attribute: 'DAMAGE',
        }}
        onChange={handleChange}
      />,
    );

    const zoneSelect = screen.getByTestId('dynamic-value-target-card-zone-select');
    await user.selectOptions(zoneSelect, 'IN_PLAY');

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'CARD_ATTRIBUTE',
        targetCard: { zone: 'IN_PLAY' },
      }),
    );

    // Rerender with targetCard populated
    rerender(
      <DynamicValueBuilder
        label="Target Card Config"
        value={{
          from: 'CARD_ATTRIBUTE',
          attribute: 'DAMAGE',
          targetCard: { zone: 'IN_PLAY' },
        }}
        onChange={handleChange}
      />,
    );

    const clearZoneSelect = screen.getByTestId('dynamic-value-target-card-zone-select');
    await user.selectOptions(clearZoneSelect, '');

    expect(handleChange).toHaveBeenCalledWith(
      expect.not.objectContaining({
        targetCard: expect.anything(),
      }),
    );
  });

  it('renders and updates PAID_WITH_RESOURCE and RESOURCES_SPENT fields', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    const { rerender } = render(
      <DynamicValueBuilder
        label="Bonus Threat"
        value={{
          from: 'PAID_WITH_RESOURCE',
          resource: 'mental',
          amount: 1,
        }}
        onChange={handleChange}
      />,
    );

    const resourceSelect = screen.getByTestId('dynamic-value-resource-select');
    expect(resourceSelect).toBeDefined();
    expect((resourceSelect as HTMLSelectElement).value).toBe('mental');

    const amountInput = screen.getByTestId('dynamic-value-amount-input');
    expect(amountInput).toBeDefined();
    expect((amountInput as HTMLInputElement).value).toBe('1');

    await user.selectOptions(resourceSelect, 'energy');
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'PAID_WITH_RESOURCE',
        resource: 'energy',
      }),
    );

    // Rerender as RESOURCES_SPENT
    rerender(
      <DynamicValueBuilder
        label="Scaled Damage"
        value={{
          from: 'RESOURCES_SPENT',
        }}
        onChange={handleChange}
      />,
    );

    const spentResourceSelect = screen.getByTestId('dynamic-value-resource-select');
    expect(spentResourceSelect).toBeDefined();
    expect(screen.queryByTestId('dynamic-value-amount-input')).toBeNull();

    await user.selectOptions(spentResourceSelect, 'physical');
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'RESOURCES_SPENT',
        resource: 'physical',
      }),
    );
  });
});
