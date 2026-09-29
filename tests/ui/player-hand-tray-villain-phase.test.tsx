import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PlayerHandTray } from '../../src/ui/components/board/PlayerHandTray';
import { GameSettingsProvider } from '../../src/ui/context/GameSettingsProvider';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { setupGame, createCardInstance } from '../../src/engine/state/game-setup';
import { GameState, HeroCard, AlterEgoCard, GamePhase } from '../../src/engine/models';

vi.mock('../../src/ui/hooks/useCardArt', () => ({
  useCardArt: vi.fn().mockReturnValue({
    artUrl: 'https://cdn.example.com/test.jpg',
    loading: false,
    error: null,
  }),
}));

describe('PlayerHandTray during Villain Phase (Issue #182)', () => {
  let state: GameState;
  let spiderManHero: HeroCard;
  let peterParkerAlterEgo: AlterEgoCard;

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

    spiderManHero = cardCatalog.getCard('01001a') as HeroCard;
    peterParkerAlterEgo = cardCatalog.getCard('01001b') as AlterEgoCard;

    state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

    state.phase = GamePhase.VILLAIN_PHASE;
    state.players[0].currentForm = 'hero';
    state.players[0].activeFormCard = spiderManHero;
  });

  it('renders header with • (VILLAIN PHASE) indicator', () => {
    render(
      <GameSettingsProvider>
        <PlayerHandTray
          hand={[]}
          deck={state.players[0].deck}
          discard={[]}
          heroName="Spider-Man"
          handSizeLimit={5}
          player={state.players[0]}
          gameState={state}
        />
      </GameSettingsProvider>,
    );

    const header = screen.getByText(/• \(VILLAIN PHASE\)/);
    expect(header).toBeDefined();
    expect(header.textContent).toContain("Spider-Man's HAND");
    expect(header.textContent).toContain('• (VILLAIN PHASE)');
  });

  it('does not render the End Turn button during Villain Phase', () => {
    render(
      <GameSettingsProvider>
        <PlayerHandTray
          hand={[]}
          deck={state.players[0].deck}
          discard={[]}
          heroName="Spider-Man"
          handSizeLimit={5}
          player={state.players[0]}
          gameState={state}
        />
      </GameSettingsProvider>,
    );

    const endTurnBtn = screen.queryByRole('button', { name: /END TURN/i });
    expect(endTurnBtn).toBeNull();
    expect(screen.queryByText(/END TURN/i)).toBeNull();
  });

  it('shows warning when clicking hand cards during Villain Phase', () => {
    const cardInst = createCardInstance(cardCatalog.getCard('01005')!); // Web-Shooter

    render(
      <GameSettingsProvider>
        <PlayerHandTray
          hand={[cardInst]}
          deck={state.players[0].deck}
          discard={[]}
          heroName="Spider-Man"
          handSizeLimit={5}
          player={state.players[0]}
          gameState={state}
        />
      </GameSettingsProvider>,
    );

    // Find card image or card container
    const cardImg = screen.getByAltText(cardInst.card.name);
    expect(cardImg).toBeDefined();

    // Click card in hand
    fireEvent.click(cardImg);

    // Warning banner should be rendered
    const warningText = `Cannot play ${cardInst.card.name}: Cannot play cards during the Villain Phase`;
    const warningElements = screen.getAllByText(new RegExp(warningText, 'i'));
    expect(warningElements.length).toBeGreaterThan(0);
  });
});
