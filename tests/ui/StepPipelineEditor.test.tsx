import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StepPipelineEditor } from '../../src/ui/components/editor/StepPipelineEditor';

const StatefulStepPipelineEditor: React.FC<{
  initial: any[];
  abilityIndex?: number;
  onChange?: (val: any[]) => void;
  hasErrors?: boolean;
  stepErrors?: Record<number, string[]>;
}> = ({ initial, abilityIndex = 0, onChange, hasErrors, stepErrors }) => {
  const [steps, setSteps] = React.useState(initial);
  return (
    <StepPipelineEditor
      steps={steps}
      abilityIndex={abilityIndex}
      hasErrors={hasErrors}
      stepErrors={stepErrors}
      onChange={(updated) => {
        setSteps(updated);
        onChange?.(updated);
      }}
    />
  );
};

describe('StepPipelineEditor', () => {
  it('renders resolution steps and adds a new step', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <StatefulStepPipelineEditor
        initial={[{ effect: 'DEAL_DAMAGE', effectParams: { amount: 2 } }]}
        onChange={handleChange}
      />,
    );

    expect(screen.getByText(/Resolution Steps \(1\)/i)).toBeDefined();
    expect(screen.getByTestId('step-item-0-0')).toBeDefined();

    await user.click(screen.getByTestId('add-step-btn-0'));
    expect(handleChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ effect: 'DEAL_DAMAGE' }),
        expect.objectContaining({ effect: 'DRAW', effectParams: { count: 1 } }),
      ]),
    );
  });

  it('configures step.id and step.target', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <StatefulStepPipelineEditor
        initial={[{ effect: 'DEAL_DAMAGE', effectParams: { amount: 2 } }]}
        onChange={handleChange}
      />,
    );

    // Set step.id
    const idInput = screen.getByTestId('step-id-0-0');
    await user.type(idInput, 'photonic_blast_damage');
    expect(handleChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'photonic_blast_damage',
        }),
      ]),
    );

    // Set step.target
    const targetSelect = screen.getByTestId('step-target-0-0');
    await user.selectOptions(targetSelect, 'CHOSEN_ENEMY');
    expect(handleChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          target: 'CHOSEN_ENEMY',
        }),
      ]),
    );
  });

  it('expands step.filter accordion and configures criteria', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <StatefulStepPipelineEditor
        initial={[
          {
            effect: 'MODIFY_HAND_SIZE',
            filter: { traits: ['Tech'] },
          },
        ]}
        onChange={handleChange}
      />,
    );

    expect(screen.getByTestId('step-filter-accordion-0-0')).toBeDefined();
    expect(screen.getByText('Configured')).toBeDefined();

    // Expand accordion
    await user.click(screen.getByTestId('toggle-step-filter-btn-0-0'));
    expect(screen.getByText(/Step Card Filter Criteria/i)).toBeDefined();
  });

  it('reorders and removes steps', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <StatefulStepPipelineEditor
        initial={[
          { id: 'first_step', effect: 'DEAL_DAMAGE' },
          { id: 'second_step', effect: 'DRAW' },
        ]}
        onChange={handleChange}
      />,
    );

    // Move first step down
    await user.click(screen.getByTestId('step-move-down-0-0'));
    expect(handleChange).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'second_step' }),
      expect.objectContaining({ id: 'first_step' }),
    ]);

    // Remove a step
    await user.click(screen.getByTestId('step-remove-0-0'));
    expect(handleChange).toHaveBeenCalledWith([expect.objectContaining({ id: 'first_step' })]);
  });

  it('displays step validation errors when hasErrors and stepErrors are provided', () => {
    render(
      <StepPipelineEditor
        steps={[{ effect: 'DEAL_DAMAGE' }]}
        abilityIndex={0}
        onChange={vi.fn()}
        hasErrors={true}
        stepErrors={{ 0: ['Target must be specified for DEAL_DAMAGE'] }}
      />,
    );

    expect(screen.getByText(/Step Errors/i)).toBeDefined();
    expect(screen.getByText(/Target must be specified for DEAL_DAMAGE/i)).toBeDefined();
  });
});
