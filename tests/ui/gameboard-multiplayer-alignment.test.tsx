import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { GameBoard } from '../../src/ui/components/board/GameBoard';
import { GameSettingsProvider } from '../../src/ui/context/GameSettingsProvider';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { setupGame } from '../../src/engine/state/game-setup';
import { GameState, HeroCard, AlterEgoCard } from '../../src/engine/models';

describe('GameBoard Multiplayer Centered Alignment & Active-Player Focus (Issue #50)', () => {
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
    {
      hero: cardCatalog.getCard('01010a') as HeroCard,
      alterEgo: cardCatalog.getCard('01010b') as AlterEgoCard,
      name: 'Carol Danvers',
    },
    {
      hero: cardCatalog.getCard('01040a') as HeroCard,
      alterEgo: cardCatalog.getCard('01040b') as AlterEgoCard,
      name: 'Jennifer Walters',
    },
  ];

  function createTestGameState(playerCount: number, activePlayerIndex = 0): GameState {
    const players = heroes.slice(0, playerCount).map((h, idx) => ({
      id: `p${idx + 1}`,
      name: h.name,
      hero: h.hero,
      alterEgo: h.alterEgo,
      deckCards: Array(15).fill(cardCatalog.getCard('01005')!),
    }));

    const state = setupGame({
      scenarioId: 'rhino',
      players,
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

    state.activePlayerIndex = activePlayerIndex;
    return state;
  }

  beforeEach(() => {
    // Ensure Element.prototype.scrollTo is mocked in happy-dom
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

  it('renders solo mode with centered container (mx-auto) and no panoramic track', () => {
    const soloState = createTestGameState(1, 0);
    const { container } = render(
      <GameSettingsProvider>
        <GameBoard gameState={soloState} onReset={vi.fn()} />
      </GameSettingsProvider>,
    );

    // Solo layout should have centered mx-auto container
    const soloContainer = container.querySelector('.mx-auto');
    expect(soloContainer).not.toBeNull();
    expect(soloContainer?.className).toContain('mx-auto');

    // Should NOT have the multiplayer panoramic track
    const panoramicInner = container.querySelector('.justify-center.min-w-full.w-max');
    expect(panoramicInner).toBeNull();
  });

  it('renders multiplayer (2 players) with centering classes (justify-center min-w-full w-max)', () => {
    const multiState = createTestGameState(2, 0);
    const { container } = render(
      <GameSettingsProvider>
        <GameBoard gameState={multiState} onReset={vi.fn()} />
      </GameSettingsProvider>,
    );

    const innerTrack = container.querySelector('.justify-center.min-w-full.w-max');
    expect(innerTrack).not.toBeNull();
    expect(innerTrack?.className).toContain('flex');
    expect(innerTrack?.className).toContain('items-start');
    expect(innerTrack?.className).toContain('justify-center');
    expect(innerTrack?.className).toContain('min-w-full');
    expect(innerTrack?.className).toContain('w-max');
    expect(innerTrack?.className).toContain('gap-6');

    // Outer scroll container should wrap inner track with w-full overflow-x-auto
    const outerContainer = innerTrack?.parentElement;
    expect(outerContainer).not.toBeNull();
    expect(outerContainer?.className).toContain('w-full');
    expect(outerContainer?.className).toContain('overflow-x-auto');

    // Verify 2 player seat cards rendered inside inner track
    expect(innerTrack?.children.length).toBe(2);
  });

  it('renders multiplayer (3 and 4 players) within the centered panoramic track', () => {
    for (const count of [3, 4]) {
      const multiState = createTestGameState(count, 0);
      const { container } = render(
        <GameSettingsProvider>
          <GameBoard gameState={multiState} onReset={vi.fn()} />
        </GameSettingsProvider>,
      );

      const innerTrack = container.querySelector('.justify-center.min-w-full.w-max');
      expect(innerTrack).not.toBeNull();
      expect(innerTrack?.children.length).toBe(count);
    }
  });

  it('automatically synchronizes activePlayerIndex to center/focus the active seat on turn transitions', () => {
    const scrollToSpy = vi.fn();
    Element.prototype.scrollTo = scrollToSpy;

    const multiState = createTestGameState(3, 0);
    const { container, rerender } = render(
      <GameSettingsProvider>
        <GameBoard gameState={multiState} onReset={vi.fn()} />
      </GameSettingsProvider>,
    );

    const innerTrack = container.querySelector('.justify-center.min-w-full.w-max')!;
    expect(innerTrack).not.toBeNull();

    // Initial render: player index 0 is active and focused
    const seat0 = innerTrack.children[0];
    const seat1 = innerTrack.children[1];
    const seat2 = innerTrack.children[2];

    expect(seat0.className).toContain('opacity-100');
    expect(seat0.className).toContain('z-10');
    expect(seat1.className).toContain('opacity-90');
    expect(seat2.className).toContain('opacity-90');

    // Simulate active player transitioning to Player 2 (index 1)
    const updatedState1 = {
      ...multiState,
      activePlayerIndex: 1,
    };

    act(() => {
      rerender(
        <GameSettingsProvider>
          <GameBoard gameState={updatedState1} onReset={vi.fn()} />
        </GameSettingsProvider>,
      );
    });

    // Active seat auto-aligned and focused for Player 2
    expect(seat1.className).toContain('opacity-100');
    expect(seat1.className).toContain('z-10');
    expect(seat0.className).toContain('opacity-90');
    expect(seat2.className).toContain('opacity-90');
    expect(scrollToSpy).toHaveBeenCalled();

    scrollToSpy.mockClear();

    // Simulate active player transitioning to Player 3 (index 2)
    const updatedState2 = {
      ...multiState,
      activePlayerIndex: 2,
    };

    act(() => {
      rerender(
        <GameSettingsProvider>
          <GameBoard gameState={updatedState2} onReset={vi.fn()} />
        </GameSettingsProvider>,
      );
    });

    // Active seat auto-aligned and focused for Player 3
    expect(seat2.className).toContain('opacity-100');
    expect(seat2.className).toContain('z-10');
    expect(seat0.className).toContain('opacity-90');
    expect(seat1.className).toContain('opacity-90');
    expect(scrollToSpy).toHaveBeenCalled();
  });
});
