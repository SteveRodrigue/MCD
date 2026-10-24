import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WakandaForeverModal } from '../../src/ui/components/board/WakandaForeverModal';
import type { DecisionPromptOption, PendingDecisionPrompt } from '../../src/engine/models';

function makePrompt(options: DecisionPromptOption[]): PendingDecisionPrompt {
  return {
    promptId: 'prompt_wakanda',
    playerId: 'p1',
    title: 'Wakanda Forever!',
    description: 'Select the resolution order for your Black Panther upgrades.',
    sourceCardName: 'Wakanda Forever!',
    options,
  };
}

function upgradeOption(
  id: string,
  cardCode: string,
  label: string,
  specialEffect: string,
  amount: number,
  finisherAmount: number,
): DecisionPromptOption {
  return {
    id,
    cardCode,
    label,
    description: `<b>Special</b>: ${label} special.`,
    effect: 'SELECT_WAKANDA_UPGRADE',
    params: { specialEffect, amount, finisherAmount },
  };
}

const daggers = upgradeOption('wf_daggers', '01046', 'Energy Daggers', 'DEAL_DAMAGE', 1, 2);
const claws = upgradeOption('wf_claws', '01047', 'Panther Claws', 'DEAL_DAMAGE', 2, 4);
const genius = upgradeOption('wf_genius', '01048', 'Tactical Genius', 'REMOVE_THREAT', 1, 2);
const suit = upgradeOption('wf_suit', '01049', 'Vibranium Suit', 'TRANSFER_DAMAGE', 1, 2);

// Black Panther's Wakanda Forever! lets the player order the upgrade Specials; the last one
// resolves as the finisher (AUD-20261017-232534 F007: the modal had no test).
describe('WakandaForeverModal', () => {
  const prompt = makePrompt([daggers, claws, genius]);

  it('lists every upgrade Special and marks the last one as the finisher', () => {
    render(<WakandaForeverModal prompt={prompt} onExecuteSequence={vi.fn()} />);
    expect(screen.getByLabelText('Move Energy Daggers later')).toBeTruthy();
    expect(screen.getByLabelText('Move Panther Claws later')).toBeTruthy();
    expect(screen.queryByText('Planned resolution sequence')).toBeNull();
    expect(screen.getAllByText('1 DMG').length).toBeGreaterThan(0);
    expect(screen.getAllByText('💥 2 THW').length).toBeGreaterThan(0);
  });

  it('executes the sequence in the order the player sets', () => {
    const onExecuteSequence = vi.fn();
    render(<WakandaForeverModal prompt={prompt} onExecuteSequence={onExecuteSequence} />);

    fireEvent.click(screen.getAllByTitle('Move later')[0]);
    fireEvent.click(screen.getByText('EXECUTE SEQUENCE!'));

    expect(onExecuteSequence).toHaveBeenCalledWith(['wf_claws', 'wf_daggers', 'wf_genius']);
  });

  it('styles Vibranium Suit (01049) from its Special effect and amounts', () => {
    render(
      <WakandaForeverModal
        prompt={makePrompt([daggers, claws, genius, suit])}
        onExecuteSequence={vi.fn()}
      />,
    );

    expect(screen.getAllByText('Vibranium Suit').length).toBeGreaterThan(0);
    expect(screen.getByText('🛡️')).toBeTruthy();
    expect(screen.getAllByText('💥 2 MOVE').length).toBeGreaterThan(0);
  });

  it('renders the card text as formatted HTML, not raw markup', () => {
    render(<WakandaForeverModal prompt={prompt} onExecuteSequence={vi.fn()} />);

    expect(screen.queryByText(/<b>Special<\/b>/)).toBeNull();
    expect(screen.getAllByText('Special', { selector: 'b' }).length).toBe(3);
  });

  it('renders the fallback tile for an option without Special amounts', () => {
    render(
      <WakandaForeverModal
        prompt={makePrompt([
          {
            id: 'wf_custom',
            cardCode: '99999',
            label: 'Custom Upgrade',
            description: 'Custom special effect',
            effect: 'SELECT_WAKANDA_UPGRADE',
          },
        ])}
        onExecuteSequence={vi.fn()}
      />,
    );

    expect(screen.getAllByText('Custom Upgrade').length).toBeGreaterThan(0);
    expect(screen.getByText('⚡')).toBeTruthy();
    expect(screen.getByText('Custom special effect')).toBeTruthy();
    expect(screen.getAllByText('💥 FINISHER').length).toBeGreaterThan(0);
  });
});
