# Plan R7: Typed log catalog

> **Status:** Proposed, waiting for owner approval.
> **Source:** post-remediation report of code audit AUD-20261017-232534 (item R7): F009 option B (option A, `appendLog`, delivered in `b53e02e`).
> **Gate:** Tech Debt & Tooling. **Tier:** 2. **Estimate:** 1–2 days.
> **Queue:** section 3.5 of [teamwork_status_and_next_target.md](teamwork_status_and_next_target.md).

## Problem

`GameLogEntry.params` is `Record<string, string | number | boolean | string[]>` (`src/engine/models/state.ts:197`). The engine names the same role differently from one log key to the next (`who`, `player`, `actor`, `hero`, `villain`, `minion`, `attacker`), so the UI guesses in `normalizeLogParams` (`src/ui/utils/comic-log-formatter.ts:456`, about 230 lines, 172 branches at audit time; the file is 997 lines). Every new log key risks a wrong or empty log line.

## Rules / spec analysis

Not a rules change. ADR-0081 (deterministic simulation) and its F009 addendum describe `appendLog`.

## Simplification & Refactor Check

- **Inventory first:** list every `key` passed to `appendLog` with its params (script over `src/engine`, output kept in the plan's PR description, not in the repo).
- **One catalog:** `interface LogEvents { 'scenario.setup': { scenario: string; difficulty: Difficulty; ... }; ... }` in `src/engine/models/log-events.ts`; `appendLog<K extends keyof LogEvents>(state, { key: K, params: LogEvents[K], ... })`.
- **One vocabulary for roles:** `actor` (the player or character doing it), `target`, `card`, `amount` (decide the final set in the inventory step). Rename at the engine call sites.
- **Delete** the guessing branches in `normalizeLogParams` that the canonical names make unnecessary; the i18n strings move to the canonical names.
- Incremental: the generic `appendLog` overload stays only until the last key is typed, then is deleted in the same plan (no lasting dual path).

## File changes

| File                                                    | Change                            |
| ------------------------------------------------------- | --------------------------------- |
| `src/engine/models/log-events.ts` (new)                 | Catalog                           |
| `src/engine/state/game-log.ts`                          | Typed `appendLog`                 |
| About 25 engine files                                   | Canonical param names             |
| `src/ui/utils/comic-log-formatter.ts`, i18n log strings | Canonical names, branches removed |
| ADR-0081                                                | Addendum                          |

## Tests

1. Type test: `appendLog` with a wrong param name fails to compile (`expectTypeOf` / `@ts-expect-error`).
2. Formatter tests (existing) pass with the canonical names; add one per renamed role.
3. A guard test: every key in the catalog has a formatter string.

## Open decisions

1. The canonical role names (proposed: `actor`, `target`, `card`, `amount`, `source`).

## UI and Card Editor impact

Log lines should read the same; the formatter gets shorter. Card Editor: none.

## Commit

`refactor(engine): Type log params through one log event catalog` with `Refs AUD-20261017-232534 R7`.
