import { GameState, RngState } from '../models';

export type { RngState };

/**
 * 32-bit FNV-1a hash algorithm converting human-friendly string seeds into deterministic 32-bit integers.
 */
function hashStringSeed(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Creates an initial RngState from a numeric or human-friendly string seed.
 * When seed is omitted, bootstraps with Math.random() (the sole permitted Math.random call in src/engine/).
 */
export function createRng(seed?: number | string): RngState {
  let initialSeed: number;
  if (typeof seed === 'number') {
    initialSeed = seed >>> 0;
  } else if (typeof seed === 'string') {
    initialSeed = hashStringSeed(seed);
  } else {
    initialSeed = Math.floor(Math.random() * 0xffffffff) >>> 0;
  }

  return {
    seed: initialSeed,
    current: initialSeed,
  };
}

/**
 * Mulberry32 32-bit pseudo-random number generator.
 * Advances the RNG state and returns a float in [0, 1).
 */
export function nextRandomFloat(rng: RngState): number {
  let t = (rng.current += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/**
 * Ensures state.rng exists, initializing lazily if missing on ad-hoc test states.
 */
export function ensureRng(state: GameState): RngState {
  if (!state.rng) {
    state.rng = createRng();
  }
  return state.rng;
}

/**
 * Returns a pseudo-random floating point number in [0, 1), advancing state.rng.
 */
export function randomFloat(state: GameState): number {
  const rng = ensureRng(state);
  return nextRandomFloat(rng);
}

/**
 * Returns a pseudo-random integer in [0, max) or [min, max), advancing state.rng.
 */
export function randomInt(state: GameState, minOrMax: number, maybeMax?: number): number {
  if (maybeMax === undefined) {
    const max = minOrMax;
    if (max <= 0) return 0;
    return Math.floor(randomFloat(state) * max);
  }
  const min = minOrMax;
  const max = maybeMax;
  if (max <= min) return min;
  return min + Math.floor(randomFloat(state) * (max - min));
}

/**
 * Standard unbiased Fisher-Yates array shuffle using the seeded engine PRNG.
 * If state.options?.shuffleFn is configured, delegates to it for custom test requirements.
 * Does not mutate the source array.
 */
export function shuffleArray<T>(state: GameState, array: readonly T[]): T[] {
  if (state.options?.shuffleFn) {
    return state.options.shuffleFn([...array]);
  }
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(state, i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Generates a monotonic, deterministic string ID for game events (logs, prompts, placements).
 * Advances state.idCounter so that identical seeds produce byte-identical execution states.
 */
export function nextEngineId(state: GameState, prefix: string): string {
  state.idCounter = (state.idCounter ?? 0) + 1;
  return `${prefix}_${state.idCounter}`;
}
