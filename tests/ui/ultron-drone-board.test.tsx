import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HeroZone } from '../../src/ui/components/board/HeroZone';
import { GameSettingsProvider } from '../../src/ui/context/GameSettingsProvider';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { setupGame } from '../../src/engine/state/game-setup';
import { AlterEgoCard, GameState, HeroCard } from '../../src/engine/models';
import { TestSession } from '../support/render-with-session';

// Plan #352 S1: a Drone shows a card back labelled "Drone"; the real card under it stays hidden.
describe('Drone minion on the board', () => {
  function ultronGame(): GameState {
    return setupGame({
      catalog: cardCatalog,
      scenarioId: 'ultron',
      difficulty: 'STANDARD',
      seed: 'ultron-drone-board',
      skipMulligan: true,
      players: [
        {
          id: 'p1',
          name: 'Peter Parker',
          hero: cardCatalog.getCard('01001a') as HeroCard,
          alterEgo: cardCatalog.getCard('01001b') as AlterEgoCard,
          deckCards: Array(15).fill(cardCatalog.getCard('01005')!),
        },
      ],
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
});
