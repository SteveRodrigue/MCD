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

## Tests

- Every card ability has an automated test. Write the failing test first and watch it fail for the right reason.
- Tests pass or fail: no `it.skip`, `describe.skip`, `it.todo`, `fit`, `fdescribe` or commented-out tests. Fix failures at the root cause, never retry until green.
- Deterministic: a test that reveals, surges or draws reads shuffled decks. Put known filler cards on top of `state.encounterDeck` (or the player deck), see `tests/engine/heart-shaped-herb.test.ts`, and run the new file 15 to 25 times before committing.
- Real path, real state: effects act on the zone entity that lives in `GameState` (for example the `SideSchemeState` in `state.sideSchemes`), never on a reveal-time copy. Drive the real reveal, defeat, attack or ability path (see `tests/engine/highway-robbery.test.ts`); do not call an effect with a card instance that is not in state.
- Whenever targeting changes, cover a minion as well as the villain.

## Formatting and files

- Run Prettier only on the files you changed. On a folder it rewrites unrelated JSON and README files.
- Pack JSON under `src/data/supplemental/pack/` uses CRLF. Edit textually and check that `git diff --stat` stays small.

## Commits

- Conventional Commits (`feat`, `fix`, `test`, `docs`, `refactor`, `chore`).
- Write a multi-line or quoted message to a file and use `git commit -F <file>`; `-m` splits messages that contain quotes.
- The pre-push hook runs the full suite. Fix a flaky test instead of retrying; amend only a commit that has not been pushed.
