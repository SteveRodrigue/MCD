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

  it('configures targetForm, damageSourceType, and defeatEntityType', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(<StatefulTriggerFilterSection initial={{}} isExpanded={true} onChange={handleChange} />);

    // Target form
    const formSelect = screen.getByTestId('trigger-target-form-0');
    await user.selectOptions(formSelect, 'HERO');
    expect(handleChange).toHaveBeenCalledWith(expect.objectContaining({ targetForm: 'HERO' }));

    // Damage source
    const dmgSourceSelect = screen.getByTestId('trigger-damage-source-type-0');
    await user.selectOptions(dmgSourceSelect, 'ATTACK');
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({ damageSourceType: 'ATTACK' }),
    );

    // Defeat entity
    const defeatEntitySelect = screen.getByTestId('trigger-defeat-entity-type-0');
    await user.selectOptions(defeatEntitySelect, 'CHARACTER');
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({ defeatEntityType: 'CHARACTER' }),
    );
  });

  it('configures formChangeDirection', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(<StatefulTriggerFilterSection initial={{}} isExpanded={true} onChange={handleChange} />);

    const changeDirSelect = screen.getByTestId('trigger-form-change-direction-0');
    await user.selectOptions(changeDirSelect, 'ALTER_EGO_TO_HERO');
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({ formChangeDirection: 'ALTER_EGO_TO_HERO' }),
    );
  });

  it('toggles isEngaged and defeatByAttack checkboxes', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(<StatefulTriggerFilterSection initial={{}} isExpanded={true} onChange={handleChange} />);

    const engagedCheck = screen.getByTestId('trigger-is-engaged-0');
    await user.click(engagedCheck);
    expect(handleChange).toHaveBeenCalledWith(expect.objectContaining({ isEngaged: true }));

    const defeatCheck = screen.getByTestId('trigger-defeat-by-attack-0');
    await user.click(defeatCheck);
    expect(handleChange).toHaveBeenCalledWith(expect.objectContaining({ defeatByAttack: true }));
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
