import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { CardStatsModal } from '../../src/ui/components/cards/CardStatsModal';
import { ResetCardStatsConfirmModal } from '../../src/ui/components/cards/ResetCardStatsConfirmModal';
import { GameOverScreen } from '../../src/ui/components/board/GameOverScreen';
import { OptionsMenu } from '../../src/ui/components/board/OptionsMenu';
import { PileViewerModal } from '../../src/ui/components/board/PileViewerModal';
import { GameSettingsProvider } from '../../src/ui/context/GameSettingsProvider';
import { newRhinoGame } from '../support/game-fixtures';
import { TestSession } from '../support/render-with-session';

vi.mock('../../src/ui/hooks/useCardArt', () => ({
  useCardArt: vi.fn().mockReturnValue({
    artUrl: 'https://cdn.example.com/test.jpg',
    loading: false,
    error: null,
  }),
}));

const spider = cardCatalog.getCard('01001a')!;

describe('modals say each thing once', () => {
  it('Card stats: the card is named once and the count legend is written once', () => {
    render(<CardStatsModal isOpen onClose={() => {}} card={spider} />);
    expect(screen.getByRole('dialog', { name: 'Card stats' })).toBeTruthy();
    expect(screen.queryByText(/Spider-Man — STATS/i)).toBeNull();
    expect(screen.queryByText('Game:')).toBeNull();
    expect(screen.getAllByText(/all-time/i, { selector: 'p' })).toHaveLength(2);
  });

  it('Reset stats: no card name or code in the body, the card is the header trigger only', () => {
    render(
      <ResetCardStatsConfirmModal isOpen onClose={() => {}} card={spider} onConfirm={() => {}} />,
    );
    const dialog = screen.getByRole('dialog', { name: 'Reset card stats' });
    expect(dialog.textContent).not.toContain('(01001a)');
    expect(dialog.querySelectorAll('[data-card-ref="01001a"]')).toHaveLength(1);
  });

  it('Game over: no "End of game" kicker above "Victory!"', () => {
    const state = { ...newRhinoGame(), winner: 'HEROES' as const };
    render(
      <TestSession state={state}>
        <GameOverScreen onReset={() => {}} />
      </TestSession>,
    );
    expect(screen.getByRole('dialog', { name: 'Victory' })).toBeTruthy();
    expect(screen.queryByText('End of game')).toBeNull();
  });

  it('Pile viewer: no generic kicker, only the dev badge when it applies', () => {
    const { rerender } = render(
      <PileViewerModal title="Discard" icon={null} closeLabel="Close" onClose={() => {}}>
        <span />
      </PileViewerModal>,
    );
    expect(screen.queryByText(/open information/i)).toBeNull();
    rerender(
      <PileViewerModal title="Deck" icon={null} devBadge closeLabel="Close" onClose={() => {}}>
        <span />
      </PileViewerModal>,
    );
    expect(screen.getByText('DEV MODE')).toBeTruthy();
  });

  it('Options: setting descriptions do not restate their buttons and show no raw LaTeX', () => {
    render(
      <GameSettingsProvider>
        <TestSession state={newRhinoGame()}>
          <OptionsMenu isOpen onClose={() => {}} />
        </TestSession>
      </GameSettingsProvider>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).not.toMatch(/\$|\\rightarrow/);
    expect(dialog.textContent).not.toContain('(90%, 100%, 110%)');
  });
});
