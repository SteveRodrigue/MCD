# [ADR-0081] Seeded Injectable PRNG, Unbiased Fisher-Yates Shuffles, and Deterministic Simulation

- **Status:** Accepted
- **Date:** 2026-10-13
- **Authors:** MCD Core Team
- **Deciders:** User & Antigravity

---

## Context and Problem Statement

Throughout the headless game engine (`src/engine/`), random number generation was previously implemented via unseeded, global `Math.random()` calls across ~40 disparate call sites:

1. **Biased Deck Shuffling**: Decks were shuffled using `.sort(() => Math.random() - 0.5)`. This naive sort algorithm is mathematically biased (yielding non-uniform permutation distributions) and cannot be seeded or reproduced.
2. **Non-Deterministic Log & Entity Identifiers**: Event log entries, prompts, and temporary modifiers generated IDs using `Date.now() + Math.random().toString(36)`. Identical game setups resulted in divergent string serializations and prevented byte-reproducible test fixtures.
3. **Flaky Test Suites & Race Conditions**: Test scenarios relying on deck order or card draws (such as Issue #217 obligation resolution) had to resort to dummy bypasses like `shuffleFn: (arr) => arr` or suffered intermittent failures.
4. **Lack of Headless Replayability**: Simulations, automated fuzz tests, and debugging of problem reports could not reliably replay exact match sequences from bug reports.

How do we architect an injectable, deterministic pseudo-random number generator across the engine while maintaining backward compatibility for existing test hooks and ensuring 100% byte-for-byte serialization reproducibility?

---

## Considered Options

> [!NOTE]
> This section was not part of the original decision record and is not required for this ADR.

---

## Decision Drivers

- **Driver 1: Zero Math.random in Engine Execution**: Eliminate all non-deterministic `Math.random()` calls from `src/engine/`, isolating the PRNG bootstrap strictly to `createRng()`.
- **Driver 2: Uniform, Unbiased Array Shuffling**: Replace `.sort(() => Math.random() - 0.5)` with an in-place Fisher-Yates shuffle driven by the engine PRNG.
- **Driver 3: Deterministic Monotonic IDs**: Replace random string suffixes on engine entities (log entries, decision prompts, cost reductions) with monotonic counters scoped to `GameState.idCounter`.
- **Driver 4: Headless Replayability & Human-Friendly Seeds**: Support both numeric seeds and human-friendly string seeds (e.g. `'rhino-expert-1'`) hashed via 32-bit FNV-1a.
- **Driver 5: Preserved Test Backward Compatibility**: Honor custom `GameOptions.shuffleFn` overrides where tests explicitly require identity or stacked ordering, while enabling seeded repeatable runs where random shuffles are desired.

---

## Decision Outcome

**Implement Mulberry32 PRNG with FNV-1a seed hashing, unified Fisher-Yates shuffling, and monotonic engine ID generation attached to `GameState`:**

### 1. Engine PRNG Primitive (`src/engine/state/rng.ts`)

A dedicated module provides deterministic pseudo-random operations:

- `createRng(seed?: number | string): RngState`: Initializes a Mulberry32 PRNG state (`{ seed, current }`). String seeds are hashed using 32-bit FNV-1a (`hashStringSeed`). When omitted, bootstraps with a random 32-bit integer.
- `nextRandomFloat(rng: RngState): number`: Mulberry32 32-bit generator producing uniform floats in $[0, 1)$.
- `randomFloat(state: GameState): number`: Advances `state.rng` and returns a float in $[0, 1)$.
- `randomInt(state: GameState, minOrMax: number, maybeMax?: number): number`: Generates uniform integers in $[0, \text{max})$ or $[\text{min}, \text{max})$.
- `shuffleArray<T>(state: GameState, array: T[]): T[]`: Executes Fisher-Yates uniform shuffle. If `state.options?.shuffleFn` is provided, delegates to it for backwards compatibility.
- `nextEngineId(state: GameState, prefix: string): string`: Produces monotonic identifiers formatted as `${prefix}_${counter}` using `state.idCounter`.

### 2. State Integration (`src/engine/models/state.ts`)

- Added `RngState` interface (`{ seed: number; current: number }`).
- Extended `GameState` with `rng?: RngState` and `idCounter?: number`.
- Added optional `shuffleFn` to `GameOptions`.
- Added `seed?: number | string` to `GameSetupOptions`.

### 3. Complete Call-Site Migration

All call sites in `src/engine/` were refactored:

- Scenario setup plugins (`rhino`, `klaw`, `ultron`): Encounter deck shuffles migrated to `shuffleArray(state, deckCards)` and setup log IDs to `nextEngineId(state, 'log')`.
- Deck exhaustion pipeline (`deck-exhaustion.ts`): Encounter and player deck reshuffles migrated to `shuffleArray`.
- Action dispatcher (`action-dispatcher.ts`): Search remainder shuffles and deck shuffles migrated to `shuffleArray`.
- Effects engine (`effects/index.ts`): Discard selections, facedown card selections, search shuffles, and prompt IDs migrated to `randomInt`, `shuffleArray`, and `nextEngineId`.
- Prompt queue and trigger dispatcher (`prompt-queue.ts`, `trigger-dispatcher.ts`): Migrated all prompt IDs and log IDs to `nextEngineId`.

---

## Evaluation of Options

> [!NOTE]
> This section was not part of the original decision record and is not required for this ADR.

---

## Consequences

### Positive

- **100% Deterministic Simulation**: Identical seeds yield byte-for-byte identical `GameState` serializations across setups, turns, and deck resets.
- **Unbiased Shuffle Fairness**: True uniform permutations replace flawed `.sort()` behavior.
- **Zero Flakiness in Test Suite**: Tests requiring randomness can lock in deterministic seeds.
- **Full Replay Support**: Replaying a game with the recorded starting seed reproduces the exact match trajectory.

### Negative / Trade-offs

- `GameState` now carries numeric PRNG state (`rng.current`) and `idCounter`, which advance monotonically with each random operation and ID generation.
