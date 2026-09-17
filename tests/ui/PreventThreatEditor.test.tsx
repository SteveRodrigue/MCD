import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StepPipelineEditor } from '../../src/ui/components/editor/StepPipelineEditor';

describe('PreventThreatEditor UI Tests (Issue #123)', () => {
  it('renders PREVENT_THREAT step with description tooltip, amount input, and target scheme selector', () => {
    const handleChange = vi.fn();
    const initialSteps = [
      {
        effect: 'PREVENT_THREAT',
        effectParams: {
          amount: 1,
          target: 'MAIN_SCHEME',
        },
      },
    ];

    render(<StepPipelineEditor steps={initialSteps} abilityIndex={0} onChange={handleChange} />);

    // Description text should be displayed
    expect(
      screen.getByText('Prevent or reduce impending threat that would be placed on a scheme.'),
    ).toBeDefined();

    // Effect selector should display PREVENT_THREAT
    const effectSelect = screen.getByTestId('step-effect-select-0-0') as HTMLSelectElement;
    expect(effectSelect.value).toBe('PREVENT_THREAT');

    // Amount numeric input should be rendered with value 1
    const amountInput = screen.getByTestId('dynamic-value-number-input') as HTMLInputElement;
    expect(amountInput).toBeDefined();
    expect(amountInput.value).toBe('1');

    // Target select should be rendered with value MAIN_SCHEME
    const targetSelect = screen.getByTestId('step-param-target-0-0') as HTMLSelectElement;
    expect(targetSelect).toBeDefined();
    expect(targetSelect.value).toBe('MAIN_SCHEME');
  });

  it('updates amount parameter when user changes amount or clicks Entire Pool (ALL)', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    const initialSteps = [
      {
        effect: 'PREVENT_THREAT',
        effectParams: {
          amount: 1,
          target: 'MAIN_SCHEME',
        },
      },
    ];

    render(<StepPipelineEditor steps={initialSteps} abilityIndex={0} onChange={handleChange} />);

    // Switch to ALL
    const allBtn = screen.getByTestId('mode-entire-pool-btn');
    expect(allBtn).toBeDefined();
    await user.click(allBtn);

    expect(handleChange).toHaveBeenCalledWith([
      {
        effect: 'PREVENT_THREAT',
        effectParams: {
          amount: 'ALL',
          target: 'MAIN_SCHEME',
        },
      },
    ]);
  });

  it('initializes default target: MAIN_SCHEME when selecting PREVENT_THREAT from effect dropdown', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    const initialSteps = [
      {
        effect: 'DEAL_DAMAGE',
      },
    ];

    render(<StepPipelineEditor steps={initialSteps} abilityIndex={0} onChange={handleChange} />);

    const effectSelect = screen.getByTestId('step-effect-select-0-0');
    await user.selectOptions(effectSelect, 'PREVENT_THREAT');

    expect(handleChange).toHaveBeenCalledWith([
      {
        effect: 'PREVENT_THREAT',
        effectParams: {
          target: 'MAIN_SCHEME',
        },
      },
    ]);
  });
});
