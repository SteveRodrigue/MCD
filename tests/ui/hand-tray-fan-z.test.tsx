import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { PlayerHandTray } from '../../src/ui/components/board/PlayerHandTray';
import { GameSettingsProvider } from '../../src/ui/context/GameSettingsProvider';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { setupGame, createCardInstance } from '../../src/engine/state/game-setup';
import { HeroCard, AlterEgoCard, GamePhase } from '../../src/engine/models';
import { TestSession } from '../support/render-with-session';

vi.mock('../../src/ui/hooks/useCardArt', () => ({
  useCardArt: vi.fn().mockReturnValue({
    artUrl: 'https://cdn.example.com/test.jpg',
    loading: false,
    error: null,
  }),
}));

describe('PlayerHandTray fan z-index (Issue #312)', () => {
  beforeEach(() => {
    Element.prototype.scrollTo = vi.fn();
    Element.prototype.scrollBy = vi.fn();
  });

  it('keeps every card of a 50-card hand above z 0 and raises the hovered card to count + 1', () => {
    const state = setupGame({
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
    const hand = Array.from({ length: 50 }, () =>
      createCardInstance(cardCatalog.getCard('01005')!),
    );
    state.players[0].hand = hand;

    const { getByTestId } = render(
      <GameSettingsProvider>
        <TestSession state={state}>
          <PlayerHandTray
            hand={hand}
            deck={state.players[0].deck}
            discard={state.players[0].discard}
            heroName="Spider-Man"
            handSizeLimit={5}
            player={state.players[0]}
          />
        </TestSession>
      </GameSettingsProvider>,
    );

    const fanRow = getByTestId('hand-fan-row');
    expect(fanRow.className).toContain('isolate');

    const wrappers = Array.from(fanRow.children) as HTMLElement[];
    expect(wrappers).toHaveLength(50);
    for (const w of wrappers) expect(Number(w.style.zIndex)).toBeGreaterThanOrEqual(1);

    fireEvent.mouseEnter(wrappers[40]);
    expect(Number(wrappers[40].style.zIndex)).toBe(51);

    // The fan row is exactly one hand card tall (184px), so the stretched piles sidebar
    // matches the cards: no vertical padding, and flex wrappers avoid the inline-block line gap.
    expect(fanRow.className).toContain('min-h-[184px]');
    expect(fanRow.className).not.toMatch(/(^|\s)py-/);
    for (const w of wrappers) expect(w.className.split(' ')).toContain('flex');
  });
});
