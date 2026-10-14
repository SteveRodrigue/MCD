import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GameBoard } from '../../src/ui/components/board/GameBoard';
import { TopBar } from '../../src/ui/components/board/TopBar';
import { GameSettingsProvider } from '../../src/ui/context/GameSettingsProvider';
import { GamePhase, GameState, HeroCard, AlterEgoCard } from '../../src/engine/models';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { setupGame } from '../../src/engine/state/game-setup';

describe('TopBar and GameBoard Layout In-Flow Architecture (Issue #301)', () => {
  const heroes = [
    {
      hero: cardCatalog.getCard('01001a') as HeroCard,
      alterEgo: cardCatalog.getCard('01001b') as AlterEgoCard,
      name: 'Peter Parker',
    },
    {
      hero: cardCatalog.getCard('01029a') as HeroCard,
      alterEgo: cardCatalog.getCard('01029b') as AlterEgoCard,
      name: 'Tony Stark',
    },
  ];

  function createTestGameState(playerCount = 1): GameState {
    const players = heroes.slice(0, playerCount).map((h, idx) => ({
      id: `p${idx + 1}`,
      name: h.name,
      hero: h.hero,
      alterEgo: h.alterEgo,
      deckCards: Array(15).fill(cardCatalog.getCard('01005')!),
    }));

    return setupGame({
      scenarioId: 'rhino',
      players,
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });
  }

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

  it('mounts TopBar as sticky in normal flow and removes fixed padding offset from main', () => {
    const state = createTestGameState(1);
    const { container } = render(
      <GameSettingsProvider>
        <GameBoard gameState={state} onReset={vi.fn()} />
      </GameSettingsProvider>,
    );

    const header = container.querySelector('header');
    expect(header).not.toBeNull();
    expect(header?.className).toContain('sticky');
    expect(header?.className).toContain('top-0');
    expect(header?.className).toContain('w-full');
    expect(header?.className).not.toContain('fixed');
    expect(header?.className).not.toContain('lg:right-[420px]');

    const main = container.querySelector('main');
    expect(main).not.toBeNull();
    // Fixed offsets pt-20 / md:pt-24 must be removed because TopBar is in-flow
    expect(main?.className).not.toContain('pt-20');
    expect(main?.className).not.toContain('md:pt-24');
  });

  it('adjusts the shared column container width when combat log drawer is toggled', () => {
    const state = createTestGameState(1);
    const { container } = render(
      <GameSettingsProvider>
        <GameBoard gameState={state} onReset={vi.fn()} />
      </GameSettingsProvider>,
    );

    const header = container.querySelector('header');
    expect(header).not.toBeNull();
    const columnContainer = header?.parentElement;
    expect(columnContainer).not.toBeNull();

    // Default: isLogOpen is true -> container has lg:w-[calc(100%-420px)]
    expect(columnContainer?.className).toContain('lg:w-[calc(100%-420px)]');

    // Toggle combat log off via TopBar button
    const combatLogBtn = screen.getByRole('button', { name: /COMBAT LOG/i });
    fireEvent.click(combatLogBtn);

    // After closing: container becomes full width
    expect(columnContainer?.className).toContain('w-full');
    expect(columnContainer?.className).not.toContain('lg:w-[calc(100%-420px)]');
  });

  it('renders responsive seat selector and Jump to Hero label in multiplayer', () => {
    const state = createTestGameState(2);
    render(
      <GameSettingsProvider>
        <TopBar
          gameState={state}
          activeSeatIndex={0}
          onSelectSeat={vi.fn()}
          onToggleLog={vi.fn()}
          isLogOpen={false}
          onReset={vi.fn()}
        />
      </GameSettingsProvider>,
    );

    // "Jump to Hero:" has hidden md:inline class
    const jumpLabel = screen.getByText('Jump to Hero:');
    expect(jumpLabel.className).toContain('hidden');
    expect(jumpLabel.className).toContain('md:inline');

    // Seat buttons include responsive suffix span: ": <Name>" hidden on small screens
    const seat1Suffix = screen.getByText(new RegExp(`: ${state.players[0].activeFormCard.name}`));
    expect(seat1Suffix.className).toContain('hidden');
    expect(seat1Suffix.className).toContain('sm:inline');
  });

  it('renders responsive phase badge with compact text on small viewports and full text on large', () => {
    const state = createTestGameState(1);
    state.phase = GamePhase.PLAYER_PHASE;

    const { rerender } = render(
      <GameSettingsProvider>
        <TopBar
          gameState={state}
          activeSeatIndex={0}
          onSelectSeat={vi.fn()}
          onToggleLog={vi.fn()}
          isLogOpen={false}
          onReset={vi.fn()}
        />
      </GameSettingsProvider>,
    );

    const fullPhaseText = screen.getByText('HEROES ASSEMBLE! (PLAYER PHASE)');
    expect(fullPhaseText.className).toContain('hidden');
    expect(fullPhaseText.className).toContain('lg:inline');

    const compactPhaseText = screen.getByText('PLAYER PHASE');
    expect(compactPhaseText.className).toContain('lg:hidden');

    // Switch to villain phase
    const villainState = { ...state, phase: GamePhase.VILLAIN_PHASE };
    rerender(
      <GameSettingsProvider>
        <TopBar
          gameState={villainState}
          activeSeatIndex={0}
          onSelectSeat={vi.fn()}
          onToggleLog={vi.fn()}
          isLogOpen={false}
          onReset={vi.fn()}
        />
      </GameSettingsProvider>,
    );

    expect(screen.getByText('VILLAIN PHASE')).toBeDefined();
  });
});
