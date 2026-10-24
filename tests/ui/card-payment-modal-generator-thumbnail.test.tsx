import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CardPaymentModal } from '../../src/ui/components/board/CardPaymentModal';
import type { GameState } from '../../src/engine/models';
import { newRhinoGame } from '../support/game-fixtures';
import { TestSession } from '../support/render-with-session';

vi.mock('../../src/ui/hooks/useCardArt', () => ({
  useCardArt: vi.fn().mockReturnValue({
    artUrl: 'https://cdn.example.com/test.jpg',
    loading: false,
    error: null,
  }),
}));

const renderPayment = (state: GameState) => {
  const player = state.players[0];
  render(
    <TestSession state={state}>
      <CardPaymentModal
        isOpen
        onClose={() => {}}
        cardToPlay={player.hand[0]}
        player={player}
        onConfirmPlay={() => {}}
      />
    </TestSession>,
  );
};

/** The choice tile of the generator card named `name`, or null. */
const generatorTile = (name: string) =>
  screen.getByText(name, { selector: 'div.text-xs' }).closest('button');

describe('CardPaymentModal resource generators show their card', () => {
  it('shows the thumbnail of a tableau generator, keyed by its card code', () => {
    renderPayment(
      newRhinoGame({ players: [{ form: 'hero', hand: ['01050'], tableau: ['01008'] }] }),
    );
    const tile = generatorTile('Web-Shooter')!;
    expect(tile.getAttribute('data-card-anchor')).toBe('01008');
    expect(tile.querySelector('img')?.getAttribute('alt')).toBe('Web-Shooter');
  });

  it('shows the thumbnail of the identity ability that generates a resource', () => {
    renderPayment(newRhinoGame({ players: [{ form: 'alter-ego', hand: ['01050'] }] }));
    const tile = screen.getByText(/Identity Ability/).closest('button')!;
    expect(tile.getAttribute('data-card-anchor')).toBe('01001b');
    expect(tile.querySelector('img')).toBeTruthy();
  });
});
