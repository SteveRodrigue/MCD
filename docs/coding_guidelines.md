# Marvel Champions Digital (MCD) — Coding Guidelines & Best Practices

> **Agents:** the short, enforceable subset of these guidelines (types, tests, formatting, commits) is in [`.agents/rules/coding-and-testing-rules.md`](../.agents/rules/coding-and-testing-rules.md), which is always loaded. Keep the two consistent; put new enforceable rules there and explanations here.

To maintain high code quality, rules accuracy, and architectural integrity across all contributors (human and AI), all code written for **Marvel Champions Digital** must strictly adhere to these guidelines.

---

## 1. Architectural Boundaries (Strict Separation)

```
+-------------------------------------------------------------------------+
|                              src/ui/                                    |
|   (React Components, Tailwind, Dialogs, Comic Panels)                    |
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
|   ✅ ONLY reads upstream data and applies overrides in src/data/supplemental|
+-------------------------------------------------------------------------+
```

### Golden Rules:

1. **`src/engine/` must be 100% headless.** You should be able to run the entire game from a Node.js CLI script or a Vitest test runner without loading a browser.
2. **`data/upstream/` is strictly READ-ONLY.** MCD application code, importers, and scripts must NEVER write to, modify, or delete raw upstream files. Any corrections, errata, or engine hooks must be declared in `src/data/supplemental/`.

3. **Dependency Direction (Strict Invariant):**

```
src/ui/ ──> src/engine/ ──> src/data/ (supplemental + importer) ──> data/upstream/ (read-only)
```

- `src/data/` may import only `@engine/models` (types and enums). It never imports engine pipeline or effects code, or `src/ui/`.
- `src/engine/` has **ZERO** dependencies on React, DOM, or `src/ui/`.
- `src/ui/` imports state and actions from `src/engine/` and never mutates state directly.

4. **Official Rules Fidelity & Errata Enforcement:**

- **The Golden Rule:** Card text overrides general rules; when card text is ambiguous, RR v1.8 governs.
- **Official Errata Enforcement:** Any card with an official FFG errata in RR v1.8 must have its corrected text and behavior declared via `errata: "..."` in `src/data/supplemental/`. This automatically renders an **[ERRATA]** indicator in the UI. Whenever engine rules or card mechanics are added or modified, developers must ensure `docs/algorithmic_rules_reference.md` is updated in lockstep to keep the algorithmic specification 100% synchronized.

5. **Documentation-First Rule Search:** Before implementing any game rule, action, or card interaction, developers and AI agents must thoroughly search and cross-reference the official rulebooks for exact keyword definitions, edge cases, and rulings. Never rely on generic assumptions or mechanics from other card games.
6. **Proactive User Consultation:** Whenever a rule, card interaction, or design choice has ambiguity or multiple possible interpretations, stop and consult the user for clarification before making assumptions.

---

## 2. Rules Authority, Algorithmic Specification & Errata Standards

The Golden Rule, errata enforcement and algorithmic-spec sync are defined in §1.4. If a rule or card interaction is ambiguous or underspecified, ask the user (§1.6).

---

## 3. Architectural Subsystem Completion & Supplemental Review Pipeline

Whenever an architectural subsystem, engine pipeline, or effect primitive is implemented, refactored, or fixed (e.g. Action Costs, Dynamic Stat Calculator, Search Pipeline, Nested Stack):

### 1. Mandatory Supplemental Review Trigger

- The developer or AI agent **MUST immediately run a review pass** using the `card-integration-protocol` skill across all cards in `docs/ambiguities/` whose blocker was related to that subsystem.
- Developers must **NOT** defer reviewing blocked cards to later sprints once the enabling engine feature is in place.

### 2. Standardized 4-Step Resolution Workflow:

1. **Supplemental Translation:** Update the card's entry in `src/data/supplemental/pack/*.json` using the newly implemented primitive, ensuring it passes `SupplementalPackSchema` validation (`npm test`).
2. **Automated Unit Tests:** Add regression unit tests in `tests/engine/` verifying the card's mechanics end-to-end.
3. **Inbox Zero Pruning:** Elevate the card's audit confidence to $\ge 95\%$ and delete the corresponding file in `docs/ambiguities/` (Inbox Zero).
4. **GitHub Issue Closure:** Close the tracking GitHub Issue via `gh issue close <id>` referencing the commit and test file.

---

## 4. TypeScript & Type Safety Standards

1. **Strict Typing Always:**
   - No `any` types. If a type is truly unknown until runtime, use `unknown` with a custom type guard function.
   - Do not disable ESLint/TypeScript strict checks with `@ts-ignore` unless accompanied by an explanatory comment and an issue reference.
2. **Discriminated Unions for Actions & Events:**
   - All game actions and events must use discriminated unions with a `type` literal:
   ```typescript
   export type GameAction =
     | { type: 'PLAY_CARD'; playerId: string; cardId: string; payment: PaymentPlan }
     | { type: 'BASIC_ATTACK'; playerId: string; targetId: string }
     | { type: 'BASIC_THWART'; playerId: string; schemeId: string }
     | { type: 'RECOVER'; playerId: string }
     | { type: 'FLIP_IDENTITY'; playerId: string };
   ```
3. **State Immutability & Serialization:**
   - `GameState` must be 100% JSON-serializable (plain objects, arrays, numbers, strings, booleans).
   - **Do not** store class instances, closures, functions, DOM elements, or circular references inside `GameState`.
   - State updates must be immutable. Produce a next state with `updateGameState(state, (draft) => { ... })` (ADR-0089); **never** write to a state the engine returned (it is frozen and shared with the previous state).
   - Card definitions (`CardInstance.card`, `player.hero`, `villain.card`, ...) are catalog objects shared by every state. **Never** write to them (`inst.card.health = 5`); replace the reference instead (`inst.card = { ...inst.card, health: 5 }`). Tests run with the catalog frozen; `tests/support/card-overrides.ts` swaps a card everywhere in a test state.

---

## 5. Card Implementation Standards (Declarative Card DSL)

Each card implementation must follow a predictable, declarative pattern:

1. **Card Code Identification:**
   - Every card must reference its canonical MarvelsDB code (e.g. `01001a` for Peter Parker, `01001b` for Spider-Man, `01005` for Web-Shooter).
2. **Standardized Timing Windows:**
   - Every ability declares `timing` from `TimingTypeSchema` (`src/data/supplemental/schema-primitives.ts`), e.g. `ACTION`, `HERO_ACTION`, `INTERRUPT`, `FORCED_RESPONSE`, `RESOURCE`, `CONSTANT`. Do not invent timing strings.
3. **Trait Checks Go Through Helpers:**
   - Traits are plain card strings. Do not hand-roll `traits.includes(...)` chains in new code; use `hasPlayerTrait` / `getEffectiveCardTraits` (`src/engine/pipeline/stat-calculator.ts`) so trait modifiers apply.
   ```typescript
   // ❌ BAD: ignores effective-trait modifiers
   if (card.traits?.includes('Avenger')) { ... }

   // ✅ GOOD
   if (hasPlayerTrait(player, 'Avenger', state)) { ... }
   ```

---

## 6. Iterative Development, Refactor-First & Targeted Testing

To ensure stability, prevent technical debt, and maintain high velocity, all development follows a **Refactor-First, Targeted-Verification workflow**:

```
+-------------------------------------------------------------------------+
|                        The Micro-Iteration Loop                         |
|                                                                         |
|  1. Pick ONE small feature/card (e.g. "Spider-Man Backflip interrupt")  |
|                                   │                                     |
|                                   ▼                                     |
|  2. Refactor-First Check: Reuse, parameterize, or merge existing logic  |
|                                   │                                     |
|                                   ▼                                     |
|  3. Write/extend the automated unit test (Arrange-Act-Assert)           |
|                                   │                                     |
|                                   ▼                                     |
|  4. Implement the minimal code & clean any tech debt in the path        |
|                                   │                                     |
|                                   ▼                                     |
|  5. TARGETED TEST RUN: Run `vitest run <file>` or `vitest related`      |
|     (Full suite `npm test` runs once via `.githooks/pre-push`)          |
|                                   │                                     |
|                                   ▼                                     |
|  6. Commit atomically (e.g. `feat(data): implement Backflip interrupt`) |
+-------------------------------------------------------------------------+
```

### Key Rules for Iterative Execution:

1. **Refactor-First (Zero Additive Bloat):** Never propose "supporting both" or duplicating functions for minor variations. If two functions are very similar, merge them or add a parameter to the existing function. If you encounter spaghetti or redundant code in the path of your change, refactor it in scope and update all callers.
2. **Small, Atomic Scope:** Never attempt to implement multiple cards or complex engine systems in a single unverified leap. Build one card, one keyword, or one phase step at a time.
3. **Targeted Test Execution (No Redundant Runs):** Run only the targeted test file (`rtk npx vitest run <file>`) or related tests (`rtk npx vitest related <files> --run`) during iteration. Do not re-run tests, `typecheck`, or `lint` when no files have changed since the last pass. Leave the full suite (`npm test`) to `.githooks/pre-push`.
4. **No Dead Code / Unverified Logic:** Every function or card effect added must be immediately exercised by an active test.

---

## 7. Test-Driven Development (TDD) Standards

1. **No Card Without a Test:**
   - Every hero ability, event card, upgrade, attachment, and villain activation must have automated tests in `tests/`.
2. **Follow the AAA Pattern (Arrange - Act - Assert):**
   ```typescript
   // See tests/engine/heart-shaped-herb.test.ts for the full setup helper.
   it('gives the villain a tough status card when Heart-Shaped Herb is revealed', () => {
     // Arrange
     const state = setup(); // setupGame({ scenarioId: 'rhino', players: [...], skipMulligan: true })
     state.players[0].dealtEncounterCards.push(createCardInstance(cardCatalog.getCard('01158')!));

     // Act
     const next = step4_revealEncounterCards(state);

     // Assert
     expect(toughCount(getActiveVillain(next))).toBe(1);
   });
   ```
3. **Fast Execution:**
   - Unit tests must remain lightweight and headless. Keep each test file fast (no I/O, no timers, no network); the full suite takes about 20-30 seconds and runs once via `.githooks/pre-push`.
4. **🚫 Zero Skipped Tests Invariant (Never Allow Skipped Tests):**
   - **Binary Outcome Only:** Tests must either strictly PASS or FAIL. There is no middle ground, no deferred state, and no `it.skip`, `describe.skip`, `test.skip`, `it.todo`, `fit`, `fdescribe`, or commented-out test assertions.
   - **Fix Problems As They Are Found:** When a test fails or a regression is discovered, diagnose and resolve it immediately at the root cause. Never bypass, skip, or disable tests to force a green pipeline.
   - **Zero Lingering Code / Problems:** If an old test asserted superseded engine semantics (e.g. legacy synchronous behavior replaced by interactive decision prompts under an accepted ADR) and dedicated contract tests already verify the modern architecture, prune and delete the obsolete test completely rather than leaving it skipped. Lingering skipped tests are strictly forbidden as tech debt.
   - **Full Suite Invariant:** Verification across all environments must always enforce `0 failed | 0 skipped | 100% green`.
5. **Coverage Thresholds as a Ratchet:**
   - Coverage thresholds in `vitest.config.ts` are a ratchet (raise when coverage rises, never lower).

---

## 8. Localization (i18n) Standards (ADR-0005)

Current state: only the comic game log is localized. There is no general `t()` helper yet; the rest of the UI uses plain strings.

1. **Comic Log Text Lives in Locale Files:**
   - Narrator, onomatopoeia and dialogue strings are templates in `src/locales/<lang>/combat-log.json` (`en`, `fr`), filled with `interpolateTemplate` in `src/ui/utils/comic-log-formatter.ts` (`{{round}}`-style placeholders).
   - Add a key to every language file in the same change.
   ```typescript
   // ❌ BAD: display text hardcoded in the formatter
   return 'ROUND ' + round + ': THE BATTLE INTENSIFIES!';

   // ✅ GOOD: template in combat-log.json, filled at render time
   interpolateTemplate(dict.narrator.round_header, { round });
   ```
2. **Do Not Invent an i18n API:**
   - Do not add `t('...')` calls or new key trees outside the combat log without a plan and ADR-0005 update. New localization infrastructure is a planned feature, not a side effect of a UI change.

---

## 9. Code Style & Naming Conventions

| Category                  | Convention                                         | Example                                         |
| :------------------------ | :------------------------------------------------- | :---------------------------------------------- |
| **Interfaces / Types**    | PascalCase                                         | `GameState`, `CardDefinition`, `GameAction`     |
| **Enums / Const Objects** | PascalCase (name) / UPPER_SNAKE (members)          | `CardType`, `Keyword.GUARD`, `StatusCard.TOUGH` |
| **Functions / Methods**   | camelCase                                          | `calculateDamage()`, `resolveTrigger()`         |
| **React Components**      | PascalCase                                         | `HeroPlaymat.tsx`, `ComicOnomatopoeia.tsx`      |
| **Constants**             | UPPER_SNAKE_CASE                                   | `EFFECT_HANDLERS`, `FACT_PRODUCERS`             |
| **File Names**            | kebab-case or camelCase (matching module standard) | `game-state.ts`, `card-loader.ts`               |

---

## 10. Git & Commit Message Standards

We use [Conventional Commits](https://www.conventionalcommits.org/). Scopes: `engine`, `ui`, `data`, `tooling`, `docs`, `tests` (full matrix in the `commit-and-push` skill):

- `feat:` A new feature or card ability implementation (e.g. `feat(engine): implement Tough replacement effect`)
- `fix:` A bug fix in rules or UI (e.g. `fix(engine): prevent thwart when Patrol minion is active`)
- `test:` Adding or refactoring test suites (e.g. `test(engine): add unit tests for Spider-Man Backflip`)
- `docs:` Documentation or ADR updates (e.g. `docs(docs): add ADR-0006`)
- `refactor:` Code restructuring without changing external behavior
- `chore:` Build scripts, package updates, CI changes

---

## 11. UI Layering, Stacking Contexts & Z-Axis Zoom Standards

1. **Unconstrained Z-Axis Elevation for Interactive Elements:**
   - Interactive card containers (such as `PlayerHandTray` and tabletop zones) must maintain `overflow-visible` so elevated/hovered elements can project into the 3D Z-axis without triggering clipping boundaries or scrollbar spawning.
   - Never place `overflow-x: auto` or `overflow: hidden` on a container whose child elements perform scale transforms on hover (`hover:scale-[1.85]`).
2. **Layering (Z-Index) Hierarchy (ADR-0082):**
   - Use only the named scale from `src/ui/styles/z-layers.ts` (`z-table` 0, `z-content` 100, `z-raised` 200, `z-zoom` 400, `z-sticky` 500, `z-drawer` 600, `z-modal` 700, `z-banner` 800, `z-menu` 900, `z-critical` 1000). Numeric or arbitrary z classes and numeric `zIndex` literals fail `tests/ui/z-literal-guard.test.ts`.
   - Every modal, drawer or banner renders through `ModalLayer` (portal to `document.body`), never inline.
   - Fans are `isolate`d, raise themselves with `hover:z-zoom focus-within:z-zoom`, and compute card z with `getFanZIndex` (`src/ui/components/cards/fan-z.ts`). Never derive fan z from a fixed constant.
   - Do not put `overflow-x-hidden` / `overflow-*-auto` on an ancestor of the sticky TopBar; use `overflow-x-clip`.
   - Full ladder and fan rules: [ADR-0082, Appendix A](decisions/0082-ui-z-index-scale-and-fan-pattern.md#appendix-a-layer-map).

---

## 12. Comic Typography & UI Scaling Standards (ADR-0004, ADR-0037)

1. **Local-First Font Assets:**
   - Never rely on runtime external CDNs for typography. All comic fonts (`Komika Text`, `Comic Relief`, `Bangers`) must be bundled locally in `public/fonts/` or `@fontsource` packages for complete offline play.
2. **Typographic Roles:**
   - **Dialogue & Narrative Prose:** Use `font-dialogue` (`Komika Text` / `Comic Relief`) with bold weight for high legibility in multi-line speech bubbles.
   - **Sound Effects & Banners:** Use `font-comic` (`Bangers`) for explosive onomatopoeias (`POW!`, `HEROES ASSEMBLE!`) and mastheads.
   - **Numbers:** `font-comic` and `.font-bangers` start with the `Body Digits` face (`src/ui/styles/index.css`), which covers only `0–9` (`unicode-range: U+0030-0039`) and maps to the body font (Inter Bold). Digits stay readable (Bangers' 1 and 7 look alike) with no per-element class; keep `Body Digits` first in both stacks. Themes that set their own headline font (see `docs/templates/modals/FONT_RECORD.md`) do not use it.
3. **Base UI Scale:**
   - The application uses `html { font-size: 110%; }` to deliver an immersive tabletop scale at standard 100% browser zoom. All component dimensions and spacings should utilize Tailwind `rem`-based classes (`p-4`, `w-44`, `text-sm`, etc.) to benefit from uniform scaling.

---

## 13. Local-First Card Art & Static Asset Pipeline (ADR-0011)

1. **Local Static Art Resolution (`/cards/:fileName`):**
   - The primary resolution route for all card artwork is the local static endpoint `/cards/${code}${side}.png`.
   - In development mode, the Vite server plugin intercepts `/cards/:fileName` and streams assets from `cache/cards/`.
   - In production builds, `cache/cards/` is bundled directly to `dist/cards/` to ensure offline desktop/web play without internet access.
2. **Dual-Tier CDN & Vector Fallback (`CardView.tsx`):**
   - If a card image is missing from the local disk cache (404), the `CardView` component catches `onError` and falls back dynamically to the remote MarvelCDB CDN.
   - If offline and without cached images, it falls back to the stylized Comic Pop-Art vector card.

---

## 14. Declarative Schema Taxonomy & Naming Invariants (ADR-0058)

All card ability definitions in `src/data/supplemental/` and primitive handlers in `src/engine/` must strictly adhere to the 5 core naming invariants:

1. **"CARD" Token is Superfluous:** In a card game engine, `DRAW`, `DISCARD`, `ENTERS_PLAY`, `REVEAL` operate on cards by default. Omit the token `CARD` from primitives, triggers, and selectors unless required for disambiguation (e.g., `CARD_ATTRIBUTE` vs `STAT_VALUE`).
2. **Grammatical Category Standards:**
   - **Triggers (Events):** `[SUBJECT]_[VERB_TENSE]` (e.g. `DAMAGE_TAKEN`, `SCHEME_DEFEATED`, `ROUND_ENDED`).
   - **Effect Primitives (Commands):** `[IMPERATIVE_VERB]_[TARGET_OR_QUALIFIER]` (e.g. `DRAW`, `DEAL_DAMAGE`, `ADD_COUNTERS`, `REMOVE_THREAT`, `MODIFY_STAT`).
3. **Temporal Verb Tenses (RR v1.8 Priority):**
   - **Interrupts (Prospective/Pre-Resolution):** Subjunctive `_WOULD_BE_` or `_INITIATES_` (e.g. `DAMAGE_WOULD_BE_TAKEN`, `THREAT_WOULD_BE_PLACED`, `ENEMY_INITIATES_ATTACK`).
   - **Responses (Post-Resolution):** Past participle (e.g. `DAMAGE_TAKEN`, `THREAT_PLACED`, `CARD_PLAYED`, `DEFEATED`, `ROUND_ENDED`).
4. **Strict Pluralization for Multi-Entity Operations:** Operations that can affect 1 to $N$ items use plural names (e.g. `ADD_COUNTERS`, `REMOVE_COUNTERS`, `DRAW`, `DISCARD`). Dual single/plural variant names (like `ADD_COUNTER` / `ADD_COUNTERS`) are prohibited.
5. **Zero Single-Use / Legacy Tech Debt:** Bespoke, single-card primitives are not allowed: express the card with composable primitives + `DynamicValueSource`.

---

## 15. Recurring-Error Guardrails

Each rule below comes from a defect found in code review or a fix commit. Check them before you open a PR.

1. **Validators fail closed.** A check that could not run is an error, never a pass. No empty `catch`, no silent skip.

   ```typescript
   // ❌ BAD: lookup fails, check is skipped, validation still "passes"
   try {
     type = extractCard(code)?.type_code;
   } catch {
     /* ignore */
   }

   // ✅ GOOD: say the check could not run
   if (!type)
     errors.push({ path: 'type', message: 'Card type unresolved; pass it as the 2nd argument.' });
   ```

2. **Identify by code, never by text.** Match cards by `cardCode` or an enum. Do not use name substrings or a regex over free-form input.

   ```typescript
   // ❌ BAD
   if (option.label.includes('Wakanda')) ...      // input.match(/\d{5}/) on raw JSON
   // ✅ GOOD
   if (option.cardCode === WAKANDA_FOREVER_CODE) ... // code taken from a field or a file name
   ```

3. **One source of truth.** Derive lists, schemas and UI tiles from the engine enums or card data. Do not retype them. When legality and payment need the same number, share one function.

   ```typescript
   // ❌ BAD: second hand-typed list that drifts
   const TYPES = ['hero', 'event', 'upgrade'];
   // ✅ GOOD
   const TYPES = Object.values(CardType);
   ```

4. **Untrusted data gets a type guard, not a cast.** No `as any`. Check shape (`Array.isArray`, `typeof`) before use. Use one typed helper instead of repeated casts.

   ```typescript
   // ❌ BAD
   (parsed as any).abilities.some(...)
   // ✅ GOOD
   const abilities = Array.isArray(data?.abilities) ? data.abilities : [];
   ```

5. **Engine is deterministic.** No `Date.now()`, `new Date()` or `Math.random()` in `src/engine/`. Write the log through `appendLog`. Use the seeded RNG in `src/engine/state/rng.ts` (its unseeded bootstrap is the only permitted `Math.random()`).

6. **UI timers are owned.** Use the `useTimeout` hook. A bare `setTimeout` that sets state leaks after unmount.

7. **Dev-server writes are confined.** Resolve the target path and check that it stays inside the intended folder before writing.

8. **Tests exercise the path that changed.** Cover resolution and fallback paths, not only the explicit-argument path. Never assume a random seed: pick by text or seed the deck.

   ```typescript
   // ❌ BAD: always passes 'event', so the lookup path is never tested
   validateCardInput(payload, 'event');
   // ✅ GOOD: also test the file-name path (supp_01003.json) and the unresolved case
   ```

9. **Match the existing check.** If the schema tests a flag by truthiness, a helper that re-checks it must too (`Boolean(x)`, not `x === true`). Otherwise a bad value passes one layer and fails another.

10. **Delete what you orphan.** Run `rtk npm run deadcode` after refactors. Remove unused exports in the same change.

11. **Legality has one gate.** Every "can this be played, used or offered now?" question goes through `legality-checker.ts` and the target-validity gate `checkAbilityTargets` (`src/engine/effects/target-choice.ts`, ADR-0090): trigger scans, queued prompts, prompt answers, action buttons, event play and the UI (through the engine) all ask it. Fix a legality defect in the gate, for every caller. Crisis, Patrol and Guard are read only in `src/engine/pipeline/target-restrictions.ts` (`getMainSchemeThreatBlock`, `isVillainAttackBlockedByGuard`); basic attack and thwart go through `canAttack` / `canThwart`. A new effect adds a rule to `AFFECT_RULES` (or a reasoned entry in `EFFECTS_WITHOUT_AFFECT_RULE`); never add an effect-name or selector check in a caller. `tests/engine/legality-gate-guards.test.ts` fails on a new one.

    ```typescript
    // ❌ BAD: a caller decides what "ready" needs, so READY on SELF_HERO slips through
    if (step.effect === 'READY') filter = { exhausted: true };
    const targets = getEligibleTargets(state, player, scope, filter);

    // ✅ GOOD: ask the gate; the rule lives in AFFECT_RULES once
    const targets = getValidStepTargets(state, player, step, { sourceCardInstance });
    const { allowed, reason } = kernel.checkAbilityTargets(state, player, ability, source);
    ```

12. **Modals go through the scaffold.** A new modal renders through `ModalScaffold` (`src/ui/theme/`, ADR-0091) and takes its colours from the active theme's tokens (`useModalStyle()`: `style.panel`, `style.option`, `style.btnGo`...); never write a frame, header or button palette by hand, and never build a Tailwind class by interpolation (`text-${hue}-300`: the scanner cannot see it). Use `border-[3px]`, not `border-3` (no such utility). Every time a card is named, its text shown, its ability used or it triggered the modal, show its thumbnail: write names with `CardRef`, mark a container that shows the card with `data-card-anchor`, and let `tests/ui/themed-modals-matrix.test.tsx` run the modal under every theme. Details: `docs/templates/modals/README.md`.
