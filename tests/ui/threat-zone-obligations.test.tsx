import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { HeroZone } from '../../src/ui/components/board/HeroZone';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { setupGame, createCardInstance } from '../../src/engine/state/game-setup';
import { HeroCard, AlterEgoCard, GameState } from '../../src/engine/models';
import { TestSession } from '../support/render-with-session';

vi.mock('../../src/ui/hooks/useCardArt', () => ({
  useCardArt: vi.fn().mockReturnValue({
    artUrl: 'https://cdn.example.com/test.jpg',
    loading: false,
    error: null,
  }),
}));

describe('Threat Zone sub-zones: Obligations (Issue #158)', () => {
  function createGame(): GameState {
    return setupGame({
      catalog: cardCatalog,
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Carol Danvers',
          hero: cardCatalog.getCard('01010a') as HeroCard,
          alterEgo: cardCatalog.getCard('01010b') as AlterEgoCard,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      skipMulligan: true,
    });
  }

  const renderZone = (state: GameState) =>
    render(
      <TestSession state={state}>
        <HeroZone player={state.players[0]} seatNumber={1} isFocused={true} isMultiHero={false} />
      </TestSession>,
    );

  it('keeps the existing header strings when the player holds no obligations', () => {
    const state = createGame();
    state.players[0].engagedMinions = [createCardInstance(cardCatalog.getCard('01110')!)];
    const { unmount } = renderZone(state);
    expect(screen.getByText('Minions Engaged with Carol Danvers (1)')).toBeDefined();
    expect(screen.queryByTestId('threat-zone-obligations')).toBeNull();
    unmount();

    state.players[0].engagedMinions = [];
    state.players[0].dealtEncounterCards = [createCardInstance(cardCatalog.getCard('01005')!)];
    renderZone(state);
    expect(
      screen.getByText('Threat Zone: Carol Danvers (0 Minions • 1 Dealt Cards)'),
    ).toBeDefined();
  });

  it('renders obligations in an Obligations sub-zone inside the Threat Zone, not in the tableau', () => {
    const state = createGame();
    state.players[0].obligations = [createCardInstance(cardCatalog.getCard('01175')!)];
    renderZone(state);

    const threatZone = screen.getByTestId('threat-zone');
    const sub = screen.getByTestId('threat-zone-obligations');
    expect(threatZone.contains(sub)).toBe(true);
    expect(within(sub).getByAltText('Family Emergency')).toBeDefined();
    // The Tableau is empty and not drawn (Issue #379), so the obligation cannot be in it.
    expect(screen.queryByTestId('tableau-section')).toBeNull();
    expect(
      screen.getByText('Threat Zone: Carol Danvers (0 Minions • 0 Dealt Cards • 1 Obligations)'),
    ).toBeDefined();
  });

  it('orders sub-zones Facedown, Obligations, Minions', () => {
    const state = createGame();
    state.players[0].dealtEncounterCards = [createCardInstance(cardCatalog.getCard('01005')!)];
    state.players[0].obligations = [createCardInstance(cardCatalog.getCard('01175')!)];
    state.players[0].engagedMinions = [createCardInstance(cardCatalog.getCard('01110')!)];
    renderZone(state);

    const ids = Array.from(
      screen.getByTestId('threat-zone').querySelectorAll('[data-testid^="threat-zone-"]'),
    ).map((el) => el.getAttribute('data-testid'));
    expect(ids).toEqual(['threat-zone-facedown', 'threat-zone-obligations', 'threat-zone-minions']);
  });

  it('shows the Minions sub-zone empty placeholder even with obligations present', () => {
    const state = createGame();
    state.players[0].obligations = [createCardInstance(cardCatalog.getCard('01175')!)];
    renderZone(state);
    expect(
      within(screen.getByTestId('threat-zone-minions')).getByText(
        /No minions engaged with Carol Danvers/,
      ),
    ).toBeDefined();
  });
});
