import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard, getActiveMainScheme } from '@engine/models';
import { setupGame, resetInstanceCounter, createCardInstance } from '@engine/state/game-setup';
import { chooseBotAction } from '@engine/simulation/player-bot';
import { exhaustPlayerDeck, drawPlayerCard } from '@engine/pipeline/deck-exhaustion';

describe('Deterministic Simulation from Seed (Issue #252)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(1700000000000));
    resetInstanceCounter();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function createTestGame(seed?: number | string): GameState {
    resetInstanceCounter();
    return setupGame({
      catalog: cardCatalog,
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: cardCatalog.getCard('01001a') as HeroCard,
          alterEgo: cardCatalog.getCard('01001b') as AlterEgoCard,
          deckCards: [
            cardCatalog.getCard('01005')!,
            cardCatalog.getCard('01006')!,
            cardCatalog.getCard('01007')!,
            cardCatalog.getCard('01008')!,
            cardCatalog.getCard('01009')!,
            cardCatalog.getCard('01088')!,
            cardCatalog.getCard('01089')!,
            cardCatalog.getCard('01090')!,
            cardCatalog.getCard('01091')!,
            cardCatalog.getCard('01092')!,
          ],
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
      seed,
    });
  }

  it('runs an entire seeded game setup with ZERO calls to Math.random', () => {
    const mathRandomSpy = vi.spyOn(Math, 'random');
    try {
      const state = createTestGame(98765);
      expect(mathRandomSpy).not.toHaveBeenCalled();
      expect(state.rng?.seed).toBe(98765);
    } finally {
      mathRandomSpy.mockRestore();
    }
  });

  it('identical numeric seeds yield 100% byte-for-byte identical GameState serialization', () => {
    const game1 = createTestGame(424242);
    const game2 = createTestGame(424242);

    expect(JSON.stringify(game1)).toBe(JSON.stringify(game2));
  });

  it('identical string seeds yield 100% byte-for-byte identical GameState serialization', () => {
    const game1 = createTestGame('rhino-spider-match-1');
    const game2 = createTestGame('rhino-spider-match-1');

    expect(JSON.stringify(game1)).toBe(JSON.stringify(game2));
  });

  it('different seeds yield different deck shuffles and states', () => {
    const gameA = createTestGame(11111);
    const gameB = createTestGame(22222);

    const deckA = gameA.players[0].deck.map((c) => c.card.code);
    const deckB = gameB.players[0].deck.map((c) => c.card.code);

    expect(deckA).not.toEqual(deckB);
  });

  it('deck exhaustion reshuffle is byte-reproducible across identical seeds', () => {
    const game1 = createTestGame(777);
    const game2 = createTestGame(777);

    // Drain both decks to discard
    for (const g of [game1, game2]) {
      const p = g.players[0];
      p.discard = [...p.deck];
      p.deck = [];
    }

    exhaustPlayerDeck(game1, 'p1');
    exhaustPlayerDeck(game2, 'p1');

    expect(game1.players[0].deck.map((c) => c.card.code)).toEqual(
      game2.players[0].deck.map((c) => c.card.code),
    );
    expect(JSON.stringify(game1)).toBe(JSON.stringify(game2));
  });

  it('drawPlayerCard sequence maintains zero Math.random calls', () => {
    const mathRandomSpy = vi.spyOn(Math, 'random');
    try {
      const state = createTestGame('draw-test-seed');
      for (let i = 0; i < 5; i++) {
        drawPlayerCard(state, 'p1');
      }
      expect(mathRandomSpy).not.toHaveBeenCalled();
    } finally {
      mathRandomSpy.mockRestore();
    }
  });

  it('bot never chooses ALLY_THWART for a dash-THW ally (Issue #316)', () => {
    const state = createTestGame(7);
    const p = state.players[0];
    p.currentForm = 'hero';
    p.activeFormCard = p.hero;
    p.hand = [];
    p.exhausted = true;
    p.allies = [createCardInstance(cardCatalog.getCard('01050')!)];
    getActiveMainScheme(state).threat = 6;

    const action = chooseBotAction({ state, playerId: 'p1' });
    expect(action.type).not.toBe('ALLY_THWART');
  });
});
