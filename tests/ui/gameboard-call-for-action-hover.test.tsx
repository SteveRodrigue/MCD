import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GameBoard } from '../../src/ui/components/board/GameBoard';
import { GameSettingsProvider } from '../../src/ui/context/GameSettingsProvider';
import { GamePhase, GameState, HeroCard, AlterEgoCard } from '../../src/engine/models';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { setupGame, createCardInstance } from '../../src/engine/state/game-setup';
import { TestSession } from '../support/render-with-session';

describe('GameBoard Call for Action Top-Left Hover Button', () => {
  let spiderManHero: HeroCard;
  let peterParkerAlterEgo: AlterEgoCard;
  let ironManHero: HeroCard;
  let tonyStarkAlterEgo: AlterEgoCard;

  beforeEach(() => {
    spiderManHero = cardCatalog.getCard('01001a') as HeroCard;
    peterParkerAlterEgo = cardCatalog.getCard('01001b') as AlterEgoCard;
    ironManHero = cardCatalog.getCard('01029a') as HeroCard;
    tonyStarkAlterEgo = cardCatalog.getCard('01029b') as AlterEgoCard;

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

  function createMultiplayerState(): GameState {
    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Peter Parker',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: Array(15).fill(cardCatalog.getCard('01005')!),
        },
        {
          id: 'p2',
          name: 'Tony Stark',
          hero: ironManHero,
          alterEgo: tonyStarkAlterEgo,
          deckCards: Array(15).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

    state.phase = GamePhase.PLAYER_PHASE;
    state.activePlayerIndex = 0; // p1 is active player

    // Add Avengers Mansion (01091) to p2 tableau for legal teammate action
    const avengersMansion = createCardInstance(cardCatalog.getCard('01091')!);
    state.players[1].tableau.push(avengersMansion);

    return state;
  }

  it('renders "EXTRA!" hover button at top-left during multiplayer PLAYER_PHASE when teammate actions are available', () => {
    const state = createMultiplayerState();

    render(
      <GameSettingsProvider>
        <TestSession state={state}>
          <GameBoard onReset={vi.fn()} />
        </TestSession>
      </GameSettingsProvider>,
    );

    const extraBtn = screen.getByRole('button', { name: /extra/i });
    expect(extraBtn).toBeDefined();
    // Verify container has fixed top-14 left-4 z-content
    const container = extraBtn.parentElement;
    expect(container?.className).toContain('fixed');
    expect(container?.className).toContain('top-14');
    expect(container?.className).toContain('left-4');
    expect(container?.className).toContain('z-content');

    // Verify button styling
    expect(extraBtn.className).toContain('font-serif');
    expect(extraBtn.className).toContain('animate-pulse');
    expect(screen.getByTestId('extra-call-count')).toBeDefined();
    expect(screen.getByTestId('extra-call-count').textContent).toContain('TEAM');
  });

  it('clicking the hover button opens the Daily Bugle modal', () => {
    const state = createMultiplayerState();

    render(
      <GameSettingsProvider>
        <TestSession state={state}>
          <GameBoard onReset={vi.fn()} />
        </TestSession>
      </GameSettingsProvider>,
    );

    const extraBtn = screen.getByRole('button', { name: /extra/i });
    fireEvent.click(extraBtn);

    // Modal should now be open
    expect(screen.getByText('THE DAILY BUGLE')).toBeDefined();
    expect(screen.getByTestId('daily-bugle-call-for-action-column')).toBeDefined();
  });

  it('does not render hover button when in single player mode or when no teammate actions exist', () => {
    // Single player game
    const singleState = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Peter Parker',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: Array(15).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });
    singleState.phase = GamePhase.PLAYER_PHASE;

    const { rerender } = render(
      <GameSettingsProvider>
        <TestSession state={singleState}>
          <GameBoard onReset={vi.fn()} />
        </TestSession>
      </GameSettingsProvider>,
    );

    expect(screen.queryByRole('button', { name: /extra/i })).toBeNull();

    // Multiplayer game with no teammate actions (Tony has no tableau cards)
    const multiNoActionsState = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Peter Parker',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: Array(15).fill(cardCatalog.getCard('01005')!),
        },
        {
          id: 'p2',
          name: 'Tony Stark',
          hero: ironManHero,
          alterEgo: tonyStarkAlterEgo,
          deckCards: Array(15).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });
    multiNoActionsState.phase = GamePhase.PLAYER_PHASE;
    // Set teammate to Iron Man hero form (which has no Action ability) so teammate actions = 0
    multiNoActionsState.players[1].activeFormCard = ironManHero;

    rerender(
      <GameSettingsProvider>
        <TestSession state={multiNoActionsState}>
          <GameBoard onReset={vi.fn()} />
        </TestSession>
      </GameSettingsProvider>,
    );

    expect(screen.queryByRole('button', { name: /extra/i })).toBeNull();
  });
});
