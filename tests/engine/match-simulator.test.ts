import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { getStarterDeck } from '../../src/engine/decks/starter-decks';
import { setupGame } from '../../src/engine/state/game-setup';
import { runMatch, createRotatingPicker } from '../../src/engine/simulation/match-simulator';
import { choiceKey, type ScarcityLedger } from '../../src/engine/simulation/ability-coverage';
import { executeVillainAttackAgainstPlayer } from '../../src/engine/pipeline';
import { attachCardToHost } from '../../src/engine/state/state-validator';
import { createCardInstance } from '../../src/engine/state/card-instance';
import { resetInstanceCounter, getActiveVillain } from '../../src/engine';
import { getEffectiveHandSize } from '../../src/engine/pipeline/stat-calculator';

describe('Fast Multi-Hero Match Simulator Battery (Roadmap 1.4)', () => {
  beforeEach(() => {
    resetInstanceCounter();
  });

  const coreHeroes = [
    { deckId: 'spider_man_justice', difficulty: 'STANDARD' as const, name: 'Spider-Man' },
    { deckId: 'captain_marvel_leadership', difficulty: 'EXPERT' as const, name: 'Captain Marvel' },
    { deckId: 'she_hulk_aggression', difficulty: 'STANDARD' as const, name: 'She-Hulk' },
    { deckId: 'iron_man_aggression', difficulty: 'EXPERT' as const, name: 'Iron Man' },
    { deckId: 'black_panther_protection', difficulty: 'STANDARD' as const, name: 'Black Panther' },
  ];

  for (const { deckId, difficulty, name } of coreHeroes) {
    it(`simulates ${name} vs Rhino (${difficulty}) without errors or deadlocks`, () => {
      const starter = getStarterDeck(deckId);
      expect(starter).toBeDefined();
      const loaded = starter!.loadDeck(cardCatalog);

      const state = setupGame({
        catalog: cardCatalog,
        scenarioId: 'rhino',
        difficulty,
        seed: `test_fast_${deckId}_${difficulty.toLowerCase()}`,
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
        maxRounds: 15,
        maxActionsPerTurn: 10,
        seed: `test_fast_${deckId}_${difficulty.toLowerCase()}`,
      });

      expect(['HEROES', 'VILLAIN', 'TIMEOUT']).toContain(result.winner);
      expect(result.roundsPlayed).toBeGreaterThanOrEqual(1);
      expect(result.heroNames).toEqual([loaded.hero.name]);
      expect(result.difficulty).toBe(difficulty);
      expect(result.playerCount).toBe(1);
      expect(result.finalState).toBeDefined();
    });
  }

  describe('turn loop runs the real END_PLAYER_TURN path', () => {
    const spideyGame = (seed: string) => {
      const loaded = getStarterDeck('spider_man_justice')!.loadDeck(cardCatalog);
      return setupGame({
        catalog: cardCatalog,
        scenarioId: 'rhino',
        difficulty: 'STANDARD',
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
    };

    it('refills the hand at the end of the player phase', () => {
      const seed = 'f001_round_two_refill';
      const result = runMatch(spideyGame(seed), { maxRounds: 1, seed });

      expect(result.winner).toBe('TIMEOUT');
      const state = result.finalState;
      expect(state.roundNumber).toBe(2);
      expect(state.phase).toBe('PLAYER_PHASE');
      const player = state.players[0];
      const cleanup = state.log.find((l) => l.key === 'player.phase.cleanup.complete');
      // Spider-Man ends round 1 in hero form; villain-phase draws (Spider-Sense) may add more
      expect(player.currentForm).toBe('hero');
      expect(cleanup?.params?.handSize).toBe(getEffectiveHandSize(player, state));
      expect(player.hand.length).toBeGreaterThanOrEqual(getEffectiveHandSize(player, state));
    });

    it('replays byte-identically from the same seed (ADR-0081)', () => {
      const seed = 'f009_determinism';
      const play = () => {
        resetInstanceCounter();
        return JSON.stringify(runMatch(spideyGame(seed), { maxRounds: 4, seed }).finalState);
      };
      expect(play()).toBe(play());
    });

    it('keeps acting after round 1', () => {
      const seed = 'f001_actions_floor';
      const result = runMatch(spideyGame(seed), { maxRounds: 5, seed });

      expect(result.roundsPlayed).toBeGreaterThanOrEqual(2);
      expect(result.totalActionsExecuted).toBeGreaterThanOrEqual(10);
    });
  });

  it('simulates a 2-player cooperative match (Spider-Man + Captain Marvel vs Rhino Standard)', () => {
    const spideyStarter = getStarterDeck('spider_man_justice')!.loadDeck(cardCatalog);
    const marvelStarter = getStarterDeck('captain_marvel_leadership')!.loadDeck(cardCatalog);

    const state = setupGame({
      catalog: cardCatalog,
      scenarioId: 'rhino',
      difficulty: 'STANDARD',
      seed: 'test_coop_spidey_marvel_standard',
      players: [
        {
          id: 'p1',
          name: spideyStarter.hero.name,
          hero: spideyStarter.hero,
          alterEgo: spideyStarter.alterEgo,
          deckCards: spideyStarter.deckCards,
          obligation: spideyStarter.obligation,
          nemesisCards: spideyStarter.nemesisCards,
        },
        {
          id: 'p2',
          name: marvelStarter.hero.name,
          hero: marvelStarter.hero,
          alterEgo: marvelStarter.alterEgo,
          deckCards: marvelStarter.deckCards,
          obligation: marvelStarter.obligation,
          nemesisCards: marvelStarter.nemesisCards,
        },
      ],
    });

    const result = runMatch(state, {
      maxRounds: 15,
      maxActionsPerTurn: 10,
      seed: 'test_coop_spidey_marvel_standard',
    });

    expect(['HEROES', 'VILLAIN', 'TIMEOUT']).toContain(result.winner);
    expect(result.roundsPlayed).toBeGreaterThanOrEqual(1);
    expect(result.playerCount).toBe(2);
    expect(result.heroNames).toHaveLength(2);
    expect(result.finalState).toBeDefined();
  });

  describe('Combat Pipeline Step 7 Host Attachment Regression', () => {
    it('eliminating a solo hero during attack with Charge attachment completes step 7 cleanly', () => {
      const sheHulkStarter = getStarterDeck('she_hulk_aggression')!.loadDeck(cardCatalog);
      const state = setupGame({
        catalog: cardCatalog,
        scenarioId: 'rhino',
        difficulty: 'STANDARD',
        skipMulligan: true,
        players: [
          {
            id: 'p1',
            name: sheHulkStarter.hero.name,
            hero: sheHulkStarter.hero,
            alterEgo: sheHulkStarter.alterEgo,
            deckCards: sheHulkStarter.deckCards,
            obligation: sheHulkStarter.obligation,
            nemesisCards: sheHulkStarter.nemesisCards,
          },
        ],
      });

      // Set player to Hero form with 1 HP so any attack eliminates them
      state.players[0].currentForm = 'hero';
      state.players[0].activeFormCard = sheHulkStarter.hero;
      state.players[0].health = 1;

      // Attach Charge (01100) to Rhino
      const chargeCard = cardCatalog.getCard('01100')!;
      const chargeInstance = createCardInstance(chargeCard);
      attachCardToHost(state, chargeInstance, 'VILLAIN');

      expect(getActiveVillain(state).attachments.some((a) => a.card.code === '01100')).toBe(true);

      // Execute attack against solo player - should eliminate player and trigger HOST_ATTACK_ENDED
      // without throwing "Cannot read properties of undefined (reading 'id')"
      let nextState!: typeof state;
      expect(() => {
        nextState = executeVillainAttackAgainstPlayer(state, state.players[0], {
          synchronousPolicy: 'TAKE_UNDEFENDED',
        });
      }).not.toThrow();

      expect(nextState.winner).toBe('VILLAIN');
      expect(nextState.players).toHaveLength(0);
    });
  });
});

describe('prompt choice rotation and the scarcity ledger (#431)', () => {
  const prompt = (promptId: string, ids: string[], extra: object = {}) =>
    ({
      promptId,
      title: 'Choose',
      sourceCardCode: '01084',
      options: ids.map((id) => ({ id })),
      ...extra,
    }) as never;
  /** Ask the picker, then report the pick as resolved, the way a successful dispatch does. */
  const choose = (
    picker: ReturnType<typeof createRotatingPicker>,
    p: ReturnType<typeof prompt>,
  ) => {
    const id = picker(p);
    if (id !== undefined) picker.commit?.(p, id);
    return id;
  };

  it('rotates through every branch of a choice before repeating one', () => {
    const picker = createRotatingPicker({}, 'seed');
    const picked = [1, 2, 3].map((n) =>
      choose(picker, prompt(`p${n}`, ['opt_1', 'opt_2', 'opt_3'])),
    );
    expect(new Set(picked)).toEqual(new Set(['opt_1', 'opt_2', 'opt_3']));
  });

  it('breaks ties with the seed, the same way every time', () => {
    const run = (seed: string) => {
      const picker = createRotatingPicker({}, seed);
      return [1, 2, 3].map((n) => choose(picker, prompt(`p${n}`, ['a', 'b', 'c'])));
    };
    expect(run('same')).toEqual(run('same'));
  });

  it('accepts an optional ability before passing on it, then lets the pass have its turn', () => {
    const ledger: ScarcityLedger = {};
    const picker = createRotatingPicker(ledger, 'seed');
    expect(choose(picker, prompt('p1', ['trigger_x', 'pass']))).toBe('trigger_x');
    expect(choose(picker, prompt('p2', ['trigger_x', 'pass']))).toBe('pass');
    expect(ledger[choiceKey('01084', 'trigger_x')]).toBe(1);
    expect(ledger[choiceKey('01084', 'pass')]).toBe(1);
  });

  it('counts a choice only once it resolved, and answers the same when asked twice', () => {
    const ledger: ScarcityLedger = {};
    const picker = createRotatingPicker(ledger, 'seed');
    const p = prompt('p1', ['a', 'b', 'c']);
    expect(picker(p)).toBe(picker(p));
    expect(ledger).toEqual({});
    picker.commit?.(p, 'b');
    expect(ledger[choiceKey('01084', 'b')]).toBe(1);
  });

  it('leaves defender declarations, multi-selects and single options to their own policies', () => {
    const picker = createRotatingPicker({}, 'seed');
    expect(picker(prompt('d', ['defend_hero', 'undefended']))).toBeUndefined();
    expect(picker(prompt('s', ['a', 'b'], { selection: { min: 0, max: 2 } }))).toBeUndefined();
    expect(picker(prompt('o', ['only']))).toBeUndefined();
  });

  it('runs a whole match with a ledger, counts what it tested and replays identically', () => {
    const play = () => {
      resetInstanceCounter();
      const loaded = getStarterDeck('spider_man_justice')!.loadDeck(cardCatalog);
      const state = setupGame({
        catalog: cardCatalog,
        scenarioId: 'rhino',
        seed: 'ledger-match',
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
      return runMatch(state, { maxRounds: 8, seed: 'ledger-match', scarcity: {} });
    };
    const first = play();
    const second = play();
    expect(first.logSummary).toEqual(second.logSummary);
    expect(first.scarcity).toEqual(second.scarcity);
    const keys = Object.keys(first.scarcity ?? {});
    expect(keys.some((k) => k.startsWith('card:'))).toBe(true);
    expect(keys.some((k) => k.startsWith('ability:'))).toBe(true);
  });
});
