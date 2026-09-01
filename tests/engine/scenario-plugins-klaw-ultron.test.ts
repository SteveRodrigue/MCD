import { describe, it, expect } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { HeroCard, AlterEgoCard, VillainCard, MainSchemeCard } from '@engine/models';
import { setupGame } from '@engine/state/game-setup';
import { ScenarioRegistry, KlawScenarioPlugin, UltronScenarioPlugin } from '@engine/scenarios';

describe('Milestone 2C: Klaw & Ultron Scenario Plugins (ADR-0033)', () => {
  const spiderManHero = cardCatalog.getCard('01001a') as HeroCard;
  const peterParkerAlterEgo = cardCatalog.getCard('01001b') as AlterEgoCard;

  describe('Klaw Scenario Plugin', () => {
    it('sets up Klaw Stage 1A with Defense Network side scheme and starting engaged minion', () => {
      const villainCard = cardCatalog.getCard('01113') as VillainCard;
      const mainSchemeCard = cardCatalog.getCard('01116b') as MainSchemeCard;

      const state = setupGame({
        scenarioId: 'klaw',
        difficulty: 'STANDARD',
        players: [
          {
            id: 'p1',
            name: 'Spider-Man',
            hero: spiderManHero,
            alterEgo: peterParkerAlterEgo,
            deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
          },
        ],
        villain: villainCard,
        mainScheme: mainSchemeCard,
        encounterCards: cardCatalog.getCardsBySet('klaw'),
        modularSetCodes: ['masters_of_evil'],
      });

      // Klaw Stage I initialized (12 HP)
      expect(state.villain.card.code).toBe('01113');
      expect(state.villain.health).toBe(12);

      // Defense Network (01124) side scheme put into play with 2 threat
      expect(state.sideSchemes.some((s) => s.card.code === '01124')).toBe(true);
      const defenseNetwork = state.sideSchemes.find((s) => s.card.code === '01124')!;
      expect(defenseNetwork.threat).toBe(2);

      // Starting minion engaged with Player 1
      expect(state.players[0].engagedMinions.length).toBeGreaterThan(0);
      expect(state.players[0].engagedMinions[0].card.type).toBe('minion');
    });

    it('advances Klaw from Stage I to Stage II and attaches Immortal Klaw with bonus HP', () => {
      const klawPlugin = ScenarioRegistry.get('klaw') as KlawScenarioPlugin;
      const villainCard = cardCatalog.getCard('01113') as VillainCard;
      const mainSchemeCard = cardCatalog.getCard('01116b') as MainSchemeCard;

      const state = setupGame({
        scenarioId: 'klaw',
        difficulty: 'STANDARD',
        players: [
          {
            id: 'p1',
            name: 'Spider-Man',
            hero: spiderManHero,
            alterEgo: peterParkerAlterEgo,
            deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
          },
        ],
        villain: villainCard,
        mainScheme: mainSchemeCard,
        encounterCards: cardCatalog.getCardsBySet('klaw'),
      });

      klawPlugin.onGameSetup(state, {
        scenarioId: 'klaw',
        difficulty: 'STANDARD',
      });

      // Defeating Stage I advances to Stage II
      const result = klawPlugin.onVillainDefeated(state, state.villain.instanceId!);
      expect(result.advancedStage).toBe(true);
      expect(state.villain.card.code).toBe('01114'); // Klaw II
      // Base HP 18 + 10 from Immortal Klaw = 28 HP
      expect(state.villain.health).toBe(28);
      // Immortal Klaw (01127) is attached
      expect(state.villain.attachments.some((a) => a.card.code === '01127')).toBe(true);
    });
  });

  describe('Ultron Scenario Plugin', () => {
    it('sets up Ultron Stage 1A with Ultron Drones environment and spawns starting drone minion', () => {
      const villainCard = cardCatalog.getCard('01134') as VillainCard;
      const mainSchemeCard = cardCatalog.getCard('01137b') as MainSchemeCard;

      const state = setupGame({
        scenarioId: 'ultron',
        difficulty: 'STANDARD',
        players: [
          {
            id: 'p1',
            name: 'Spider-Man',
            hero: spiderManHero,
            alterEgo: peterParkerAlterEgo,
            deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
          },
        ],
        villain: villainCard,
        mainScheme: mainSchemeCard,
        encounterCards: cardCatalog.getCardsBySet('ultron'),
        modularSetCodes: ['under_attack'],
      });

      // Ultron Stage I initialized (17 HP)
      expect(state.villain.card.code).toBe('01134');
      expect(state.villain.health).toBe(17);

      // Ultron Drones (01140) environment is in play
      expect(state.environments.some((e) => e.card.code === '01140')).toBe(true);

      // Player 1 has 1 facedown drone minion engaged (1 HP, 1 ATK, 1 SCH)
      expect(state.players[0].engagedMinions.length).toBe(1);
      const drone = state.players[0].engagedMinions[0];
      expect(drone.card.traits).toContain('Drone');
      expect((drone.card as any).health).toBe(1);
      expect((drone.card as any).attack).toBe(1);
    });

    it('advances Ultron through 3-stage main scheme progression (1B -> 2B -> 3B -> Defeat)', () => {
      const ultronPlugin = ScenarioRegistry.get('ultron') as UltronScenarioPlugin;
      const villainCard = cardCatalog.getCard('01134') as VillainCard;
      const mainSchemeCard = cardCatalog.getCard('01137b') as MainSchemeCard;

      const state = setupGame({
        scenarioId: 'ultron',
        difficulty: 'STANDARD',
        players: [
          {
            id: 'p1',
            name: 'Spider-Man',
            hero: spiderManHero,
            alterEgo: peterParkerAlterEgo,
            deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
          },
        ],
        villain: villainCard,
        mainScheme: mainSchemeCard,
        encounterCards: cardCatalog.getCardsBySet('ultron'),
      });

      ultronPlugin.onGameSetup(state, {
        scenarioId: 'ultron',
        difficulty: 'STANDARD',
      });

      // Stage 1B completed -> Advances to Stage 2B (Assault on NORAD 01138b)
      const res1 = ultronPlugin.onMainSchemeCompleted(state, state.mainScheme.instanceId!);
      expect(res1.advancedStage).toBe(true);
      expect(state.mainScheme.stage).toBe('2B');
      expect(state.mainScheme.targetThreat).toBe(10);

      // Stage 2B completed -> Advances to Stage 3B (Countdown to Oblivion 01139b)
      const res2 = ultronPlugin.onMainSchemeCompleted(state, state.mainScheme.instanceId!);
      expect(res2.advancedStage).toBe(true);
      expect(state.mainScheme.stage).toBe('3B');
      expect(state.mainScheme.targetThreat).toBe(5);

      // Stage 3B completed -> Defeat
      const res3 = ultronPlugin.onMainSchemeCompleted(state, state.mainScheme.instanceId!);
      expect(res3.defeat).toBe(true);
      expect(state.winner).toBe('VILLAIN');
    });
  });
});
