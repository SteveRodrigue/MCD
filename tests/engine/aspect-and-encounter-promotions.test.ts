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
import { executeEffect } from '@engine/effects';
import { getEffectiveAllyStats } from '@engine/pipeline/stat-calculator';

describe('Sub-Milestone 2D-4: Aspect Cards & Encounter Promotion Pass (Inbox Zero)', () => {
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
          name: 'Player 1',
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
    state.players[0].currentForm = 'hero';
    state.players[0].activeFormCard = spiderManHero;
  });

  describe('Leadership: Vision (01068), Get Ready (01069), Lead from the Front (01070)', () => {
    it('Vision boosts ATK or THW by +2', () => {
      const player = state.players[0];
      const vision = createCardInstance(cardCatalog.getCard('01068')!);
      player.allies.push(vision);

      let stats = getEffectiveAllyStats(state, vision);
      expect(stats.attack).toBe(2);
      expect(stats.thwart).toBe(1);

      // Boost ATK by +2
      executeEffect(
        state,
        { effect: 'BOOST_STAT_CHOICE', params: { amount: 2, stat: 'ATK' } },
        { playerId: 'p1', sourceCardInstance: vision, choice: 'ATK' },
      );

      stats = getEffectiveAllyStats(state, vision);
      expect(stats.attack).toBe(4);
      expect(stats.thwart).toBe(1);
    });

    it('Get Ready readies an exhausted ally', () => {
      const player = state.players[0];
      const vision = createCardInstance(cardCatalog.getCard('01068')!);
      vision.exhausted = true;
      player.allies.push(vision);

      const result = executeEffect(
        state,
        { effect: 'READY_CHARACTER', params: { target: 'CHOSEN_ALLY' } },
        { playerId: 'p1', targetType: 'ally', targetInstanceId: vision.instanceId },
      );

      expect(result.success).toBe(true);
      expect(vision.exhausted).toBe(false);
    });

    it('Lead from the Front grants +1 ATK and +1 THW to all friendly characters', () => {
      const player = state.players[0];
      const ally1 = createCardInstance(cardCatalog.getCard('01068')!);
      player.allies.push(ally1);

      const result = executeEffect(
        state,
        { effect: 'BUFF_ALL_FRIENDLY_CHARACTERS', params: { atkBonus: 1, thwBonus: 1 } },
        { playerId: 'p1' },
      );

      expect(result.success).toBe(true);
      const stats = getEffectiveAllyStats(state, ally1);
      expect(stats.attack).toBe(3); // 2 + 1
      expect(stats.thwart).toBe(2); // 1 + 1
    });
  });

  describe('Justice & Basic: Black Widow (01075) and Tenacity (01093)', () => {
    it('Black Widow cancels treachery when revealed and reveals replacement encounter card', () => {
      const player = state.players[0];
      player.dealtEncounterCards = [];
      state.encounterDeck = [createCardInstance(cardCatalog.getCard('01094')!)];

      const result = executeEffect(
        state,
        { effect: 'CANCEL_WHEN_REVEALED_AND_REVEAL_ANOTHER' },
        { playerId: 'p1' },
      );

      expect(result.success).toBe(true);
      expect(player.dealtEncounterCards.length).toBe(1);
    });

    it('Tenacity readies your hero', () => {
      const player = state.players[0];
      player.exhausted = true;

      const result = executeEffect(
        state,
        { effect: 'READY_IDENTITY', params: { target: 'SELF' } },
        { playerId: 'p1' },
      );

      expect(result.success).toBe(true);
      expect(player.exhausted).toBe(false);
    });
  });

  describe('Encounter: Highway Robbery (01166)', () => {
    it('Attaches facedown card from each player hand and returns to owner on defeat', () => {
      const player = state.players[0];
      const cardA = createCardInstance(cardCatalog.getCard('01005')!);
      player.hand = [cardA];

      const schemeInstance = createCardInstance(cardCatalog.getCard('01166')!);

      // When Revealed
      executeEffect(
        state,
        { effect: 'ATTACH_FACEDOWN_CARDS_FROM_HAND' },
        { playerId: 'p1', sourceCardInstance: schemeInstance },
      );

      expect(player.hand.length).toBe(0);
      expect(schemeInstance.attachments?.length).toBe(1);

      // When Defeated
      executeEffect(
        state,
        { effect: 'RETURN_FACEDOWN_CARDS_TO_OWNERS' },
        { playerId: 'p1', sourceCardInstance: schemeInstance },
      );

      expect(player.hand.length).toBe(1);
      expect(player.hand[0].instanceId).toBe(cardA.instanceId);
      expect(schemeInstance.attachments?.length).toBe(0);
    });
  });
});
