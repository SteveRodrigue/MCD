import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import {
  GameState,
  HeroCard,
  AlterEgoCard,
  VillainCard,
  MainSchemeCard,
} from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import {
  drawEncounterCard,
  exhaustPlayerDeck,
  exhaustEncounterDeck,
  discardFromEncounterDeckUntil,
  discardFromPlayerDeckUntil,
} from '@engine/pipeline';
import { executeEffect } from '@engine/effects';

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

  describe('Mid-Action Player Deck Exhaustion & Reshuffle (RR v1.8 p. 18)', () => {
    it('mid-action draw reshuffles player discard and unconditionally deals 1 facedown encounter card', () => {
      const player = state.players[0];
      const cardA = createCardInstance(cardCatalog.getCard('01005')!);
      const discard1 = createCardInstance(cardCatalog.getCard('01006')!);
      const discard2 = createCardInstance(cardCatalog.getCard('01007')!);

      // Player has 1 card in deck and 2 in discard pile
      player.deck = [cardA];
      player.discard = [discard1, discard2];
      player.hand = [];
      player.dealtEncounterCards = [];

      // Draw 2 cards via executeEffect DRAW_CARDS
      const result = executeEffect(
        state,
        {
          effect: 'DRAW_CARDS',
          params: { count: 2 },
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

    it('unconditionally deals 1 facedown encounter card even if discard pile is empty upon exhaustion', () => {
      const player = state.players[0];
      player.deck = [];
      player.discard = [];
      player.dealtEncounterCards = [];

      // Direct exhaustion trigger
      exhaustPlayerDeck(state, 'p1');

      // Still deals 1 facedown encounter card penalty
      expect(player.dealtEncounterCards.length).toBe(1);
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

      exhaustEncounterDeck(state);

      expect(state.accelerationTokens).toBe(1);
      expect(state.encounterDeck.length).toBe(0);
    });
  });

  describe('Discard Loops ("Discard until [condition]") & Termination Invariant (RR v1.8 p. 11, 18, 26)', () => {
    it('stops discarding from encounter deck if target condition is found', () => {
      const chargeCard = createCardInstance(cardCatalog.getCard('01099')!); // Attachment
      const minionCard = createCardInstance(cardCatalog.getCard('01108')!); // Side Scheme or Minion

      state.encounterDeck = [chargeCard, minionCard];
      state.encounterDiscard = [];

      const result = discardFromEncounterDeckUntil(
        state,
        (c) => c.card.code === '01108',
      );

      expect(result.found).toBeDefined();
      expect(result.found?.card.code).toBe('01108');
      expect(result.discarded.length).toBe(2);
      expect(state.encounterDeck.length).toBe(0);
    });

    it('terminates loop with found: null if encounter deck runs out of cards without match', () => {
      const chargeCard1 = createCardInstance(cardCatalog.getCard('01099')!);
      const chargeCard2 = createCardInstance(cardCatalog.getCard('01099')!);

      // Only attachment cards in deck, no minions
      state.encounterDeck = [chargeCard1, chargeCard2];
      state.encounterDiscard = [];
      state.accelerationTokens = 0;

      const result = discardFromEncounterDeckUntil(
        state,
        (c) => c.card.type === 'minion',
      );

      // Loop terminated: target wasn't found
      expect(result.found).toBeNull();
      expect(result.discarded.length).toBe(2);
      // Sequential exhaustion was triggered (+1 acceleration token)
      expect(state.accelerationTokens).toBe(1);
    });

    it('terminates loop with found: null if player deck runs out of cards without match', () => {
      const player = state.players[0];
      const upgrade1 = createCardInstance(cardCatalog.getCard('01005')!);
      const upgrade2 = createCardInstance(cardCatalog.getCard('01005')!);

      player.deck = [upgrade1, upgrade2];
      player.discard = [];
      player.dealtEncounterCards = [];

      const result = discardFromPlayerDeckUntil(
        state,
        'p1',
        (c) => c.card.type === 'ally',
      );

      // Loop terminated: target wasn't found
      expect(result.found).toBeNull();
      expect(result.discarded.length).toBe(2);
      // Sequential exhaustion was triggered (1 facedown encounter card dealt)
      expect(player.dealtEncounterCards.length).toBe(1);
    });
  });
});
