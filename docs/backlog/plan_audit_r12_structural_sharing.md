# Plan R12: Structural sharing for state updates

> **Status:** Proposed. **Tier 3 (core state model): owner decision required before any code.**
> **Source:** post-remediation report of code audit AUD-20261017-232534 (item R12): F005 option C, F012 option B, Appendix A1 and A3.
> **Gate:** Tech Debt & Tooling. **Estimate:** 2–3 days. **Depends on:** R8 (session context), so memoised components have one place to read from.
> **Queue:** section 3.5 of [teamwork_status_and_next_target.md](teamwork_status_and_next_target.md).

## Problem

Every action starts with `cloneGameState` (`action-dispatcher.ts`), and the villain phase and clean-up clone again. F005-A (`bc97330`) made the clone share card definitions, cutting clone time 54–94 %, but every other object still gets a new identity on every action. So `React.memo` and selectors cannot skip anything: the whole board re-renders per action (zero `React.memo` in `src/ui`).

## Rules / spec analysis

Not a rules change. ADR-0081 (deterministic simulation) must keep holding.

## Design options (owner picks one; Appendix A1/A3)

| Option                                                                         | Pros                                                                                | Cons                                                                                                                  |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **A. Immer `produce` around `dispatchSingleAction` (recommended to evaluate)** | Copies only changed branches; fits today's in-place mutation style; about 5 KB gzip | New runtime dependency; auto-freeze throws wherever code mutates an earlier state (finds bugs, needs a clean-up pass) |
| B. `CardInstance.cardCode` + catalog lookup (F005-B)                           | Smallest saves/replays                                                              | Rewrites every `.card.` read; biggest migration                                                                       |
| C. Keep cloning                                                                | Zero cost                                                                           | No memoisation possible                                                                                               |

Measure first: a React Profiler capture of one action (committed components) and `measure-state.ts` bytes per action, before and after. Acceptance from the audit: at least 70 % fewer bytes copied per action and fewer committed components.

## Simplification & Refactor Check (option A)

- **Delete** `cloneGameState` from the dispatcher and phase runners (replaced by `produce`); keep it only where a full copy is the point (snapshots), or delete it entirely.
- **Delete** the shared-definition WeakSet from F005-A if Immer's structural sharing makes it redundant (check: definitions are never written, so Immer leaves them shared).
- **Add** `React.memo` to the board components that read slices from the R8 context; adopt Zustand selectors only if the context still re-renders too much (A3). Otherwise do not add Zustand.

## File changes

`package.json` (immer), `src/engine/models/state.ts`, `src/engine/pipeline/action-dispatcher.ts`, `villain-phase.ts`, `player-phase-cleanup.ts`, `match-simulator.ts`, board components (`memo`), ADR (state updates), `docs/coding_guidelines.md` (no mutation of a previous state).

## Tests

- Full suite with auto-freeze on in tests (exposes mutations of earlier states).
- `npm run simulate`: same seed → same final state; time per game not worse.
- A UI test asserting that an action that changes only the villain does not re-render the hand tray (render counter).

## Open decisions

1. Option A, B or C; approve Immer as a dependency (option A).

## UI and Card Editor impact

Smoother board updates; no visible change otherwise. Card Editor: none.
