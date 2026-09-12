import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard } from '../../src/engine/models';
import { setupGame } from '../../src/engine/state/game-setup';
import {
  getEffectiveAllyLimit,
  getEffectiveHandSize,
  getEffectiveVillainStats,
} from '../../src/engine/pipeline/stat-calculator';

describe('UI Dynamic Board Stats Display Contract (Issue #103)', () => {
  let state: GameState;
  let ironManHero: HeroCard;
  let tonyStarkAlterEgo: AlterEgoCard;

  beforeEach(() => {
    ironManHero = cardCatalog.getCard('01029a') as HeroCard;
    tonyStarkAlterEgo = cardCatalog.getCard('01029b') as AlterEgoCard;

    state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Tony Stark',
          hero: ironManHero,
          alterEgo: tonyStarkAlterEgo,
          deckCards: Array(15).fill(cardCatalog.getCard('01005')!),
        },
        {
          id: 'p2',
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
  });

  describe('HeroZone: Dynamic Ally Limit Display (Issue #103)', () => {
    it('returns default ally limit of 3 when no modifiers are in play', () => {
      const p1 = state.players[0];
      const limit = getEffectiveAllyLimit(p1, state);
      expect(limit).toBe(3);
    });

    it('returns ally limit of 4 when The Triskelion (01073) is in player tableau', () => {
      const p1 = state.players[0];
      const triskelionCard = cardCatalog.getCard('01073')!;
      expect(triskelionCard).toBeDefined();

      p1.tableau.push({
        instanceId: 'triskelion_inst',
        card: triskelionCard,
        exhausted: false,
      });

      const limit = getEffectiveAllyLimit(p1, state);
      expect(limit).toBe(4);
    });

    it('isolates ally limit bonus to controller unless targeted to ALL_PLAYERS', () => {
      const p1 = state.players[0];
      const p2 = state.players[1];
      const triskelionCard = cardCatalog.getCard('01073')!;

      // P1 controls The Triskelion
      p1.tableau.push({
        instanceId: 'triskelion_inst',
        card: triskelionCard,
        exhausted: false,
      });

      // P1 has 4, P2 still has base 3
      expect(getEffectiveAllyLimit(p1, state)).toBe(4);
      expect(getEffectiveAllyLimit(p2, state)).toBe(3);
    });

    it('evaluates player tableau even when gameState is not provided', () => {
      const p1 = state.players[0];
      const triskelionCard = cardCatalog.getCard('01073')!;

      p1.tableau.push({
        instanceId: 'triskelion_inst',
        card: triskelionCard,
        exhausted: false,
      });

      // Fallback without state
      expect(getEffectiveAllyLimit(p1)).toBe(4);
    });
  });

  describe('GameBoard -> PlayerHandTray: Dynamic Hand Size Contract', () => {
    it('evaluates effective hand size for PlayerHandTray limit (e.g. Iron Man Tech scaling)', () => {
      const p1 = state.players[0];
      p1.currentForm = 'hero';
      p1.activeFormCard = ironManHero;
      p1.tableau = [];

      // Base hero hand size is 1
      expect(getEffectiveHandSize(p1, state)).toBe(1);

      // Add 3 Tech upgrades: Arc Reactor (01035), Mark V Armor (01036), Rocket Boots (01039)
      p1.tableau.push(
        { instanceId: 'tech1', card: cardCatalog.getCard('01035')!, exhausted: false },
        { instanceId: 'tech2', card: cardCatalog.getCard('01036')!, exhausted: false },
        { instanceId: 'tech3', card: cardCatalog.getCard('01039')!, exhausted: false },
      );

      // Effective hand size should now be 1 + 3 = 4
      const dynamicHandSize = getEffectiveHandSize(p1, state);
      expect(dynamicHandSize).toBe(4);
    });
  });

  describe('VillainZone: Dynamic Villain ATK & SCH with Attachments', () => {
    it('calculates effective ATK when villain has Enhanced Ivory Horn (01100)', () => {
      const villain = state.villain;
      const baseAtk = villain.card.attack || 2;
      const baseSch = villain.card.scheme || 1;

      // Unbuffed
      const initialStats = getEffectiveVillainStats(state, villain);
      expect(initialStats.attack).toBe(baseAtk);
      expect(initialStats.scheme).toBe(baseSch);

      // Attach Enhanced Ivory Horn (01100: +1 ATK)
      const hornCard = cardCatalog.getCard('01100')!;
      villain.attachments = [
        {
          instanceId: 'horn_inst',
          card: hornCard,
          exhausted: false,
        },
      ];

      const buffedStats = getEffectiveVillainStats(state, villain);
      expect(buffedStats.attack).toBe(baseAtk + 1);
    });
  });
});
