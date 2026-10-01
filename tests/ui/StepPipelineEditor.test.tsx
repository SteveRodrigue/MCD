import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StepPipelineEditor } from '../../src/ui/components/editor/StepPipelineEditor';
import { AbilityStepSchema } from '../../src/data/supplemental/schema';

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

  it('configures distinctFrom via PREVIOUS_TARGET dropdown, custom string input, and removes key when cleared', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <StatefulStepPipelineEditor
        initial={[
          { effect: 'DEAL_DAMAGE', target: 'CHOSEN_ENEMY' },
          { effect: 'DEAL_DAMAGE', target: 'CHOSEN_ENEMY' },
        ]}
        abilityIndex={0}
        onChange={handleChange}
      />,
    );

    // Expand Step 1
    await user.click(screen.getByTestId('step-item-0-1'));

    const distinctSelect = screen.getByTestId('step-distinct-from-0-1');
    const customInput = screen.getByTestId('step-distinct-from-input-0-1') as HTMLInputElement;

    // 1. Select PREVIOUS_TARGET
    await user.selectOptions(distinctSelect, 'PREVIOUS_TARGET');
    expect(handleChange).toHaveBeenCalledWith([
      expect.anything(),
      expect.objectContaining({ distinctFrom: 'PREVIOUS_TARGET' }),
    ]);

    // 2. Set custom step ID string via text input
    fireEvent.change(customInput, { target: { value: 'first_damage_step' } });
    expect(handleChange).toHaveBeenCalledWith([
      expect.anything(),
      expect.objectContaining({ distinctFrom: 'first_damage_step' }),
    ]);

    // 3. Clear distinctFrom by typing empty string
    fireEvent.change(customInput, { target: { value: '' } });
    const lastCall = handleChange.mock.calls[handleChange.mock.calls.length - 1][0];
    expect(lastCall[1].distinctFrom).toBeUndefined();
    expect('distinctFrom' in lastCall[1]).toBe(false);

    // 4. Validate with AbilityStepSchema (strict object validation)
    const stepParsed = AbilityStepSchema.safeParse(lastCall[1]);
    expect(stepParsed.success).toBe(true);

    // 5. Also verify selecting "None" clears PREVIOUS_TARGET
    await user.selectOptions(distinctSelect, 'PREVIOUS_TARGET');
    await user.selectOptions(distinctSelect, '');
    const finalCall = handleChange.mock.calls[handleChange.mock.calls.length - 1][0];
    expect(finalCall[1].distinctFrom).toBeUndefined();
    expect('distinctFrom' in finalCall[1]).toBe(false);
  });

  it('renders newly registered effect parameters across effects', () => {
    // SEARCH
    const { rerender } = render(
      <StepPipelineEditor
        steps={[{ effect: 'SEARCH', effectParams: {} }]}
        abilityIndex={0}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId('step-param-shuffleAfter-0-0')).toBeDefined();
    expect(screen.getByTestId('step-param-isVoluntary-0-0')).toBeDefined();
    expect(screen.getByTestId('step-param-promptTitle-0-0')).toBeDefined();

    // DRAW
    rerender(
      <StepPipelineEditor
        steps={[{ effect: 'DRAW', effectParams: {} }]}
        abilityIndex={0}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId('step-param-targetPlayerId-0-0')).toBeDefined();

    // SPEND_COUNTERS
    rerender(
      <StepPipelineEditor
        steps={[{ effect: 'SPEND_COUNTERS', effectParams: {} }]}
        abilityIndex={0}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId('step-param-discardWhenEmpty-0-0')).toBeDefined();

    // REMOVE_COUNTERS_MATCHING_FILTER
    rerender(
      <StepPipelineEditor
        steps={[{ effect: 'REMOVE_COUNTERS_MATCHING_FILTER', effectParams: {} }]}
        abilityIndex={0}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId('step-param-targetZone-0-0')).toBeDefined();
    expect(screen.getByText('Amount to Remove')).toBeDefined();

    // GENERATE_RESOURCE
    rerender(
      <StepPipelineEditor
        steps={[{ effect: 'GENERATE_RESOURCE', effectParams: { sourceMode: 'STATIC' } }]}
        abilityIndex={0}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId('step-param-count-0-0')).toBeDefined();

    // PLAY_FROM_ZONE
    rerender(
      <StepPipelineEditor
        steps={[{ effect: 'PLAY_FROM_ZONE', effectParams: {} }]}
        abilityIndex={0}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId('step-param-promptTitle-0-0')).toBeDefined();
    expect(screen.getByText('Card Filter (Filter)')).toBeDefined();

    // DISCARD
    rerender(
      <StepPipelineEditor
        steps={[{ effect: 'DISCARD', effectParams: {} }]}
        abilityIndex={0}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Until Match Filter (Filter)')).toBeDefined();
  });

  it('does not render deprecated/unimplemented parameters on REMOVE_THREAT', () => {
    render(
      <StepPipelineEditor
        steps={[{ effect: 'REMOVE_THREAT', effectParams: {} }]}
        abilityIndex={0}
        onChange={vi.fn()}
      />,
    );

    expect(screen.queryByTestId('step-param-aerialAllSchemes-0-0')).toBeNull();
    expect(screen.queryByTestId('step-param-bonusWithMental-0-0')).toBeNull();
    // But keeps implemented ones:
    expect(screen.getByTestId('step-param-finisherBonus-0-0')).toBeDefined();
    expect(screen.getByText('Dynamic Bonus Threat')).toBeDefined();
  });

  it('updates newly registered effect parameters in state', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <StatefulStepPipelineEditor
        initial={[{ effect: 'SEARCH', effectParams: { source: ['PLAYER_DECK'] } }]}
        onChange={handleChange}
      />,
    );

    const shuffleCheckbox = screen.getByTestId('step-param-shuffleAfter-0-0');
    await user.click(shuffleCheckbox);

    expect(handleChange).toHaveBeenCalledWith([
      expect.objectContaining({
        effect: 'SEARCH',
        effectParams: expect.objectContaining({
          shuffleAfter: true,
        }),
      }),
    ]);
  });

  it('renders and allows editing Rhino II side scheme selection in SEARCH effect (Bug #174 regression)', async () => {
    const handleChange = vi.fn();

    // Rhino II (01095) search configuration
    render(
      <StatefulStepPipelineEditor
        initial={[
          {
            effect: 'SEARCH',
            effectParams: {
              source: ['ENCOUNTER_DECK', 'ENCOUNTER_DISCARD'],
              filter: { codes: ['01107'] },
              takeCount: 1,
              selectedDestination: 'REVEAL',
              shuffleAfter: true,
              autoSelectIfUnambiguous: true,
            },
          },
        ]}
        onChange={handleChange}
      />,
    );

    // Verify filter displays Breakin' & Takin' card code (01107) in the GUI
    const codesInput = screen.getByTestId('filter-codes-input') as HTMLInputElement;
    expect(codesInput.value).toBe('01107');

    // Edit code in GUI
    fireEvent.change(codesInput, { target: { value: '01109' } });

    expect(handleChange).toHaveBeenCalledWith([
      expect.objectContaining({
        effect: 'SEARCH',
        effectParams: expect.objectContaining({
          filter: expect.objectContaining({
            codes: ['01109'],
          }),
        }),
      }),
    ]);
  });

  it('renders IF_FORM gate controls and updates target form in state', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <StatefulStepPipelineEditor
        initial={[
          {
            id: 'assault_hero_attack',
            gate: 'IF_FORM',
            gateParams: { form: 'HERO' },
            effect: 'VILLAIN_ATTACKS',
          },
        ]}
        onChange={handleChange}
      />,
    );

    // Form parameter dropdown is rendered
    const formSelect = screen.getByTestId('gate-param-form') as HTMLSelectElement;
    expect(formSelect).toBeDefined();
    expect(formSelect.value).toBe('HERO');

    // Change to ALTER_EGO
    await user.selectOptions(formSelect, 'ALTER_EGO');
    expect(handleChange).toHaveBeenCalledWith([
      expect.objectContaining({
        gate: 'IF_FORM',
        gateParams: expect.objectContaining({
          form: 'ALTER_EGO',
        }),
      }),
    ]);
  });
});
