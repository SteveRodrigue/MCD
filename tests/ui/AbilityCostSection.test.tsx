import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AbilityCostSection } from '../../src/ui/components/editor/AbilityCostSection';

const StatefulAbilityCostSection: React.FC<{
  initial: any;
  abilityIndex?: number;
  onChange?: (val: any) => void;
  hasErrors?: boolean;
  errors?: string[];
}> = ({ initial, abilityIndex = 0, onChange, hasErrors, errors }) => {
  const [data, setData] = React.useState(initial);
  return (
    <AbilityCostSection
      cost={data}
      abilityIndex={abilityIndex}
      hasErrors={hasErrors}
      errors={errors}
      onChange={(updated) => {
        setData(updated);
        onChange?.(updated);
      }}
    />
  );
};

describe('AbilityCostSection', () => {
  it('renders all cost controls and initial state', () => {
    render(<AbilityCostSection cost={{}} abilityIndex={0} onChange={vi.fn()} />);

    expect(screen.getByText(/Ability Costs \(RR v1\.8 p\. 11 'Cost'\)/i)).toBeDefined();
    expect(screen.getByTestId('cost-exhaust-self-0')).toBeDefined();
    expect(screen.getByTestId('cost-discard-self-0')).toBeDefined();
    expect(screen.getByTestId('cost-damage-self-0')).toBeDefined();
    expect(screen.getByTestId('cost-damage-hero-0')).toBeDefined();
    expect(screen.getByTestId('cost-res-plus-physical-0')).toBeDefined();
    expect(screen.getByTestId('cost-spend-counters-toggle-0')).toBeDefined();
    expect(screen.getByTestId('cost-discard-card-toggle-0')).toBeDefined();
  });

  it('toggles exhaustSelf and discardSelf', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(<StatefulAbilityCostSection initial={{}} onChange={handleChange} />);

    // Toggle exhaustSelf
    await user.click(screen.getByTestId('cost-exhaust-self-0'));
    expect(handleChange).toHaveBeenCalledWith(expect.objectContaining({ exhaustSelf: true }));

    // Toggle discardSelf
    await user.click(screen.getByTestId('cost-discard-self-0'));
    expect(handleChange).toHaveBeenCalledWith(expect.objectContaining({ discardSelf: true }));
  });

  it('updates self damage and hero damage', () => {
    const handleChange = vi.fn();

    render(<StatefulAbilityCostSection initial={{}} onChange={handleChange} />);

    fireEvent.change(screen.getByTestId('cost-damage-self-0'), { target: { value: '2' } });
    expect(handleChange).toHaveBeenCalledWith(expect.objectContaining({ damageSelf: 2 }));

    fireEvent.change(screen.getByTestId('cost-damage-hero-0'), { target: { value: '3' } });
    expect(handleChange).toHaveBeenCalledWith(expect.objectContaining({ damageHero: 3 }));
  });

  it('increments, decrements, and clears resources', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <StatefulAbilityCostSection initial={{ resources: ['energy'] }} onChange={handleChange} />,
    );

    // Add physical
    await user.click(screen.getByTestId('cost-res-plus-physical-0'));
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        resources: ['energy', 'physical'],
      }),
    );

    // Add another energy
    await user.click(screen.getByTestId('cost-res-plus-energy-0'));
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        resources: ['energy', 'physical', 'energy'],
      }),
    );

    // Remove one energy
    await user.click(screen.getByTestId('cost-res-minus-energy-0'));
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        resources: ['energy', 'physical'],
      }),
    );

    // Clear resources
    await user.click(screen.getByTestId('cost-clear-resources-0'));
    expect(handleChange).toHaveBeenCalledWith(
      expect.not.objectContaining({ resources: expect.anything() }),
    );
  });

  it('configures and removes spendCounters cost', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(<StatefulAbilityCostSection initial={{}} onChange={handleChange} />);

    // Add spendCounters
    await user.click(screen.getByTestId('cost-spend-counters-toggle-0'));
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        spendCounters: { amount: 1, counterType: 'charge', target: 'SELF' },
      }),
    );

    // Update amount, type, and target
    fireEvent.change(screen.getByTestId('cost-spend-counters-amount-0'), {
      target: { value: '3' },
    });
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        spendCounters: expect.objectContaining({ amount: 3 }),
      }),
    );

    fireEvent.change(screen.getByTestId('cost-spend-counters-type-0'), {
      target: { value: 'shield' },
    });
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        spendCounters: expect.objectContaining({ counterType: 'shield' }),
      }),
    );

    await user.selectOptions(screen.getByTestId('cost-spend-counters-target-0'), 'IDENTITY');
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        spendCounters: expect.objectContaining({ target: 'IDENTITY' }),
      }),
    );

    // Remove spendCounters
    await user.click(screen.getByTestId('cost-spend-counters-toggle-0'));
    expect(handleChange).toHaveBeenCalledWith(
      expect.not.objectContaining({ spendCounters: expect.anything() }),
    );
  });

  it('configures and removes discardCard cost', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(<StatefulAbilityCostSection initial={{}} onChange={handleChange} />);

    // Add discardCard
    await user.click(screen.getByTestId('cost-discard-card-toggle-0'));
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        discardCard: { count: 1, from: 'HAND' },
      }),
    );

    // Update count and from
    fireEvent.change(screen.getByTestId('cost-discard-card-count-0'), {
      target: { value: '2' },
    });
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        discardCard: expect.objectContaining({ count: 2 }),
      }),
    );

    await user.selectOptions(screen.getByTestId('cost-discard-card-from-0'), 'DECK');
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        discardCard: expect.objectContaining({ from: 'DECK' }),
      }),
    );

    // Remove discardCard
    await user.click(screen.getByTestId('cost-discard-card-toggle-0'));
    expect(handleChange).toHaveBeenCalledWith(
      expect.not.objectContaining({ discardCard: expect.anything() }),
    );
  });

  it('displays cost validation errors when hasErrors is true', () => {
    render(
      <AbilityCostSection
        cost={{}}
        abilityIndex={0}
        onChange={vi.fn()}
        hasErrors={true}
        errors={['Invalid counter type', 'Cost amount must be greater than 0']}
      />,
    );

    expect(screen.getByText(/Cost Validation Error/i)).toBeDefined();
    expect(screen.getByText(/Invalid counter type/i)).toBeDefined();
    expect(screen.getByText(/Cost amount must be greater than 0/i)).toBeDefined();
  });
});
