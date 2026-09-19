import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TriggerFilterSection } from '../../src/ui/components/editor/TriggerFilterSection';

const StatefulTriggerFilterSection: React.FC<{
  initial: any;
  abilityIndex?: number;
  isExpanded?: boolean;
  onChange?: (val: any) => void;
  hasErrors?: boolean;
  errors?: string[];
}> = ({ initial, abilityIndex = 0, isExpanded, onChange, hasErrors, errors }) => {
  const [data, setData] = React.useState(initial);
  return (
    <TriggerFilterSection
      filter={data}
      abilityIndex={abilityIndex}
      isExpanded={isExpanded}
      hasErrors={hasErrors}
      errors={errors}
      onChange={(updated) => {
        setData(updated);
        onChange?.(updated);
      }}
    />
  );
};

describe('TriggerFilterSection', () => {
  it('renders collapsed by default and expands on click', async () => {
    const user = userEvent.setup();
    render(<TriggerFilterSection filter={{}} abilityIndex={0} onChange={vi.fn()} />);

    expect(screen.getByText('Trigger Filter & Event Scope')).toBeDefined();
    expect(screen.getByText('Configure')).toBeDefined();
    expect(screen.queryByTestId('trigger-attacker-kind-0')).toBeNull();

    await user.click(screen.getByText('Configure'));
    expect(screen.getByText('Collapse')).toBeDefined();
    expect(screen.getByTestId('trigger-attacker-kind-0')).toBeDefined();
  });

  it('selects attackerKind and targetPlayerScope', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(<StatefulTriggerFilterSection initial={{}} isExpanded={true} onChange={handleChange} />);

    // Select attackerKind: VILLAIN
    const attackerSelect = screen.getByTestId('trigger-attacker-kind-0');
    await user.selectOptions(attackerSelect, 'VILLAIN');
    expect(handleChange).toHaveBeenCalledWith(expect.objectContaining({ attackerKind: 'VILLAIN' }));

    // Select targetPlayerScope: SELF
    const scopeSelect = screen.getByTestId('trigger-target-player-scope-0');
    await user.selectOptions(scopeSelect, 'SELF');
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({ targetPlayerScope: 'SELF' }),
    );
  });

  it('configures targetForm and targetType', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(<StatefulTriggerFilterSection initial={{}} isExpanded={true} onChange={handleChange} />);

    // Target form
    const formSelect = screen.getByTestId('trigger-target-form-0');
    await user.selectOptions(formSelect, 'HERO');
    expect(handleChange).toHaveBeenCalledWith(expect.objectContaining({ targetForm: 'HERO' }));

    // Target entity type
    const targetTypeSelect = screen.getByTestId('trigger-target-type-0');
    await user.selectOptions(targetTypeSelect, 'CHARACTER');
    expect(handleChange).toHaveBeenCalledWith(expect.objectContaining({ targetType: 'CHARACTER' }));
  });

  it('configures sourceCardCode and sourceInstanceId', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(<StatefulTriggerFilterSection initial={{}} isExpanded={true} onChange={handleChange} />);

    const cardCodeInput = screen.getByTestId('trigger-source-card-code-0');
    await user.type(cardCodeInput, '01050');
    expect(handleChange).toHaveBeenCalledWith(expect.objectContaining({ sourceCardCode: '01050' }));

    const instanceIdInput = screen.getByTestId('trigger-source-instance-id-0');
    await user.type(instanceIdInput, 'inst_123');
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({ sourceInstanceId: 'inst_123' }),
    );
  });

  it('toggles isEngaged checkbox', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(<StatefulTriggerFilterSection initial={{}} isExpanded={true} onChange={handleChange} />);

    const engagedCheck = screen.getByTestId('trigger-is-engaged-0');
    await user.click(engagedCheck);
    expect(handleChange).toHaveBeenCalledWith(expect.objectContaining({ isEngaged: true }));
  });

  it('expands attackerCardFilter accordion and configures criteria', async () => {
    const user = userEvent.setup();
    render(
      <TriggerFilterSection
        filter={{ attackerCardFilter: { traits: ['Elite'] } }}
        abilityIndex={0}
        isExpanded={true}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId('trigger-attacker-card-filter-accordion-0')).toBeDefined();
    await user.click(screen.getByTestId('toggle-trigger-attacker-card-filter-btn-0'));
    expect(screen.getAllByText(/Attacker Card Criteria/i).length).toBeGreaterThanOrEqual(1);
  });

  it('verifies that purged orphan inputs do not exist in the DOM (ADR-0069)', () => {
    render(
      <TriggerFilterSection filter={{}} abilityIndex={0} isExpanded={true} onChange={vi.fn()} />,
    );

    expect(screen.queryByTestId('trigger-damage-source-type-0')).toBeNull();
    expect(screen.queryByTestId('trigger-damage-target-type-0')).toBeNull();
    expect(screen.queryByTestId('trigger-defeat-entity-type-0')).toBeNull();
    expect(screen.queryByTestId('trigger-defeat-by-attack-0')).toBeNull();
    expect(screen.queryByTestId('trigger-form-change-direction-0')).toBeNull();
  });

  it('renders validation errors when hasErrors is true', () => {
    render(
      <TriggerFilterSection
        filter={{}}
        abilityIndex={0}
        onChange={vi.fn()}
        hasErrors={true}
        errors={['Invalid attackerKind specified']}
      />,
    );

    expect(screen.getByText(/Issue/i)).toBeDefined();
    expect(screen.getByText(/Invalid attackerKind specified/i)).toBeDefined();
  });
});
