import { describe, it, expect } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { packHooks } from '../../src/data/content/pack-hooks.generated';
import { AlterEgoCard, HeroCard, MainSchemeCard, VillainCard } from '@engine/models';
import { setupGame } from '@engine/state/game-setup';
import { ScenarioRegistry } from '@engine/scenarios';

describe('Ultron scenario script (Core pack)', () => {
  // Spider-Man and Captain Marvel: a game needs distinct heroes
  const HEROES = [
    { hero: '01001a', alterEgo: '01001b' },
    { hero: '01010a', alterEgo: '01010b' },
  ];

  const game = (playerCount: number) =>
    setupGame({
      catalog: cardCatalog,
      scenarioId: 'ultron',
      difficulty: 'STANDARD',
      players: Array.from({ length: playerCount }, (_, i) => ({
        id: `p${i + 1}`,
        name: `Player ${i + 1}`,
        hero: cardCatalog.getCard(HEROES[i].hero) as HeroCard,
        alterEgo: cardCatalog.getCard(HEROES[i].alterEgo) as AlterEgoCard,
        deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
      })),
      villain: cardCatalog.getCard('01134') as VillainCard,
      mainScheme: cardCatalog.getCard('01137b') as MainSchemeCard,
      encounterCards: cardCatalog.getCardsBySet('ultron'),
    });

  it('is the only scenario script of the Core pack', () => {
    expect(Object.keys(packHooks.core.scenarioHooks ?? {})).toEqual(['ultron']);
    expect(ScenarioRegistry.get('rhino')).toBeDefined();
    expect(ScenarioRegistry.get('klaw')).toBeDefined();
  });

  it('puts the top card of each deck into play facedown as an engaged Drone minion (1/1/1)', () => {
    const state = game(2);
    for (const player of state.players) {
      expect(player.engagedMinions).toHaveLength(1);
      const drone = player.engagedMinions[0];
      expect(drone.card.traits).toContain('Drone');
      expect(drone.card).toMatchObject({ health: 1, attack: 1, scheme: 1 });
    }
    expect(state.log.filter((e) => e.key === 'scenario.setup.drone')).toHaveLength(2);
  });

  it('logs the setup sound effect from the definition', () => {
    const entry = game(1).log.find((e) => e.key === 'scenario.setup');
    expect(entry?.onomatopoeia).toBe('ULTRON ONLINE! DRONES INITIALIZED!');
  });
});
