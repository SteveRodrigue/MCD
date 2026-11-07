import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { GameBoard } from '../../src/ui/components/board/GameBoard';
import { HeroZone } from '../../src/ui/components/board/HeroZone';
import { GameSettingsProvider } from '../../src/ui/context/GameSettingsProvider';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { setupGame } from '../../src/engine/state/game-setup';
import { AlterEgoCard, GameState, HeroCard } from '../../src/engine/models';
import { TestSession } from '../support/render-with-session';

// Plan #352 S1 and #613 S1: with no art pack, a Drone shows a card back labelled "Drone". With or
// without one (`art-packs-board.test.tsx`), the real card under it stays hidden.
const DRONE = '[data-card-view="ultron_drone"]';

describe('Drone minion on the board', () => {
  function ultronGame(heroes = 1): GameState {
    return setupGame({
      catalog: cardCatalog,
      scenarioId: 'ultron',
      difficulty: 'STANDARD',
      seed: 'ultron-drone-board',
      skipMulligan: true,
      players: ['01001', '01029'].slice(0, heroes).map((code, i) => ({
        id: `p${i + 1}`,
        name: i === 0 ? 'Peter Parker' : 'Tony Stark',
        hero: cardCatalog.getCard(`${code}a`) as HeroCard,
        alterEgo: cardCatalog.getCard(`${code}b`) as AlterEgoCard,
        deckCards: Array(15).fill(cardCatalog.getCard('01005')!),
      })),
    });
  }

  beforeEach(() => {
    Element.prototype.scrollTo = vi.fn();
    Element.prototype.scrollBy = vi.fn();
  });

  it('renders a labelled card back and never the real card name', () => {
    const state = ultronGame();
    const player = state.players[0];
    expect(player.engagedMinions[0].cardsUnderneath![0].card.name).toBe('Swinging Web Kick');
    player.hand = [];

    const { container } = render(
      <GameSettingsProvider>
        <TestSession state={state}>
          <HeroZone player={player} seatNumber={1} isFocused={true} isMultiHero={false} />
        </TestSession>
      </GameSettingsProvider>,
    );

    expect(screen.getByTestId('drone-shell-label').textContent).toBe('Drone');
    const zone = screen.getByTestId('threat-zone-minions');
    expect(zone.querySelector('[data-testid="card-view-facedown"]')).not.toBeNull();
    // One card back for the Drone: the tucked card does not peek out as a second one
    expect(zone.querySelector('[data-testid="underneath-facedown-card"]')).toBeNull();
    expect(container.innerHTML).not.toContain('Swinging Web Kick');
  });

  // The seat strip scrolls sideways and clips, so the zoom must live outside it.
  it('shows a hovered Drone in the corner zoom, outside the seat strip, in a two-hero game', () => {
    const state = ultronGame(2);

    const { container } = render(
      <GameSettingsProvider>
        <TestSession state={state}>
          <GameBoard onReset={vi.fn()} />
        </TestSession>
      </GameSettingsProvider>,
    );

    fireEvent.mouseEnter(screen.getAllByTestId('threat-zone-minions')[0].querySelector(DRONE)!);

    const zoom = document.body.querySelector('[data-card-zoom-layer="ultron_drone"]');
    expect(zoom).not.toBeNull();
    expect(container.contains(zoom)).toBe(false);
  });
});
