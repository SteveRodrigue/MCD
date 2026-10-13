# Implementation Plan: Seeded, Injectable RNG instead of Math.random

> **Scope:** Engine-wide PRNG refactor. Queue item 12 of section 3.3 in [teamwork_status_and_next_target.md](teamwork_status_and_next_target.md) (Gate 1). The commit will say `Fixes #252`.
> **UI / Card Editor impact:** UI none (PRNG state internal to engine; never displayed in board, debug UI, or public issue bodies). Card Editor none (declarative schema untouched).

---

## 1. Context & Architectural Rationale

Marvel Champions Digital is designed to be 100% headless, data-driven, and deterministic. However, the runtime currently relies on `Math.random()` across ~40 call sites in `src/engine/`:
1. **Biased shuffles:** Decks are shuffled via `.sort(() => Math.random() - 0.5)`, which has known statistical bias and lacks seedability.
2. **Nondeterministic testing:** Tests must work around random deck orders (e.g. issue #217 intermittent flakiness in `obligation-recipient.test.ts`).
3. **Replayability & Dev Mode reports:** Problem reports save `GameState`, but without RNG state, a maintainer cannot replay identical draw/activation sequences.
4. **Monte Carlo simulation requirement:** The upcoming 100-game headless simulation gate (Issue #304) requires injectable seeds for repeatable scenario validation.

---

## 2. Evidence: Inventory of Call Sites in `src/engine/`

The codebase contains 40 occurrences of `Math.random` in `src/engine/`:

### A. Deck Shuffles (Biased `.sort(() => Math.random() - 0.5)`)
- `src/engine/state/game-setup.ts:58`: `defaultShuffle` Fisher-Yates with `Math.random`
- `src/engine/scenarios/built-in/rhino/plugin.ts:120`: `state.encounterDeck` shuffle
- `src/engine/scenarios/built-in/klaw/plugin.ts:123`: `state.encounterDeck` shuffle
- `src/engine/scenarios/built-in/ultron/plugin.ts:173`: `state.encounterDeck` shuffle
- `src/engine/pipeline/deck-exhaustion.ts:24, 85`: encounter deck and player deck exhaustion reshuffles
- `src/engine/effects/index.ts:4436, 4439, 5108, 5111, 5239, 5242`: `SHUFFLE_DECK` effect handlers
- `src/engine/pipeline/action-dispatcher.ts:195, 198, 3096, 3099, 3171, 3174`: setup and search reshuffle handlers

### B. Gameplay Random Selections
- `src/engine/effects/index.ts:1827`: candidate selection (`Math.floor(Math.random() * candidates.length)`)
- `src/engine/effects/index.ts:5536`: Highway Robbery random discard (`Math.floor(Math.random() * p.hand.length)`)
- `src/engine/pipeline/cost-engine.ts:746`: random card discard for cost payment (`Math.floor(Math.random() * player.hand.length)`)

### C. Runtime ID Generation
- `src/engine/effects/index.ts`: log entries (508, 599, 3351), prompts (2154, 3025, 4481, 5368, 5841), cost reductions (5617)
- `src/engine/effects/target-choice.ts:189`: target selection prompt IDs
- `src/engine/pipeline/combat-pipeline.ts:250, 795`: attack ID and damage placement IDs
- `src/engine/pipeline/threat-pipeline.ts:128, 204, 223, 242, 280, 393, 422, 467, 503`: threat placement and log IDs
- `src/engine/pipeline/damage-pipeline.ts:209, 263, 320, 378, 419, 468, 506, 577, 623, 655`: log IDs
- `src/engine/pipeline/prompt-queue.ts:140, 552, 591, 620, 705`: prompt IDs and log IDs
- `src/engine/pipeline/surge.ts:22`: log IDs
- `src/engine/triggers/trigger-dispatcher.ts:570, 769, 981`: prompt IDs
- `src/engine/decks/deck-utils.ts:41`: default unique suffix for user deck files

---

## 3. Proposed Engine Changes

### 3.1 PRNG Primitive (`src/engine/state/rng.ts`)
- Implement **Mulberry32**, a fast, lightweight 32-bit PRNG with period \(2^{32}\) and excellent statistical distribution.
- State shape:
  ```ts
  export interface RngState {
    seed: number;
    current: number;
  }
  ```
- Public functions:
  - `createRng(seed?: number | string): RngState`: Converts numeric or string seeds (via FNV-1a 32-bit hash) into an unsigned 32-bit integer. When `seed` is undefined, uses `Math.floor(Math.random() * 0xffffffff) >>> 0` as the bootstrap.
  - `randomFloat(state: GameState): number`: Advances `state.rng` and returns a float in \([0, 1)\). Lazily initializes `state.rng` if missing.
  - `randomInt(state: GameState, max: number): number` and `randomInt(state: GameState, min: number, max: number): number`: Returns integer in \([0, \text{max})\) or \([\text{min}, \text{max})\).
  - `shuffleArray<T>(state: GameState, array: T[]): T[]`: Unbiased Fisher-Yates shuffle using `randomInt`.
  - `nextEngineId(state: GameState, prefix: string): string`: Deterministic ID generation based on an incrementing `state.idCounter`, eliminating `Date.now() + Math.random()` from runtime state.

### 3.2 State Model Integration (`src/engine/models/state.ts`)
- Add fields to `GameState`:
  ```ts
  export interface GameState {
    // ...
    rng?: RngState;
    idCounter?: number;
  }
  ```
- Since `cloneGameState` uses `JSON.parse(JSON.stringify(state))`, `rng` and `idCounter` are plain numbers and serialize/clone cleanly across turns, pauses, and prompts.

### 3.3 Setup Integration (`src/engine/state/game-setup.ts`)
- Add `seed?: number | string` to `GameSetupOptions`.
- In `setupGame`, initialize `state.rng = createRng(options.seed)`.
- Replace `defaultShuffle` implementation with Fisher-Yates using `randomInt(state, ...)` or make it forward to `shuffleArray(state, ...)`.
- Update scenario plugins (`rhino`, `klaw`, `ultron`) to use `shuffleArray(state, deckCards)` during scenario setup.

### 3.4 Call Site Migration
- Migrate all shuffles to `shuffleArray(state, ...)`.
- Migrate all random indices to `randomInt(state, ...)`.
- Migrate all runtime IDs to `nextEngineId(state, prefix)`.
- Update `deck-utils.ts` to use a monotonic counter or static default suffix, removing `Math.random`.

---

## 4. UI, Security & Documentation Impact

- **Security & Privacy:** The RNG seed and state are purely engine-internal. They are never rendered in the UI or board components, and are stripped if public issue URLs are generated.
- **Card Editor Impact:** None.
- **Documentation:**
  - Add ADR-0077 (`docs/decisions/0077-seedable-prng-and-deterministic-engine.md`).
  - Update `docs/specifications/content_plugins_scenarios_and_campaigns.md` section on Seedable RNG.

---

## 5. Tests (Written First)

1. `tests/engine/rng.test.ts` (new):
   - Uniformity and boundary testing for `createRng`, `randomFloat`, `randomInt`.
   - String and number seed determinism (same seed yields exact identical sequence).
   - Divergence test (different seeds yield different sequences).
   - Fisher-Yates shuffle uniformity and element preservation.
   - Id counter monotonicity and prefix formatting.
2. `tests/engine/deterministic-simulation.test.ts` (new):
   - Golden determinism: two complete games initialized with the same seed and receiving identical action sequences produce 100% deep-equal `GameState`.
   - `cloneGameState` preserves RNG sequence without desync.
   - Verify that during a seeded run, zero calls to `Math.random()` occur.
3. Verification of Issue #217:
4. Retrofit of existing tests:
   - Audit the ~35 test files currently supplying `shuffleFn: (arr) => arr` or unseeded `setupGame`.
   - Distinguish tests that strictly require exact top-of-deck card stacking from tests where `shuffleFn: (arr) => arr` was merely a workaround against `Math.random` flakiness (e.g. deck exhaustion, obligation handling, villain phase turns).
   - Retrofit eligible tests to use deterministic seeds (e.g. `seed: 'test-deck-exhaustion'`) so they exercise real, unbiased shuffles and discard/draw cycles in a repeatable, deterministic manner.

---

## 6. Files to Modify

- `src/engine/models/state.ts` (add `rng` and `idCounter` to `GameState`)
- `src/engine/state/rng.ts` (new PRNG module)
- `src/engine/state/index.ts` (re-export RNG helpers)
- `src/engine/state/game-setup.ts` (`GameSetupOptions.seed`, setup PRNG initialization)
- `src/engine/scenarios/built-in/rhino/plugin.ts` (use `shuffleArray`)
- `src/engine/scenarios/built-in/klaw/plugin.ts` (use `shuffleArray`)
- `src/engine/scenarios/built-in/ultron/plugin.ts` (use `shuffleArray`)
- `src/engine/pipeline/deck-exhaustion.ts` (use `shuffleArray`)
- `src/engine/pipeline/action-dispatcher.ts` (use `shuffleArray`)
- `src/engine/pipeline/cost-engine.ts` (use `randomInt`)
- `src/engine/pipeline/combat-pipeline.ts` (use `nextEngineId`)
- `src/engine/pipeline/damage-pipeline.ts` (use `nextEngineId`)
- `src/engine/pipeline/threat-pipeline.ts` (use `nextEngineId`)
- `src/engine/pipeline/prompt-queue.ts` (use `nextEngineId`)
- `src/engine/pipeline/surge.ts` (use `nextEngineId`)
- `src/engine/effects/index.ts` (use `shuffleArray`, `randomInt`, `nextEngineId`)
- `src/engine/effects/target-choice.ts` (use `nextEngineId`)
- `src/engine/triggers/trigger-dispatcher.ts` (use `nextEngineId`)
- `src/engine/decks/deck-utils.ts` (remove `Math.random`)
- `tests/engine/rng.test.ts` (new)
- `tests/engine/deterministic-simulation.test.ts` (new)
- `tests/engine/obligation-recipient.test.ts` & candidate suite files (retrofit `shuffleFn` to seeds)
- `docs/decisions/0077-seedable-prng-and-deterministic-engine.md` (new)
- `CHANGELOG.md`

---

## 7. Decisions Taken

1. **Seed format in `setupGame`:**
   - Approved: Support both `number` and human-friendly `string` (e.g. `'mc-rhino-001'`, `'deck-exhaustion-run'`), hashed via 32-bit FNV-1a.

2. **Retrofit existing tests:**
   - Approved: Retrofit test suites currently using dummy `shuffleFn: (arr) => arr` to use explicit seeds where exact index ordering is not required, validating real repeatable shuffle dynamics. Keep lazy PRNG initialization on `state` as an engine guard for ad-hoc test fixtures.

---

## 8. Estimate

- Plan review and approval: Complete
- TDD & Implementation: ~3 hours
- Quality gates verification: ~15 minutes


