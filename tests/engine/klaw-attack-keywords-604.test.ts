import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import {
  GameState,
  HeroCard,
  AlterEgoCard,
  Keyword,
  StatusCard,
  VillainCard,
  MinionCard,
  getActiveVillain,
} from '../../src/engine/models';
import {
  setupGame,
  createCardInstance,
  resetInstanceCounter,
} from '../../src/engine/state/game-setup';
import { executeEnemyAttackSynchronously } from '../../src/engine/pipeline';
import { isVillainAttackBlockedByGuard } from '../../src/engine/pipeline/target-restrictions';

describe('Issue #604: Klaw attack-hook and keyword cards (01113, 01115, 01120)', () => {
  let state: GameState;
  let spiderManHero: HeroCard;
  let peterParkerAlterEgo: AlterEgoCard;

  beforeEach(() => {
    resetInstanceCounter();
    spiderManHero = cardCatalog.getCard('01001a') as HeroCard;
    peterParkerAlterEgo = cardCatalog.getCard('01001b') as AlterEgoCard;

    state = setupGame({
      catalog: cardCatalog,
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'p1',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as VillainCard,
      mainScheme: cardCatalog.getCard('01097b') as never,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });
    state.players[0].currentForm = 'hero';
    state.players[0].activeFormCard = spiderManHero;
    // Non-interrupt hand so Backflip does not intercept
    state.players[0].hand = [createCardInstance(cardCatalog.getCard('01005')!)];
    state.encounterDiscard = [];
  });

  describe('Scenario 1: Klaw I (01113) additional boost card on attack', () => {
    it('deals 2 boost cards (1 base + 1 additional) during an undefended attack', () => {
      const klawI = cardCatalog.getCard('01113') as VillainCard;
      expect(klawI).toBeDefined();
      expect(klawI.additionalBoostCards).toBe(1);

      const villain = getActiveVillain(state);
      villain.card = klawI;
      villain.health = klawI.health || 12;

      // Stack two 2-boost treachery cards on top of encounter deck
      const boost1 = cardCatalog.getCard('01103')!; // 2 boost icons
      const boost2 = cardCatalog.getCard('01103')!; // 2 boost icons
      state.encounterDeck = [
        createCardInstance(boost1),
        createCardInstance(boost2),
        ...state.encounterDeck,
      ];

      const initialHp = state.players[0].health;

      executeEnemyAttackSynchronously(state, { type: 'VILLAIN' }, 'p1', 'TAKE_UNDEFENDED');

      // Klaw I base ATK 0 + boost 2 + boost 2 = 4 total damage
      expect(state.players[0].health).toBe(initialHp - 4);
      // Both boost cards should be in encounter discard
      expect(state.encounterDiscard.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Scenario 2: Klaw III (01115) Toughness and additional boost card', () => {
    it('has Toughness keyword and deals 2 boost cards on attack', () => {
      const klawIII = cardCatalog.getCard('01115') as VillainCard;
      expect(klawIII).toBeDefined();
      expect(klawIII.keywords).toContain(Keyword.TOUGHNESS);
      expect(klawIII.additionalBoostCards).toBe(1);

      const villain = getActiveVillain(state);
      villain.card = klawIII;
      villain.health = klawIII.health || 22;

      // Stack two boost cards
      const boost1 = cardCatalog.getCard('01103')!; // 2 boost icons
      const boost2 = cardCatalog.getCard('01103')!; // 2 boost icons
      state.encounterDeck = [
        createCardInstance(boost1),
        createCardInstance(boost2),
        ...state.encounterDeck,
      ];

      const initialHp = state.players[0].health;

      executeEnemyAttackSynchronously(state, { type: 'VILLAIN' }, 'p1', 'TAKE_UNDEFENDED');

      // Klaw III base ATK 2 + boost 2 + boost 2 = 6 total damage
      expect(state.players[0].health).toBe(initialHp - 6);
    });
  });

  describe('Scenario 3: Armored Guard (01120) Guard and Toughness keywords', () => {
    it('has Guard and Toughness keywords and prevents attacking the villain while engaged', () => {
      const guardCard = cardCatalog.getCard('01120') as MinionCard;
      expect(guardCard).toBeDefined();
      expect(guardCard.keywords).toContain(Keyword.GUARD);
      expect(guardCard.keywords).toContain(Keyword.TOUGHNESS);

      const guardInstance = createCardInstance(guardCard);
      // Minion with Toughness enters play with a tough status card
      guardInstance.statusCards = [StatusCard.TOUGH];
      state.players[0].engagedMinions.push(guardInstance);

      // Player cannot attack villain while engaged with a minion with Guard
      expect(isVillainAttackBlockedByGuard(state.players[0])).toBe(true);
    });
  });
});
