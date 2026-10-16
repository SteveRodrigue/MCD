import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StepPipelineEditor } from '../../src/ui/components/editor/StepPipelineEditor';

describe('Step "cannot be canceled" flag in the Card Editor (#255)', () => {
  it('shows the flag of a flagged step and clears it', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    const steps = [
      { effect: 'DRAW', cannotBeCanceled: true, effectParams: { count: 1, target: 'SELF' } },
    ];

    render(<StepPipelineEditor steps={steps} abilityIndex={0} onChange={handleChange} />);

    const flag = screen.getByTestId('step-cannot-be-canceled-0-0') as HTMLInputElement;
    expect(flag.checked).toBe(true);

    await user.click(flag);
    const updated = handleChange.mock.calls.at(-1)![0];
    expect(updated[0].cannotBeCanceled).toBeUndefined();
  });

  it('sets the flag on an unflagged step', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    const steps = [{ effect: 'REMOVE_FROM_GAME', effectParams: {} }];

    render(<StepPipelineEditor steps={steps} abilityIndex={0} onChange={handleChange} />);

    expect(screen.queryByTestId('step-cannot-be-canceled-0-0')).toBeNull();

    await user.click(screen.getByTestId('step-chip-add-cannotBeCanceled-0-0'));
    expect(handleChange.mock.calls.at(-1)![0][0].cannotBeCanceled).toBe(true);
  });
});
