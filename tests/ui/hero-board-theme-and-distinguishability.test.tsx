import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { GameBoard } from '../../src/ui/components/board/GameBoard';
import { HeroZone } from '../../src/ui/components/board/HeroZone';
import { GameSettingsProvider } from '../../src/ui/context/GameSettingsProvider';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { setupGame } from '../../src/engine/state/game-setup';
import { GameState, HeroCard, AlterEgoCard, PlayerState } from '../../src/engine/models';
import { DEFAULT_HERO_PALETTE } from '../../src/ui/utils/hero-theme';

describe('HeroBoard Theme & Distinguishability (Issue #110)', () => {
  const heroes = [
    {
      hero: cardCatalog.getCard('01001a') as HeroCard, // Spider-Man: #982828
      alterEgo: cardCatalog.getCard('01001b') as AlterEgoCard,
      name: 'Peter Parker',
    },
    {
      hero: cardCatalog.getCard('01010a') as HeroCard, // Captain Marvel: #2a377b
      alterEgo: cardCatalog.getCard('01010b') as AlterEgoCard,
      name: 'Carol Danvers',
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

  describe('Active HeroZone Theme Colors', () => {
    it('renders active HeroZone with hero printed theme colors on ribbon, health bar, and shield', () => {
      const state = createTestGameState(1, 0);
      const spideyPlayer = state.players[0];

      const { container } = render(
        <GameSettingsProvider>
          <HeroZone
            player={spideyPlayer}
            gameState={state}
            seatNumber={1}
            isFocused={true}
            isMultiHero={false}
          />
        </GameSettingsProvider>,
      );

      // Spider-Man primary color is #982828
      // 1. Ribbon background should match hero primary color
      const ribbon = container.querySelector('.font-comic.text-xs.tracking-wider');
      expect(ribbon).not.toBeNull();
      const ribbonBg = (ribbon as HTMLElement).style.backgroundColor;
      expect(['#982828', 'rgb(152, 40, 40)']).toContain(ribbonBg);

      // 2. Active badge pill should be rendered with dynamic contrast text (white on black for Spider-Man)
      expect(container.textContent).toContain('★ ACTIVE HERO');
      const activeBadge = Array.from(container.querySelectorAll('span')).find((el) =>
        el.textContent?.includes('★ ACTIVE HERO'),
      );
      expect(activeBadge).toBeDefined();
      expect(['#ffffff', 'rgb(255, 255, 255)']).toContain((activeBadge as HTMLElement).style.color);
      expect(['#010101', 'rgb(1, 1, 1)']).toContain(
        (activeBadge as HTMLElement).style.backgroundColor,
      );

      // 3. Health bar progress fill should match hero primary color
      const healthBarFill = container.querySelector('.rounded-full.overflow-hidden > div');
      expect(healthBarFill).not.toBeNull();
      expect(['#982828', 'rgb(152, 40, 40)']).toContain(
        (healthBarFill as HTMLElement).style.backgroundColor,
      );

      // 4. Outer panel border should match hero primary color
      const panel = container.querySelector('section.comic-panel');
      expect(panel).not.toBeNull();
      expect(['#982828', 'rgb(152, 40, 40)']).toContain((panel as HTMLElement).style.borderColor);
    });

    it('falls back to default comic palette when hero has no meta.colors', () => {
      const fallbackHeroCard: HeroCard = {
        ...(cardCatalog.getCard('01001a') as HeroCard),
        meta: undefined,
        raw: {
          ...(cardCatalog.getCard('01001a') as HeroCard).raw,
          meta: undefined,
        },
      };

      const fallbackPlayer: PlayerState = {
        id: 'p-custom',
        name: 'Custom Hero',
        hero: fallbackHeroCard,
        alterEgo: cardCatalog.getCard('01001b') as AlterEgoCard,
        availableForms: [fallbackHeroCard],
        activeFormCard: fallbackHeroCard,
        currentForm: 'hero',
        health: 10,
        maxHealth: 10,
        exhausted: false,
        statusCards: [],
        hand: [],
        deck: [],
        discard: [],
        tableau: [],
        allies: [],
        engagedMinions: [],
        basicChangeFormUsedThisRound: false,
        formChangedThisRound: false,
        recoveryUsedThisRound: false,
        dealtEncounterCards: [],
        setAsideCards: [],
      };

      const { container } = render(
        <GameSettingsProvider>
          <HeroZone player={fallbackPlayer} seatNumber={1} isFocused={true} isMultiHero={false} />
        </GameSettingsProvider>,
      );

      // Default primary is #1d4ed8 (rgb(29, 78, 216))
      const ribbon = container.querySelector('.font-comic.text-xs.tracking-wider');
      expect(ribbon).not.toBeNull();
      expect([DEFAULT_HERO_PALETTE.primary, 'rgb(29, 78, 216)']).toContain(
        (ribbon as HTMLElement).style.backgroundColor,
      );

      const healthBarFill = container.querySelector('.rounded-full.overflow-hidden > div');
      expect(healthBarFill).not.toBeNull();
      expect([DEFAULT_HERO_PALETTE.primary, 'rgb(29, 78, 216)']).toContain(
        (healthBarFill as HTMLElement).style.backgroundColor,
      );
    });
  });

  describe('Inactive Player Board Distinguishability', () => {
    it('applies distinct visual dimming, grayscale, muted styling, and waiting badge to inactive seats', () => {
      const multiState = createTestGameState(2, 0); // Player 0 active, Player 1 inactive

      const { container } = render(
        <GameSettingsProvider>
          <GameBoard gameState={multiState} onReset={vi.fn()} />
        </GameSettingsProvider>,
      );

      const innerTrack = container.querySelector('.justify-center.min-w-full.w-max')!;
      expect(innerTrack).not.toBeNull();

      const activeSeatContainer = innerTrack.children[0] as HTMLElement;
      const inactiveSeatContainer = innerTrack.children[1] as HTMLElement;

      // Active seat: full opacity, scale-100
      expect(activeSeatContainer.className).toContain('opacity-100');
      expect(activeSeatContainer.className).toContain('scale-[1.00]');
      expect(activeSeatContainer.className).not.toContain('opacity-60');

      // Inactive seat: opacity-60, grayscale-[35%], cursor-pointer
      expect(inactiveSeatContainer.className).toContain('opacity-60');
      expect(inactiveSeatContainer.className).toContain('grayscale-[35%]');
      expect(inactiveSeatContainer.className).toContain('cursor-pointer');

      // Inactive seat HeroZone panel: muted ring and slate background
      const inactiveHeroZonePanel = inactiveSeatContainer.querySelector('section.comic-panel');
      expect(inactiveHeroZonePanel).not.toBeNull();
      expect(inactiveHeroZonePanel?.className).toContain('ring-slate-300/80');
      expect(inactiveHeroZonePanel?.className).toContain('bg-slate-100/90');

      // Inactive ribbon: waiting indicator
      expect(inactiveSeatContainer.textContent).toContain('(WAITING)');
      expect(inactiveSeatContainer.textContent).not.toContain('★ ACTIVE HERO');
    });

    it('clicking anywhere on an inactive seat focuses and centers it', () => {
      const multiState = createTestGameState(2, 0);

      const { container } = render(
        <GameSettingsProvider>
          <GameBoard gameState={multiState} onReset={vi.fn()} />
        </GameSettingsProvider>,
      );

      const innerTrack = container.querySelector('.justify-center.min-w-full.w-max')!;
      const inactiveSeatContainer = innerTrack.children[1] as HTMLElement;

      // Click inactive seat container
      fireEvent.click(inactiveSeatContainer);

      // Now seat 1 should become focused (opacity-100) and seat 0 should become inactive (opacity-60)
      const seat0After = innerTrack.children[0] as HTMLElement;
      const seat1After = innerTrack.children[1] as HTMLElement;

      expect(seat1After.className).toContain('opacity-100');
      expect(seat1After.className).toContain('scale-[1.00]');
      expect(seat0After.className).toContain('opacity-60');
      expect(seat0After.className).toContain('grayscale-[35%]');
    });

    it('clicking inactive HeroZone calls onFocus', () => {
      const onFocusMock = vi.fn();
      const state = createTestGameState(2, 0);
      const inactivePlayer = state.players[1];

      const { container } = render(
        <GameSettingsProvider>
          <HeroZone
            player={inactivePlayer}
            gameState={state}
            seatNumber={2}
            isFocused={false}
            isMultiHero={true}
            onFocus={onFocusMock}
          />
        </GameSettingsProvider>,
      );

      const panel = container.querySelector('section.comic-panel');
      expect(panel).not.toBeNull();
      fireEvent.click(panel!);

      expect(onFocusMock).toHaveBeenCalled();
    });
  });
});
