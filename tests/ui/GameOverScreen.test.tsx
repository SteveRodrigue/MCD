import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GameOverScreen } from '../../src/ui/components/board/GameOverScreen';
import { GameState } from '../../src/engine/models';
import { TestSession } from '../support/render-with-session';

const state = (winner: 'HEROES' | 'VILLAIN' | null, alive: string[], fallen: string[]) =>
  ({
    winner,
    players: alive.map((name) => ({ id: name, name })),
    eliminatedPlayers: fallen.map((name) => ({ id: name, name })),
  }) as unknown as GameState;

describe('Game over screen (#246)', () => {
  it('shows nothing while the game is not over', () => {
    const { container } = render(
      <TestSession state={state(null, ['A'], [])}>
        <GameOverScreen onReset={vi.fn()} />
      </TestSession>,
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows defeat when every hero has fallen and lists them as defeated', () => {
    render(
      <TestSession state={state('VILLAIN', [], ['Spider-Man', 'Iron Man'])}>
        <GameOverScreen onReset={vi.fn()} />
      </TestSession>,
    );
    expect(screen.getByRole('dialog', { name: 'Defeat' })).toBeDefined();
    expect(screen.getByText(/Spider-Man/)).toBeDefined();
    expect(screen.getAllByText(/\(defeated\)/)).toHaveLength(2);
  });

  it('shows victory with the surviving and the fallen heroes', () => {
    render(
      <TestSession state={state('HEROES', ['Iron Man'], ['Spider-Man'])}>
        <GameOverScreen onReset={vi.fn()} />
      </TestSession>,
    );
    expect(screen.getByRole('dialog', { name: 'Victory' })).toBeDefined();
    expect(screen.getAllByText(/\(defeated\)/)).toHaveLength(1);
  });

  it('starts a new game from the button', () => {
    const onReset = vi.fn();
    render(
      <TestSession state={state('VILLAIN', [], ['A'])}>
        <GameOverScreen onReset={onReset} />
      </TestSession>,
    );
    fireEvent.click(screen.getByRole('button', { name: /new game/i }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
