# Handoff prompt (paste to a new agent or send to a developer)

Last reviewed 2026-10-05 (after commit `5d01ec3`). If the repository has moved on, trust `git log`, the GitHub issues and the status file over this text.

---

## Short version (paste this)

```text
Continue work on Marvel Champions Digital in C:\Users\steve\repos\MCD (branch main, Windows, PowerShell).

START
1. Run `git pull`, `git status`, `npm test`. Baseline: 1,850 tests green, 0 skipped, typecheck/lint/Prettier
   clean. #217 is a known flaky test (shuffle-dependent): rerun it once before assuming you broke something.
2. Read, in order: AGENTS.md, docs/backlog/README.md, docs/backlog/teamwork_status_and_next_target.md
   (sections 1 to 4), then the plan and issue of the item you take.
3. Your task is the first item of section 3.1 of the status file that is not done. Today that is #248 (see
   "Next task" below). Say which item you took, in one line.

FOR EVERY ITEM
4. Write docs/backlog/plan_<topic>.md (copy the shape of plan_issue_234_triggered_chosen_targets.md or
   plan_issue_222_self_hero_selector.md) and STOP for my approval. For a card change, show: printed text,
   original data, proposed data, why (card-integration-protocol skill). One open question at a time.
5. After approval: failing test first (see it fail for the right reason), then the fix, then the docs:
   spec in docs/specifications/supplemental/, ADR or addendum for design decisions, Card Editor when the
   schema changes, CHANGELOG.md [Unreleased], the plan status, the two living trackers, the status file.
6. Gates: npm test, npm run typecheck, npm run lint, npx prettier --check "src/**/*.{ts,tsx}" "tests/**/*.{ts,tsx}",
   npm run report:declarations after data changes. Report results plainly; never claim green without the output.
7. Commit and push ONLY when I ask, in that message. Conventional Commits; `Fixes #N` only when the issue is
   fully done, `Refs #N` otherwise; end with the Co-Authored-By line used in recent commits; check the issue
   state on GitHub after the push.

OWNER PREFERENCES (decided, do not re-ask)
- No tech debt, no legacy: no aliases, no fallbacks "for compatibility", no shims, no skipped or todo tests.
  We are early: refactor now rather than pile up debt. If a fix exposes debt in its path, remove it in scope.
- Rules first (RR v1.8). An optional ability keeps its "Do you want to use…? Yes / No" prompt; a target
  choice is a separate, later prompt (the first decision can start a chain that changes the board).
- Engine primitives are generic (no card names, ADR-0021); card behaviour stays in src/data/supplemental/.
- Any supplemental data change needs my explicit approval, even a one-line fix found mid-task.
- Out-of-scope gaps become GitHub issues (printed text, evidence, acceptance), never silent notes.
- I may use ADHD mode (/i-have-adhd): lead with the next action, short numbered steps, one question.

Be concise. Lead with the next action, number multi-step work, ask me one question at a time.
```

---

## Next task: #248, pausable `executeSequence` (finishes Hulk `01050`)

- **Problem:** `executeSequence` (`src/engine/effects/index.ts`) does not stop when a step opens a decision prompt; later steps of the same ability run before the player answers. Wakanda Forever! is the only exception: it has its own special-only pause (`pendingSpecialSequence`, #207).
- **Why now:** since #234 every "an enemy" / "a scheme" step can open a target prompt. Hulk `01050` ("deal 2 damage to an enemy" is step 2 of 4; with a wild resource, "1 damage to each character" and "discard Hulk" follow) now resolves out of order.
- **Owner decision (2026-10-05):** do this next, then finish Hulk.
- **Expected direction (to confirm in the plan):** one general resumable sequence (remaining steps plus the sequence context: previous result, step results, chosen targets, `isFinalStep`), resumed when the prompt resolves; retire `pendingSpecialSequence` in favour of it (one path). Consider #225 (same function: step failures are swallowed) in the same plan, and say whether you include it.
- **Careful:** #225 is **not** the pause problem (an earlier plan mixed them up). Always read the issue text before citing an issue number.

## What changed recently (read before touching targeting)

- **ADR-0077 / #234 (`5d01ec3`):** the effect context has `chosenTargetInstanceId` / `chosenTargetType` (what the player chose) and `eventTargetInstanceId` / `eventTargetType` (the triggering event's target). There is no `targetInstanceId` in `EffectExecutionContext` any more. `TriggerContext` (the event payload) still uses `targetInstanceId`.
- `CHOSEN_*` steps choose through `src/engine/effects/target-choice.ts` (valid targets only, 0 / 1 / 2+ rule). `TRIGGERING_*` reads the event target. The resolver never guesses a target.
- "The attacked enemy" / "that enemy" is `TRIGGERING_ENEMY`, not `PREVIOUS_TARGET`.
- Specs: `02_timings_and_triggers.md` (event target vs chosen target), `03_costs_and_targeting.md` (Layer 3).

## Queue after #248 (status file section 3.1, in order)

1. [#238](https://github.com/SteveRodrigue/MCD/issues/238) **P1** Highway Robbery `01166` loses the card taken from each hand (orphaned attachment, `Math.random`, discarded before "return to hand"). Evidence in the issue.
2. [#240](https://github.com/SteveRodrigue/MCD/issues/240) Emergency `01085` is offered for every threat placement (setup included), not only "when the villain schemes".
3. [#245](https://github.com/SteveRodrigue/MCD/issues/245) Masterplan `01192`: the "no side scheme → discard until one, reveal it" sentence is missing.
4. [#247](https://github.com/SteveRodrigue/MCD/issues/247) Chase Them Down `01052` is never offered (no hand Response scan after a defeat; filter too narrow).
5. [#246](https://github.com/SteveRodrigue/MCD/issues/246) player elimination and game-over screen: **ask the owner first** (Gate 1 or Gate 3).

Then the rest of section 3 (Weapons Runner #244, Genetically Enhanced #228, engine prerequisites #219 to #223, `effectParams` WP5 to WP7, core player review items).

## Pitfalls met in this project (avoid them)

| Pitfall | Do this instead |
| :-- | :-- |
| `tsc` does not flag a renamed field inside an untyped object literal (`const ctx = { targetInstanceId }`) | type the literal (`const ctx: EffectExecutionContext = …`) and grep for the old name as well |
| A test that reveals or surges reads the shuffled encounter deck and fails at random | put filler cards on top of `state.encounterDeck` (see `heart-shaped-herb.test.ts`, `false-alarm-surge.test.ts`) and run the new file 15 to 25 times |
| An existing suite stays green while a card regresses (it only tested the villain) | add a test with a minion as well as the villain whenever targeting changes |
| `rtk git commit -m "…"` splits a message that contains quotes | write the message to a file and use `git commit -F <file>` |
| PowerShell: `(cmd1; cmd2) | …` is a parse error; `&&` does not exist | use `@(cmd1) + @(cmd2)` and `if ($?) { … }` |
| Prettier on a folder rewrites unrelated files | format only the files you changed |
| Pack JSON uses CRLF | edit textually; check `git diff --stat` stays small |
| Pre-push hook runs the full suite; a flaky test blocks the push | fix the flakiness (never retry until green); amend only an unpushed commit |

## Where to find things

| Need | Where |
| :-- | :-- |
| What to do next, in order | `docs/backlog/teamwork_status_and_next_target.md` section 3 |
| Plan template by example | `plan_issue_234_triggered_chosen_targets.md` (engine refactor), `plan_issue_244_heart_shaped_herb.md` (card data), `plan_issue_222_self_hero_selector.md` |
| The two living trackers | `plan_core_player_cards_review.md`, `plan_effect_params_remediation.md` |
| Why `effectParams` keys are risky | `docs/reports/effect_params_orphan_audit.md` |
| Schema and effect specifications | `docs/specifications/supplemental/` (02 triggers, 03 targets, 05 to 08 effects, 09 formulas, 10 gates and prompts) |
| Design decisions | `docs/decisions/` (ADR-0021 no card names, ADR-0049 conditions and gates, ADR-0058 taxonomy, ADR-0070 and ADR-0077 targeting, ADR-0020 triggers) |
| Rules | `npm run rule -- <term>` or `references/rules/` (never the raw PDF) |
| Card data quickly | `npm run card:get -- <code>` (printed text plus supplemental) |
| Blocked cards and why | `docs/ambiguities/` |
| In-app bug reports | `logs/reports/` → `problem-report-triage` skill (game states stay local in `logs/gamestates/`) |
| Open work | GitHub issues of `SteveRodrigue/MCD` (use `gh`; it is authenticated on this machine) |

## Good first items for a new person (independent, small)

1. [#244](https://github.com/SteveRodrigue/MCD/issues/244): Weapons Runner `01121` has no supplemental entry (`01158` is done; `01185` waits on #209).
2. [#245](https://github.com/SteveRodrigue/MCD/issues/245): Masterplan `01192` second sentence (data plus a test; check whether `DISCARD` supports "until a side scheme").
3. [#221](https://github.com/SteveRodrigue/MCD/issues/221) (damage gate) or [#223](https://github.com/SteveRodrigue/MCD/issues/223) (named minion attack): self-contained engine primitives, each unblocks one stripped card.

## Pending questions for the owner

- [#246](https://github.com/SteveRodrigue/MCD/issues/246): player elimination in Gate 1 or Gate 3?
- [#233](https://github.com/SteveRodrigue/MCD/issues/233): how many upgrades/supports did the revealing player control when Caught Off Guard showed no prompt?
- Section 5 of the status file: B4, C9, C10, C13, Repulsor Blast, scheduling of the data read-through and #243.
- 2 moderate Dependabot alerts on `main` are not reviewed yet (`dependabot` skill).
