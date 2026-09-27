import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PlayerHandTray } from '../../src/ui/components/board/PlayerHandTray';
import { VillainZone } from '../../src/ui/components/board/VillainZone';
import { CardView } from '../../src/ui/components/cards/CardView';
import { GameSettingsProvider } from '../../src/ui/context/GameSettingsProvider';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { createCardInstance } from '../../src/engine/state/game-setup';
import { getCardBackUrl, getCardBackFallbackColor } from '../../src/ui/services/card-cache-service';
import {
  VillainState,
  MainSchemeState,
  VillainCard,
  MainSchemeCard,
} from '../../src/engine/models';

vi.mock('../../src/ui/hooks/useCardArt', () => ({
  useCardArt: vi.fn().mockReturnValue({
    artUrl: 'https://cdn.example.com/test.jpg',
    loading: false,
    error: null,
  }),
}));

describe('Board Deck Piles & Facedown Card Backs (Issue #141)', () => {
  beforeEach(() => {
    Element.prototype.scrollTo = vi.fn();
    Element.prototype.scrollBy = vi.fn();
    Element.prototype.getBoundingClientRect = vi.fn().mockReturnValue({
      top: 0,
      left: 0,
      right: 1920,
      bottom: 1080,
      width: 1920,
      height: 1080,
      x: 0,
      y: 0,
    });
  });

  describe('Player Draw Deck Pile (PlayerHandTray)', () => {
    it('renders player card back image and deck count badge', () => {
      const mockCard = cardCatalog.getCard('01005')!;
      const deck = [
        createCardInstance(mockCard),
        createCardInstance(mockCard),
        createCardInstance(mockCard),
      ];

      render(
        <GameSettingsProvider>
          <PlayerHandTray
            hand={[]}
            deck={deck}
            discard={[]}
            heroName="Spider-Man"
            handSizeLimit={6}
          />
        </GameSettingsProvider>,
      );

      const deckPile = screen.getByTestId('player-deck-pile');
      expect(deckPile).toBeDefined();
      expect(deckPile.textContent).toContain('3');
      expect(deckPile.textContent).not.toContain('DECK');

      const img = screen.getByTestId('player-deck-image') as HTMLImageElement;
      expect(img).toBeDefined();
      expect(img.getAttribute('src')).toBe(getCardBackUrl('player'));
      expect(img.getAttribute('alt')).toBe('Player Card Back');
    });

    it('falls back to solid blue placeholder color when image fails to load', () => {
      const mockCard = cardCatalog.getCard('01005')!;
      const deck = [createCardInstance(mockCard)];

      render(
        <GameSettingsProvider>
          <PlayerHandTray
            hand={[]}
            deck={deck}
            discard={[]}
            heroName="Spider-Man"
            handSizeLimit={6}
          />
        </GameSettingsProvider>,
      );

      const img = screen.getByTestId('player-deck-image');
      fireEvent.error(img);

      const fallback = screen.getByTestId('player-deck-fallback');
      expect(fallback).toBeDefined();
      expect(fallback.style.backgroundColor).toBe(getCardBackFallbackColor('player'));
    });
  });

  describe('Encounter Draw Deck Pile (VillainZone)', () => {
    const villainCard = cardCatalog.getCard('01094') as VillainCard;
    const mainSchemeCard = cardCatalog.getCard('01097b') as MainSchemeCard;

    const mockVillain: VillainState = {
      card: villainCard,
      health: 14,
      maxHealth: 14,
      exhausted: false,
      statusCards: [],
      attachments: [],
    };

    const mockMainScheme: MainSchemeState = {
      card: mainSchemeCard,
      stage: '1',
      threat: 0,
      targetThreat: 7,
    };

    it('renders encounter card back image and encounter deck count badge', () => {
      const mockCard = cardCatalog.getCard('01100')!;
      const encounterDeck = [createCardInstance(mockCard), createCardInstance(mockCard)];

      render(
        <GameSettingsProvider>
          <VillainZone
            villain={mockVillain}
            mainScheme={mockMainScheme}
            sideSchemes={[]}
            encounterDeck={encounterDeck}
            encounterDiscard={[]}
            accelerationTokens={0}
          />
        </GameSettingsProvider>,
      );

      const deckPile = screen.getByTestId('encounter-deck-pile');
      expect(deckPile).toBeDefined();
      expect(deckPile.textContent).toContain('2');
      expect(deckPile.textContent).not.toContain('DECK');

      const img = screen.getByTestId('encounter-deck-image') as HTMLImageElement;
      expect(img).toBeDefined();
      expect(img.getAttribute('src')).toBe(getCardBackUrl('encounter'));
    });

    it('falls back to solid orange placeholder color when encounter deck image fails to load', () => {
      const mockCard = cardCatalog.getCard('01100')!;
      const encounterDeck = [createCardInstance(mockCard)];

      render(
        <GameSettingsProvider>
          <VillainZone
            villain={mockVillain}
            mainScheme={mockMainScheme}
            sideSchemes={[]}
            encounterDeck={encounterDeck}
            encounterDiscard={[]}
            accelerationTokens={0}
          />
        </GameSettingsProvider>,
      );

      const img = screen.getByTestId('encounter-deck-image');
      fireEvent.error(img);

      const fallback = screen.getByTestId('encounter-deck-fallback');
      expect(fallback).toBeDefined();
      expect(fallback.style.backgroundColor).toBe(getCardBackFallbackColor('encounter'));
    });
  });

  describe('CardView Facedown Rendering', () => {
    it('renders player card back when isFacedown is true for player card', () => {
      const playerCard = cardCatalog.getCard('01005')!;
      render(<CardView card={playerCard} isFacedown={true} />);

      const facedownContainer = screen.getByTestId('card-view-facedown');
      expect(facedownContainer).toBeDefined();

      const img = screen.getByTestId('card-back-image') as HTMLImageElement;
      expect(img.getAttribute('src')).toBe(getCardBackUrl('player'));
    });

    it('renders encounter card back when isFacedown is true for encounter card', () => {
      const encounterCard = cardCatalog.getCard('01100')!;
      render(<CardView card={encounterCard} isFacedown={true} />);

      const img = screen.getByTestId('card-back-image') as HTMLImageElement;
      expect(img.getAttribute('src')).toBe(getCardBackUrl('encounter'));
    });

    it('falls back to solid placeholder color when facedown image fails to load', () => {
      const playerCard = cardCatalog.getCard('01005')!;
      render(<CardView card={playerCard} isFacedown={true} />);

      const img = screen.getByTestId('card-back-image');
      fireEvent.error(img);

      const fallback = screen.getByTestId('card-back-fallback');
      expect(fallback).toBeDefined();
      expect(fallback.style.backgroundColor).toBe(getCardBackFallbackColor('player'));
    });
  });
});
