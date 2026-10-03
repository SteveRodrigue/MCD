import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { setupGame, createCardInstance } from '../../src/engine/state/game-setup';
import { HeroCard, AlterEgoCard, GameState, CardInstance } from '../../src/engine/models';
import { CardPaymentModal } from '../../src/ui/components/board/CardPaymentModal';
import { isGeneratorIneligibleForCost } from '../../src/ui/components/board/payment-eligibility';

vi.mock('../../src/ui/hooks/useCardArt', () => ({
  useCardArt: vi.fn().mockReturnValue({
    artUrl: 'https://cdn.example.com/test.jpg',
    loading: false,
    error: null,
  }),
}));

describe('CardPaymentModal typed resource eligibility (Issues #180, #129)', () => {
  const captainMarvel = cardCatalog.getCard('01010a') as HeroCard;
  const carolDanvers = cardCatalog.getCard('01010b') as AlterEgoCard;
  let state: GameState;
  let source: CardInstance;

  function handCard(name: string, icons: Partial<Record<string, number>>): CardInstance {
    const base = cardCatalog.getCard('01005')!;
    const physical = icons.physical || 0;
    const energy = icons.energy || 0;
    const mental = icons.mental || 0;
    const wild = icons.wild || 0;
    const inst = createCardInstance({
      ...base,
      name,
      resources: {
        physical,
        energy,
        mental,
        wild,
        total: physical + energy + mental + wild,
      },
    } as any);
    return inst;
  }

  function renderModal(abilityCost: any) {
    state.players[0].hand = [
      handCard('Physical Card', { physical: 1 }),
      handCard('Energy Card', { energy: 1 }),
      handCard('Mental Card', { mental: 1 }),
      handCard('Wild Card', { wild: 1 }),
      handCard('Blank Card', {}),
    ];
    render(
      <CardPaymentModal
        isOpen={true}
        onClose={() => {}}
        cardToPlay={source}
        abilityCost={abilityCost}
        player={state.players[0]}
        gameState={state}
        onConfirmPlay={() => {}}
      />,
    );
  }

  const isDisabled = (name: string) =>
    (screen.getByText(name).closest('button') as HTMLButtonElement).disabled;

  beforeEach(() => {
    state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Carol',
          hero: captainMarvel,
          alterEgo: carolDanvers,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      skipMulligan: true,
    });
    state.players[0].currentForm = 'hero';
    state.players[0].activeFormCard = captainMarvel;
    source = createCardInstance(captainMarvel);
  });

  it('Energy cost (Rechannel): only Energy and Wild cards are selectable', () => {
    renderModal({ amount: 1, resourceType: 'energy', title: 'Rechannel' });
    expect(isDisabled('Energy Card')).toBe(false);
    expect(isDisabled('Wild Card')).toBe(false);
    expect(isDisabled('Physical Card')).toBe(true);
    expect(isDisabled('Mental Card')).toBe(true);
    expect(isDisabled('Blank Card')).toBe(true);
  });

  it('Physical cost (Rhino attachment discard): only Physical and Wild cards are selectable', () => {
    renderModal({ amount: 1, resourceType: 'physical', title: 'Discard attachment' });
    expect(isDisabled('Physical Card')).toBe(false);
    expect(isDisabled('Wild Card')).toBe(false);
    expect(isDisabled('Energy Card')).toBe(true);
    expect(isDisabled('Mental Card')).toBe(true);
    expect(isDisabled('Blank Card')).toBe(true);
  });

  it('requirePrinted keeps excluding Wild cards', () => {
    renderModal({ amount: 1, resourceType: 'energy', requirePrinted: true, title: 'Printed' });
    expect(isDisabled('Energy Card')).toBe(false);
    expect(isDisabled('Wild Card')).toBe(true);
    expect(isDisabled('Physical Card')).toBe(true);
  });

  it('Untyped generic cost leaves every card selectable', () => {
    renderModal({ amount: 2, title: 'Generic' });
    for (const name of ['Physical Card', 'Energy Card', 'Mental Card', 'Wild Card', 'Blank Card']) {
      expect(isDisabled(name)).toBe(false);
    }
  });
});

describe('isGeneratorIneligibleForCost (Issues #180, #129)', () => {
  it('mismatched concrete generator is ineligible; wild and untyped stay eligible', () => {
    expect(isGeneratorIneligibleForCost({ resourceType: 'mental' }, 'energy', false)).toBe(true);
    expect(isGeneratorIneligibleForCost({ resourceType: 'energy' }, 'energy', false)).toBe(false);
    expect(isGeneratorIneligibleForCost({ resourceType: 'wild' }, 'energy', false)).toBe(false);
    expect(isGeneratorIneligibleForCost({ resourceType: 'wild' }, 'energy', true)).toBe(true);
    expect(isGeneratorIneligibleForCost({ resourceType: 'mental' }, undefined, false)).toBe(false);
    expect(isGeneratorIneligibleForCost({ resourceType: 'mental' }, 'wild', false)).toBe(false);
  });
});
