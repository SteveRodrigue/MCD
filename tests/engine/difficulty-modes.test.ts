import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard, StatusCard } from '@engine/models';
import { setupGame } from '@engine/state/game-setup';
import { ScenarioRegistry } from '@engine/scenarios';

describe('Scenario Plugin & Difficulty Modes (Rules Reference v1.8 p. 28)', () => {
  let spiderManHero: HeroCard;
  let peterParkerAlterEgo: AlterEgoCard;

  beforeEach(() => {
    spiderManHero = cardCatalog.getCard('01001a') as HeroCard;
    peterParkerAlterEgo = cardCatalog.getCard('01001b') as AlterEgoCard;
  });

  function createGame(difficulty: 'SKIRMISH' | 'STANDARD' | 'EXPERT'): GameState {
    const plugin = ScenarioRegistry.get('rhino');
    const baseState = setupGame({
      difficulty,
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Player 1',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: [cardCatalog.getCard('01005')!], // Swinging Web Kick
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097a') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

    return plugin.onGameSetup(baseState, { scenarioId: 'rhino', difficulty });
  }

  it('Skirmish Mode: Setup starts on Stage I and defeating Stage I declares Hero Victory', () => {
    const state = createGame('SKIRMISH');
    expect(state.difficulty).toBe('SKIRMISH');
    expect(state.villain.card.code).toBe('01094');
    expect(state.villain.health).toBe(14); // 14 * 1 player

    // Deal lethal damage (14) to Rhino Stage I
    const plugin = ScenarioRegistry.get('rhino');
    state.villain.health = 0;
    const { state: resState, victory } = plugin.onVillainDefeated(state, state.villain.instanceId || '');

    expect(victory).toBe(true);
    expect(resState.winner).toBe('HEROES');
  });

  it("Standard Mode: Defeating Stage I advances to Stage II, searches Breakin' & Takin', and defeating Stage II wins", () => {
    const state = createGame('STANDARD');
    expect(state.difficulty).toBe('STANDARD');
    expect(state.villain.card.code).toBe('01094');
    expect(state.villain.health).toBe(14);

    const plugin = ScenarioRegistry.get('rhino');

    // Defeat Stage I
    state.villain.health = 0;
    const { state: stage2State, advancedStage } = plugin.onVillainDefeated(state, state.villain.instanceId || '');

    expect(advancedStage).toBe(true);
    expect(stage2State.winner).toBeNull();
    expect(stage2State.villain.card.code).toBe('01095'); // Rhino Stage II
    expect(stage2State.villain.health).toBe(15); // 15 * 1 player

    // Breakin' & Takin' (01107) was searched and revealed
    const breakinScheme = stage2State.sideSchemes.find((s) => s.card.code === '01107');
    expect(breakinScheme).toBeDefined();
    // Base 2 + 1 scaling = 3 threat in solo
    expect(breakinScheme?.threat).toBe(3);

    // Defeat Stage II
    stage2State.villain.health = 0;
    const { state: winState, victory } = plugin.onVillainDefeated(stage2State, stage2State.villain.instanceId || '');

    expect(victory).toBe(true);
    expect(winState.winner).toBe('HEROES');
  });

  it('Expert Mode: Starts on Stage II, defeating Stage II advances to Stage III (with Tough + Stun All Heroes), and defeating Stage III wins', () => {
    const state = createGame('EXPERT');
    expect(state.difficulty).toBe('EXPERT');
    expect(state.villain.card.code).toBe('01095'); // Starts on Stage II
    expect(state.villain.health).toBe(15);

    const plugin = ScenarioRegistry.get('rhino');

    // Defeat Stage II
    state.villain.health = 0;
    const { state: stage3State, advancedStage } = plugin.onVillainDefeated(state, state.villain.instanceId || '');

    expect(advancedStage).toBe(true);
    expect(stage3State.winner).toBeNull();
    expect(stage3State.villain.card.code).toBe('01096'); // Rhino Stage III
    expect(stage3State.villain.health).toBe(16); // 16 * 1 player

    // Rhino gained Tough
    expect(stage3State.villain.statusCards).toContain(StatusCard.TOUGH);

    // Hero gained Stunned
    expect(stage3State.players[0].statusCards).toContain(StatusCard.STUNNED);

    // Defeat Stage III
    stage3State.villain.health = 0;
    const { state: winState, victory } = plugin.onVillainDefeated(stage3State, stage3State.villain.instanceId || '');

    expect(victory).toBe(true);
    expect(winState.winner).toBe('HEROES');
  });
});
