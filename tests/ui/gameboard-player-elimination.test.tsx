import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GameBoard } from '../../src/ui/components/board/GameBoard';
import { GameSettingsProvider } from '../../src/ui/context/GameSettingsProvider';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { setupGame } from '../../src/engine/state/game-setup';
import { eliminatePlayer } from '../../src/engine/pipeline/player-elimination';
import { GameState, HeroCard, AlterEgoCard } from '../../src/engine/models';

// Issue #246: the board keeps working when a hero is eliminated, and shows a game-over screen when
// the game ends.
describe('GameBoard with eliminated players (#246)', () => {
  const build = (): GameState =>
    setupGame({
      scenarioId: 'rhino',
      players: [
        ['01001a', '01001b', 'Peter Parker'],
        ['01029a', '01029b', 'Tony Stark'],
      ].map(([h, a, name], i) => ({
        id: `p${i + 1}`,
        name,
        hero: cardCatalog.getCard(h) as HeroCard,
        alterEgo: cardCatalog.getCard(a) as AlterEgoCard,
        deckCards: Array(15).fill(cardCatalog.getCard('01005')!),
      })),
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

  const show = (state: GameState) =>
    render(
      <GameSettingsProvider>
        <GameBoard gameState={state} onReset={vi.fn()} />
      </GameSettingsProvider>,
    );

  beforeEach(() => {
    Element.prototype.scrollTo = vi.fn();
    Element.prototype.scrollBy = vi.fn();
  });

  it('shows no game-over screen while a hero still stands', () => {
    const state = build();
    eliminatePlayer(state, 'p1');
    show(state);
    expect(screen.queryByRole('dialog', { name: 'Defeat' })).toBeNull();
  });

  it('keeps rendering when the seat that was in focus is eliminated', () => {
    const state = build();
    state.activePlayerIndex = 1;
    eliminatePlayer(state, 'p2');
    expect(() => show(state)).not.toThrow();
  });

  it('shows the defeat screen, with every fallen hero, when the last hero is eliminated', () => {
    const state = build();
    eliminatePlayer(state, 'p1');
    eliminatePlayer(state, 'p2');
    expect(state.players).toHaveLength(0);
    show(state);
    expect(screen.getByRole('dialog', { name: 'Defeat' })).toBeDefined();
    expect(screen.getAllByText(/\(defeated\)/)).toHaveLength(2);
  });
});
