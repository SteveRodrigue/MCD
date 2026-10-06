import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GameOverScreen } from '../../src/ui/components/board/GameOverScreen';
import { GameState } from '../../src/engine/models';

const state = (winner: 'HEROES' | 'VILLAIN' | null, alive: string[], fallen: string[]) =>
  ({
    winner,
    players: alive.map((name) => ({ id: name, name })),
    eliminatedPlayers: fallen.map((name) => ({ id: name, name })),
  }) as unknown as GameState;

describe('Game over screen (#246)', () => {
  it('shows nothing while the game is not over', () => {
    const { container } = render(
      <GameOverScreen gameState={state(null, ['A'], [])} onReset={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows defeat when every hero has fallen and lists them as defeated', () => {
    render(
      <GameOverScreen
        gameState={state('VILLAIN', [], ['Spider-Man', 'Iron Man'])}
        onReset={vi.fn()}
      />,
    );
    expect(screen.getByRole('dialog', { name: 'Defeat' })).toBeDefined();
    expect(screen.getByText(/Spider-Man/)).toBeDefined();
    expect(screen.getAllByText(/\(defeated\)/)).toHaveLength(2);
  });

  it('shows victory with the surviving and the fallen heroes', () => {
    render(
      <GameOverScreen
        gameState={state('HEROES', ['Iron Man'], ['Spider-Man'])}
        onReset={vi.fn()}
      />,
    );
    expect(screen.getByRole('dialog', { name: 'Victory' })).toBeDefined();
    expect(screen.getAllByText(/\(defeated\)/)).toHaveLength(1);
  });

  it('starts a new game from the button', () => {
    const onReset = vi.fn();
    render(<GameOverScreen gameState={state('VILLAIN', [], ['A'])} onReset={onReset} />);
    fireEvent.click(screen.getByRole('button', { name: /new game/i }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
