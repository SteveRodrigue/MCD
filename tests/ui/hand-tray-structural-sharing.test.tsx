import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { PlayerHandTray } from '../../src/ui/components/board/PlayerHandTray';
import { GameSettingsProvider } from '../../src/ui/context/GameSettingsProvider';
import { useCardArt } from '../../src/ui/hooks/useCardArt';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { setupGame, createCardInstance } from '../../src/engine/state/game-setup';
import {
  HeroCard,
  AlterEgoCard,
  GamePhase,
  GameState,
  updateGameState,
} from '../../src/engine/models';
import { TestSession } from '../support/render-with-session';

vi.mock('../../src/ui/hooks/useCardArt', () => ({
  useCardArt: vi.fn().mockReturnValue({
    artUrl: 'https://cdn.example.com/test.jpg',
    loading: false,
    error: null,
  }),
}));

// An action that only changes the villain leaves the hand's cards as they were, so the hand tray
// does not render them again (ADR-0089, AUD-20261017-232534 R12). One useCardArt call is one
// CardView render.
describe('hand tray structural sharing', () => {
  beforeEach(() => {
    Element.prototype.scrollTo = vi.fn();
    Element.prototype.scrollBy = vi.fn();
    vi.mocked(useCardArt).mockClear();
  });

  const newState = (): GameState => {
    const state = setupGame({
      catalog: cardCatalog,
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: cardCatalog.getCard('01001a') as HeroCard,
          alterEgo: cardCatalog.getCard('01001b') as AlterEgoCard,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });
    state.phase = GamePhase.PLAYER_PHASE;
    state.players[0].hand = Array.from({ length: 5 }, () =>
      createCardInstance(cardCatalog.getCard('01005')!),
    );
    return state;
  };

  const tray = (state: GameState) => (
    <GameSettingsProvider>
      <TestSession state={state}>
        <PlayerHandTray
          hand={state.players[0].hand}
          deck={state.players[0].deck}
          discard={state.players[0].discard}
          heroName="Spider-Man"
          handSizeLimit={5}
          player={state.players[0]}
        />
      </TestSession>
    </GameSettingsProvider>
  );

  it('does not render the hand cards again when only the villain changes', () => {
    const before = newState();
    const { rerender } = render(tray(before));
    const rendersAfterMount = vi.mocked(useCardArt).mock.calls.length;
    expect(rendersAfterMount).toBeGreaterThanOrEqual(5);

    const after = updateGameState(before, (draft) => {
      draft.villain.health -= 1;
    });
    expect(after.players[0].hand).toBe(before.players[0].hand);
    rerender(tray(after));

    expect(vi.mocked(useCardArt).mock.calls.length).toBe(rendersAfterMount);
  });
});
