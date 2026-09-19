import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { HeroZone } from '../../src/ui/components/board/HeroZone';
import { FacedownEncounterCard } from '../../src/ui/components/cards/FacedownEncounterCard';
import { GameSettingsProvider } from '../../src/ui/context/GameSettingsProvider';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { setupGame, createCardInstance } from '../../src/engine/state/game-setup';
import { GameState, HeroCard, AlterEgoCard } from '../../src/engine/models';

describe('Facedown Encounter Card Display in Hero Zone (Issue #138)', () => {
  const heroes = [
    {
      hero: cardCatalog.getCard('01001a') as HeroCard, // Spider-Man
      alterEgo: cardCatalog.getCard('01001b') as AlterEgoCard,
      name: 'Peter Parker',
    },
  ];

  function createTestGameState(): GameState {
    const players = heroes.map((h, idx) => ({
      id: `p${idx + 1}`,
      name: h.name,
      hero: h.hero,
      alterEgo: h.alterEgo,
      deckCards: Array(15).fill(cardCatalog.getCard('01005')!),
    }));

    const state = setupGame({
      scenarioId: 'rhino',
      players,
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

    state.activePlayerIndex = 0;
    return state;
  }

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

  describe('FacedownEncounterCard Component Unit Tests', () => {
    it('returns null when cards array is empty', () => {
      const { container } = render(<FacedownEncounterCard cards={[]} />);
      expect(container.firstChild).toBeNull();
    });

    it('renders facedown encounter card with comic styling and count badge', () => {
      const cardA = createCardInstance(cardCatalog.getCard('01005')!);
      render(<FacedownEncounterCard cards={[cardA]} heroName="Spider-Man" />);

      const cardElement = screen.getByTestId('facedown-encounter-card');
      expect(cardElement).toBeDefined();
      expect(cardElement.getAttribute('title')).toBe(
        'Dealt facedown. Will be revealed and resolved during Step 5 of the Villain Phase.',
      );

      const countBadge = screen.getByTestId('facedown-count-badge');
      expect(countBadge.textContent).toContain('FACEDOWN (1)');

      expect(screen.getByText('ENCOUNTER')).toBeDefined();
      expect(screen.getByText('For Spider-Man')).toBeDefined();
    });

    it('renders correct count badge for multiple cards', () => {
      const cardA = createCardInstance(cardCatalog.getCard('01005')!);
      const cardB = createCardInstance(cardCatalog.getCard('01006')!);
      const cardC = createCardInstance(cardCatalog.getCard('01007')!);

      render(<FacedownEncounterCard cards={[cardA, cardB, cardC]} />);

      const countBadge = screen.getByTestId('facedown-count-badge');
      expect(countBadge.textContent).toContain('FACEDOWN (3)');
    });

    it('does not open peek modal on click when devMode is false', () => {
      const cardA = createCardInstance(cardCatalog.getCard('01005')!);
      render(<FacedownEncounterCard cards={[cardA]} devMode={false} />);

      const card = screen.getByTestId('facedown-encounter-card');
      fireEvent.click(card.querySelector('[role="region"]')!);

      expect(screen.queryByTestId('facedown-peek-modal')).toBeNull();
    });

    it('opens and closes peek modal on click when devMode is true', () => {
      const cardA = createCardInstance(cardCatalog.getCard('01005')!);
      render(<FacedownEncounterCard cards={[cardA]} devMode={true} heroName="Spider-Man" />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      const modal = screen.getByTestId('facedown-peek-modal');
      expect(modal).toBeDefined();
      expect(screen.getByText(/\[DEV\] Dealt Encounter Cards Peek \(1\)/i)).toBeDefined();
      expect(screen.getByText(cardA.card.name)).toBeDefined();

      // Close peek modal
      const closeBtn = screen.getByLabelText('Close peek modal');
      fireEvent.click(closeBtn);

      expect(screen.queryByTestId('facedown-peek-modal')).toBeNull();
    });
  });

  describe('HeroZone Integration', () => {
    it('does not render FacedownEncounterCard when dealtEncounterCards is empty', () => {
      const state = createTestGameState();
      const player = state.players[0];
      player.dealtEncounterCards = [];

      render(
        <GameSettingsProvider>
          <HeroZone player={player} gameState={state} seatNumber={1} isFocused={true} />
        </GameSettingsProvider>,
      );

      expect(screen.queryByTestId('facedown-encounter-card')).toBeNull();
      expect(screen.getByText(`Minions Engaged with ${player.name} (0)`)).toBeDefined();
    });

    it('renders FacedownEncounterCard to the left of minions and updates threat zone header when dealtEncounterCards has cards', () => {
      const state = createTestGameState();
      const player = state.players[0];
      const cardA = createCardInstance(cardCatalog.getCard('01005')!);
      player.dealtEncounterCards = [cardA];

      render(
        <GameSettingsProvider>
          <HeroZone player={player} gameState={state} seatNumber={1} isFocused={true} />
        </GameSettingsProvider>,
      );

      // Verify facedown encounter card is rendered
      const facedownCard = screen.getByTestId('facedown-encounter-card');
      expect(facedownCard).toBeDefined();

      // Verify count badge
      const countBadge = screen.getByTestId('facedown-count-badge');
      expect(countBadge.textContent).toContain('FACEDOWN (1)');

      // Verify threat zone header shows minions and dealt cards count
      expect(
        screen.getByText(`Threat Zone: ${player.name} (0 Minions • 1 Dealt Cards)`),
      ).toBeDefined();
    });

    it('displays updated count when player has multiple dealt encounter cards', () => {
      const state = createTestGameState();
      const player = state.players[0];
      const cardA = createCardInstance(cardCatalog.getCard('01005')!);
      const cardB = createCardInstance(cardCatalog.getCard('01006')!);
      player.dealtEncounterCards = [cardA, cardB];

      render(
        <GameSettingsProvider>
          <HeroZone player={player} gameState={state} seatNumber={1} isFocused={true} />
        </GameSettingsProvider>,
      );

      const countBadge = screen.getByTestId('facedown-count-badge');
      expect(countBadge.textContent).toContain('FACEDOWN (2)');

      expect(
        screen.getByText(`Threat Zone: ${player.name} (0 Minions • 2 Dealt Cards)`),
      ).toBeDefined();
    });

    it('renders both FacedownEncounterCard and engaged minions side-by-side', () => {
      const state = createTestGameState();
      const player = state.players[0];
      const cardA = createCardInstance(cardCatalog.getCard('01005')!);
      player.dealtEncounterCards = [cardA];

      // Add an engaged minion (e.g. Armored Rhino / Hydra Soldier)
      const minionCard = cardCatalog.getCard('01096')!; // Armored Rhino minion
      const minionInst = createCardInstance(minionCard);
      player.engagedMinions = [minionInst];

      render(
        <GameSettingsProvider>
          <HeroZone player={player} gameState={state} seatNumber={1} isFocused={true} />
        </GameSettingsProvider>,
      );

      // Facedown card exists
      expect(screen.getByTestId('facedown-encounter-card')).toBeDefined();

      // Header shows 1 Minions • 1 Dealt Cards
      expect(
        screen.getByText(`Threat Zone: ${player.name} (1 Minions • 1 Dealt Cards)`),
      ).toBeDefined();
    });

    it('opens dev-mode peek modal from HeroZone when devMode is active', () => {
      const state = createTestGameState();
      const player = state.players[0];
      const encounterCard = createCardInstance(cardCatalog.getCard('01005')!);
      player.dealtEncounterCards = [encounterCard];

      render(
        <GameSettingsProvider>
          <HeroZone
            player={player}
            gameState={state}
            seatNumber={1}
            isFocused={true}
            devMode={true}
          />
        </GameSettingsProvider>,
      );

      const button = screen.getByRole('button', { name: /Facedown Encounter Cards/i });
      fireEvent.click(button);

      expect(screen.getByTestId('facedown-peek-modal')).toBeDefined();
      expect(screen.getByText(encounterCard.card.name)).toBeDefined();
    });
  });
});
