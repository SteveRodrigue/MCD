import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StepPipelineEditor } from '../../src/ui/components/editor/StepPipelineEditor';
import { AbilityStepSchema } from '../../src/data/supplemental/schema';
import { ResultFactSchema } from '../../src/data/supplemental/gate-params';

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
    expect(screen.getByTestId('step-param-minimumTake-0-0')).toBeDefined();
    expect(screen.getByTestId('step-param-distinctBy-0-0')).toBeDefined();
    expect(screen.queryByTestId('step-param-isVoluntary-0-0')).toBeNull();
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
    expect(screen.getByTestId('step-param-counterType-0-0')).toBeDefined();

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
        steps={[{ effect: 'GENERATE_RESOURCE', effectParams: {} }]}
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
    const formSelect = screen.getByTestId('gate-param-form-0-0') as HTMLSelectElement;
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
  it('offers IF_PLAYER_HAS_TRAIT and shows its trait field', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <StatefulStepPipelineEditor
        initial={[
          {
            effect: 'REMOVE_THREAT',
            gate: 'IF_PLAYER_HAS_TRAIT',
            gateParams: { trait: 'Aerial' },
            effectParams: { amount: 1, target: 'CHOSEN_SCHEME' },
          },
        ]}
        onChange={handleChange}
      />,
    );

    const gateSelect = screen.getByTestId('step-gate-0-0') as HTMLSelectElement;
    expect(gateSelect.value).toBe('IF_PLAYER_HAS_TRAIT');
    expect(Array.from(gateSelect.options).map((o) => o.value)).toContain('IF_PLAYER_HAS_TRAIT');
    expect(screen.getByText('Trait Gate Parameters')).toBeDefined();
    expect((screen.getByTestId('gate-param-trait-0-0') as HTMLInputElement).value).toBe('Aerial');

    await user.clear(screen.getByTestId('gate-param-trait-0-0'));
    await user.type(screen.getByTestId('gate-param-trait-0-0'), 'Avenger');
    expect(handleChange).toHaveBeenLastCalledWith([
      expect.objectContaining({ gateParams: { trait: 'Avenger' } }),
    ]);
  });
  it('edits MODIFY_HAND_SIZE amount as a dynamic formula (Iron Man 01029a) with no legacy scaling fields', () => {
    render(
      <StatefulStepPipelineEditor
        initial={[
          {
            effect: 'MODIFY_HAND_SIZE',
            effectParams: {
              amount: {
                from: 'ENTITY_COUNT',
                filter: { types: ['upgrade'], traits: ['Tech'] },
                clamp: { max: 6 },
              },
            },
          },
        ]}
      />,
    );

    expect(screen.getByText('Hand Size Delta')).toBeDefined();
    expect(screen.getByTestId('dynamic-value-multiplier-input')).toBeDefined();
    expect(screen.queryByTestId('step-param-scaling-0-0')).toBeNull();
    expect(screen.queryByTestId('step-param-multiplier-0-0')).toBeNull();
  });
  it('shows an Attacker Kind select for the IF_UNDEFENDED_ATTACK gate and round-trips gateParams', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <StatefulStepPipelineEditor
        initial={[
          {
            effect: 'ADD_THREAT',
            gate: 'IF_UNDEFENDED_ATTACK',
            gateParams: { attackerKind: 'VILLAIN' },
            effectParams: { amount: 1, target: 'MAIN_SCHEME' },
          },
        ]}
        onChange={handleChange}
      />,
    );

    const gate = screen.getByTestId('step-gate-0-0') as HTMLSelectElement;
    expect(Array.from(gate.options).map((o) => o.value)).toContain('IF_UNDEFENDED_ATTACK');
    expect(gate.value).toBe('IF_UNDEFENDED_ATTACK');

    const kind = screen.getByTestId('gate-param-attackerKind-0-0') as HTMLSelectElement;
    expect(kind.value).toBe('VILLAIN');

    await user.selectOptions(kind, 'ANY_ENEMY');
    expect(handleChange).toHaveBeenLastCalledWith([
      expect.objectContaining({ gateParams: { attackerKind: 'ANY_ENEMY' } }),
    ]);
  });

  it('shows a Zone select for the IF_ZONE_EMPTY gate and writes gateParams.zone', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <StatefulStepPipelineEditor
        initial={[
          {
            effect: 'DISCARD',
            gate: 'IF_ZONE_EMPTY',
            gateParams: { zone: 'SIDE_SCHEMES' },
            effectParams: { source: 'ENCOUNTER_DECK' },
          },
        ]}
        onChange={handleChange}
      />,
    );

    const gate = screen.getByTestId('step-gate-0-0') as HTMLSelectElement;
    expect(Array.from(gate.options).map((o) => o.value)).toContain('IF_ZONE_EMPTY');
    expect(gate.value).toBe('IF_ZONE_EMPTY');

    const zone = screen.getByTestId('gate-param-zone-0-0') as HTMLSelectElement;
    expect(zone.value).toBe('SIDE_SCHEMES');
    expect(Array.from(zone.options).map((o) => o.value)).toEqual(
      expect.arrayContaining([
        'SIDE_SCHEMES',
        'ENCOUNTER_DECK',
        'ENCOUNTER_DISCARD',
        'HAND',
        'DECK',
        'DISCARD',
      ]),
    );

    await user.selectOptions(zone, 'ENCOUNTER_DISCARD');
    expect(handleChange).toHaveBeenLastCalledWith([
      expect.objectContaining({ gateParams: { zone: 'ENCOUNTER_DISCARD' } }),
    ]);
  });

  it('renders IF_RESULT gate controls with fact options, step picker, and updates state', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <StatefulStepPipelineEditor
        initial={[
          {
            id: 'step_damage',
            effect: 'DEAL_DAMAGE',
          },
          {
            id: 'step_surge',
            effect: 'SURGE',
            gate: 'IF_RESULT',
            gateParams: { result: 'AMOUNT_ZERO' },
          },
        ]}
        onChange={handleChange}
      />,
    );

    // Expand Step 1 (the IF_RESULT step)
    await user.click(screen.getByTestId('step-item-0-1'));

    const resultSelect = screen.getByTestId('gate-param-result-0-1') as HTMLSelectElement;
    expect(resultSelect).toBeDefined();
    expect(resultSelect.value).toBe('AMOUNT_ZERO');

    // Confirm all ResultFactSchema options are present
    const renderedOptions = Array.from(resultSelect.options).map((o) => o.value);
    for (const fact of ResultFactSchema.options) {
      expect(renderedOptions).toContain(fact);
    }

    // Step picker is present and contains the earlier step ID
    const stepSelect = screen.getByTestId('gate-param-step-0-1') as HTMLSelectElement;
    expect(stepSelect).toBeDefined();
    expect(Array.from(stepSelect.options).map((o) => o.value)).toContain('step_damage');

    // Change result to TARGET_DEFEATED
    await user.selectOptions(resultSelect, 'TARGET_DEFEATED');
    expect(handleChange).toHaveBeenCalledWith([
      expect.anything(),
      expect.objectContaining({
        gate: 'IF_RESULT',
        gateParams: expect.objectContaining({
          result: 'TARGET_DEFEATED',
        }),
      }),
    ]);
  });

  it('renders IF_RESOURCE_MATCH gate controls with text, count, checkboxes, and form qualifier', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <StatefulStepPipelineEditor
        initial={[
          {
            effect: 'DEAL_DAMAGE',
            gate: 'IF_RESOURCE_MATCH',
            gateParams: { resource: 'energy', count: 2, printedResource: true },
          },
        ]}
        onChange={handleChange}
      />,
    );

    const resourceInput = screen.getByTestId('gate-param-resource-0-0') as HTMLInputElement;
    expect(resourceInput).toBeDefined();
    expect(resourceInput.value).toBe('energy');

    const countInput = screen.getByTestId('gate-param-count-0-0') as HTMLInputElement;
    expect(countInput).toBeDefined();
    expect(countInput.value).toBe('2');

    const printedCheckbox = screen.getByTestId(
      'gate-param-printedResource-0-0',
    ) as HTMLInputElement;
    expect(printedCheckbox).toBeDefined();
    expect(printedCheckbox.checked).toBe(true);

    const onlyCheckbox = screen.getByTestId('gate-param-only-0-0') as HTMLInputElement;
    expect(onlyCheckbox).toBeDefined();
    expect(onlyCheckbox.checked).toBe(false);

    const formSelect = screen.getByTestId('gate-param-form-0-0') as HTMLSelectElement;
    expect(formSelect).toBeDefined();

    // Toggle only checkbox
    await user.click(onlyCheckbox);
    expect(handleChange).toHaveBeenCalledWith([
      expect.objectContaining({
        gateParams: expect.objectContaining({
          only: true,
        }),
      }),
    ]);
  });

  it('toggles gateParams.negate via Negate (NOT) checkbox', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <StatefulStepPipelineEditor
        initial={[
          {
            effect: 'DRAW',
            gate: 'THEN',
            gateParams: {},
          },
        ]}
        onChange={handleChange}
      />,
    );

    const negateCheckbox = screen.getByTestId('gate-param-negate-0-0') as HTMLInputElement;
    expect(negateCheckbox).toBeDefined();
    expect(negateCheckbox.checked).toBe(false);

    // Check negate
    await user.click(negateCheckbox);
    expect(handleChange).toHaveBeenLastCalledWith([
      expect.objectContaining({
        gateParams: expect.objectContaining({
          negate: true,
        }),
      }),
    ]);

    // Uncheck negate
    await user.click(negateCheckbox);
    const lastCall = handleChange.mock.calls[handleChange.mock.calls.length - 1][0];
    expect(lastCall[0].gateParams?.negate).toBeUndefined();
  });

  it('populates step picker with only earlier step IDs in the ability', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <StatefulStepPipelineEditor
        initial={[
          { id: 'first_step', effect: 'DEAL_DAMAGE' },
          { id: 'second_step', effect: 'DRAW' },
          {
            id: 'third_step',
            effect: 'SURGE',
            gate: 'IF_RESULT',
            gateParams: { result: 'AMOUNT_ZERO' },
          },
          { id: 'fourth_step', effect: 'HEAL_DAMAGE' },
        ]}
        onChange={handleChange}
      />,
    );

    // Step 0 is expanded: if it had a step picker (e.g. if gate was THEN), it would only have 'Previous step'
    // Expand Step 2 (third_step)
    await user.click(screen.getByTestId('step-item-0-2'));

    const stepPicker = screen.getByTestId('gate-param-step-0-2') as HTMLSelectElement;
    const optionValues = Array.from(stepPicker.options).map((o) => o.value);

    // Should include previous step placeholder and only preceding step IDs
    expect(optionValues).toContain(''); // "Previous step"
    expect(optionValues).toContain('first_step');
    expect(optionValues).toContain('second_step');

    // Should NOT include third_step (current step) or fourth_step (later step)
    expect(optionValues).not.toContain('third_step');
    expect(optionValues).not.toContain('fourth_step');

    // Select second_step
    await user.selectOptions(stepPicker, 'second_step');
    expect(handleChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'third_step',
          gateParams: expect.objectContaining({
            step: 'second_step',
          }),
        }),
      ]),
    );

    // Select Previous step ("") -> should clear step param
    await user.selectOptions(stepPicker, '');
    const lastCall = handleChange.mock.calls[handleChange.mock.calls.length - 1][0];
    expect(lastCall[2].gateParams?.step).toBeUndefined();
  });

  it('confirms Condition dropdown is completely absent from the editor', () => {
    render(
      <StepPipelineEditor
        steps={[
          {
            effect: 'DEAL_DAMAGE',
            gate: 'IF_PLAYER_HAS_TRAIT',
            gateParams: { trait: 'Aerial' },
          },
        ]}
        abilityIndex={0}
        onChange={vi.fn()}
      />,
    );

    // Assert that the old "Step Condition" label and controls are not rendered anywhere
    expect(screen.queryByText(/Step Condition/i)).toBeNull();
    expect(screen.queryByTestId(/step-condition/i)).toBeNull();
    expect(screen.queryByTestId(/condition-select/i)).toBeNull();
  });
});
