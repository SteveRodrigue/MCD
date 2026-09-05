import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { HeroCard, AlterEgoCard } from '@engine/models';
import { setupGame } from '@engine/state/game-setup';
import { executeVillainPhase } from '@engine/pipeline/villain-phase';
import { startPlayerPhase, endPlayerPhase, passActivePlayer } from '@engine/pipeline/player-phase';

describe('Phase & Round Lifecycle Triggers & Ability Resets (RR v1.8 p. 15, 22, 32)', () => {
  let spiderManHero: HeroCard;
  let peterParkerAlterEgo: AlterEgoCard;
  let captainMarvelHero: HeroCard;
  let carolDanversAlterEgo: AlterEgoCard;

  beforeEach(() => {
    spiderManHero = cardCatalog.getCard('01001a') as HeroCard;
    peterParkerAlterEgo = cardCatalog.getCard('01001b') as AlterEgoCard;
    captainMarvelHero = cardCatalog.getCard('01010a') as HeroCard;
    carolDanversAlterEgo = cardCatalog.getCard('01010b') as AlterEgoCard;
  });

  it('resets usedAbilitiesThisPhase upon starting Player Phase and Villain Phase', () => {
    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: [],
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: Array(10).fill(cardCatalog.getCard('01108')!),
      skipMulligan: true,
      shuffleFn: (arr) => arr,
    });

    state.players[0].currentForm = 'alter_ego';
    state.players[0].activeFormCard = peterParkerAlterEgo;

    // Simulate an ability used in Player Phase (e.g. once per phase)
    state.players[0].usedAbilitiesThisPhase = { dummy_ability: 1 };
    state.players[0].usedAbilitiesThisRound = { dummy_ability: 1 };

    // Conclude Player Phase -> Run Villain Phase
    endPlayerPhase(state);
    expect(state.phase).toBe('VILLAIN_PHASE');

    const nextState = executeVillainPhase(state, { synchronousPolicy: 'TAKE_UNDEFENDED' });

    // After full round cycle:
    // 1. usedAbilitiesThisPhase is reset
    expect(nextState.players[0].usedAbilitiesThisPhase).toEqual({});
    // 2. usedAbilitiesThisRound is reset
    expect(nextState.players[0].usedAbilitiesThisRound).toEqual({});
    // 3. New Round & Player Phase active
    expect(nextState.roundNumber).toBe(2);
    expect(nextState.phase).toBe('PLAYER_PHASE');
  });

  it('rotates active players and concludes Player Phase via passActivePlayer', () => {
    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: [],
        },
        {
          id: 'p2',
          name: 'Captain Marvel',
          hero: captainMarvelHero,
          alterEgo: carolDanversAlterEgo,
          deckCards: [],
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: Array(10).fill(cardCatalog.getCard('01108')!),
      skipMulligan: true,
      shuffleFn: (arr) => arr,
    });

    startPlayerPhase(state);
    expect(state.activePlayerIndex).toBe(0); // P1 active

    // P1 passes turn -> P2 becomes active
    passActivePlayer(state);
    expect(state.activePlayerIndex).toBe(1); // P2 active

    // P2 passes turn -> All players done -> Player Phase concludes
    passActivePlayer(state);
    expect(state.phase).toBe('VILLAIN_PHASE');
  });

  it('records lifecycle events in game log', () => {
    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: [],
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: Array(10).fill(cardCatalog.getCard('01108')!),
      skipMulligan: true,
      shuffleFn: (arr) => arr,
    });

    state.players[0].currentForm = 'hero';
    state.players[0].activeFormCard = spiderManHero;

    endPlayerPhase(state);
    const nextState = executeVillainPhase(state, { synchronousPolicy: 'TAKE_UNDEFENDED' });

    const logKeys = nextState.log.map((l) => l.key);
    expect(logKeys).toContain('phase.villain_phase.start');
    expect(logKeys).toContain('round.upkeep.complete');
    expect(logKeys).toContain('phase.player_phase.start');
  });
});
