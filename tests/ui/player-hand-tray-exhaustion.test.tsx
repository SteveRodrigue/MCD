import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { PlayerHandTray } from '../../src/ui/components/board/PlayerHandTray';
import { GameSettingsProvider } from '../../src/ui/context/GameSettingsProvider';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { setupGame, createCardInstance } from '../../src/engine/state/game-setup';
import { GameState, HeroCard, AlterEgoCard } from '../../src/engine/models';
import { TestSession } from '../support/render-with-session';

vi.mock('../../src/ui/hooks/useCardArt', () => ({
  useCardArt: vi.fn().mockReturnValue({
    artUrl: 'https://cdn.example.com/test.jpg',
    loading: false,
    error: null,
  }),
}));

describe('PlayerHandTray cards in hand cannot be exhausted (Issue #388)', () => {
  it('does not render hand cards as exhausted even if instance has exhausted: true', () => {
    const spiderManHero = cardCatalog.getCard('01001a') as HeroCard;
    const peterParkerAlterEgo = cardCatalog.getCard('01001b') as AlterEgoCard;

    const state: GameState = setupGame({
      catalog: cardCatalog,
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

    const webShooter = createCardInstance(cardCatalog.getCard('01008')!);
    webShooter.exhausted = true; // Simulating dirty/legacy instance in hand

    const { container, queryByText } = render(
      <GameSettingsProvider>
        <TestSession state={state}>
          <PlayerHandTray
            hand={[webShooter]}
            deck={state.players[0].deck}
            discard={[]}
            heroName="Spider-Man"
            handSizeLimit={5}
            player={state.players[0]}
          />
        </TestSession>
      </GameSettingsProvider>,
    );

    // EXHAUSTED badge must not appear for cards in hand
    expect(queryByText('EXHAUSTED')).toBeNull();

    // The card container must not have rotate-30
    const cardEl = container.querySelector('[data-card-view="01008"]');
    expect(cardEl).not.toBeNull();
    expect(cardEl?.className).not.toContain('rotate-30');
  });
});
