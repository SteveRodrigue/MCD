# docs/backlog: how this folder works

This folder holds the **reviewable plans** (one per change) and the **living trackers** that drive the work. Nothing in `src/`, `tests/` or the supplemental data is changed before the owner approves the matching plan.

| File | Role |
| :-- | :-- |
| [teamwork_status_and_next_target.md](teamwork_status_and_next_target.md) | **Entry point.** Current state, rules digest, ordered work queue, handoff protocol, open owner decisions. Keep it current after every item. |
| [handoff_prompt.md](handoff_prompt.md) | Ready-to-paste prompt for a new agent or developer. |
| [plan_core_player_cards_review.md](plan_core_player_cards_review.md) | Living tracker: line-by-line review of every core player card (items A, B, C, D). |
| [plan_effect_params_remediation.md](plan_effect_params_remediation.md) | Living tracker: untyped `effectParams` audit and its work packages (WP1 to WP8), with acceptance criteria per package. Evidence: [../reports/effect_params_orphan_audit.md](../reports/effect_params_orphan_audit.md). |
| `plan_issue_<n>_<slug>.md` | One plan per GitHub issue. |
| `plan_core_review_<id>_<slug>.md` | One plan per review item or work package. |
| `plan_hero_target_audit.md`, `plan_phase4_*`, `issue_draft_*` | Older audits and drafts, kept for history. |

## Anatomy of a plan

Printed card text; original data; proposed data; why (rules analysis, evidence with file references); engine and schema changes; Card Editor and documentation impact; tests (written first); files; open decisions. Mark the status line at the top (`awaiting approval`, `implemented ... committed <hash>`). Copy the structure of [plan_issue_222_self_hero_selector.md](plan_issue_222_self_hero_selector.md) or [plan_issue_218_surge_keyword.md](plan_issue_218_surge_keyword.md).

## Lifecycle of an item

1. Pick the first ready item of the queue in the status file.
2. Write the plan, stop for approval.
3. Failing test, implementation, docs (spec, ADR when a design decision was taken, Card Editor when the schema changes), `CHANGELOG.md`.
4. Gates (`npm test`, `npm run typecheck`, `npm run lint`, Prettier check on changed files), `npm run report:declarations` after data changes.
5. Update the plan status, the living trackers and the status file; file GitHub issues for anything found but out of scope.
6. Commit and push only when the owner asks.

Related: card ambiguities that block a card live in [../ambiguities/](../ambiguities/README.md); design decisions in [../decisions/](../decisions/README.md); the supplemental data specification in [../specifications/supplemental/](../specifications/supplemental/README.md).
