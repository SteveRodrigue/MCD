import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard } from '../../src/engine/models';
import { setupGame } from '../../src/engine/state/game-setup';
import {
  getEffectiveHandSize,
  getEffectiveMaxHealth,
  getEffectiveHeroStats,
  getEffectiveAllyStats,
} from '../../src/engine/pipeline/stat-calculator';
import { evaluateCardPlayability, canPlayCard } from '../../src/engine/pipeline/legality-checker';
import { executePlayerCleanup } from '../../src/engine/pipeline/player-phase-cleanup';

describe('Milestone 2A.2: Unified Dynamic Stat & Aura Calculator', () => {
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
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });
  });

  describe('01029a Iron Man (Hand Size scaling with Tech upgrades)', () => {
    it('calculates Alter-Ego hand size as base 6', () => {
      const p1 = state.players[0];
      p1.currentForm = 'alter_ego';
      p1.activeFormCard = tonyStarkAlterEgo;

      expect(getEffectiveHandSize(p1, state)).toBe(6);
    });

    it('calculates Hero hand size as base 1 with 0 Tech upgrades', () => {
      const p1 = state.players[0];
      p1.currentForm = 'hero';
      p1.activeFormCard = ironManHero;
      p1.tableau = [];

      expect(getEffectiveHandSize(p1, state)).toBe(1);
    });

    it('increases Hero hand size dynamically with each in-play Tech upgrade', () => {
      const p1 = state.players[0];
      p1.currentForm = 'hero';
      p1.activeFormCard = ironManHero;

      const arcReactor = cardCatalog.getCard('01035')!; // Tech
      const markVArmor = cardCatalog.getCard('01036')!; // Tech
      const rocketBoots = cardCatalog.getCard('01039')!; // Tech

      // Add 1 Tech upgrade
      p1.tableau.push({ instanceId: 'u1', card: arcReactor, exhausted: false });
      expect(getEffectiveHandSize(p1, state)).toBe(2);

      // Add 2nd Tech upgrade
      p1.tableau.push({ instanceId: 'u2', card: markVArmor, exhausted: false });
      expect(getEffectiveHandSize(p1, state)).toBe(3);

      // Add 3rd Tech upgrade
      p1.tableau.push({ instanceId: 'u3', card: rocketBoots, exhausted: false });
      expect(getEffectiveHandSize(p1, state)).toBe(4);
    });

    it('Player phase clean-up draws up to dynamic effective hand size', () => {
      const p1 = state.players[0];
      p1.currentForm = 'hero';
      p1.activeFormCard = ironManHero;
      p1.hand = []; // empty hand

      // Add 2 Tech upgrades -> Hand size = 3
      p1.tableau.push({ instanceId: 'u1', card: cardCatalog.getCard('01035')!, exhausted: false });
      p1.tableau.push({ instanceId: 'u2', card: cardCatalog.getCard('01036')!, exhausted: false });

      const afterCleanup = executePlayerCleanup(state, p1.id, []);
      expect(afterCleanup.players[0].hand).toHaveLength(3);
    });
  });

  describe('Max Health Modifiers (Mark V Armor & Rocket Boots)', () => {
    it('increases player max health with Mark V Armor (+6) and Rocket Boots (+1)', () => {
      const p1 = state.players[0];
      p1.currentForm = 'hero';
      p1.activeFormCard = ironManHero;
      p1.tableau = [];

      // Base HP = 9
      expect(getEffectiveMaxHealth(p1, state)).toBe(9);

      // Add Mark V Armor (+6)
      p1.tableau.push({ instanceId: 'u1', card: cardCatalog.getCard('01036')!, exhausted: false });
      expect(getEffectiveMaxHealth(p1, state)).toBe(15);

      // Add Rocket Boots (+1)
      p1.tableau.push({ instanceId: 'u2', card: cardCatalog.getCard('01039')!, exhausted: false });
      expect(getEffectiveMaxHealth(p1, state)).toBe(16);
    });
  });

  describe('Hero Combat Stat Upgrades (Combat Training & Heroic Intuition)', () => {
    it('calculates dynamic ATK and THW bonuses from upgrades in tableau', () => {
      const p1 = state.players[0];
      p1.currentForm = 'hero';
      p1.activeFormCard = ironManHero; // Base ATK: 1, THW: 2, DEF: 1

      const baseStats = getEffectiveHeroStats(state, p1);
      expect(baseStats.attack).toBe(1);
      expect(baseStats.thwart).toBe(2);
      expect(baseStats.defense).toBe(1);

      // Add Combat Training (+1 ATK)
      p1.tableau.push({ instanceId: 'ct', card: cardCatalog.getCard('01057')!, exhausted: false });
      // Add Heroic Intuition (+1 THW)
      p1.tableau.push({ instanceId: 'hi', card: cardCatalog.getCard('01065')!, exhausted: false });

      const upgradedStats = getEffectiveHeroStats(state, p1);
      expect(upgradedStats.attack).toBe(2);
      expect(upgradedStats.thwart).toBe(3);
      expect(upgradedStats.defense).toBe(1);
    });
  });

  describe('01059 Jessica Jones (Side Scheme Dynamic Scaling)', () => {
    it('dynamically calculates +1 THW per side scheme in play', () => {
      const jessicaCard = cardCatalog.getCard('01059')!;
      const jessicaInstance = {
        instanceId: 'jj',
        card: jessicaCard,
        exhausted: false,
      };

      state.sideSchemes = [];
      expect(getEffectiveAllyStats(state, jessicaInstance).thwart).toBe(1); // Base 1 + 0

      // Add 1 side scheme
      state.sideSchemes.push({
        instanceId: 'ss1',
        card: cardCatalog.getCard('01109')!, // Bomb Scare
        threat: 3,
      } as any);
      expect(getEffectiveAllyStats(state, jessicaInstance).thwart).toBe(2); // Base 1 + 1

      // Add 2nd side scheme
      state.sideSchemes.push({
        instanceId: 'ss2',
        card: cardCatalog.getCard('01107')!, // Breakin' & Takin'
        threat: 2,
      } as any);
      expect(getEffectiveAllyStats(state, jessicaInstance).thwart).toBe(3); // Base 1 + 2
    });
  });

  describe('Alter-Ego Form Upgrade Playability (RR v1.8 p. 16, 28)', () => {
    it('allows Tony Stark in Alter-Ego form to play Arc Reactor, Mark V Armor, and Rocket Boots', () => {
      const p1 = state.players[0];
      p1.currentForm = 'alter_ego';
      p1.activeFormCard = tonyStarkAlterEgo;

      const arcReactor = cardCatalog.getCard('01035')!;

      // Put Arc Reactor in hand with payment cards
      p1.hand = [
        { instanceId: 'arc_inst', card: arcReactor, exhausted: false },
        { instanceId: 'pay1', card: cardCatalog.getCard('01005')!, exhausted: false },
        { instanceId: 'pay2', card: cardCatalog.getCard('01005')!, exhausted: false },
      ];

      // Evaluate playability: should be playable in Alter-Ego!
      const status = evaluateCardPlayability(state, p1.id, p1.hand[0]);
      expect(status.isPlayable).toBe(true);
      expect(status.reasons).toEqual([]);

      const playRes = canPlayCard(state, p1.id, 'arc_inst', ['pay1', 'pay2']);
      expect(playRes.allowed).toBe(true);
    });
  });
});
