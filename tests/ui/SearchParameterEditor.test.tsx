import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StepPipelineEditor } from '../../src/ui/components/editor/StepPipelineEditor';
import { DynamicValueBuilder } from '../../src/ui/components/editor/DynamicValueBuilder';

describe('SearchParameterEditor UI Tests (Issue #115)', () => {
  it('renders multi-select chip toggle buttons for source zones in StepPipelineEditor', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    const initialSteps = [
      {
        effect: 'SEARCH',
        params: {
          source: ['ENCOUNTER_DECK'],
        },
      },
    ];

    render(<StepPipelineEditor steps={initialSteps} abilityIndex={0} onChange={handleChange} />);

    // Multi-select chip buttons should be rendered
    const encounterDeckBtn = screen.getByTestId('step-param-source-ENCOUNTER_DECK-0-0');
    const encounterDiscardBtn = screen.getByTestId('step-param-source-ENCOUNTER_DISCARD-0-0');
    const playerDeckBtn = screen.getByTestId('step-param-source-PLAYER_DECK-0-0');

    expect(encounterDeckBtn).toBeDefined();
    expect(encounterDiscardBtn).toBeDefined();
    expect(playerDeckBtn).toBeDefined();

    // ENCOUNTER_DECK should have active classes
    expect(encounterDeckBtn.className).toContain('bg-comic-accent');
    // ENCOUNTER_DISCARD should not have active classes
    expect(encounterDiscardBtn.className).toContain('bg-gray-100');

    // Clicking ENCOUNTER_DISCARD should add it to the multi-select array
    await user.click(encounterDiscardBtn);
    expect(handleChange).toHaveBeenCalledWith([
      {
        effect: 'SEARCH',
        params: {
          source: ['ENCOUNTER_DECK', 'ENCOUNTER_DISCARD'],
        },
      },
    ]);
  });

  it('toggles off an active source zone in multi-select chips', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    const initialSteps = [
      {
        effect: 'SEARCH',
        params: {
          source: ['ENCOUNTER_DECK', 'ENCOUNTER_DISCARD'],
        },
      },
    ];

    render(<StepPipelineEditor steps={initialSteps} abilityIndex={0} onChange={handleChange} />);

    const encounterDeckBtn = screen.getByTestId('step-param-source-ENCOUNTER_DECK-0-0');
    await user.click(encounterDeckBtn);

    expect(handleChange).toHaveBeenCalledWith([
      {
        effect: 'SEARCH',
        params: {
          source: ['ENCOUNTER_DISCARD'],
        },
      },
    ]);
  });

  it('clamps number inputs to non-negative values in StepPipelineEditor', () => {
    const handleChange = vi.fn();
    const initialSteps = [
      {
        effect: 'MODIFY_RESTRICTED_LIMIT',
        params: {
          amount: 1,
        },
      },
    ];

    render(<StepPipelineEditor steps={initialSteps} abilityIndex={0} onChange={handleChange} />);

    const numInput = screen.getByTestId('step-param-amount-0-0') as HTMLInputElement;
    expect(numInput.getAttribute('min')).toBe('0');

    // Simulate typing a negative number
    fireEvent.change(numInput, { target: { value: '-5' } });
    expect(handleChange).toHaveBeenCalledWith([
      {
        effect: 'MODIFY_RESTRICTED_LIMIT',
        params: {
          amount: 0,
        },
      },
    ]);
  });

  it('clamps number inputs to non-negative values in DynamicValueBuilder', () => {
    const handleChange = vi.fn();

    render(
      <DynamicValueBuilder label="Look Count" value={5} allowAll={true} onChange={handleChange} />,
    );

    const numInput = screen.getByTestId('dynamic-value-number-input') as HTMLInputElement;
    expect(numInput.getAttribute('min')).toBe('0');

    // Simulate typing a negative number
    fireEvent.change(numInput, { target: { value: '-2' } });
    expect(handleChange).toHaveBeenCalledWith(0);
  });
});
