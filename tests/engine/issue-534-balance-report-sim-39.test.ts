import { describe, it, expect } from 'vitest';
import { setupGame } from '../../src/engine/state/game-setup';
import { runMatch } from '../../src/engine/simulation/match-simulator';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { getStarterDeck } from '../../src/engine/decks/starter-decks';

describe('Issue #534 - balance report crash at game 39', () => {
  it('reproduces and completes sim_100_rhino_expert_iron_man_aggression_4 as a clean villain victory without throwing', () => {
    const starter = getStarterDeck('iron_man_aggression')!;
    const loaded = starter.loadDeck(cardCatalog);
    const seed = 'sim_100_rhino_expert_iron_man_aggression_4';

    const state = setupGame({
      catalog: cardCatalog,
      scenarioId: 'rhino',
      difficulty: 'EXPERT',
      seed,
      players: [
        {
          id: 'p1',
          name: loaded.hero.name,
          hero: loaded.hero,
          alterEgo: loaded.alterEgo,
          deckCards: loaded.deckCards,
          obligation: loaded.obligation,
          nemesisCards: loaded.nemesisCards,
        },
      ],
    });

    const result = runMatch(state, {
      maxRounds: 30,
      maxActionsPerTurn: 15,
      seed,
    });

    expect(result.winner).toBe('VILLAIN');
    expect(result.roundsPlayed).toBeGreaterThanOrEqual(1);
  });
});
