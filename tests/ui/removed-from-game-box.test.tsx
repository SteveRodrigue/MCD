import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { RemovedFromGameBox } from '../../src/ui/components/board/RemovedFromGameBox';
import { GameBoard } from '../../src/ui/components/board/GameBoard';
import { GameSettingsProvider } from '../../src/ui/context/GameSettingsProvider';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { createCardInstance, setupGame } from '../../src/engine/state/game-setup';
import { eliminatePlayer } from '../../src/engine/pipeline/player-elimination';
import { HeroCard, AlterEgoCard } from '../../src/engine/models';
import { TestSession } from '../support/render-with-session';

vi.mock('../../src/ui/hooks/useCardArt', () => ({
  useCardArt: vi.fn().mockReturnValue({
    artUrl: 'https://cdn.example.com/test.jpg',
    loading: false,
    error: null,
  }),
}));

describe('Visible Removed from Game Pile (Issue #282)', () => {
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

  it('renders empty placeholder with REMOVED and EMPTY when cards list is empty', () => {
    render(
      <GameSettingsProvider>
        <RemovedFromGameBox cards={[]} />
      </GameSettingsProvider>,
    );

    const emptyPile = screen.getByTestId('removed-from-game-pile-empty');
    expect(emptyPile).toBeDefined();
    expect(emptyPile.textContent).toContain('REMOVED');
    expect(emptyPile.textContent).toContain('EMPTY');

    fireEvent.click(emptyPile);
    expect(screen.getByText(/Removed from Game \(0 Cards\)/i)).toBeDefined();
    expect(screen.getByText(/No cards have been removed from the game/i)).toBeDefined();
  });

  it('renders populated pile with card name, REMOVED badge, and count badge', () => {
    // Eviction Notice (Spider-Man obligation)
    const obligationCard = cardCatalog.getCard('01165')!;
    const cardInstance = createCardInstance(obligationCard);

    render(
      <GameSettingsProvider>
        <RemovedFromGameBox cards={[cardInstance]} />
      </GameSettingsProvider>,
    );

    const populatedPile = screen.getByTestId('removed-from-game-pile');
    expect(populatedPile).toBeDefined();
    expect(populatedPile.textContent).toContain('REMOVED');
    expect(populatedPile.textContent).toContain('1');
    expect(screen.getByAltText(obligationCard.name)).toBeDefined();
  });

  it('shows the short OUT OF PLAY ribbon title (Issue #312 follow-up)', () => {
    render(
      <GameSettingsProvider>
        <RemovedFromGameBox cards={[]} />
      </GameSettingsProvider>,
    );

    const ribbon = screen.getByText('OUT OF PLAY');
    expect(ribbon.textContent).toBe('OUT OF PLAY');
    expect(screen.queryByText(/OUT OF PLAY: REMOVED FROM GAME/)).toBeNull();
  });

  it('opens modal on click showing cards and title', () => {
    const obligationCard = cardCatalog.getCard('01165')!;
    const cardInstance = createCardInstance(obligationCard);

    render(
      <GameSettingsProvider>
        <RemovedFromGameBox cards={[cardInstance]} />
      </GameSettingsProvider>,
    );

    const pile = screen.getByTestId('removed-from-game-pile');
    fireEvent.click(pile);

    expect(screen.getByText(/Removed from Game \(1 Cards\)/i)).toBeDefined();
    expect(
      screen.getByText(/Cards removed from the game are out of play and cannot reenter the game/i),
    ).toBeDefined();
    expect(screen.getAllByAltText(obligationCard.name).length).toBeGreaterThanOrEqual(1);
  });

  it('closes modal when clicking close button', () => {
    const obligationCard = cardCatalog.getCard('01165')!;
    const cardInstance = createCardInstance(obligationCard);

    render(
      <GameSettingsProvider>
        <RemovedFromGameBox cards={[cardInstance]} />
      </GameSettingsProvider>,
    );

    fireEvent.click(screen.getByTestId('removed-from-game-pile'));
    expect(screen.getByText(/Removed from Game \(1 Cards\)/i)).toBeDefined();

    // Click close button in modal (footer close button or header X)
    const closeButtons = screen.getAllByRole('button', { name: /close/i });
    expect(closeButtons.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(closeButtons[0]);

    expect(screen.queryByText(/Removed from Game \(1 Cards\)/i)).toBeNull();
  });

  it('renders RemovedFromGameBox within GameBoard with gameState.removedFromGame', () => {
    const obligationCard = cardCatalog.getCard('01026')!;
    const cardInstance = createCardInstance(obligationCard);

    const state = setupGame({
      catalog: cardCatalog,
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Peter Parker',
          hero: cardCatalog.getCard('01001a') as HeroCard,
          alterEgo: cardCatalog.getCard('01001b') as AlterEgoCard,
          deckCards: Array(15).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

    state.removedFromGame = [cardInstance];

    render(
      <GameSettingsProvider>
        <TestSession state={state}>
          <GameBoard onReset={vi.fn()} />
        </TestSession>
      </GameSettingsProvider>,
    );

    expect(screen.getByTestId('removed-from-game-box')).toBeDefined();
    const pile = screen.getByTestId('removed-from-game-pile');
    expect(pile).toBeDefined();
    expect(pile.textContent).toContain('1');
  });

  describe('Defeated Hero(es) in Removed from Game (Issue #357)', () => {
    const HEROES = [
      { id: 'p1', name: 'Peter Parker', hero: '01001a', alterEgo: '01001b' },
      { id: 'p2', name: 'Carol Danvers', hero: '01010a', alterEgo: '01010b' },
      { id: 'p3', name: 'Jennifer Walters', hero: '01019a', alterEgo: '01019b' },
      { id: 'p4', name: 'Tony Stark', hero: '01029a', alterEgo: '01029b' },
    ];

    const createEliminatedState = (eliminated: string[] = ['p1'], playerCount = 2) => {
      const state = setupGame({
        catalog: cardCatalog,
        scenarioId: 'rhino',
        players: HEROES.slice(0, playerCount).map((h) => ({
          id: h.id,
          name: h.name,
          hero: cardCatalog.getCard(h.hero) as HeroCard,
          alterEgo: cardCatalog.getCard(h.alterEgo) as AlterEgoCard,
          deckCards: Array(15).fill(cardCatalog.getCard('01005')!),
        })),
        villain: cardCatalog.getCard('01094') as any,
        mainScheme: cardCatalog.getCard('01097b') as any,
        encounterCards: cardCatalog.getCardsBySet('rhino'),
        skipMulligan: true,
      });
      for (const p of state.players) {
        p.currentForm = 'hero';
        p.activeFormCard = p.hero;
      }
      for (const id of eliminated) eliminatePlayer(state, id);
      return state;
    };

    it('renders defeated hero with DEFEATED badge, grayscale stack, and deck peek', () => {
      const state = createEliminatedState();
      const eliminatedPlayer = state.eliminatedPlayers![0];

      render(
        <GameSettingsProvider>
          <RemovedFromGameBox cards={[]} eliminatedPlayers={[eliminatedPlayer]} />
        </GameSettingsProvider>,
      );

      const heroStack = screen.getByTestId(`defeated-hero-stack-${eliminatedPlayer.id}`);

      // The grayscale covers the hero and its deck peek together
      const visual = screen.getByTestId(`defeated-hero-visual-${eliminatedPlayer.id}`);
      expect(visual.className).toContain('grayscale');
      expect(
        visual.contains(screen.getByTestId(`defeated-hero-deck-peek-${eliminatedPlayer.id}`)),
      ).toBe(true);
      expect(visual.contains(screen.getByTestId(`defeated-hero-card-${eliminatedPlayer.id}`))).toBe(
        true,
      );

      expect(heroStack.textContent).toContain('DEFEATED');
      expect(heroStack.textContent).toContain(String(eliminatedPlayer.deck.length));
    });

    it('wraps three defeated heroes and the removed pile in a 4-player game', () => {
      const state = createEliminatedState(['p1', 'p2', 'p3'], 4);
      expect(state.players.map((p) => p.id)).toEqual(['p4']);

      render(
        <GameSettingsProvider>
          <RemovedFromGameBox
            cards={[createCardInstance(cardCatalog.getCard('01165')!)]}
            eliminatedPlayers={state.eliminatedPlayers}
          />
        </GameSettingsProvider>,
      );

      const row = screen.getByTestId('out-of-play-stacks');
      expect(row.className).toContain('flex-wrap');
      expect(row.contains(screen.getByTestId('removed-from-game-pile'))).toBe(true);
      for (const id of ['p1', 'p2', 'p3']) {
        const stack = screen.getByTestId(`defeated-hero-stack-${id}`);
        expect(row.contains(stack)).toBe(true);
        expect(stack.textContent).toContain('DEFEATED');
      }
    });

    it('switches the modal between the removed pile and each defeated hero', () => {
      const state = createEliminatedState(['p1', 'p2', 'p3'], 4);
      const [fallen1, fallen2] = state.eliminatedPlayers!;
      fallen1.hand = [createCardInstance(cardCatalog.getCard('01005')!)];
      fallen2.hand = [];
      fallen2.allies = [createCardInstance(cardCatalog.getCard('01002')!)];

      render(
        <GameSettingsProvider>
          <RemovedFromGameBox
            cards={[createCardInstance(cardCatalog.getCard('01165')!)]}
            eliminatedPlayers={state.eliminatedPlayers}
          />
        </GameSettingsProvider>,
      );

      fireEvent.click(screen.getByTestId('removed-from-game-pile'));
      expect(screen.getByText(/Removed from Game \(1 Cards\)/i)).toBeDefined();
      expect(screen.queryByTestId('defeated-zone-counts')).toBeNull();

      fireEvent.click(screen.getByTestId('defeated-tab-p1'));
      expect(screen.getByText(/Peter Parker — Defeated Hero/i)).toBeDefined();
      expect(screen.getByTestId('defeated-zone-hand')).toBeDefined();
      expect(screen.queryByTestId('defeated-zone-allies')).toBeNull();

      fireEvent.click(screen.getByTestId('defeated-tab-p2'));
      expect(screen.getByText(/Carol Danvers — Defeated Hero/i)).toBeDefined();
      expect(screen.getByTestId('defeated-zone-allies')).toBeDefined();
      expect(screen.queryByTestId('defeated-zone-hand')).toBeNull();

      fireEvent.click(screen.getByTestId('defeated-tab-p3'));
      expect(screen.getByText(/Jennifer Walters — Defeated Hero/i)).toBeDefined();

      fireEvent.click(screen.getByTestId('removed-tab'));
      expect(screen.getByText(/Removed from Game \(1 Cards\)/i)).toBeDefined();
    });

    it('opens the modal on the hero whose stack was clicked', () => {
      const state = createEliminatedState(['p1', 'p2', 'p3'], 4);

      render(
        <GameSettingsProvider>
          <RemovedFromGameBox cards={[]} eliminatedPlayers={state.eliminatedPlayers} />
        </GameSettingsProvider>,
      );

      fireEvent.click(screen.getByTestId('defeated-hero-stack-p3'));
      expect(screen.getByText(/Jennifer Walters — Defeated Hero/i)).toBeDefined();
    });

    it('shows every zone of the defeated play area, hides empty ones, and lists all counts', () => {
      const state = createEliminatedState();
      const fallen = state.eliminatedPlayers![0];
      const card = (code: string) => createCardInstance(cardCatalog.getCard(code)!, 'p1');
      fallen.hand = [card('01005'), card('01005')];
      fallen.discard = [card('01002'), card('01005')];
      fallen.tableau = [card('01037')];
      fallen.allies = [card('01002')];
      fallen.cardsUnderneath = [];
      const nemesisCount = fallen.setAsideCards.length;
      expect(nemesisCount).toBeGreaterThan(0);

      render(
        <GameSettingsProvider>
          <RemovedFromGameBox cards={[]} eliminatedPlayers={[fallen]} />
        </GameSettingsProvider>,
      );
      fireEvent.click(screen.getByTestId('defeated-hero-stack-p1'));

      expect(screen.getByText('Hand (2 Cards)')).toBeDefined();
      expect(screen.getByText(`Deck (${fallen.deck.length} Cards)`)).toBeDefined();
      expect(screen.getByText('Discard Pile (2 Cards)')).toBeDefined();
      expect(screen.getByText('Upgrades & Supports (1 Cards)')).toBeDefined();
      expect(screen.getByText('Allies (1 Cards)')).toBeDefined();
      expect(screen.getByText(`Set-Aside Nemesis (${nemesisCount} Cards)`)).toBeDefined();

      // Empty zones have no section but still show in the count strip
      expect(screen.queryByTestId('defeated-zone-underneath')).toBeNull();
      expect(screen.queryByTestId('defeated-zone-attachments')).toBeNull();
      const counts = screen.getByTestId('defeated-zone-counts').textContent ?? '';
      expect(counts).toContain('Underneath: 0');
      expect(counts).toContain('Attached to Identity: 0');
      expect(counts).toContain(`Set-Aside Nemesis: ${nemesisCount}`);
    });

    it('lists the discard pile newest first, so #1 is its top card', () => {
      const state = createEliminatedState();
      const fallen = state.eliminatedPlayers![0];
      const older = createCardInstance(cardCatalog.getCard('01002')!, 'p1');
      const newer = createCardInstance(cardCatalog.getCard('01005')!, 'p1');
      fallen.discard = [older, newer];

      render(
        <GameSettingsProvider>
          <RemovedFromGameBox cards={[]} eliminatedPlayers={[fallen]} />
        </GameSettingsProvider>,
      );
      fireEvent.click(screen.getByTestId('defeated-hero-stack-p1'));

      const tiles = within(screen.getByTestId('defeated-zone-discard')).getAllByTestId('card-tile');
      expect(tiles[0].textContent).toContain('#1');
      expect(tiles[0].getAttribute('data-card-code')).toBe(newer.card.code);
      expect(tiles[1].getAttribute('data-card-code')).toBe(older.card.code);
    });

    it('lists the deck from its top card, which is index 0', () => {
      const state = createEliminatedState();
      const fallen = state.eliminatedPlayers![0];
      fallen.deck = [
        createCardInstance(cardCatalog.getCard('01002')!, 'p1'),
        createCardInstance(cardCatalog.getCard('01005')!, 'p1'),
      ];

      render(
        <GameSettingsProvider>
          <RemovedFromGameBox cards={[]} eliminatedPlayers={[fallen]} />
        </GameSettingsProvider>,
      );
      fireEvent.click(screen.getByTestId('defeated-hero-stack-p1'));

      const tiles = within(screen.getByTestId('defeated-zone-deck')).getAllByTestId('card-tile');
      expect(tiles[0].getAttribute('data-card-code')).toBe(fallen.deck[0].card.code);
      expect(tiles[0].textContent).toContain('#1');
    });

    it('lists the removed pile newest first', () => {
      const older = createCardInstance(cardCatalog.getCard('01165')!);
      const newer = createCardInstance(cardCatalog.getCard('01005')!);

      render(
        <GameSettingsProvider>
          <RemovedFromGameBox cards={[older, newer]} />
        </GameSettingsProvider>,
      );
      fireEvent.click(screen.getByTestId('removed-from-game-pile'));

      const tiles = screen.getAllByTestId('card-tile');
      expect(tiles[0].textContent).toContain('#1');
      expect(tiles[0].getAttribute('data-card-code')).toBe(newer.card.code);
      expect(tiles[1].getAttribute('data-card-code')).toBe(older.card.code);
    });

    it('opens inspection modal showing defeated hero deck cards on click', () => {
      const state = createEliminatedState();
      const eliminatedPlayer = state.eliminatedPlayers![0];

      render(
        <GameSettingsProvider>
          <RemovedFromGameBox cards={[]} eliminatedPlayers={[eliminatedPlayer]} />
        </GameSettingsProvider>,
      );

      const heroStack = screen.getByTestId(`defeated-hero-stack-${eliminatedPlayer.id}`);
      fireEvent.click(heroStack);

      // Modal appears with player name / header
      expect(screen.getByTestId('removed-from-game-modal')).toBeDefined();
      expect(
        screen.getAllByText(new RegExp(eliminatedPlayer.name, 'i')).length,
      ).toBeGreaterThanOrEqual(1);

      // Shows defeated hero's deck cards
      expect(
        screen.getByText(new RegExp(`Deck \\(${eliminatedPlayer.deck.length} Cards\\)`, 'i')),
      ).toBeDefined();
    });

    it('renders defeated hero in GameBoard when a player is eliminated', () => {
      const state = createEliminatedState();

      render(
        <GameSettingsProvider>
          <TestSession state={state}>
            <GameBoard onReset={vi.fn()} />
          </TestSession>
        </GameSettingsProvider>,
      );

      const heroStack = screen.getByTestId(`defeated-hero-stack-p1`);
      expect(heroStack).toBeDefined();
      expect(heroStack.textContent).toContain('DEFEATED');
    });
  });
});
