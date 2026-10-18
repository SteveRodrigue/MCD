import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { getStarterDeck } from '../../src/engine/decks/starter-decks';
import { setupGame } from '../../src/engine/state/game-setup';
import { createCardInstance } from '../../src/engine/state/card-instance';
import { canPlayCard, evaluateCardPlayability } from '../../src/engine/pipeline/legality-checker';
import { resetInstanceCounter } from '../../src/engine';
import { CardInstance, GamePhase, GameState, getActiveMainScheme } from '@engine/models';

// The dispatcher (canPlayCard) and the hand, legal-action list and bot (evaluateCardPlayability)
// must agree on whether a card can be played when its cost can be paid (AUD-20261017-232534 F002).
const STARTER_DECKS = [
  'spider_man_justice',
  'captain_marvel_leadership',
  'she_hulk_aggression',
  'iron_man_aggression',
  'black_panther_protection',
];
// Energy, Genius, Strength: two of each pays any Core cost
const FILLER_CODES = ['01088', '01089', '01090', '01088', '01089', '01090'];

const newGame = (deckId: string): GameState => {
  const loaded = getStarterDeck(deckId)!.loadDeck(cardCatalog);
  const state = setupGame({
    scenarioId: 'rhino',
    skipMulligan: true,
    players: [
      {
        id: 'p1',
        name: loaded.hero.name,
        hero: loaded.hero,
        alterEgo: loaded.alterEgo,
        deckCards: loaded.deckCards,
      },
    ],
  });
  state.phase = GamePhase.PLAYER_PHASE;
  state.activePlayerIndex = 0;
  return state;
};

const setForm = (state: GameState, form: 'hero' | 'alter_ego') => {
  const player = state.players[0];
  player.currentForm = form;
  player.activeFormCard = form === 'hero' ? player.hero : player.alterEgo;
};

describe('card playability parity: canPlayCard vs evaluateCardPlayability', () => {
  beforeEach(() => resetInstanceCounter());

  describe.each(STARTER_DECKS)('%s starter deck', (deckId) => {
    it.each(['hero', 'alter_ego'] as const)('agrees on every deck card in %s form', (form) => {
      const loaded = getStarterDeck(deckId)!.loadDeck(cardCatalog);
      const codes = [...new Set(loaded.deckCards.map((c) => c.code))];
      const mismatches: string[] = [];

      for (const code of codes) {
        const state = newGame(deckId);
        setForm(state, form);
        const player = state.players[0];
        const card = createCardInstance(cardCatalog.getCard(code)!);
        const fillers = FILLER_CODES.map((c) => createCardInstance(cardCatalog.getCard(c)!));
        player.hand = [card, ...fillers];

        const engine = canPlayCard(
          state,
          'p1',
          card,
          fillers.map((f) => f.instanceId),
        );
        const view = evaluateCardPlayability(state, 'p1', card);
        if (engine.allowed !== view.isPlayable) {
          mismatches.push(
            `${code} ${card.card.name}: engine=${engine.allowed} (${engine.reason}) view=${view.isPlayable} (${view.reasons.join('; ')})`,
          );
        }
      }

      expect(mismatches).toEqual([]);
    });
  });

  it('an event whose extra hand-discard cost cannot be paid is unplayable in both', () => {
    const state = newGame('she_hulk_aggression');
    setForm(state, 'alter_ego');
    const player = state.players[0];
    // Legal Practice (01023): Alter-Ego Action, extra cost "discard up to 5 cards from your hand"
    const legalPractice: CardInstance = createCardInstance(cardCatalog.getCard('01023')!);
    player.hand = [legalPractice];
    getActiveMainScheme(state).threat = 3;
    player.activeCostReductions = [
      { id: 'free', amount: legalPractice.card.cost ?? 0, duration: 'TURN' } as never,
    ];
    player.costReductions = legalPractice.card.cost ?? 0;

    expect(canPlayCard(state, 'p1', legalPractice).reason).toBe(
      'No cards in hand to discard as cost.',
    );
    expect(evaluateCardPlayability(state, 'p1', legalPractice).reasons).toEqual([
      'No cards in hand to discard as cost.',
    ]);
  });
});
