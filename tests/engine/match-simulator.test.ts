import { describe, it, expect, beforeEach } from 'vitest';
import { CardCatalog } from '@data/importer/card-loader';
import {
  setupGame,
  resetInstanceCounter,
  runMatch,
  VillainCard,
  MainSchemeCard,
} from '@engine/index';

import corePack from '../../data/upstream/pack/core.json';
import coreEncounterPack from '../../data/upstream/pack/core_encounter.json';

describe('End-to-End Match Simulator (Vertical Slice Matchup)', () => {
  const catalog = new CardCatalog([...corePack, ...coreEncounterPack]);

  let initialGameState: ReturnType<typeof setupGame>;

  beforeEach(() => {
    resetInstanceCounter();

    const identity = catalog.getHeroIdentity('spider_man')!;
    const signatureCards = catalog.getCardsBySet('spider_man').flatMap((c) => {
      if (c.type === 'hero' || c.type === 'alter_ego') return [];
      return Array(c.quantity).fill(c);
    });
    const justiceCards = catalog.getCardsByFaction('justice' as any).flatMap((c) => Array(c.quantity).fill(c));
    const basicCards = catalog.getCardsByFaction('basic' as any).flatMap((c) => Array(c.quantity).fill(c));
    const deck = [...signatureCards, ...justiceCards, ...basicCards].slice(0, 40);

    const rhinoCards = catalog.getCardsBySet('rhino').filter((c) => c.type !== 'villain' && c.type !== 'main_scheme');
    const standardCards = catalog.getCardsBySet('standard');
    const bombScareCards = catalog.getCardsBySet('bomb_scare');
    const encounterCards = [...rhinoCards, ...standardCards, ...bombScareCards].flatMap((c) =>
      Array(c.quantity).fill(c),
    );

    const villain = catalog.getCard('01094') as VillainCard; // Rhino I
    const mainScheme = catalog.getCard('01097b') as MainSchemeCard; // The Break-In!

    initialGameState = setupGame({
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: identity.hero,
          alterEgo: identity.alterEgo,
          deckCards: deck,
        },
      ],
      villain,
      mainScheme,
      encounterCards,
      shuffleFn: (arr) => arr,
    });
  });

  it('runs a complete end-to-end match to victory or defeat', () => {
    const result = runMatch(initialGameState, { maxRounds: 30 });

    // 1. Simulation terminated with a valid conclusion
    expect(['HEROES', 'VILLAIN']).toContain(result.winner);
    expect(result.roundsPlayed).toBeGreaterThanOrEqual(1);
    expect(result.totalActionsExecuted).toBeGreaterThan(0);

    // 2. Final state assertions
    expect(result.finalState).toBeDefined();
    expect(result.finalState.log.length).toBeGreaterThan(5);

    // 3. Victory/Defeat condition verified
    if (result.winner === 'HEROES') {
      expect(result.finalState.villain.health).toBe(0);
    } else if (result.winner === 'VILLAIN') {
      const threatReachedLimit = result.finalState.mainScheme.threat >= result.finalState.mainScheme.targetThreat;
      const heroDefeated = result.finalState.players[0].health <= 0;
      expect(threatReachedLimit || heroDefeated).toBe(true);
    }
  });
});
