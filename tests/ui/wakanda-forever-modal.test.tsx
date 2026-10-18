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
      { id: 'wf_daggers', cardCode: '01046', label: 'Energy Daggers' },
      { id: 'wf_claws', cardCode: '01047', label: 'Panther Claws' },
      { id: 'wf_genius', cardCode: '01048', label: 'Tactical Genius' },
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

  it('renders styled tiles for all four upgrades with Vibranium Suit (01049) showing its icon', () => {
    const fullPrompt = {
      promptId: 'prompt_wakanda_full',
      playerId: 'p1',
      title: 'Wakanda Forever!',
      sourceCardName: 'Wakanda Forever!',
      options: [
        { id: 'wf_daggers', cardCode: '01046', label: 'Energy Daggers' },
        { id: 'wf_claws', cardCode: '01047', label: 'Panther Claws' },
        { id: 'wf_genius', cardCode: '01048', label: 'Tactical Genius' },
        { id: 'wf_suit', cardCode: '01049', label: 'Vibranium Suit' },
      ],
    } as PendingDecisionPrompt;

    render(<WakandaForeverModal prompt={fullPrompt} onExecuteSequence={vi.fn()} />);

    expect(screen.getAllByText('Energy Daggers').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Panther Claws').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Tactical Genius').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Vibranium Suit').length).toBeGreaterThan(0);
    expect(screen.getByText('🛡️')).toBeTruthy();
    expect(screen.getByText('MOVE 2 DAMAGE TO ENEMY (FINISHER)')).toBeTruthy();
  });

  it('renders fallback tile for an unknown card code', () => {
    const unknownPrompt = {
      promptId: 'prompt_wakanda_unknown',
      playerId: 'p1',
      title: 'Wakanda Forever!',
      sourceCardName: 'Wakanda Forever!',
      options: [
        {
          id: 'wf_custom',
          cardCode: '99999',
          label: 'Custom Upgrade',
          description: 'Custom special effect',
        },
      ],
    } as PendingDecisionPrompt;

    render(<WakandaForeverModal prompt={unknownPrompt} onExecuteSequence={vi.fn()} />);

    expect(screen.getAllByText('Custom Upgrade').length).toBeGreaterThan(0);
    expect(screen.getByText('⚡')).toBeTruthy();
    expect(screen.getByText('Custom special effect (BOOSTED)')).toBeTruthy();
    expect(screen.getByText('💥 FINISHER')).toBeTruthy();
  });
});
