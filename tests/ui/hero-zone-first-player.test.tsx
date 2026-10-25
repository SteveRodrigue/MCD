import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HeroZone } from '../../src/ui/components/board/HeroZone';
import { newRhinoGame } from '../support/game-fixtures';
import { TestSession } from '../support/render-with-session';

vi.mock('../../src/ui/hooks/useCardArt', () => ({
  useCardArt: vi
    .fn()
    .mockReturnValue({ artUrl: 'https://cdn.example.com/test.jpg', loading: false, error: null }),
}));

describe('HeroZone first-player badge (Issue #378)', () => {
  const renderSeat = (firstPlayerIndex: number, seat: 0 | 1, isMultiHero = true) => {
    const state = newRhinoGame({ players: 2 });
    state.firstPlayerIndex = firstPlayerIndex;
    render(
      <TestSession state={state}>
        <HeroZone
          player={state.players[seat]}
          seatNumber={seat + 1}
          isFocused
          isMultiHero={isMultiHero}
        />
      </TestSession>,
    );
  };

  it('marks the seat that holds the First Player token', () => {
    renderSeat(1, 1);
    expect(screen.getByTestId('first-player-badge').textContent).toContain('FIRST PLAYER');
  });

  it('is absent on the other seat', () => {
    renderSeat(1, 0);
    expect(screen.queryByTestId('first-player-badge')).toBeNull();
  });

  it('is absent in solo play, where there is no one to pass the token to', () => {
    renderSeat(0, 0, false);
    expect(screen.queryByTestId('first-player-badge')).toBeNull();
  });
});
