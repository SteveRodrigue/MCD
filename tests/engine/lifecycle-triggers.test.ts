import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { HeroCard, AlterEgoCard } from '@engine/models';
import { setupGame } from '@engine/state/game-setup';
import { executeVillainPhase } from '@engine/pipeline/villain-phase';

describe('Phase & Round Lifecycle Triggers (RR v1.8 p. 22, p. 32)', () => {
  let spiderManHero: HeroCard;
  let peterParkerAlterEgo: AlterEgoCard;

  beforeEach(() => {
    spiderManHero = cardCatalog.getCard('01001a') as HeroCard;
    peterParkerAlterEgo = cardCatalog.getCard('01001b') as AlterEgoCard;
  });

  it('dispatches lifecycle events across villain phase, round end, and new round start', () => {
    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        { id: 'p1', name: 'Spider-Man', hero: spiderManHero, alterEgo: peterParkerAlterEgo, deckCards: [] },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: Array(10).fill(cardCatalog.getCard('01108')!),
      skipMulligan: true,
    });

    const nextState = executeVillainPhase(state);

    // Verify round increment and log events
    expect(nextState.roundNumber).toBe(2);
    expect(nextState.phase).toBe('PLAYER_PHASE');

    // Verify log contains villain phase start and new round logs
    const logKeys = nextState.log.map((l) => l.key);
    expect(logKeys).toContain('phase.villain_phase.start');
    expect(logKeys).toContain('round.upkeep.complete');
  });
});
