# Marvel Champions Digital (MCD) — Coding Guidelines & Best Practices

To maintain high code quality, rules accuracy, and architectural integrity across all contributors (human and AI), all code written for **Marvel Champions Digital** must strictly adhere to these guidelines.

---

## 1. Architectural Boundaries (Strict Separation)

```
+-------------------------------------------------------------------------+
|                              src/ui/                                    |
|   (React Components, Tailwind, Framer Motion, Dialogs, Comic Panels)    |
|   ❌ NEVER contains rules calculations, HP math, or card effect logic.   |
|   ✅ ONLY renders GameState and dispatches Action commands.              |
+------------------------------------+------------------------------------+
                                     |
                          dispatches Actions / Events
                                     |
                                     v
+-------------------------------------------------------------------------+
|                            src/engine/                                  |
|   (Pure TypeScript, Headless, Deterministic, 100% Testable)             |
|   ❌ NEVER imports React, DOM, window, document, or CSS.                |
|   ✅ ONLY processes state transitions, rule checks, and trigger queues.  |
+------------------------------------+------------------------------------+
                                     |
                           ingests JSON Card Data
                                     |
                                     v
+-------------------------------------------------------------------------+
|                             src/data/                                   |
|   (MarvelsDB card schemas, static JSON definitions, card loaders)       |
|   ❌ NEVER mutates or writes to data/upstream/ (zzorba raw files).      |
|   ✅ ONLY reads upstream data and applies overrides in src/data/overrides|
+-------------------------------------------------------------------------+
```

### Golden Rules:
1. **`src/engine/` must be 100% headless.** You should be able to run the entire game from a Node.js CLI script or a Vitest test runner without loading a browser.
2. **`data/upstream/` is strictly READ-ONLY.** MCD application code, importers, and scripts must NEVER write to, modify, or delete raw upstream files. Any corrections, errata, or engine hooks must be declared in `src/data/supplemental/`.

3. **Dependency Direction (Strict Invariant):**
```
src/ui/ ──> src/engine/ ──> src/data/ (supplemental + importer) ──> data/upstream/ (read-only)
```
* `src/data/` has **ZERO** dependencies on `src/engine/` or `src/ui/`.
* `src/engine/` has **ZERO** dependencies on React, DOM, or `src/ui/`.
* `src/ui/` imports state and actions from `src/engine/` and never mutates state directly.

4. **Official Rules Fidelity & Errata Enforcement:**
* **The Golden Rule:** Card text overrides general rules; when card text is ambiguous, RR v1.8 governs.
* **Official Errata Enforcement:** Any card with an official FFG errata in RR v1.8 must have its corrected text and behavior declared via `errata: "..."` in `src/data/supplemental/`. This automatically renders an **[ERRATA]** indicator in the UI. Whenever engine rules or card mechanics are added or modified, developers must ensure `docs/algorithmic_rules_reference.md` is updated in lockstep to keep the algorithmic specification 100% synchronized.
5. **Documentation-First Rule Search:** Before implementing any game rule, action, or card interaction, developers and AI agents must thoroughly search and cross-reference the official rulebooks for exact keyword definitions, edge cases, and rulings. Never rely on generic assumptions or mechanics from other card games.
6. **Proactive User Consultation:** Whenever a rule, card interaction, or design choice has ambiguity or multiple possible interpretations, stop and consult the user for clarification before making assumptions.

---

## 2. Rules Authority, Algorithmic Specification & Errata Standards

* **Authoritative Source:** When designing engine logic or unit tests, always cite and verify against the **Rules Reference v1.8** (`references/mc_rulesreference_v18_compressed.pdf`).
* **Algorithmic Specification:** Consult and update **[docs/algorithmic_rules_reference.md](docs/algorithmic_rules_reference.md)** as the living pseudocode and state-machine blueprint for all game pipelines.
* **Superseding Rule:** If any contradiction or discrepancy exists between the *Learn to Play Guide* and the *Rules Reference*, the **Rules Reference v1.8 strictly supersedes and prevails**.
* **Search & Verification Requirement:** Thoroughly search the PDF text for exact keywords (e.g. *Form*, *Change Form*, *Guard*, *Patrol*, *Crisis*, *Boost*, *Interrupt*, *Replacement*, *Defend*, *Surge*, *Overkill*, *Piercing*, *Villain Phase*, *Consequential Damage*) before coding mechanics.
* **The Golden Rule:** Card text overrides general rules; when card text is ambiguous, RR v1.8 governs.
* **Official Errata Enforcement:** Any card with an official FFG errata in RR v1.8 must have its corrected text and behavior implemented via `src/data/overrides/`.
* **Clarifications & Ambiguities:** If any rule or card interaction is ambiguous or underspecified, proactively ask the user.

---

## 3. TypeScript & Type Safety Standards

1. **Strict Typing Always:**
   * No `any` types. If a type is truly unknown until runtime, use `unknown` with a custom type guard function.
   * Do not disable ESLint/TypeScript strict checks with `@ts-ignore` unless accompanied by an explanatory comment and an issue reference.
2. **Discriminated Unions for Actions & Events:**
   * All game actions and events must use discriminated unions with a `type` literal:
   ```typescript
   export type GameAction =
     | { type: 'PLAY_CARD'; playerId: string; cardId: string; payment: PaymentPlan }
     | { type: 'BASIC_ATTACK'; playerId: string; targetId: string }
     | { type: 'BASIC_THWART'; playerId: string; schemeId: string }
     | { type: 'RECOVER'; playerId: string }
     | { type: 'FLIP_IDENTITY'; playerId: string };
   ```
3. **State Immutability & Serialization:**
   * `GameState` must be 100% JSON-serializable (plain objects, arrays, numbers, strings, booleans).
   * **Do not** store class instances, closures, functions, DOM elements, or circular references inside `GameState`.
   * State updates must be immutable (using pure functions, structural cloning, or state reducers).

---

## 4. Card Implementation Standards (Declarative Card DSL)

Each card implementation must follow a predictable, declarative pattern:

1. **Card Code Identification:**
   * Every card must reference its canonical MarvelsDB code (e.g. `01001a` for Peter Parker, `01001b` for Spider-Man, `01005` for Web-Shooter).
2. **Standardized Trigger Windows:**
   * Abilities must explicitly declare their trigger window:
     * `Action` / `Hero Action` / `Alter-Ego Action`
     * `Forced Interrupt` / `Interrupt`
     * `Forced Response` / `Response`
     * `Resource` / `Hero Resource`
     * `Constant`
3. **Keyword & Trait Constants:**
   * Never use raw string comparisons for traits or keywords. Use defined enums/consts:
   ```typescript
   // ❌ BAD
   if (card.traits.includes("Avenger")) { ... }

   // ✅ GOOD
   import { Trait } from '@engine/models/traits';
   if (card.traits.includes(Trait.AVENGER)) { ... }
   ```

---

## 5. Iterative Development & Test Recursion (Micro-Iterations)

To ensure stability, prevent regressions, and maintain high velocity, all development must follow a **strict micro-iteration workflow**:

```
+-------------------------------------------------------------------------+
|                        The Micro-Iteration Loop                         |
|                                                                         |
|  1. Pick ONE small feature/card (e.g. "Spider-Man Backflip interrupt")  |
|                                   │                                     |
|                                   ▼                                     |
|  2. Write the automated unit test (Arrange-Act-Assert)                  |
|                                   │                                     |
|                                   ▼                                     |
|  3. Implement the minimal code to satisfy the test                      |
|                                   │                                     |
|                                   ▼                                     |
|  4. RECURSIVE TEST RUN: Run the ENTIRE test suite (`npm test`)          |
|     Ensure ZERO regressions across all previously implemented cards.    |
|                                   │                                     |
|                                   ▼                                     |
|  5. Commit atomically (e.g. `feat(card): implement Backflip interrupt`) |
+-------------------------------------------------------------------------+
```

### Key Rules for Iterative Execution:
1. **Small, Atomic Scope:** Never attempt to implement multiple cards or complex engine systems in a single unverified leap. Build one card, one keyword, or one phase step at a time.
2. **Continuous Test Recursion:** Whenever changing core engine pipelines (trigger bus, payment resolution, threat calculations), the entire test suite must re-run recursively to guarantee that older cards and rules still function correctly.
3. **No Dead Code / Unverified Logic:** Every function or card effect added must be immediately exercised by an active test.

---

## 6. Test-Driven Development (TDD) Standards

1. **No Card Without a Test:**
   * Every hero ability, event card, upgrade, attachment, and villain activation must have automated tests in `tests/`.
2. **Follow the AAA Pattern (Arrange - Act - Assert):**
   ```typescript
   it('triggers Spider-Sense when the villain initiates an attack', () => {
     // Arrange
     const state = createTestGame({
       hero: '01001b', // Spider-Man
       villain: '01094', // Rhino
       hand: ['01009'], // Backflip in hand
     });
     const initialHandSize = state.players[0].hand.length;

     // Act
     const nextState = engine.stepVillainAttack(state, { targetPlayerId: 'player-1' });

     // Assert
     expect(nextState.players[0].hand.length).toBe(initialHandSize + 1); // Spider-Sense drew 1 card
   });
   ```
3. **Fast Execution:**
   * Unit tests must remain lightweight and headless. The entire test suite should execute in < 2 seconds.

---

## 5. Localization (i18n) Standards

1. **Zero Hardcoded Display Strings:**
   * All user-facing text, dialogs, button labels, and system log descriptions must use translation keys via `t('key')` or locale catalogs.
   ```tsx
   // ❌ BAD
   <button>End Turn</button>

   // ✅ GOOD
   <button>{t('game.actions.endTurn')}</button>
   ```
2. **Translation Key Hierarchy:**
   * Keys must be structured hierarchically in JSON:
     * `game.phases.*`
     * `game.actions.*`
     * `keywords.*`
     * `status.*`
     * `prompts.*`

---

## 6. Code Style & Naming Conventions

| Category | Convention | Example |
| :--- | :--- | :--- |
| **Interfaces / Types** | PascalCase | `GameState`, `CardDefinition`, `GameAction` |
| **Enums / Const Objects** | PascalCase (name) / UPPER_SNAKE (values) | `Phase.PLAYER_PHASE`, `Trait.WEB_WARRIOR` |
| **Functions / Methods** | camelCase | `calculateDamage()`, `resolveTrigger()` |
| **React Components** | PascalCase | `HeroPlaymat.tsx`, `ComicOnomatopoeia.tsx` |
| **Constants** | UPPER_SNAKE_CASE | `MAX_HAND_SIZE`, `DEFAULT_THREAT` |
| **File Names** | kebab-case or camelCase (matching module standard) | `game-state.ts`, `card-loader.ts` |

---

## 7. Git & Commit Message Standards

We use [Conventional Commits](https://www.conventionalcommits.org/):

* `feat:` A new feature or card ability implementation (e.g. `feat(engine): implement Tough replacement effect`)
* `fix:` A bug fix in rules or UI (e.g. `fix(rules): prevent thwart when Patrol minion is active`)
* `test:` Adding or refactoring test suites (e.g. `test(hero): add unit tests for Spider-Man Backflip`)
* `docs:` Documentation or ADR updates (e.g. `docs(adr): add ADR-0006`)
* `refactor:` Code restructuring without changing external behavior
* `chore:` Build scripts, package updates, CI changes

---

## 8. UI Layering, Stacking Contexts & Z-Axis Zoom Standards

1. **Unconstrained Z-Axis Elevation for Interactive Elements:**
   * Interactive card containers (such as `PlayerHandTray` and tabletop zones) must maintain `overflow-visible` so elevated/hovered elements can project into the 3D Z-axis without triggering clipping boundaries or scrollbar spawning.
   * Never place `overflow-x: auto` or `overflow: hidden` on a container whose child elements perform scale transforms on hover (`hover:scale-[1.85]`).
2. **Layering (Z-Index) Hierarchy:**
   * Base Tabletop Layers: `z-0` to `z-10`
   * Bottom Hand Tray Base: `z-20`
   * Sticky Navigation / Header: `z-30`
   * Hovered / Elevated Interactive Cards: `z-50` (with deep drop shadows)
   * Modals & Drawers (Combat Log, Payment Modal): `z-50` to `z-60`
