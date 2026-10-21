import { describe, it, expect, beforeEach } from 'vitest';
import { overrideCard } from '../support/card-overrides';
import { cardCatalog } from '../../src/data/importer/card-loader';
import {
  GameState,
  HeroCard,
  AlterEgoCard,
  VillainCard,
  MainSchemeCard,
  getActiveVillain,
} from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import {
  drawEncounterCard,
  exhaustPlayerDeck,
  exhaustEncounterDeck,
  discardFromEncounterDeckUntil,
  discardFromPlayerDeckUntil,
  drawPlayerCard,
} from '@engine/pipeline';
import { executeEffect, discardCardInstance } from '@engine/effects';

describe('Sub-Milestone 2D-2: Deck Exhaustion Invariants, Search Failures & Discard Loops (RR v1.8 p. 11, 18, 26)', () => {
  let state: GameState;
  let spiderManHero: HeroCard;
  let peterParkerAlterEgo: AlterEgoCard;
  let rhinoVillain: VillainCard;
  let mainScheme: MainSchemeCard;

  beforeEach(() => {
    spiderManHero = cardCatalog.getCard('01001a') as HeroCard;
    peterParkerAlterEgo = cardCatalog.getCard('01001b') as AlterEgoCard;
    rhinoVillain = cardCatalog.getCard('01094') as VillainCard;
    mainScheme = cardCatalog.getCard('01097b') as MainSchemeCard;

    state = setupGame({
      catalog: cardCatalog,
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: rhinoVillain,
      mainScheme,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });
  });

  describe('Immediate Player Deck Reset Invariants (Issue #273, RR v1.8 p. 18)', () => {
    it('1. Immediate reset on draw: drawing final card immediately resets player deck from discard', () => {
      const player = state.players[0];
      const cardA = createCardInstance(cardCatalog.getCard('01005')!);
      const discard1 = createCardInstance(cardCatalog.getCard('01006')!);
      const discard2 = createCardInstance(cardCatalog.getCard('01007')!);

      player.deck = [cardA];
      player.discard = [discard1, discard2];
      player.hand = [];
      player.dealtEncounterCards = [];

      const drawn = drawPlayerCard(state, 'p1');

      expect(drawn?.instanceId).toBe(cardA.instanceId);
      // Immediately reset: discard pile of 2 cards shuffled into new deck
      expect(player.deck.length).toBe(2);
      expect(player.discard.length).toBe(0);
      expect(player.dealtEncounterCards.length).toBe(1);
    });

    it('2. Multi-card draw across reset boundary: draws exact requested count and deals exactly 1 penalty card', () => {
      const player = state.players[0];
      const deck1 = createCardInstance(cardCatalog.getCard('01005')!);
      const deck2 = createCardInstance(cardCatalog.getCard('01005')!);
      const disc1 = createCardInstance(cardCatalog.getCard('01006')!);
      const disc2 = createCardInstance(cardCatalog.getCard('01006')!);
      const disc3 = createCardInstance(cardCatalog.getCard('01006')!);

      player.deck = [deck1, deck2];
      player.discard = [disc1, disc2, disc3];
      player.hand = [];
      player.dealtEncounterCards = [];

      const result = executeEffect(
        state,
        {
          effect: 'DRAW',
          effectParams: { count: 4 },
        },
        { playerId: 'p1' },
      );

      expect(result.success).toBe(true);
      expect(player.hand.length).toBe(4);
      expect(player.deck.length).toBe(1);
      expect(player.discard.length).toBe(0);
      expect(player.dealtEncounterCards.length).toBe(1);
    });

    it('3. Empty discard on deck exhaustion: no reset happens and no encounter card is dealt', () => {
      const player = state.players[0];
      const cardA = createCardInstance(cardCatalog.getCard('01005')!);

      player.deck = [cardA];
      player.discard = [];
      player.hand = [];
      player.dealtEncounterCards = [];

      const drawn = drawPlayerCard(state, 'p1');

      expect(drawn?.instanceId).toBe(cardA.instanceId);
      expect(player.deck.length).toBe(0);
      expect(player.discard.length).toBe(0);
      expect(player.dealtEncounterCards.length).toBe(0);
    });

    it('4. Deferred reset when first card enters discard after deck emptied with empty discard', () => {
      const player = state.players[0];
      const cardA = createCardInstance(cardCatalog.getCard('01005')!);
      const cardToDiscard = createCardInstance(cardCatalog.getCard('01006')!);

      player.deck = [cardA];
      player.discard = [];
      player.hand = [cardToDiscard];
      player.dealtEncounterCards = [];

      // Draw last card: deck empties, discard is empty, no reset yet
      drawPlayerCard(state, 'p1');
      expect(player.deck.length).toBe(0);
      expect(player.dealtEncounterCards.length).toBe(0);

      // Now a card enters discard pile
      discardCardInstance(state, cardToDiscard, player.id);

      // Deferred reset triggered: deck reshuffled from discard, 1 encounter card dealt
      expect(player.deck.length).toBe(1);
      expect(player.discard.length).toBe(0);
      expect(player.dealtEncounterCards.length).toBe(1);
    });

    it('5. Exact-N player deck discard stops and resets', () => {
      const player = state.players[0];
      const deck1 = createCardInstance(cardCatalog.getCard('01005')!);
      const deck2 = createCardInstance(cardCatalog.getCard('01005')!);
      const disc1 = createCardInstance(cardCatalog.getCard('01006')!);

      player.deck = [deck1, deck2];
      player.discard = [disc1];
      player.dealtEncounterCards = [];

      const res = executeEffect(
        state,
        {
          effect: 'DISCARD',
          effectParams: { source: 'DECK', count: 2 },
        },
        { playerId: 'p1' },
      );

      expect(res.success).toBe(true);
      expect(res.value).toBe(2);
      // Both discarded cards + initial discard card = 3 cards reshuffled into new deck
      expect(player.deck.length).toBe(3);
      expect(player.discard.length).toBe(0);
      expect(player.dealtEncounterCards.length).toBe(1);
    });

    it('6. Under-N player deck discard stops and resets without continuing into new deck', () => {
      const player = state.players[0];
      const deck1 = createCardInstance(cardCatalog.getCard('01005')!);
      const deck2 = createCardInstance(cardCatalog.getCard('01005')!);
      const disc1 = createCardInstance(cardCatalog.getCard('01006')!);

      player.deck = [deck1, deck2];
      player.discard = [disc1];
      player.dealtEncounterCards = [];

      const res = executeEffect(
        state,
        {
          effect: 'DISCARD',
          effectParams: { source: 'DECK', count: 5 },
        },
        { playerId: 'p1' },
      );

      expect(res.success).toBe(true);
      // Discarded only 2 cards because deck emptied
      expect(res.value).toBe(2);
      // 3 cards reshuffled into new deck, no further cards discarded from new deck
      expect(player.deck.length).toBe(3);
      expect(player.discard.length).toBe(0);
      expect(player.dealtEncounterCards.length).toBe(1);
    });

    it('7. Exact-N encounter deck discard stops and resets without continuing into new deck', () => {
      const enc1 = createCardInstance(cardCatalog.getCard('01098')!);
      const enc2 = createCardInstance(cardCatalog.getCard('01099')!);
      const disc1 = createCardInstance(cardCatalog.getCard('01098')!);
      const disc2 = createCardInstance(cardCatalog.getCard('01099')!);
      const disc3 = createCardInstance(cardCatalog.getCard('01098')!);

      state.encounterDeck = [enc1, enc2];
      state.encounterDiscard = [disc1, disc2, disc3];
      state.accelerationTokens = 0;

      const res = executeEffect(
        state,
        {
          effect: 'DISCARD',
          effectParams: { source: 'ENCOUNTER_DECK', count: 2 },
        },
        { playerId: 'p1' },
      );

      expect(res.success).toBe(true);
      expect(res.value).toBe(2);
      expect(state.accelerationTokens).toBe(1);
      // 2 discarded + 3 in discard = 5 cards in new deck, 0 in discard
      expect(state.encounterDeck.length).toBe(5);
      expect(state.encounterDiscard.length).toBe(0);
    });

    it('8. Simultaneous empty encounter deck & discard places acceleration token without crash (RR v1.8 p. 11)', () => {
      state.encounterDeck = [];
      state.encounterDiscard = [];
      state.accelerationTokens = 0;

      const reset = exhaustEncounterDeck(state);

      expect(reset).toBe(false);
      expect(state.accelerationTokens).toBe(1);
      expect(state.encounterDeck.length).toBe(0);
    });
  });

  describe('Mid-Action Player Deck Exhaustion & Reshuffle (RR v1.8 p. 18)', () => {
    it('mid-action draw reshuffles player discard and deals 1 facedown encounter card', () => {
      const player = state.players[0];
      const cardA = createCardInstance(cardCatalog.getCard('01005')!);
      const discard1 = createCardInstance(cardCatalog.getCard('01006')!);
      const discard2 = createCardInstance(cardCatalog.getCard('01007')!);

      // Player has 1 card in deck and 2 in discard pile
      player.deck = [cardA];
      player.discard = [discard1, discard2];
      player.hand = [];
      player.dealtEncounterCards = [];

      // Draw 2 cards via executeEffect DRAW
      const result = executeEffect(
        state,
        {
          effect: 'DRAW',
          effectParams: { count: 2 },
        },
        { playerId: 'p1' },
      );

      expect(result.success).toBe(true);
      // Hand now has 2 cards (cardA and one from reshuffled discard)
      expect(player.hand.length).toBe(2);
      // Discard was reshuffled into deck (1 card left in deck)
      expect(player.deck.length).toBe(1);
      expect(player.discard.length).toBe(0);
      // 1 extra facedown encounter card dealt as penalty
      expect(player.dealtEncounterCards.length).toBe(1);
    });

    it('exhaustPlayerDeck does not reset deck or deal penalty card when discard pile is empty (RR v1.8)', () => {
      const player = state.players[0];
      player.deck = [];
      player.discard = [];
      player.dealtEncounterCards = [];

      // Direct exhaustion trigger
      const reset = exhaustPlayerDeck(state, 'p1');

      // Does not reset and does not deal encounter card
      expect(reset).toBe(false);
      expect(player.dealtEncounterCards.length).toBe(0);
      // Deck remains safely empty without errors
      expect(player.deck.length).toBe(0);
    });
  });

  describe('Mid-Action Encounter Deck Exhaustion & Acceleration Token (RR v1.8 p. 11)', () => {
    it('mid-action encounter draw reshuffles encounter discard and places 1 permanent acceleration token', () => {
      const encounter1 = createCardInstance(cardCatalog.getCard('01098')!);
      const encounter2 = createCardInstance(cardCatalog.getCard('01099')!);

      state.encounterDeck = [];
      state.encounterDiscard = [encounter1, encounter2];
      state.accelerationTokens = 0;

      const drawn = drawEncounterCard(state);

      expect(drawn).toBeDefined();
      expect(state.accelerationTokens).toBe(1);
      expect(state.encounterDeck.length).toBe(1);
      expect(state.encounterDiscard.length).toBe(0);
    });

    it('unconditionally places 1 acceleration token even if encounter discard is empty upon exhaustion', () => {
      state.encounterDeck = [];
      state.encounterDiscard = [];
      state.accelerationTokens = 0;

      const reset = exhaustEncounterDeck(state);

      expect(reset).toBe(false);
      expect(state.accelerationTokens).toBe(1);
      expect(state.encounterDeck.length).toBe(0);
    });
  });

  describe('Discard Loops ("Discard until [condition]") & Termination Invariant (RR v1.8 p. 11, 18, 26)', () => {
    it('stops discarding from encounter deck if target condition is found', () => {
      const chargeCard = createCardInstance(cardCatalog.getCard('01099')!); // Attachment
      const minionCard = createCardInstance(cardCatalog.getCard('01108')!); // Side Scheme or Minion
      const extraCard = createCardInstance(cardCatalog.getCard('01099')!);

      state.encounterDeck = [chargeCard, minionCard, extraCard];
      state.encounterDiscard = [];

      const result = discardFromEncounterDeckUntil(state, (c) => c.card.code === '01108');

      expect(result.found).toBeDefined();
      expect(result.found?.card.code).toBe('01108');
      expect(result.discarded.length).toBe(2);
      expect(state.encounterDeck.length).toBe(1);
    });

    it('terminates loop with found: null if encounter deck runs out of cards without match', () => {
      const chargeCard1 = createCardInstance(cardCatalog.getCard('01099')!);
      const chargeCard2 = createCardInstance(cardCatalog.getCard('01099')!);

      // Only attachment cards in deck, no minions
      state.encounterDeck = [chargeCard1, chargeCard2];
      state.encounterDiscard = [];
      state.accelerationTokens = 0;

      const result = discardFromEncounterDeckUntil(state, (c) => c.card.type === 'minion');

      // Loop terminated: target wasn't found
      expect(result.found).toBeNull();
      expect(result.discarded.length).toBe(2);
      // Sequential exhaustion was triggered (+1 acceleration token)
      expect(state.accelerationTokens).toBe(1);
    });

    it('puts each non-matching discarded card into the encounter discard pile, not the match', () => {
      const charge = createCardInstance(cardCatalog.getCard('01099')!);
      const side = createCardInstance(cardCatalog.getCard('01108')!);
      const rest = createCardInstance(cardCatalog.getCard('01099')!);

      state.encounterDeck = [charge, side, rest];
      state.encounterDiscard = [];

      const result = discardFromEncounterDeckUntil(state, (c) => c.card.code === '01108');

      expect(result.found?.instanceId).toBe(side.instanceId);
      expect(state.encounterDiscard.map((c) => c.instanceId)).toEqual([charge.instanceId]);
      expect(state.encounterDeck.map((c) => c.instanceId)).toEqual([rest.instanceId]);
    });

    it('on an empty deck the discarded cards are part of the reshuffled deck', () => {
      const a = createCardInstance(cardCatalog.getCard('01099')!);
      const b = createCardInstance(cardCatalog.getCard('01099')!);
      const earlier = createCardInstance(cardCatalog.getCard('01099')!);

      state.encounterDeck = [a, b];
      state.encounterDiscard = [earlier];
      state.accelerationTokens = 0;

      const result = discardFromEncounterDeckUntil(state, (c) => c.card.type === 'minion');

      expect(result.found).toBeNull();
      expect(state.accelerationTokens).toBe(1);
      expect(state.encounterDeck.map((c) => c.instanceId).sort()).toEqual(
        [a.instanceId, b.instanceId, earlier.instanceId].sort(),
      );
      expect(state.encounterDiscard).toHaveLength(0);
    });

    it('terminates loop with found: null if player deck runs out of cards without match', () => {
      const player = state.players[0];
      const upgrade1 = createCardInstance(cardCatalog.getCard('01005')!);
      const upgrade2 = createCardInstance(cardCatalog.getCard('01005')!);

      player.deck = [upgrade1, upgrade2];
      player.discard = [];
      player.dealtEncounterCards = [];

      const result = discardFromPlayerDeckUntil(state, 'p1', (c) => c.card.type === 'ally');

      // Loop terminated: target wasn't found
      expect(result.found).toBeNull();
      expect(result.discarded.length).toBe(2);
      // Sequential exhaustion was triggered (1 facedown encounter card dealt)
      expect(player.dealtEncounterCards.length).toBe(1);
    });
  });

  describe('Mid-Action Card Effect Invariants (RR v1.8 p. 11, 18)', () => {
    it('mid-action Repulsor Blast exhausts deck, reshuffles discard, deals penalty encounter card, and stops discarding from new deck', () => {
      const player = state.players[0];
      const energyCard1 = createCardInstance(cardCatalog.getCard('01088')!); // Energy (2 energy)
      const energyCard2 = createCardInstance(cardCatalog.getCard('01088')!);
      const energyCard3 = createCardInstance(cardCatalog.getCard('01088')!);

      // Player has 2 cards in deck, 1 in discard
      player.deck = [energyCard1, energyCard2];
      player.discard = [energyCard3];
      player.dealtEncounterCards = [];
      getActiveVillain(state).health = 20;

      // Execute DISCARD (requests 3 cards from deck across deck boundary)
      const res = executeEffect(
        state,
        {
          effect: 'DISCARD',
          effectParams: { source: 'DECK', count: 3 },
        },
        { playerId: 'p1' },
      );

      expect(res.success).toBe(true);
      // Penalty encounter card was dealt due to deck exhaustion
      expect(player.dealtEncounterCards.length).toBe(1);
      // 2 cards discarded from initial deck. The 2 discarded cards + 1 initial discard = 3 cards reshuffled into new deck
      expect(player.deck.length).toBe(3);
      expect(player.discard.length).toBe(0);
      expect(res.value).toBe(2);
    });

    it('mid-action Black Cat DISCARD reshuffles and deals penalty when deck runs dry, without discarding from the new deck', () => {
      const player = state.players[0];
      const mentalCard1 = createCardInstance(cardCatalog.getCard('01089')!); // Genius (Mental)
      const mentalCard2 = createCardInstance(cardCatalog.getCard('01089')!);

      player.deck = [mentalCard1];
      player.discard = [mentalCard2];
      player.hand = [];
      player.dealtEncounterCards = [];

      const res = executeEffect(
        state,
        {
          effect: 'DISCARD',
          effectParams: {
            source: 'DECK',
            count: 2,
            filter: { resource: 'mental' },
            matchingDestination: 'HAND',
          },
        },
        { playerId: 'p1' },
      );

      expect(res.success).toBe(true);
      // RR v1.8 "Player Deck": no further card is discarded from the newly shuffled deck, so only
      // the card that was left in the deck reaches the hand; the old discard pile is the new deck.
      expect(player.hand.length).toBe(1);
      expect(player.deck.map((c) => c.instanceId)).toEqual([mentalCard2.instanceId]);
      expect(player.dealtEncounterCards.length).toBe(1);
    });

    it('mid-action Hulk DISCARD reshuffles and deals penalty when deck is empty', () => {
      const player = state.players[0];
      const physicalCard = createCardInstance(cardCatalog.getCard('01026')!);

      player.deck = [];
      player.discard = [physicalCard];
      player.dealtEncounterCards = [];
      getActiveVillain(state).health = 14;

      const res = executeEffect(
        state,
        {
          effect: 'DISCARD',
          effectParams: { source: 'DECK', count: 1 },
        },
        { playerId: 'p1' },
      );

      expect(res.success).toBe(true);
      expect(player.dealtEncounterCards.length).toBe(1);
      // The 1 discard was reshuffled into deck
      expect(player.deck.length).toBe(1);
      expect(player.discard.length).toBe(0);
    });

    it('mid-action DRAW with limit: HAND_SIZE reshuffles and deals penalty when drawing across deck boundary', () => {
      const player = state.players[0];
      const card1 = createCardInstance(cardCatalog.getCard('01005')!);
      const card2 = createCardInstance(cardCatalog.getCard('01006')!);
      const card3 = createCardInstance(cardCatalog.getCard('01007')!);

      player.deck = [card1];
      player.discard = [card2, card3];
      player.hand = [];
      player.dealtEncounterCards = [];
      // Mock Alter-Ego hand size to 3 for boundary test
      player.currentForm = 'alter_ego';
      overrideCard(state, player.alterEgo, { handSize: 3 });

      const res = executeEffect(
        state,
        {
          effect: 'DRAW',
          effectParams: { limit: 'HAND_SIZE' },
        },
        { playerId: 'p1' },
      );

      expect(res.success).toBe(true);
      expect(player.hand.length).toBe(3);
      expect(player.dealtEncounterCards.length).toBe(1);
    });
  });
});
