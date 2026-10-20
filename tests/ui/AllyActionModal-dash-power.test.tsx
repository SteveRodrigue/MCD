import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { AllyActionModal } from '../../src/ui/components/board/AllyActionModal';
import { GameState, HeroCard, AlterEgoCard } from '../../src/engine/models';
import { setupGame, createCardInstance } from '../../src/engine/state/game-setup';
import { TestSession } from '../support/render-with-session';

describe('AllyActionModal dash (–) power display (Issue #316)', () => {
  it('shows THW – for Hulk and disables the thwart button', () => {
    const state: GameState = setupGame({
      catalog: cardCatalog,
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Player 1',
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
    const player = state.players[0];
    player.currentForm = 'hero';
    const hulk = createCardInstance(cardCatalog.getCard('01050')!);
    player.allies = [hulk];
    state.mainScheme.threat = 4;

    render(
      <TestSession state={state}>
        <AllyActionModal
          isOpen
          ally={hulk}
          player={player}
          onClose={vi.fn()}
          onInitiateAllyAttack={vi.fn()}
          onInitiateAllyThwart={vi.fn()}
        />
      </TestSession>,
    );

    expect(screen.getAllByText(/– THW/).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/^0 THW$/)).toBeNull();
    const thwartButton = screen.getByRole('button', { name: /Thwart/ }) as HTMLButtonElement;
    expect(thwartButton.disabled).toBe(true);
  });
});
