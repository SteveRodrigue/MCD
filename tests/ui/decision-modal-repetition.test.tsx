import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { PendingDecisionPrompt } from '../../src/engine/models';
import { DecisionPromptModal } from '../../src/ui/components/board/DecisionPromptModal';
import { decisionPrompt } from '../../src/ui/components/templates/template-data';

vi.mock('../../src/ui/hooks/useCardArt', () => ({
  useCardArt: vi.fn().mockReturnValue({
    artUrl: 'https://cdn.example.com/test.jpg',
    loading: false,
    error: null,
  }),
}));

const renderPrompt = (prompt: PendingDecisionPrompt) =>
  render(<DecisionPromptModal prompt={prompt} onSelectOption={() => {}} />);

describe('DecisionPromptModal says each thing once', () => {
  it('writes the question once, as the dialog title', () => {
    renderPrompt(decisionPrompt(false));
    expect(screen.getAllByText('Choose your defense')).toHaveLength(1);
    expect(screen.getByRole('dialog', { name: 'Choose your defense' })).toBeTruthy();
  });

  it('does not repeat the forced or optional state in a chip', () => {
    renderPrompt(decisionPrompt(true));
    expect(screen.getByText('FORCED RESOLUTION')).toBeTruthy();
    expect(screen.queryByText('FORCED')).toBeNull();
    expect(screen.queryByText('OPTIONAL')).toBeNull();
  });

  it('shows the attacker and defender once, in the matchup, not again as header or card panels', () => {
    renderPrompt(decisionPrompt(false));
    const dialog = screen.getByRole('dialog');
    expect(dialog.querySelector('[data-card-ref="01094"]')).toBeNull();
    expect(screen.queryByText('TRIGGERING ENCOUNTER CARD')).toBeNull();
    expect(screen.queryByText('TRIGGERING CARD')).toBeNull();
    expect(screen.queryByText('ABILITY CARD')).toBeNull();
    expect(dialog.querySelectorAll('[data-card-anchor="01094"]')).toHaveLength(1);
  });

  it('still shows a trigger card that no matchup covers', () => {
    renderPrompt({
      promptId: 'prompt_forced_treachery',
      playerId: 'p1',
      title: 'Resolve the treachery',
      description: 'Choose how to resolve it.',
      sourceCardName: 'Rhino',
      sourceCardCode: '01094',
      triggerSourceCode: '01094',
      isVoluntary: false,
      options: [{ id: 'go', label: 'Resolve', effect: 'RESOLVE' }],
    });
    expect(screen.getByText(/TRIGGERING/)).toBeTruthy();
  });
});
