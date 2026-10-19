import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import type { AlterEgoCard, CardInstance, GameState, HeroCard } from '../../src/engine/models';
import { setupGame } from '../../src/engine/state/game-setup';
import { createCardInstance } from '../../src/engine/state/card-instance';
import { routeCardInstances } from '../../src/engine/effects/card-routing';

/** Where `routeCardInstances` puts cards for each destination, per source zone (R6b, Task B). */

const card = (id: string, code = '01088'): CardInstance => ({
  ...createCardInstance(cardCatalog.getCard(code)!, 'p1'),
  instanceId: id,
});

function buildState(): GameState {
  return setupGame({
    scenarioId: 'rhino',
    players: [
      {
        id: 'p1',
        name: 'Player 1',
        hero: cardCatalog.getCard('01001a') as HeroCard,
        alterEgo: cardCatalog.getCard('01001b') as AlterEgoCard,
        deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
      },
    ],
    villain: cardCatalog.getCard('01094') as any,
    mainScheme: cardCatalog.getCard('01097b') as any,
    encounterCards: cardCatalog.getCardsBySet('rhino'),
    skipMulligan: true,
  });
}

const ids = (cards: CardInstance[]) => cards.map((c) => c.instanceId);

describe('routeCardInstances', () => {
  let state: GameState;
  let a: CardInstance;
  let b: CardInstance;

  beforeEach(() => {
    state = buildState();
    a = card('a');
    b = card('b');
    state.players[0].hand = [];
    state.players[0].discard = [];
    state.players[0].tableau = [];
    state.players[0].deck = [card('d1')];
    state.encounterDeck = [card('e1')];
    state.encounterDiscard = [];
  });

  const route = (destination: string | null, sourceZone: string) =>
    routeCardInstances(state, state.players[0], [a, b], destination, sourceZone);

  it('does nothing for an empty list', () => {
    routeCardInstances(state, state.players[0], [], 'HAND', 'PLAYER_DECK');
    expect(state.players[0].hand).toEqual([]);
  });

  describe('LEAVE_IN_PLACE returns cards to the zone they came from, in order', () => {
    it.each([
      ['PLAYER_DISCARD', () => ids(state.players[0].discard), ['a', 'b']],
      ['PLAYER_HAND', () => ids(state.players[0].hand), ['a', 'b']],
      ['ENCOUNTER_DISCARD', () => ids(state.encounterDiscard), ['a', 'b']],
      ['ENCOUNTER_DECK', () => ids(state.encounterDeck), ['a', 'b', 'e1']],
      ['PLAYER_DECK', () => ids(state.players[0].deck), ['a', 'b', 'd1']],
    ])('from %s', (zone, read, expected) => {
      route('LEAVE_IN_PLACE', zone as string);
      expect((read as () => string[])()).toEqual(expected);
    });

    it('treats a missing destination as LEAVE_IN_PLACE', () => {
      route(null, 'PLAYER_DISCARD');
      expect(ids(state.players[0].discard)).toEqual(['a', 'b']);
    });
  });

  it('HAND adds to the hand whatever the origin', () => {
    route('HAND', 'ENCOUNTER_DECK');
    expect(ids(state.players[0].hand)).toEqual(['a', 'b']);
  });

  it('TABLEAU puts non-scheme cards in the tableau', () => {
    route('TABLEAU', 'PLAYER_DECK');
    expect(ids(state.players[0].tableau)).toEqual(['a', 'b']);
  });

  describe('DISCARD', () => {
    it('goes to the player discard from a player zone', () => {
      route('DISCARD', 'PLAYER_DECK');
      expect(ids(state.players[0].discard)).toEqual(['a', 'b']);
    });
    it.each(['ENCOUNTER_DECK', 'ENCOUNTER_DISCARD'])(
      'goes to the encounter discard from %s',
      (zone) => {
        route('DISCARD', zone);
        expect(ids(state.encounterDiscard)).toEqual(['a', 'b']);
      },
    );
  });

  describe('deck destinations', () => {
    it('DECK_TOP / DECK_BOTTOM use the player deck from a player zone', () => {
      route('DECK_TOP', 'PLAYER_DISCARD');
      expect(ids(state.players[0].deck)).toEqual(['a', 'b', 'd1']);
      state.players[0].deck = [card('d1')];
      route('DECK_BOTTOM', 'PLAYER_DISCARD');
      expect(ids(state.players[0].deck)).toEqual(['d1', 'a', 'b']);
    });

    it('DECK_TOP / DECK_BOTTOM use the encounter deck from the encounter deck', () => {
      route('DECK_TOP', 'ENCOUNTER_DECK');
      expect(ids(state.encounterDeck)).toEqual(['a', 'b', 'e1']);
      state.encounterDeck = [card('e1')];
      route('DECK_BOTTOM', 'ENCOUNTER_DECK');
      expect(ids(state.encounterDeck)).toEqual(['e1', 'a', 'b']);
    });

    it('DECK_SHUFFLE adds the cards to the deck and shuffles it', () => {
      route('DECK_SHUFFLE', 'PLAYER_DECK');
      expect(ids(state.players[0].deck).sort()).toEqual(['a', 'b', 'd1']);
    });
  });
  describe('mixed origins and encounter cards', () => {
    it('sends a card from the encounter discard to the encounter deck for DECK_TOP', () => {
      route('DECK_TOP', 'ENCOUNTER_DISCARD');
      expect(ids(state.encounterDeck)).toEqual(['a', 'b', 'e1']);
      expect(ids(state.players[0].deck)).toEqual(['d1']);
    });

    it('treats a card printed as an encounter card as encounter whatever its zone', () => {
      const base = card('enc');
      const enc = { ...base, card: { ...base.card, faction: 'encounter' } } as CardInstance;
      routeCardInstances(state, state.players[0], [a, enc], 'DISCARD', 'PLAYER_DECK');
      expect(ids(state.players[0].discard)).toEqual(['a']);
      expect(ids(state.encounterDiscard)).toEqual(['enc']);
    });

    it('routes each card by its own origin when the origin is a lookup', () => {
      const origins: Record<string, string> = { a: 'PLAYER_DISCARD', b: 'ENCOUNTER_DISCARD' };
      routeCardInstances(
        state,
        state.players[0],
        [a, b],
        'LEAVE_IN_PLACE',
        (c) => origins[c.instanceId],
      );
      expect(ids(state.players[0].discard)).toEqual(['a']);
      expect(ids(state.encounterDiscard)).toEqual(['b']);
    });

    it('DECK_SHUFFLE shuffles both decks when cards come from both', () => {
      const origins: Record<string, string> = { a: 'PLAYER_DECK', b: 'ENCOUNTER_DECK' };
      routeCardInstances(
        state,
        state.players[0],
        [a, b],
        'DECK_SHUFFLE',
        (c) => origins[c.instanceId],
      );
      expect(ids(state.players[0].deck).sort()).toEqual(['a', 'd1']);
      expect(ids(state.encounterDeck).sort()).toEqual(['b', 'e1']);
    });

    it('ATTACH_TO_TARGET attaches to the villain by default', () => {
      routeCardInstances(state, state.players[0], [a], 'ATTACH_TO_TARGET', 'PLAYER_DECK');
      expect(ids(state.villain.attachments ?? [])).toEqual(['a']);
    });
  });
});
