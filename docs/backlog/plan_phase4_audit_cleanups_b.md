# Plan: Phase 4, group B — #161, #199, #200, #201, #202

> Status: **Delivered (uncommitted).** #199 closed on GitHub; #200 result: main chunk 1,230 kB to 860 kB, kept.
> Source: `teamwork_status_and_next_target.md`, Phase 4 second line ("#161, #199, #200, #201, #202").
> No gameplay rules involved. UI impact: #161 (visual) and #200 (load behavior). No Card Editor impact.

## Verified facts (investigated today)

| # | Finding |
|---|---|
| #161 | Exhausted heroes render through `CardView` (`cards/CardView.tsx:222-234`: `rotate-[30deg] filter brightness-95`). `HeroZone.tsx:719-730` places that card in the center column, with the stat/health blocks beside it. The rotated card overlaps those blocks. Not yet reproduced visually. |
| #199 | **Not reproducible.** The full test suite prints **0** `not wrapped in act(...)` warnings (the villain-zone tests the issue names included). |
| #200 | `npm run build` today: main chunk **1,229.9 kB** (292.9 kB gzip), `SupplementalEditorScreen` 306.3 kB. `App.tsx` imports `ScenarioSelector`, `MulliganScreen` and `GameBoard` eagerly (lines 13-15); only the editor is lazy. |
| #201 | `normalizeCardCodeForArt` appears only in its definition (`card-cache-service.ts`), `tests/ui/card-cache-service.test.ts`, and non-code files (agent notes, audit report, backlog doc, coverage output). No script, tool or barrel uses it. |
| #202 | `customActionHandlers` is **never invoked**: its only occurrence in `src/` is the type definition (`scenarios/types.ts:119`); no plugin sets it and no dispatcher reads it. ADR-0055 does not define a custom-action contract. |

## Proposed work (in the doc's order)

| Order | Issue | Action | Est. |
|---|---|---|---|
| 1 | #161 | Reproduce in the browser pane (Spider-Man + Captain Marvel, exhaust a hero), then fix the stacking so the rotated card sits behind the health bar and stats (`relative`/`z-` on the card wrapper, stats above). Add a layering test only if it can assert a class/stacking contract; otherwise verify visually (screenshot before and after). | 45 min |
| 2 | #199 | Close as not reproducible with the evidence above. No code change. | 5 min |
| 3 | #200 | Time-boxed experiment: `React.lazy` + `Suspense` for `GameBoard`, `MulliganScreen`, `ScenarioSelector`; rebuild; record the sizes. Keep only if the main chunk drops meaningfully and the setup-to-board flow still works (existing `tests/ui` App tests, manual run through setup). Otherwise document that the engine dominates the bundle and raise `chunkSizeWarningLimit` with a comment. | 1-2 h |
| 4 | #201 | Delete `normalizeCardCodeForArt` and its tests (red-green: the test file drops those cases; `typecheck` proves no consumer). | 15 min |
| 5 | #202 | Remove the unused `customActionHandlers` member from `ScenarioPlugin` (`scenarios/types.ts:119`). Nothing sets or calls it, so there is no behavior to test; `typecheck` is the proof. `App.tsx`'s `handleDispatchAction(action: any)` is a separate concern and stays out of scope. | 15 min |

Total: about 3 hours. Commits: one per issue (`Fixes #N`); #199 closed through a comment.

## TDD / verification

- #201 and #202 are covered by `typecheck` (no consumer can exist after deletion); #161 by visual check (screenshots) and a layering test where feasible; #200 by build sizes and the UI suites.
- Each commit: `rtk npm test` (baseline 1,666 passing), `rtk npm run typecheck`, `rtk npm run lint`, `rtk npm run format:check`.

## Docs

`CHANGELOG.md` (`[Unreleased]`) and the backlog status. No ADR.

## Decisions needed

1. **#199:** close as not reproducible. *Approved.*
2. **#200:** keep the lazy split only if the main chunk drops meaningfully; otherwise raise the warning limit with a comment. *Approved.*
3. **#202:** remove the unused extension point (YAGNI, matches the no-unused-shims principle). *Approved.* Evidence: its only mention in code or docs is the type definition (plus agent notes and the audit report); no plugin sets it, no dispatcher reads it, no test or ADR defines its contract. A plugin author who set it today would get silent no-ops. It can return with a real consumer and a defined contract.
