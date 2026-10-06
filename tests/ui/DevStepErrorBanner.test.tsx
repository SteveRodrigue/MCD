import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DevStepErrorBanner } from '../../src/ui/components/board/DevStepErrorBanner';
import { CombatLogDrawer } from '../../src/ui/components/board/CombatLogDrawer';
import { GameLogEntry } from '../../src/engine/models';

const stepError = (id: string, text: string): GameLogEntry => ({
  id,
  timestamp: 1,
  key: 'engine.stepError',
  category: 'ability',
  params: { effect: 'ADD_TRAIT', error: 'boom' },
  text,
});

describe('Dev Mode step error message (Issue #225)', () => {
  it('shows the latest step error in Dev Mode and can be dismissed', () => {
    const logs = [stepError('l1', '01039 ADD_TRAIT failed: boom')];
    render(<DevStepErrorBanner logs={logs} devMode />);
    expect(screen.getByText(/01039 ADD_TRAIT failed: boom/)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(screen.queryByText(/ADD_TRAIT failed/)).toBeNull();
  });

  it('shows a newer error after a dismissal', () => {
    const first = [stepError('l1', 'first failed')];
    const { rerender } = render(<DevStepErrorBanner logs={first} devMode />);
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    rerender(<DevStepErrorBanner logs={[...first, stepError('l2', 'second failed')]} devMode />);
    expect(screen.getByText(/second failed/)).toBeDefined();
  });

  it('shows nothing outside Dev Mode', () => {
    render(<DevStepErrorBanner logs={[stepError('l1', 'hidden failed')]} devMode={false} />);
    expect(screen.queryByText(/hidden failed/)).toBeNull();
  });

  it('lists the error in the combat log in Dev Mode only', () => {
    const logs = [stepError('l1', '01039 ADD_TRAIT failed: boom')];
    const { unmount } = render(
      <CombatLogDrawer isOpen onClose={() => {}} logs={logs} devMode={false} />,
    );
    expect(screen.queryByText(/ADD_TRAIT failed/)).toBeNull();
    unmount();
    render(<CombatLogDrawer isOpen onClose={() => {}} logs={logs} devMode />);
    expect(screen.getAllByText(/ADD_TRAIT failed: boom/).length).toBeGreaterThan(0);
  });
});
