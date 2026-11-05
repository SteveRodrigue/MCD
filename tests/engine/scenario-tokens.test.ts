import { describe, it, expect } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { getLoadedContent, setLoadedContent } from '../../src/data/content/store';
import { AlterEgoCard, HeroCard, setupGame } from '@engine/index';
import { scenarioTokenCard } from '@engine/scenarios/scenario-tokens';

/** The game facts a seed decides: who has what, in which order, and what was logged. */
function ultronGame() {
  const state = setupGame({
    catalog: cardCatalog,
    scenarioId: 'ultron',
    difficulty: 'STANDARD',
    seed: 'art-pack-independence',
    skipMulligan: true,
    players: [
      {
        id: 'p1',
        name: 'Peter Parker',
        hero: cardCatalog.getCard('01001a') as HeroCard,
        alterEgo: cardCatalog.getCard('01001b') as AlterEgoCard,
        deckCards: Array(15).fill(cardCatalog.getCard('01005')!),
      },
    ],
  });
  const codes = (list: { card: { code: string } }[]) => list.map((c) => c.card.code);
  return JSON.stringify({
    encounterDeck: codes(state.encounterDeck),
    environments: codes(state.environments),
    engaged: state.players.map((p) => codes(p.engagedMinions)),
    deck: state.players.map((p) => codes(p.deck)),
    log: state.log.map((entry) => entry.key),
  });
}

describe('a Drone comes from Ultron scenario data', () => {
  it('S2: the Drone face reads its stats from definition.json', () => {
    expect(scenarioTokenCard('ultron', 'ultron_drone')).toMatchObject({
      code: 'ultron_drone',
      name: 'Drone',
      type: 'minion',
      traits: ['Drone'],
      scheme: 1,
      attack: 1,
      health: 1,
    });
  });

  it('names the scenario and the token when the token does not exist', () => {
    expect(() => scenarioTokenCard('ultron', 'no_such_token')).toThrow(/ultron.*no_such_token/);
    expect(() => scenarioTokenCard('rhino', 'ultron_drone')).toThrow(/rhino.*ultron_drone/);
  });

  it('S5: Ultron plays the same with and without an art pack', () => {
    const loaded = getLoadedContent();
    const without = ultronGame();
    setLoadedContent({
      ...loaded,
      artPacks: [
        {
          id: 'tokens',
          name: 'Tokens',
          description: 'Tokens for the Ultron scenario.',
          credit: { author: 'A', sourceUrl: 'https://example.com/a', unofficial: true },
          cards: { ultron_drone: [{ file: 'mk1.png' }], '01001a': [{ file: 'hero.png' }] },
        },
      ],
    });
    try {
      expect(ultronGame()).toBe(without);
    } finally {
      setLoadedContent(loaded);
    }
  });
});
