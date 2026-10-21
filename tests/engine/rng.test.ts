import { describe, it, expect } from 'vitest';
import {
  createRng,
  randomFloat,
  randomInt,
  shuffleArray,
  nextEngineId,
} from '../../src/engine/state/rng';
import { GameState } from '../../src/engine/models';

function createDummyState(seed?: number | string): GameState {
  const state = {
    id: 'dummy-game',
    roundNumber: 1,
    phase: 'PLAYER_PHASE',
    players: [],
    villains: [],
    mainSchemes: [],
    sideSchemes: [],
    environments: [],
    encounterDeck: [],
    encounterDiscard: [],
    victoryDisplay: [],
    auxiliaryDecks: {},
    auxiliaryDiscards: {},
    removedFromGame: [],
    accelerationTokens: 0,
    winner: null,
    log: [],
    firstPlayerIndex: 0,
    activePlayerIndex: 0,
    activeMainSchemeIndex: 0,
  } as unknown as GameState;

  if (seed !== undefined) {
    state.rng = createRng(seed);
  }
  return state;
}

describe('RNG module (Mulberry32 & deterministic engine utilities)', () => {
  describe('createRng', () => {
    it('creates predictable state from a numeric seed', () => {
      const rng1 = createRng(42);
      const rng2 = createRng(42);
      expect(rng1.seed).toBe(42);
      expect(rng1.current).toBe(42);
      expect(rng1).toEqual(rng2);
    });

    it('creates deterministic 32-bit state from human-friendly string seeds via FNV-1a', () => {
      const rng1 = createRng('rhino-run-1');
      const rng2 = createRng('rhino-run-1');
      expect(typeof rng1.seed).toBe('number');
      expect(rng1.seed).toBeGreaterThan(0);
      expect(rng1).toEqual(rng2);

      const rng3 = createRng('rhino-run-2');
      expect(rng3.seed).not.toBe(rng1.seed);
    });

    it('creates a non-zero state when no seed is provided', () => {
      const rng = createRng();
      expect(typeof rng.seed).toBe('number');
      expect(rng.seed).toBe(rng.current);
    });
  });

  describe('randomFloat', () => {
    it('generates numbers in [0, 1) and advances state deterministically', () => {
      const state1 = createDummyState('seed-test');
      const state2 = createDummyState('seed-test');

      const values1 = [randomFloat(state1), randomFloat(state1), randomFloat(state1)];
      const values2 = [randomFloat(state2), randomFloat(state2), randomFloat(state2)];

      expect(values1).toEqual(values2);
      for (const val of values1) {
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThan(1);
      }
      expect(state1.rng?.current).toEqual(state2.rng?.current);
    });

    it('lazily initializes state.rng if missing on ad-hoc state', () => {
      const state = createDummyState();
      delete (state as any).rng;
      expect(state.rng).toBeUndefined();

      const val = randomFloat(state);
      expect(state.rng).toBeDefined();
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    });
  });

  describe('randomInt', () => {
    it('generates integers in [0, max)', () => {
      const state = createDummyState('int-test');
      for (let i = 0; i < 50; i++) {
        const val = randomInt(state, 6);
        expect(Number.isInteger(val)).toBe(true);
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThan(6);
      }
    });

    it('generates integers in [min, max)', () => {
      const state = createDummyState('min-max-test');
      for (let i = 0; i < 50; i++) {
        const val = randomInt(state, 10, 20);
        expect(Number.isInteger(val)).toBe(true);
        expect(val).toBeGreaterThanOrEqual(10);
        expect(val).toBeLessThan(20);
      }
    });

    it('returns min if max <= min', () => {
      const state = createDummyState('edge-test');
      expect(randomInt(state, 5, 5)).toBe(5);
      expect(randomInt(state, 5, 4)).toBe(5);
      expect(randomInt(state, 0)).toBe(0);
    });
  });

  describe('shuffleArray (Fisher-Yates)', () => {
    it('produces identical permutations for identical seeds', () => {
      const items = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
      const state1 = createDummyState('shuffle-seed');
      const state2 = createDummyState('shuffle-seed');

      const shuffled1 = shuffleArray(state1, items);
      const shuffled2 = shuffleArray(state2, items);

      expect(shuffled1).toEqual(shuffled2);
      expect(shuffled1.sort()).toEqual([...items].sort());
    });

    it('produces different permutations for different seeds', () => {
      const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const state1 = createDummyState('seed-alpha');
      const state2 = createDummyState('seed-beta');

      const shuffled1 = shuffleArray(state1, items);
      const shuffled2 = shuffleArray(state2, items);

      expect(shuffled1).not.toEqual(shuffled2);
      expect(shuffled1.slice().sort((a, b) => a - b)).toEqual(items);
    });

    it('does not mutate the source array', () => {
      const items = [1, 2, 3];
      const original = [...items];
      const state = createDummyState('immutability');
      shuffleArray(state, items);
      expect(items).toEqual(original);
    });

    it('honors state.options.shuffleFn when configured', () => {
      const items = [1, 2, 3, 4, 5];
      const state = createDummyState('custom-shuffle');
      state.options = { shuffleFn: (arr) => [...arr].reverse() };

      const shuffled = shuffleArray(state, items);
      expect(shuffled).toEqual([5, 4, 3, 2, 1]);
    });
  });

  describe('nextEngineId', () => {
    it('generates monotonic, deterministic IDs using state.idCounter', () => {
      const state = createDummyState('id-test');
      expect(nextEngineId(state, 'log')).toBe('log_1');
      expect(nextEngineId(state, 'prompt')).toBe('prompt_2');
      expect(nextEngineId(state, 'attack')).toBe('attack_3');
      expect(state.idCounter).toBe(3);
    });

    it('produces identical ID sequences across two identically seeded states', () => {
      const state1 = createDummyState('id-run');
      const state2 = createDummyState('id-run');

      const ids1 = [
        nextEngineId(state1, 'log'),
        nextEngineId(state1, 'threat'),
        nextEngineId(state1, 'prompt'),
      ];
      const ids2 = [
        nextEngineId(state2, 'log'),
        nextEngineId(state2, 'threat'),
        nextEngineId(state2, 'prompt'),
      ];

      expect(ids1).toEqual(ids2);
    });
  });
});
