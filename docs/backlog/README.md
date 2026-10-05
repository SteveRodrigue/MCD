# docs/backlog: how this folder works

This folder is **temporary working space**: the **reviewable plans** of changes in flight and the **status file** that drives the work. Open work items live in GitHub issues, not in files here. A plan is deleted once its change is committed (its record is the commit, the changelog, the spec and the ADR; `git log -- docs/backlog` recovers it). Do not let finished plans accumulate. Nothing in `src/`, `tests/` or the supplemental data is changed before the owner approves the matching plan.

| File | Role |
| :-- | :-- |
| [teamwork_status_and_next_target.md](teamwork_status_and_next_target.md) | Current state, rules digest, ordered work queue, open owner decisions. Keep it current after every item. |
| `plan_issue_<n>_<slug>.md` | One plan per GitHub issue; delete it after the commit. |
| `plan_core_review_<id>_<slug>.md` | One plan per review item or work package; delete it after the commit. |

## Start here (new agent or developer)

Paste this to start a session: `Continue work on Marvel Champions Digital (C:\Users\steve\repos\MCD, branch main, Windows, PowerShell). Follow docs/backlog/README.md, then take the next task of docs/backlog/teamwork_status_and_next_target.md.`

1. **Sync and verify:** `rtk git pull`, `rtk git status`, `rtk npm test`. Expect the baseline in the status file header. #217 is a known flaky test (shuffle-dependent): rerun it once before assuming you broke something.
2. **Read**, in order: [AGENTS.md](../../AGENTS.md), the status file (sections 1 to 4), then the issue of the item you take.
3. **Take** the first item of section 3.1 of the status file that is not done, and say which one in one line.
4. Follow the lifecycle below. For a card change, the plan shows printed text, original data, proposed data and why (`card-integration-protocol` skill). One open question at a time.
5. Gates: `npm test`, `npm run typecheck`, `npm run lint`, `npx prettier --check "src/**/*.{ts,tsx}" "tests/**/*.{ts,tsx}"`, `npm run report:declarations` after data changes. Report results plainly; never claim green without the output.
6. Commit and push only when the owner asks, in that message. Conventional Commits; `Fixes #N` only when the issue is fully done, `Refs #N` otherwise; end with the Co-Authored-By line used in recent commits; write the message to a file and use `git commit -F`; check the issue state on GitHub after the push.
7. Hand back: what changed, what you verified, what you found, which GitHub issues you filed.

## Owner preferences (decided, do not re-ask)

- No tech debt, no legacy: no aliases, no fallbacks "for compatibility", no shims, no skipped or todo tests. We are early: refactor now rather than pile up debt. If a fix exposes debt in its path, remove it in scope.
- Rules first (RR v1.8). An optional ability keeps its "Do you want to use...? Yes / No" prompt; a target choice is a separate, later prompt.
- Engine primitives are generic (no card names, ADR-0021); card behaviour stays in `src/data/supplemental/`.
- Any supplemental data change needs the owner's explicit approval, even a one-line fix found mid-task.
- Out-of-scope gaps become GitHub issues (printed text, evidence, acceptance), never silent notes. Do not call a filed issue a "follow-up" unless it blocks the status file queue.
- The owner may use ADHD mode (`/i-have-adhd`): lead with the next action, short numbered steps, one question. Be concise.

## Pitfalls met in this project

| Pitfall | Do this instead |
| :-- | :-- |
| `tsc` does not flag a renamed field inside an untyped object literal (`const ctx = { targetInstanceId }`) | type the literal (`const ctx: EffectExecutionContext = ...`) and grep for the old name as well |
| A test that reveals or surges reads the shuffled encounter deck and fails at random | put filler cards on top of `state.encounterDeck` (see `heart-shaped-herb.test.ts`, `false-alarm-surge.test.ts`) and run the new file 15 to 25 times |
| An existing suite stays green while a card regresses (it only tested the villain) | add a test with a minion as well as the villain whenever targeting changes |
| A unit test calls an effect with a card instance that is not in `GameState` | effects must act on the zone entity in state (see `resolveSourceHostZone`); build the test through the real reveal or defeat path |
| `rtk git commit -m "..."` splits a message that contains quotes | write the message to a file and use `git commit -F <file>` |
| PowerShell: `(cmd1; cmd2) \| ...` is a parse error; `&&` does not exist | use `@(cmd1) + @(cmd2)` and `if ($?) { ... }` |
| Prettier on a folder rewrites unrelated files | format only the files you changed |
| Pack JSON uses CRLF | edit textually; check `git diff --stat` stays small |
| Pre-push hook runs the full suite; a flaky test blocks the push | fix the flakiness (never retry until green); amend only an unpushed commit |

## Where to find things

| Need | Where |
| :-- | :-- |
| What to do next, in order | status file section 3 |
| Plan template by example | `git show 8f20d39:docs/backlog/plan_issue_238_highway_robbery.md`, `git log -- docs/backlog` for others |
| Why `effectParams` keys are risky | [../reports/effect_params_orphan_audit.md](../reports/effect_params_orphan_audit.md) |
| Schema and effect specifications | `docs/specifications/supplemental/` (02 triggers, 03 targets, 05 to 08 effects, 09 formulas, 10 gates and prompts) |
| Design decisions | `docs/decisions/` (ADR-0021 no card names, ADR-0034 side schemes, ADR-0049 conditions and gates, ADR-0058 taxonomy, ADR-0070 and ADR-0077 targeting, ADR-0020 triggers) |
| Rules | `npm run rule -- <term>` or `references/rules/` (never the raw PDF) |
| Card data quickly | `npm run card:get -- <code>` (printed text plus supplemental) |
| Blocked cards and why | `docs/ambiguities/` |
| In-app bug reports | `logs/reports/` then the `problem-report-triage` skill (game states stay local in `logs/gamestates/`) |
| Open work | GitHub issues of `SteveRodrigue/MCD` (`gh` is authenticated on this machine) |

## Anatomy of a plan

Printed card text; original data; proposed data; why (rules analysis, evidence with file references); engine and schema changes; Card Editor and documentation impact; tests (written first); files; open decisions. Mark the status line at the top (`awaiting approval`, `implemented ... committed <hash>`). For a worked example run `git show 8f20d39:docs/backlog/plan_issue_238_highway_robbery.md`.

## Lifecycle of an item

1. Pick the first ready item of the queue in the status file.
2. Write the plan, stop for approval.
3. Failing test, implementation, docs (spec, ADR when a design decision was taken, Card Editor when the schema changes), `CHANGELOG.md`.
4. Gates (`npm test`, `npm run typecheck`, `npm run lint`, Prettier check on changed files), `npm run report:declarations` after data changes.
5. Update the status file, then delete the plan after the commit; file GitHub issues for anything found but out of scope.
6. Commit and push only when the owner asks.

Related: card ambiguities that block a card live in [../ambiguities/](../ambiguities/README.md); design decisions in [../decisions/](../decisions/README.md); the supplemental data specification in [../specifications/supplemental/](../specifications/supplemental/README.md).
