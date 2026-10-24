import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { createCardInstance } from '../../src/engine/state/game-setup';
import type { CombatResolutionSummary } from '../../src/engine/models';
import { BoostIconsPill } from '../../src/ui/components/cards/BoostIconsPill';
import { CombatBoostModal } from '../../src/ui/components/board/CombatBoostModal';

vi.mock('../../src/ui/hooks/useCardArt', () => ({
  useCardArt: vi.fn().mockReturnValue({
    artUrl: 'https://cdn.example.com/test.jpg',
    loading: false,
    error: null,
  }),
}));

const boostCard = (code: string) => createCardInstance(cardCatalog.getCard(code)!);

const outcome = (codes: string[]): CombatResolutionSummary => {
  const boostCards = codes.map(boostCard);
  return {
    attackerName: 'Rhino',
    attackerType: 'VILLAIN',
    targetPlayerId: 'p1',
    targetHeroName: 'Spider-Man',
    baseAttack: 2,
    boostCards,
    totalBoostIcons: boostCards.reduce((n, c) => n + (c.card.boostIcons ?? 0), 0),
    defenseValue: 1,
    finalDamage: 3,
  };
};

describe('BoostIconsPill', () => {
  it('draws one enlarged icon per boost icon and says the count in words', () => {
    const { container } = render(<BoostIconsPill icons={2} />);
    expect(screen.getByRole('img', { name: '2 boost icons' })).toBeTruthy();
    expect(container.querySelectorAll('[data-boost-icon]')).toHaveLength(2);
  });

  it('marks a boost star and a card without icons', () => {
    const { rerender } = render(<BoostIconsPill icons={1} star />);
    expect(screen.getByRole('img', { name: '1 boost icon, boost star effect' })).toBeTruthy();
    rerender(<BoostIconsPill icons={0} />);
    expect(screen.getByRole('img', { name: '0 boost icons' })).toBeTruthy();
    expect(screen.getByText('none')).toBeTruthy();
  });
});

describe('CombatBoostModal boost cards', () => {
  it('puts a pill on every boost card, not a zoom', () => {
    const result = outcome(['01102', '01094', '01102']);
    render(<CombatBoostModal isOpen outcome={result} onContinue={() => {}} />);
    const pills = document.querySelectorAll('[data-boost-icons]');
    expect(pills).toHaveLength(3);
    expect([...pills].map((p) => Number(p.getAttribute('data-boost-icons')))).toEqual(
      result.boostCards.map((c) => c.card.boostIcons ?? 0),
    );
    expect(document.querySelectorAll('[class*="group-hover:scale"]')).toHaveLength(0);
  });

  it('hides the pill while the pointer is on the card, and the card never moves', () => {
    render(<CombatBoostModal isOpen outcome={outcome(['01102'])} onContinue={() => {}} />);
    const pill = document.querySelector('[data-boost-icons]')!;
    expect(pill.className).toContain('group-hover/boost:opacity-0');
    expect(pill.parentElement!.className).toContain('group/boost');
    expect(document.querySelectorAll('[class*="group-hover:-translate-y"]')).toHaveLength(0);
  });

  it('widens the modal for three or more boost cards', () => {
    render(
      <CombatBoostModal
        isOpen
        outcome={outcome(['01102', '01094', '01102'])}
        onContinue={() => {}}
      />,
    );
    expect(screen.getByTestId('combat-boost-modal').innerHTML).toContain('max-w-3xl');
  });

  it('shows no pill when no boost card was drawn', () => {
    render(<CombatBoostModal isOpen outcome={outcome([])} onContinue={() => {}} />);
    expect(document.querySelectorAll('[data-boost-icons]')).toHaveLength(0);
  });
});
