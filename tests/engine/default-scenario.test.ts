import { describe, it, expect, afterAll } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { bootContent, resetContent } from '../../src/data/content/apply';
import { ScenarioRegistry, defaultScenarioId } from '@engine/scenarios';
import { AlterEgoCard, HeroCard } from '@engine/models';
import { setupGame } from '@engine/state/game-setup';
import { contentDriver } from '../helpers/content';

afterAll(async () => {
  await bootContent(contentDriver);
});

const players = () => [
  {
    id: 'p1',
    name: 'Spider-Man',
    hero: cardCatalog.getCard('01001a') as HeroCard,
    alterEgo: cardCatalog.getCard('01001b') as AlterEgoCard,
    deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
  },
];

describe('default scenario (M5d)', () => {
  it('is the registered scenario with the lowest scenario card code', () => {
    expect(defaultScenarioId()).toBe('rhino');
    expect(ScenarioRegistry.getAll()[0].definition.scenarioCardCode).toBe('01094');
  });

  it('is what a game without a named scenario plays', () => {
    const state = setupGame({ catalog: cardCatalog, players: players() });
    expect(state.scenarioId).toBe('rhino');
    expect(state.villains[0].card.code).toBe('01094');
  });

  it('is a clear error when no pack provides a scenario', () => {
    const seats = players();
    resetContent();
    expect(() => defaultScenarioId()).toThrow(/No scenario is available/);
    expect(() => setupGame({ catalog: cardCatalog, players: seats })).toThrow(
      /No scenario is available/,
    );
  });

  it('never substitutes Rhino for a scenario whose villain is missing', async () => {
    await bootContent(contentDriver);
    expect(() =>
      setupGame({ catalog: cardCatalog, scenarioId: 'not_a_scenario', players: players() }),
    ).toThrow(/no villain stage I/);
  });
});
