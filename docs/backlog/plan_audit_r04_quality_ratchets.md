# Plan R4: Quality ratchets (coverage thresholds, dead-export report)

> **Status:** Proposed, waiting for owner approval.
> **Source:** post-remediation report of code audit AUD-20261017-232534 (item R4); audit options F007-B and F017-B, Appendix A2.
> **Gate:** Tech Debt & Tooling. **Tier:** 1 (adds a dev dependency: owner approval). **Estimate:** 3–4 h.
> **Queue:** section 3.5 of [teamwork_status_and_next_target.md](teamwork_status_and_next_target.md).

## Problem

1. `vitest.config.ts` now includes every `src` file in coverage (F007, `84b9e0d`) but has no thresholds, so coverage can drop without a failing gate.
2. Unused exports were removed once by hand (F017, `59550d8`: 27 deleted, 75 un-exported). Nothing stops new ones.

## Rules / spec analysis

Not a rules change. Policy: `.agents/rules/shared-quality-gates.md` (read it first; thresholds must not conflict with the lean-testing policy, which leaves the full suite to `pre-push`).

## Simplification & Refactor Check

- **Coverage:** add `coverage.thresholds` per folder in the existing `vitest.config.ts` block. Set each threshold to the measured value rounded **down** to the nearest whole percent (a ratchet, not a target), for `src/engine/**` and `src/ui/**`. No new script.
- **Dead exports:** Appendix A2 compared `knip`, `ts-prune` (maintenance mode) and keeping the audit script. Recommended: `knip` as a **non-blocking** `npm run deadcode` report, promoted to blocking after a month without false positives. Configure entries for JSON-driven reachability (supplemental packs, `ScenarioRegistry`, special registry) to avoid false positives.
- **Delete** nothing; the ad-hoc `logs/reports/code-audit/_work-*/analyze.ts` stays local (gitignored).

## File changes

| File                                                          | Change                                                             |
| ------------------------------------------------------------- | ------------------------------------------------------------------ |
| `vitest.config.ts`                                            | `coverage.thresholds` per folder                                   |
| `package.json`                                                | `knip` dev dependency; `deadcode` script                           |
| `knip.json` (new)                                             | Entries and ignores                                                |
| `docs/guidelines/` or `.agents/rules/shared-quality-gates.md` | One line: thresholds are a ratchet; raise them when coverage rises |
| `changes/unreleased/<date>-quality-ratchets.md`               | `Changed` fragment                                                 |

## Tests

1. `rtk npm run test:coverage` passes with the thresholds (run once to measure, once to confirm).
2. `rtk npm run deadcode` lists 0 unused exports, or every listed item is either fixed or added to `knip.json` ignores with a reason.

## Open decisions

1. Approve `knip` as a dev dependency (Appendix A2), or keep only coverage thresholds.
2. Run `deadcode` in CI now (non-blocking) or only locally.

## UI and Card Editor impact

None.

## Commit

`chore: Coverage thresholds and a dead-export report` with `Refs AUD-20261017-232534 R4`.
