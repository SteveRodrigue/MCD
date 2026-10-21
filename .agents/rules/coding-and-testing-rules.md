---
always_on: true
description: 'Short, enforceable coding, testing, formatting and commit rules for MCD agent workflows'
---

# Coding and Testing Rules

Enforceable summary. Explanations, examples, naming tables and architecture live in [`docs/coding_guidelines.md`](../../docs/coding_guidelines.md); do not copy them here.

## TypeScript

- No `any`; use `unknown` plus a type guard. No `@ts-ignore` without a comment and an issue reference.
- Game actions and events are discriminated unions with a `type` literal.
- `GameState` stays 100% JSON-serializable (no class instances, closures, DOM nodes, cycles) and is updated immutably.
- Annotate object literals passed across boundaries (`const ctx: EffectExecutionContext = ...`). `tsc` does not flag a renamed field inside an untyped literal; also `grep` for the old name.

## Recurring-Error Guardrails (examples in `docs/coding_guidelines.md` §15)

- Validators fail closed: a check that could not run is an error; no empty `catch`.
- Identify cards by code or enum, never by name substring or regex over free-form input.
- One source of truth: derive lists, schemas and tiles from engine enums or card data; share one function for legality and payment.
- Untrusted data gets a type guard (`Array.isArray`, `typeof`), not `as any`.
- No `Date.now()`, `new Date()` or `Math.random()` in `src/engine/`; use `appendLog` and the seeded RNG.
- UI timers use `useTimeout`; dev-server writes stay inside the intended folder.
- Tests cover the resolution and fallback paths, not only explicit arguments.
- Re-check flags the same way the schema does (truthiness); run `rtk npm run deadcode` after refactors.

## Refactoring and Tech Debt (Refactor Now)

- **Single canonical path:** Never propose "we'll support both", backwards-compatibility shims, or parallel functions that differ only slightly.
- **Parameterize or merge first:** Before writing a new function, helper, or effect handler, check existing ones. Prefer adding a parameter to an existing function or merging two similar functions over adding new code.
- **Clean debt in path:** We are early in development. When a task exposes redundant, overcomplicated, or spaghetti code in its path, refactor it in scope and update all callers/card data immediately.

## Tests

- Every card ability has an automated test. Write the failing test first and watch it fail for the right reason.
- Tests pass or fail: no `it.skip`, `describe.skip`, `it.todo`, `fit`, `fdescribe` or commented-out tests. Fix failures at the root cause, never retry until green.
- **Deterministic in 1 run (no repeat loops):** A test that reveals, surges, or draws reads shuffled decks. Seed known cards on top of `state.encounterDeck` (or the player deck), see `tests/engine/heart-shaped-herb.test.ts`, and run the test **once**—never loop a test 15–25 times.
- **Targeted & non-redundant execution:** During development and task verification, run only targeted test files (`rtk npx vitest run <file>` or `rtk npx vitest related <files> --run`). Never re-run tests, `typecheck`, or `lint` if zero files changed since the last pass. The full test suite (`npm test`) runs once via `.githooks/pre-push`.
- **Consolidate test boilerplate:** Extend existing test files or use `it.each` for related variations rather than duplicating full game-setup boilerplate across multiple nearly identical tests.
- **Shared game fixtures:** Build games with `newRhinoGame` (and `dispatchOk`, `heroCard`, `abilityOf`) from `tests/support/game-fixtures.ts`. A new or touched test file does not add a local `buildGame` / `newGame` / `createMockState` that wraps `setupGame`; migrate the file's existing builders when you touch it. Tests of setup itself may call `setupGame` directly.
- Real path, real state: effects act on the zone entity that lives in `GameState` (for example the `SideSchemeState` in `state.sideSchemes`), never on a reveal-time copy. Drive the real reveal, defeat, attack or ability path (see `tests/engine/highway-robbery.test.ts`); do not call an effect with a card instance that is not in state.
- Whenever targeting changes, cover a minion as well as the villain.

## Formatting and files

- Run Prettier only on the files you changed (`npx prettier --write <files>`). On a folder it rewrites unrelated JSON and README files.
- Pack JSON under `src/data/supplemental/pack/` uses CRLF. Edit textually and check that `git diff --stat` stays small.

## Commits

- Conventional Commits (`feat`, `fix`, `test`, `docs`, `refactor`, `chore`).
- Write a multi-line or quoted message to a file and use `git commit -F <file>`; `-m` splits messages that contain quotes.
- `.githooks/pre-commit` runs `format:check`, `lint`, and `typecheck`; `.githooks/pre-push` runs `npm test`. Do not manually re-run those same commands immediately before `git commit` or `git push`.
