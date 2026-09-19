import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CardView } from '../../src/ui/components/cards/CardView';
import { CardType } from '../../src/engine/models/enums';
import type { NormalizedCard, CardInstance } from '../../src/engine/models';
import * as cardArtHook from '../../src/ui/hooks/useCardArt';

vi.mock('../../src/ui/hooks/useCardArt', () => ({
  useCardArt: vi.fn(),
}));

describe('CardView Dynamic Traits Display (Issue #4)', () => {
  const mockCard: NormalizedCard = {
    code: '01010a',
    name: 'Captain Marvel',
    type: CardType.HERO,
    traits: ['Avenger'],
    printedTraits: 'Avenger',
    faction: 'hero',
    cost: null,
    text: 'Energy Absorption',
    resources: { total: 0, physical: 0, energy: 0, mental: 0, wild: 0 },
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dynamic trait badge row when dynamicTraits prop is provided with real art', () => {
    vi.mocked(cardArtHook.useCardArt).mockReturnValue({
      artUrl: 'https://cdn.example.com/01010a.jpg',
      loading: false,
      error: null,
    });

    render(<CardView card={mockCard} dynamicTraits={['Aerial']} />);

    const row = screen.getByTestId('dynamic-traits-row');
    expect(row).toBeDefined();

    const badge = screen.getByTestId('dynamic-trait-badge-aerial');
    expect(badge).toBeDefined();
    expect(badge.textContent).toContain('Aerial');
    expect(badge.className).toContain('bg-cyan-300');
    expect(badge.className).toContain('font-comic');
  });

  it('renders multiple dynamic traits badges', () => {
    vi.mocked(cardArtHook.useCardArt).mockReturnValue({
      artUrl: 'https://cdn.example.com/01010a.jpg',
      loading: false,
      error: null,
    });

    render(<CardView card={mockCard} dynamicTraits={['Aerial', 'Mystic']} />);

    expect(screen.getByTestId('dynamic-trait-badge-aerial')).toBeDefined();
    expect(screen.getByTestId('dynamic-trait-badge-mystic')).toBeDefined();
  });

  it('automatically calculates dynamic traits from instance attachments when dynamicTraits is not explicitly passed', () => {
    vi.mocked(cardArtHook.useCardArt).mockReturnValue({
      artUrl: 'https://cdn.example.com/01010a.jpg',
      loading: false,
      error: null,
    });

    const instanceWithAttachment: CardInstance = {
      instanceId: 'inst-1',
      card: mockCard,
      attachments: [
        {
          instanceId: 'att-1',
          card: {
            code: 'att-card',
            name: 'Cosmic Wings',
            type: CardType.ATTACHMENT,
            traits: ['Item'],
            enrichment: {
              abilities: [
                {
                  id: 'cw_flight',
                  timing: 'CONSTANT',
                  steps: [
                    {
                      effect: 'ADD_TRAIT',
                      effectParams: { trait: 'Aerial' },
                    },
                  ],
                },
              ],
            },
          } as any,
        },
      ],
    };

    render(<CardView card={mockCard} instance={instanceWithAttachment} />);

    const badge = screen.getByTestId('dynamic-trait-badge-aerial');
    expect(badge).toBeDefined();
    expect(badge.textContent).toContain('Aerial');
  });

  it('renders dynamic traits alongside printed traits in fallback vector card layout', () => {
    vi.mocked(cardArtHook.useCardArt).mockReturnValue({
      artUrl: null,
      loading: false,
      error: null,
    });

    render(<CardView card={mockCard} dynamicTraits={['Aerial']} />);

    // In fallback mode, both printed trait (Avenger) and dynamic trait (+Aerial) are displayed
    expect(screen.getByText('Avenger')).toBeDefined();
    const fallbackBadge = screen.getByTestId('fallback-dynamic-trait-aerial');
    expect(fallbackBadge).toBeDefined();
    expect(fallbackBadge.textContent).toBe('+Aerial');
    expect(fallbackBadge.className).toContain('bg-cyan-300');
  });

  it('does not render dynamic traits row when dynamicTraits is empty', () => {
    vi.mocked(cardArtHook.useCardArt).mockReturnValue({
      artUrl: 'https://cdn.example.com/01010a.jpg',
      loading: false,
      error: null,
    });

    render(<CardView card={mockCard} dynamicTraits={[]} />);

    expect(screen.queryByTestId('dynamic-traits-row')).toBeNull();
  });
});
