import { describe, it, expect } from 'vitest';
import { setupGame } from '../../src/engine/state/game-setup';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { assertGameStateInvariants } from '../../src/engine/state/state-validator';
import { CardInstance } from '../../src/engine/models';

describe('assertGameStateInvariants', () => {
  const spiderMan = cardCatalog.getHeroIdentity('spider_man')!;
  const deckCards = Array(15).fill(cardCatalog.getCard('01005')!);

  function createBaseGame() {
    return setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: spiderMan.hero,
          alterEgo: spiderMan.alterEgo,
          deckCards,
        },
      ],
      skipMulligan: true,
      shuffleFn: (arr) => arr,
    });
  }

  it('passes on freshly initialized game state', () => {
    const state = createBaseGame();
    expect(() => assertGameStateInvariants(state)).not.toThrow();
  });

  describe('Card Conservation Law (ADR-0040)', () => {
    it('throws when the same card instance exists in multiple zones', () => {
      const state = createBaseGame();
      const duplicateCard = state.players[0].hand[0];
      state.encounterDiscard.push(duplicateCard);

      expect(() => assertGameStateInvariants(state)).toThrow(
        /exists in multiple zones simultaneously/,
      );
    });
  });

  describe('Non-Negative Value Invariants', () => {
    it('throws when an active player has negative health', () => {
      const state = createBaseGame();
      state.players[0].health = -1;

      expect(() => assertGameStateInvariants(state)).toThrow(
        /Active player 'p1' has negative health: -1/,
      );
    });

    it('throws when an active villain has negative health', () => {
      const state = createBaseGame();
      state.villain.health = -3;

      expect(() => assertGameStateInvariants(state)).toThrow(
        /Active villain .* has negative health: -3/,
      );
    });

    it('throws when main scheme threat is negative', () => {
      const state = createBaseGame();
      state.mainScheme.threat = -2;

      expect(() => assertGameStateInvariants(state)).toThrow(
        /Main scheme .* has negative threat: -2/,
      );
    });

    it('throws when a side scheme has negative threat', () => {
      const state = createBaseGame();
      const sideSchemeCard = cardCatalog.getCard('01107')!; // Armored Rhino Suit or other side scheme
      state.sideSchemes = [
        {
          instanceId: 'scheme_1',
          card: sideSchemeCard as any,
          threat: -1,
        } as any,
      ];

      expect(() => assertGameStateInvariants(state)).toThrow(
        /Side scheme .* has negative threat: -1/,
      );
    });

    it('throws when a card has negative tokens', () => {
      const state = createBaseGame();
      const card = state.players[0].hand[0];
      card.tokens = { damage: -2 };

      expect(() => assertGameStateInvariants(state)).toThrow(/has negative token 'damage': -2/);
    });

    it('throws when a card has negative counters', () => {
      const state = createBaseGame();
      const card = state.players[0].hand[0];
      card.counters = { all_purpose: -1 };

      expect(() => assertGameStateInvariants(state)).toThrow(
        /has negative counter 'all_purpose': -1/,
      );
    });
  });

  describe('Attachment & Host Integrity', () => {
    it('throws when an attachment references an inactive or missing host', () => {
      const state = createBaseGame();
      const attCard = cardCatalog.getCard('01100')!; // Charge
      const attInstance: CardInstance = {
        instanceId: 'att_orphan_1',
        card: attCard,
        tokens: {},
      };
      (attInstance as any).hostInstanceId = 'missing_minion_id';
      state.villain.attachments = [attInstance];

      expect(() => assertGameStateInvariants(state)).toThrow(
        /Attachment '.*' on villain .* references missing host 'missing_minion_id'/,
      );
    });

    it('throws when a card in a non-play zone (discard) holds attachments', () => {
      const state = createBaseGame();
      const discardedCard = state.players[0].discard[0] || state.players[0].hand.pop()!;
      state.players[0].discard.push(discardedCard);
      discardedCard.attachments = [
        {
          instanceId: 'att_ghost_1',
          card: cardCatalog.getCard('01100')!,
          tokens: {},
        },
      ];

      expect(() => assertGameStateInvariants(state)).toThrow(
        /has 1 attachment\(s\)\. Attachments cannot exist on cards out of play/,
      );
    });
  });

  describe('Valid Win/Loss State', () => {
    it('throws when HEROES win is declared while villain still has health > 0', () => {
      const state = createBaseGame();
      state.winner = 'HEROES';
      state.villain.health = 10;

      expect(() => assertGameStateInvariants(state)).toThrow(
        /Game marked as won by HEROES, but villain has health > 0/,
      );
    });

    it('passes when HEROES win is declared and villain health is 0', () => {
      const state = createBaseGame();
      state.winner = 'HEROES';
      state.villain.health = 0;

      expect(() => assertGameStateInvariants(state)).not.toThrow();
    });

    it('throws when VILLAIN win is declared without main scheme completion or hero elimination', () => {
      const state = createBaseGame();
      state.winner = 'VILLAIN';
      state.mainScheme.threat = 2; // target is 7
      state.players[0].health = 10;

      expect(() => assertGameStateInvariants(state)).toThrow(
        /Game marked as won by VILLAIN, but neither main scheme reached target threat nor were all heroes eliminated/,
      );
    });

    it('passes when VILLAIN win is declared after all heroes eliminated', () => {
      const state = createBaseGame();
      state.winner = 'VILLAIN';
      state.players = [];

      expect(() => assertGameStateInvariants(state)).not.toThrow();
    });

    it('passes when VILLAIN win is declared after main scheme reached target threat', () => {
      const state = createBaseGame();
      state.winner = 'VILLAIN';
      state.mainScheme.threat = state.mainScheme.targetThreat;

      expect(() => assertGameStateInvariants(state)).not.toThrow();
    });
  });
});
