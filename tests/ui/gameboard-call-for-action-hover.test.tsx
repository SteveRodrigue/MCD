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
      catalog: cardCatalog,
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

  it('renders the "EXTRA!" pill left of the Villain Zone during multiplayer PLAYER_PHASE when teammate actions are available', () => {
    const state = createMultiplayerState();

    render(
      <GameSettingsProvider>
        <TestSession state={state}>
          <GameBoard onReset={vi.fn()} />
        </TestSession>
      </GameSettingsProvider>,
    );

    const extraBtn = screen.getByRole('button', { name: /^EXTRA!/ });
    expect(extraBtn).toBeDefined();
    // The pill sits in the villain row, left of the Villain Zone: nothing floats over the board and
    // no space is reserved above it (Issue #379).
    const row = screen.getByTestId('villain-row');
    const villainZone = screen.getByTestId('villain-zone');
    expect(row.contains(extraBtn)).toBe(true);
    expect(extraBtn.closest('.fixed')).toBeNull();
    expect(
      extraBtn.compareDocumentPosition(villainZone) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(row.className).toContain('flex-nowrap');
    expect(document.querySelector('main')?.className).not.toContain('pt-16');

    // Verify button styling: a beacon ring, not a fading pulse (the label stays readable).
    expect(extraBtn.className).toContain('font-news-headline');
    expect(extraBtn.hasAttribute('data-newspaper')).toBe(true);
    expect(extraBtn.className).not.toContain('animate-pulse');
    // The pill and the Daily Bugle button of the rail both ring.
    expect(screen.getAllByTestId('attention-beacon')).toHaveLength(2);
    expect(
      screen.getByRole('button', {
        name: /^Daily Bugle: \d+ legal moves?, \d+ extra actions? waiting$/,
      }),
    ).toBeDefined();
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

    const extraBtn = screen.getByRole('button', { name: /^EXTRA!/ });
    fireEvent.click(extraBtn);

    // Modal should now be open, and the rings stop: the player has seen the bulletin
    expect(screen.getByTestId('daily-bugle-container')).toBeDefined();
    expect(screen.queryAllByTestId('attention-beacon')).toHaveLength(0);
    expect(screen.getByTestId('daily-bugle-call-for-action-column')).toBeDefined();
  });

  it('does not render hover button when in single player mode or when no teammate actions exist', () => {
    // Single player game
    const singleState = setupGame({
      catalog: cardCatalog,
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

    expect(screen.queryByRole('button', { name: /^EXTRA!/ })).toBeNull();

    // Multiplayer game with no teammate actions (Tony has no tableau cards)
    const multiNoActionsState = setupGame({
      catalog: cardCatalog,
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

    expect(screen.queryByRole('button', { name: /^EXTRA!/ })).toBeNull();
  });
});
