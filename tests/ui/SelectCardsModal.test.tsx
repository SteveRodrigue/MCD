import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DecisionPromptModal } from '../../src/ui/components/board/DecisionPromptModal';
import { PendingDecisionPrompt } from '../../src/engine/models';

function makePrompt(
  selection: NonNullable<PendingDecisionPrompt['selection']>,
): PendingDecisionPrompt {
  const card = (id: string, name: string, code: string) => ({
    id,
    label: `${name} (event)`,
    description: '',
    effect: 'SEARCH_AND_SELECT_RESOLUTION',
    params: { cardName: name, cardCode: code },
  });
  return {
    promptId: 'p',
    playerId: 'p1',
    title: 'Ancestral Knowledge: Choose card(s)',
    description: 'Select up to 3 card(s):',
    sourceCardName: 'Ancestral Knowledge',
    options: [
      card('a1', 'Backflip', '01003'),
      card('a2', 'Backflip', '01003'),
      card('b', 'Swinging Web Kick', '01004'),
      card('c', 'Energy Daggers', '01047'),
      card('d', 'Black Panther', '01040a'),
    ],
    isVoluntary: false,
    selection,
  };
}

describe('multi-select card prompt (SEARCH minimumTake / takeCount)', () => {
  it('confirms an empty choice when min is 0 and sends the chosen ids', () => {
    const onSelect = vi.fn();
    render(
      <DecisionPromptModal
        prompt={makePrompt({ min: 0, max: 3, distinctBy: 'NAME' })}
        onSelectOption={onSelect}
      />,
    );
    expect(screen.getByTestId('select-cards-counter').textContent).toContain('0 / 3');
    const confirm = screen.getByTestId('select-cards-confirm') as HTMLButtonElement;
    expect(confirm.disabled).toBe(false);
    fireEvent.click(screen.getByTestId('select-card-b'));
    fireEvent.click(screen.getByTestId('select-card-c'));
    expect(screen.getByTestId('select-cards-counter').textContent).toContain('2 / 3');
    fireEvent.click(confirm);
    expect(onSelect).toHaveBeenCalledWith('confirm_selection', { selectedOptionIds: ['b', 'c'] });
  });

  it('does not allow more than max cards', () => {
    render(
      <DecisionPromptModal prompt={makePrompt({ min: 0, max: 2 })} onSelectOption={vi.fn()} />,
    );
    fireEvent.click(screen.getByTestId('select-card-a1'));
    fireEvent.click(screen.getByTestId('select-card-b'));
    expect((screen.getByTestId('select-card-c') as HTMLButtonElement).disabled).toBe(true);
  });

  it('disables a second card with the same name when distinctBy is NAME', () => {
    render(
      <DecisionPromptModal
        prompt={makePrompt({ min: 0, max: 3, distinctBy: 'NAME' })}
        onSelectOption={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('select-card-a1'));
    expect((screen.getByTestId('select-card-a2') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId('select-card-a1'));
    expect((screen.getByTestId('select-card-a2') as HTMLButtonElement).disabled).toBe(false);
  });

  it('keeps Confirm disabled below min', () => {
    render(
      <DecisionPromptModal prompt={makePrompt({ min: 2, max: 3 })} onSelectOption={vi.fn()} />,
    );
    const confirm = screen.getByTestId('select-cards-confirm') as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    fireEvent.click(screen.getByTestId('select-card-b'));
    expect(confirm.disabled).toBe(true);
    fireEvent.click(screen.getByTestId('select-card-c'));
    expect(confirm.disabled).toBe(false);
  });
});

describe('End of Player Phase discard (PLAYER_CLEANUP multi-select)', () => {
  const handCard = (id: string, name: string, code: string) => ({
    id,
    label: `Discard ${name}`,
    cardCode: code,
    cardName: name,
    description: '',
    effect: 'PLAYER_CLEANUP_DISCARD',
    params: { cardCode: code, cardName: name },
  });
  const cleanupPrompt: PendingDecisionPrompt = {
    promptId: 'prompt_cleanup_p1_1',
    playerId: 'p1',
    title: 'End of Player Phase: Voluntary Discard',
    description: 'Select any cards in your hand you wish to discard:',
    sourceCardName: 'Black Panther',
    isVoluntary: true,
    kind: 'PLAYER_CLEANUP',
    selection: { min: 0, max: 3 },
    options: [
      handCard('i1', 'Energy Daggers', '01047'),
      handCard('i2', 'Backflip', '01003'),
      handCard('i3', 'Swinging Web Kick', '01004'),
    ],
  };

  it('shows every hand card with its thumbnail anchor, keeping all when nothing is chosen', () => {
    const onSelect = vi.fn();
    render(<DecisionPromptModal prompt={cleanupPrompt} onSelectOption={onSelect} />);
    for (const o of cleanupPrompt.options) {
      expect(screen.getByTestId(`select-card-${o.id}`).getAttribute('data-card-anchor')).toBe(
        o.cardCode,
      );
    }
    const confirm = screen.getByTestId('select-cards-confirm') as HTMLButtonElement;
    expect(confirm.textContent).toBe('Keep all cards');
    fireEvent.click(confirm);
    expect(onSelect).toHaveBeenCalledWith('confirm_selection', { selectedOptionIds: [] });
  });

  it('discards all chosen cards in one confirmation', () => {
    const onSelect = vi.fn();
    render(<DecisionPromptModal prompt={cleanupPrompt} onSelectOption={onSelect} />);
    fireEvent.click(screen.getByTestId('select-card-i1'));
    fireEvent.click(screen.getByTestId('select-card-i3'));
    const confirm = screen.getByTestId('select-cards-confirm');
    expect(confirm.textContent).toBe('Discard 2');
    fireEvent.click(confirm);
    expect(onSelect).toHaveBeenCalledWith('confirm_selection', { selectedOptionIds: ['i1', 'i3'] });
  });
});
