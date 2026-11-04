import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard, StatusCard, getActiveVillain } from '@engine/models';
import { setupGame } from '@engine/state/game-setup';
import { ScenarioRegistry } from '@engine/scenarios';

interface Skirmish {
  scenarioId?: string;
  villainVersionCode?: string;
}

describe('Scenario Plugin & Difficulty Modes (Rules Reference v1.8 p. 28)', () => {
  let spiderManHero: HeroCard;
  let peterParkerAlterEgo: AlterEgoCard;

  beforeEach(() => {
    spiderManHero = cardCatalog.getCard('01001a') as HeroCard;
    peterParkerAlterEgo = cardCatalog.getCard('01001b') as AlterEgoCard;
  });

  function createGame(
    difficulty: 'SKIRMISH' | 'STANDARD' | 'EXPERT',
    { scenarioId = 'rhino', villainVersionCode }: Skirmish = {},
  ): GameState {
    const plugin = ScenarioRegistry.get(scenarioId);
    const baseState = setupGame({
      catalog: cardCatalog,
      difficulty,
      scenarioId,
      villainVersionCode,
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

    return plugin.onGameSetup(baseState, { scenarioId, difficulty, villainVersionCode });
  }

  describe('Skirmish: the players choose any one version of the villain (RR v1.8 Modes of Play)', () => {
    it('with no choice, Rhino I plays', () => {
      expect(getActiveVillain(createGame('SKIRMISH')).card.code).toBe('01094');
    });

    it("Rhino II chosen: starts on Rhino II with its hit points and reveals Breakin' & Takin'", () => {
      const state = createGame('SKIRMISH', { villainVersionCode: '01095' });
      expect(getActiveVillain(state).card.code).toBe('01095');
      expect(getActiveVillain(state).health).toBe(15);
      expect(state.sideSchemes.map((s) => s.card.code)).toContain('01107');
    });

    it('Rhino II chosen: defeating Rhino wins at once and Rhino III never enters play', () => {
      const state = createGame('SKIRMISH', { villainVersionCode: '01095' });
      const {
        state: won,
        victory,
        advancedStage,
      } = ScenarioRegistry.get('rhino').onVillainDefeated(
        state,
        getActiveVillain(state).instanceId!,
      );
      expect(victory).toBe(true);
      expect(advancedStage).toBeUndefined();
      expect(won.winner).toBe('HEROES');
      expect(getActiveVillain(won).card.code).toBe('01095');
    });

    it('Rhino III chosen: Rhino enters with a tough status card and no alter-ego is stunned', () => {
      const state = createGame('SKIRMISH', { villainVersionCode: '01096' });
      expect(getActiveVillain(state).card.code).toBe('01096');
      expect(getActiveVillain(state).statusCards).toContain(StatusCard.TOUGH);
      expect(state.players[0].currentForm).toBe('alter_ego');
      expect(state.players[0].statusCards).not.toContain(StatusCard.STUNNED);
    });

    it("Ultron III chosen: Ultron's Imperative is revealed at setup", () => {
      const state = createGame('SKIRMISH', { scenarioId: 'ultron', villainVersionCode: '01136' });
      expect(getActiveVillain(state).card.code).toBe('01136');
      expect(state.sideSchemes.map((s) => s.card.name)).toContain("Ultron's Imperative");
    });

    it('Klaw III chosen: Klaw III plays', () => {
      const state = createGame('SKIRMISH', { scenarioId: 'klaw', villainVersionCode: '01115' });
      expect(getActiveVillain(state).card.code).toBe('01115');
    });
  });

  describe('a villain revealed at setup stuns what its When Revealed names (players start in alter-ego form)', () => {
    afterEach(() => vi.restoreAllMocks());

    const setupWithStartingVillainStunning = (target: string): GameState => {
      const getCard = cardCatalog.getCard.bind(cardCatalog);
      vi.spyOn(cardCatalog, 'getCard').mockImplementation((code) => {
        const card = getCard(code);
        if (code !== '01094' || !card) return card;
        return {
          ...card,
          enrichment: {
            abilities: [
              {
                id: 'stun_when_revealed',
                timing: 'WHEN_REVEALED',
                trigger: 'WHEN_REVEALED',
                steps: [{ effect: 'ADD_STATUS', effectParams: { status: 'STUNNED', target } }],
              },
            ],
          },
        } as typeof card;
      });
      return createGame('STANDARD');
    };

    it('"Stun each hero" stuns no alter-ego', () => {
      const state = setupWithStartingVillainStunning('ALL_HEROES');
      expect(state.players[0].currentForm).toBe('alter_ego');
      expect(state.players[0].statusCards).not.toContain(StatusCard.STUNNED);
    });

    it('"Stun each player" stuns a player in alter-ego form', () => {
      const state = setupWithStartingVillainStunning('ALL_PLAYERS');
      expect(state.players[0].currentForm).toBe('alter_ego');
      expect(state.players[0].statusCards).toContain(StatusCard.STUNNED);
    });

    it('"Stun each enemy" stuns the villain', () => {
      const state = setupWithStartingVillainStunning('ALL_ENEMIES');
      expect(getActiveVillain(state).statusCards).toContain(StatusCard.STUNNED);
    });
  });

  it('Skirmish Mode: Setup starts on Stage I and defeating Stage I declares Hero Victory', () => {
    const state = createGame('SKIRMISH');
    expect(state.difficulty).toBe('SKIRMISH');
    expect(getActiveVillain(state).card.code).toBe('01094');
    expect(getActiveVillain(state).health).toBe(14); // 14 * 1 player

    // Deal lethal damage (14) to Rhino Stage I
    const plugin = ScenarioRegistry.get('rhino');
    getActiveVillain(state).health = 0;
    const { state: resState, victory } = plugin.onVillainDefeated(
      state,
      getActiveVillain(state).instanceId || '',
    );

    expect(victory).toBe(true);
    expect(resState.winner).toBe('HEROES');
  });

  it("Standard Mode: Defeating Stage I advances to Stage II, searches Breakin' & Takin', and defeating Stage II wins", () => {
    const state = createGame('STANDARD');
    expect(state.difficulty).toBe('STANDARD');
    expect(getActiveVillain(state).card.code).toBe('01094');
    expect(getActiveVillain(state).health).toBe(14);

    const plugin = ScenarioRegistry.get('rhino');

    // Defeat Stage I
    getActiveVillain(state).health = 0;
    const { state: stage2State, advancedStage } = plugin.onVillainDefeated(
      state,
      getActiveVillain(state).instanceId || '',
    );

    expect(advancedStage).toBe(true);
    expect(stage2State.winner).toBeNull();
    expect(getActiveVillain(stage2State).card.code).toBe('01095'); // Rhino Stage II
    expect(getActiveVillain(stage2State).health).toBe(15); // 15 * 1 player

    // Breakin' & Takin' (01107) was searched and revealed
    const breakinScheme = stage2State.sideSchemes.find((s) => s.card.code === '01107');
    expect(breakinScheme).toBeDefined();
    // Base 2 + 1 scaling = 3 threat in solo
    expect(breakinScheme?.threat).toBe(3);

    // Defeat Stage II
    getActiveVillain(stage2State).health = 0;
    const { state: winState, victory } = plugin.onVillainDefeated(
      stage2State,
      getActiveVillain(stage2State).instanceId || '',
    );

    expect(victory).toBe(true);
    expect(winState.winner).toBe('HEROES');
  });

  it('Expert Mode: Starts on Stage II, defeating Stage II advances to Stage III (with Tough + Stun All Heroes), and defeating Stage III wins', () => {
    const state = createGame('EXPERT');
    state.players[0].currentForm = 'hero';
    expect(state.difficulty).toBe('EXPERT');
    expect(getActiveVillain(state).card.code).toBe('01095'); // Starts on Stage II
    expect(getActiveVillain(state).health).toBe(15);

    const plugin = ScenarioRegistry.get('rhino');

    // Defeat Stage II
    getActiveVillain(state).health = 0;
    const { state: stage3State, advancedStage } = plugin.onVillainDefeated(
      state,
      getActiveVillain(state).instanceId || '',
    );

    expect(advancedStage).toBe(true);
    expect(stage3State.winner).toBeNull();
    expect(getActiveVillain(stage3State).card.code).toBe('01096'); // Rhino Stage III
    expect(getActiveVillain(stage3State).health).toBe(16); // 16 * 1 player

    // Rhino gained Tough
    expect(getActiveVillain(stage3State).statusCards).toContain(StatusCard.TOUGH);

    // Hero gained Stunned
    expect(stage3State.players[0].statusCards).toContain(StatusCard.STUNNED);

    // Defeat Stage III
    getActiveVillain(stage3State).health = 0;
    const { state: winState, victory } = plugin.onVillainDefeated(
      stage3State,
      getActiveVillain(stage3State).instanceId || '',
    );

    expect(victory).toBe(true);
    expect(winState.winner).toBe('HEROES');
  });
});
