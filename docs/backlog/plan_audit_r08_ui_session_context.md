# Plan R8: One game session context; UI settings out of the game state

> **Status:** Implemented with decision 1 = keep in `state.options` (ADR-0013 addendum; per-dispatch argument tracked in #337).
> **Source:** post-remediation report of code audit AUD-20261017-232534 (item R8): F012 option A rest (the part deliberately skipped in `e3dea07`) and open question OQ-3.
> **Gate:** Tech Debt & Tooling. **Tier:** 2. **Estimate:** 1–1.5 days.
> **Queue:** section 3.5 of [teamwork_status_and_next_target.md](teamwork_status_and_next_target.md).

## Problem

- `gameState` is passed as a prop at 18 sites and `onDispatchAction` at 63 sites across the board components, while `GameStateContext` exists and is read in only 3 places (`useGameState()`).
- `App.tsx` writes UI settings (`autoResolveUnambiguous`, `villainPhaseStepping`) into `state.options` through `withUiOptions` (`App.tsx:43`) before every dispatch. ADR-0013 says UI preferences must not live in the deterministic state; OQ-3 asks whether these two are engine behaviour flags instead.
- The largest UI components (`CardPaymentModal` 1,280 lines, `HeroZone` 1,200, `PlayerHandTray` 731, `GameTable` 725) carry the props through.

## Rules / spec analysis

Not a rules change. ADR-0013 (UI preferences vs engine state), ADR-0068 (read both before deciding OQ-3). `villainPhaseStepping` changes when the engine pauses; `autoResolveUnambiguous` changes whether a one-option prompt opens. Both change the action sequence, so the same seed with different settings gives different logs.

## Simplification & Refactor Check

- **Merge** prop drilling into one `GameSessionContext { state, dispatch, playability, settings }` (extend the existing `GameStateContext` rather than adding a second context). `playability` is the per-state map built once (already in `PlayerHandTray` since `e3dea07`; move it up).
- **Delete** the `gameState` / `onDispatchAction` props from the board components and their test wrappers (tests render inside a provider helper in `tests/support/`).
- **Settings (depends on decision 1):** either `dispatchAction(state, action, { autoResolveUnambiguous, villainPhaseStepping })` and drop `withUiOptions`, or keep them in `state.options` and record that in an ADR-0013 addendum.
- No `React.memo` yet: it pays off only with stable identities (R12).

## File changes

| File                                                     | Change                                                 |
| -------------------------------------------------------- | ------------------------------------------------------ |
| `src/ui/context/GameStateContext.tsx`                    | Becomes the session context                            |
| `src/ui/App.tsx`                                         | Provider; `withUiOptions` removed or kept (decision 1) |
| `src/ui/components/board/*.tsx` (about 6 files)          | Read from context                                      |
| `src/engine/pipeline/action-dispatcher.ts`               | Options argument (if decision 1 = argument)            |
| `tests/support/render-with-session.tsx` (new) + UI tests | Provider helper                                        |
| ADR-0013                                                 | Addendum (decision 1)                                  |

## Tests

- Existing UI tests, moved to the provider helper; the Rhino smoke suite (`tests/ui/rhino-release-smoke.test.tsx`) must pass unchanged.
- If decision 1 = argument: an engine test that the same seed and settings give the same final state.

## Open decisions

1. **OQ-3:** are `autoResolveUnambiguous` and `villainPhaseStepping` UI preferences (pass them per dispatch, recommended) or engine options (keep in `state.options`)?

## UI and Card Editor impact

No visible change. Card Editor: none.

## Commit

`refactor(ui): Read game state and dispatch from one session context` with `Refs AUD-20261017-232534 R8`.
