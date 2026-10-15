import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RemovedFromGameBox } from '../../src/ui/components/board/RemovedFromGameBox';
import { GameBoard } from '../../src/ui/components/board/GameBoard';
import { GameSettingsProvider } from '../../src/ui/context/GameSettingsProvider';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { createCardInstance, setupGame } from '../../src/engine/state/game-setup';
import { HeroCard, AlterEgoCard } from '../../src/engine/models';

vi.mock('../../src/ui/hooks/useCardArt', () => ({
  useCardArt: vi.fn().mockReturnValue({
    artUrl: 'https://cdn.example.com/test.jpg',
    loading: false,
    error: null,
  }),
}));

describe('Visible Removed from Game Pile (Issue #282)', () => {
  beforeEach(() => {
    Element.prototype.scrollTo = vi.fn();
    Element.prototype.scrollBy = vi.fn();
    Element.prototype.getBoundingClientRect = vi.fn().mockReturnValue({
      top: 0,
      left: 0,
      right: 1920,
      bottom: 1080,
      width: 1920,
      height: 1080,
      x: 0,
      y: 0,
    });
  });

  it('renders empty placeholder with REMOVED and EMPTY when cards list is empty', () => {
    render(
      <GameSettingsProvider>
        <RemovedFromGameBox cards={[]} />
      </GameSettingsProvider>,
    );

    const emptyPile = screen.getByTestId('removed-from-game-pile-empty');
    expect(emptyPile).toBeDefined();
    expect(emptyPile.textContent).toContain('REMOVED');
    expect(emptyPile.textContent).toContain('EMPTY');

    fireEvent.click(emptyPile);
    expect(screen.getByText(/Removed from Game \(0 Cards\)/i)).toBeDefined();
    expect(screen.getByText(/No cards have been removed from the game/i)).toBeDefined();
  });

  it('renders populated pile with card name, REMOVED badge, and count badge', () => {
    // Eviction Notice (Spider-Man obligation)
    const obligationCard = cardCatalog.getCard('01165')!;
    const cardInstance = createCardInstance(obligationCard);

    render(
      <GameSettingsProvider>
        <RemovedFromGameBox cards={[cardInstance]} />
      </GameSettingsProvider>,
    );

    const populatedPile = screen.getByTestId('removed-from-game-pile');
    expect(populatedPile).toBeDefined();
    expect(populatedPile.textContent).toContain('REMOVED');
    expect(populatedPile.textContent).toContain('1');
    expect(screen.getByAltText(obligationCard.name)).toBeDefined();
  });

  it('opens modal on click showing cards and title', () => {
    const obligationCard = cardCatalog.getCard('01165')!;
    const cardInstance = createCardInstance(obligationCard);

    render(
      <GameSettingsProvider>
        <RemovedFromGameBox cards={[cardInstance]} />
      </GameSettingsProvider>,
    );

    const pile = screen.getByTestId('removed-from-game-pile');
    fireEvent.click(pile);

    expect(screen.getByText(/Removed from Game \(1 Cards\)/i)).toBeDefined();
    expect(
      screen.getByText(/Cards removed from the game are out of play and cannot reenter the game/i),
    ).toBeDefined();
    expect(screen.getAllByAltText(obligationCard.name).length).toBeGreaterThanOrEqual(1);
  });

  it('closes modal when clicking close button', () => {
    const obligationCard = cardCatalog.getCard('01165')!;
    const cardInstance = createCardInstance(obligationCard);

    render(
      <GameSettingsProvider>
        <RemovedFromGameBox cards={[cardInstance]} />
      </GameSettingsProvider>,
    );

    fireEvent.click(screen.getByTestId('removed-from-game-pile'));
    expect(screen.getByText(/Removed from Game \(1 Cards\)/i)).toBeDefined();

    // Click close button in modal (footer close button or header X)
    const closeButtons = screen.getAllByRole('button', { name: /close/i });
    expect(closeButtons.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(closeButtons[0]);

    expect(screen.queryByText(/Removed from Game \(1 Cards\)/i)).toBeNull();
  });

  it('renders RemovedFromGameBox within GameBoard with gameState.removedFromGame', () => {
    const obligationCard = cardCatalog.getCard('01026')!;
    const cardInstance = createCardInstance(obligationCard);

    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Peter Parker',
          hero: cardCatalog.getCard('01001a') as HeroCard,
          alterEgo: cardCatalog.getCard('01001b') as AlterEgoCard,
          deckCards: Array(15).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

    state.removedFromGame = [cardInstance];

    render(
      <GameSettingsProvider>
        <GameBoard gameState={state} onReset={vi.fn()} />
      </GameSettingsProvider>,
    );

    expect(screen.getByTestId('removed-from-game-box')).toBeDefined();
    const pile = screen.getByTestId('removed-from-game-pile');
    expect(pile).toBeDefined();
    expect(pile.textContent).toContain('1');
  });
});
