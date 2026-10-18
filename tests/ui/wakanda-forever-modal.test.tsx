import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WakandaForeverModal } from '../../src/ui/components/board/WakandaForeverModal';
import type { PendingDecisionPrompt } from '../../src/engine/models';

// Black Panther's Wakanda Forever! lets the player order the upgrade Specials; the last one
// resolves as the finisher (AUD-20261017-232534 F007: the modal had no test).
describe('WakandaForeverModal', () => {
  const prompt = {
    promptId: 'prompt_wakanda',
    playerId: 'p1',
    title: 'Wakanda Forever!',
    sourceCardName: 'Wakanda Forever!',
    options: [
      { id: 'wf_daggers', label: 'Energy Daggers' },
      { id: 'wf_claws', label: 'Panther Claws' },
      { id: 'wf_genius', label: 'Tactical Genius' },
    ],
  } as PendingDecisionPrompt;

  it('lists every upgrade Special and marks the last one as the finisher', () => {
    render(<WakandaForeverModal prompt={prompt} onExecuteSequence={vi.fn()} />);
    expect(screen.getAllByText('Energy Daggers').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Panther Claws').length).toBeGreaterThan(0);
    expect(screen.getByText('REMOVE 2 THREAT FROM SCHEME (FINISHER)')).toBeTruthy();
  });

  it('executes the sequence in the order the player sets', () => {
    const onExecuteSequence = vi.fn();
    render(<WakandaForeverModal prompt={prompt} onExecuteSequence={onExecuteSequence} />);

    fireEvent.click(screen.getAllByTitle('Move later')[0]);
    fireEvent.click(screen.getByText('EXECUTE SEQUENCE!'));

    expect(onExecuteSequence).toHaveBeenCalledWith(['wf_claws', 'wf_daggers', 'wf_genius']);
  });
});
