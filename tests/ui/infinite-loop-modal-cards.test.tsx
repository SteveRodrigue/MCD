import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { InfiniteLoopModal } from '../../src/ui/components/board/InfiniteLoopModal';
import type { TriggerCallNode } from '../../src/engine/errors/infinite-loop-error';

vi.mock('../../src/ui/hooks/useCardArt', () => ({
  useCardArt: vi.fn().mockReturnValue({
    artUrl: 'https://cdn.example.com/test.jpg',
    loading: false,
    error: null,
  }),
}));

const sandman = (n: number): TriggerCallNode => ({
  trigger: 'CHARACTER_DEFEATED',
  abilityId: `sandman_${n}`,
  sourceInstanceId: 'inst_sandman',
  cardCode: '01102',
  cardName: 'Sandman',
});
const rhino: TriggerCallNode = {
  trigger: 'ENEMY_INITIATES_ATTACK',
  abilityId: 'rhino_charge',
  sourceInstanceId: 'inst_rhino',
  cardCode: '01094',
  cardName: 'Rhino',
};

const renderLoop = (cycle: TriggerCallNode[]) =>
  render(
    <InfiniteLoopModal
      message="engine message"
      cycle={cycle}
      onDismiss={vi.fn()}
      onReset={vi.fn()}
    />,
  );

describe('InfiniteLoopModal shows the cards that cause the loop', () => {
  it('shows each card of the cycle once, as a full card face, in firing order', () => {
    renderLoop([sandman(1), rhino, sandman(1)]);
    const loop = screen.getByRole('list', { name: 'The loop' });
    const faces = loop.querySelectorAll('[data-card-view]');
    expect(faces).toHaveLength(2);
    expect(within(loop).getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('Loops back to the first card')).toBeTruthy();
    expect(loop.className).not.toContain('overflow-x');
    expect(loop.className).toContain('flex-wrap');
  });

  it('lists every ability of a card that fires in the cycle', () => {
    renderLoop([sandman(1), rhino, sandman(2)]);
    const loop = screen.getByRole('list', { name: 'The loop' });
    expect(loop.textContent).toContain(
      'sandman_1 (CHARACTER_DEFEATED), sandman_2 (CHARACTER_DEFEATED)',
    );
    expect(loop.textContent).toContain('rhino_charge (ENEMY_INITIATES_ATTACK)');
  });

  it('falls back to the engine message when the cycle names no card', () => {
    renderLoop([]);
    expect(screen.queryByRole('list', { name: 'The loop' })).toBeNull();
    expect(screen.getByText('engine message')).toBeTruthy();
  });
});
