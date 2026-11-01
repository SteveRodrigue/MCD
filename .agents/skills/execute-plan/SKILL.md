---
name: execute-plan
description: 'Executes an approved implementation plan step by step, runs targeted verification, then delivers it through commit-and-push. Triggers automatically on plan approval, clicking "Proceed", or prefixed with "execute-plan:".'
---

# ⚡ Execute-Plan Protocol (Direct Implementation)

**Shared rules:** Apply [`.agents/rules/shared-quality-gates.md`](../../rules/shared-quality-gates.md), including the [Stop policy](../../rules/shared-quality-gates.md#stop-policy), [Plan deviation](../../rules/shared-quality-gates.md#plan-deviation) and [Delivery authorization](../../rules/shared-quality-gates.md#delivery-authorization).

**Needs:** `rtk` (see [`antigravity-rtk-rules.md`](../../rules/antigravity-rtk-rules.md)) and Node.js with `npm ci`.

## 🛑 Hard rules (read first)

- **The plan's In-Game Scenario is the contract.** Self-resolve a gap when confidence is at least 95% and the player-visible result stays the one the scenario describes; list it under **Decisions I made**. Stop with the [plan deviation](../../rules/shared-quality-gates.md#plan-deviation) message when the code cannot deliver that scenario.
- **No tech debt:** Implement the plan's **Debt Removed** items in full; do not drop one to finish faster. Debt you find while implementing, in the path of the change, is fixed in the same change (see the [No Tech Debt Mandate](../../rules/shared-quality-gates.md#no-tech-debt-mandate)). Debt that needs a file outside the plan's subsystems is a plan deviation.
- **Circuit breaker:** If compile errors or broken test contracts cannot be resolved in 2 iterations, stop, inspect the failure, and give the user an actionable diagnosis.

---

## 🛠️ Step-by-Step Instructions

### Step 1: Read the Approved Plan

1. Read the approved plan from wherever it was written: the host's user-facing artifact or plan location, or the repository-relative plan file. If more than one candidate exists, use the one the user approved.
2. Extract the In-Game Scenario, the file list (`[NEW]`, `[MODIFY]`, `[DELETE]`), the UI and Card Editor statement, the tests, the Debt Removed list, and the verification commands.
3. Delete `temp/.plan-pending` if it still exists.
4. Fill plan gaps yourself before editing:
   - A missing `UI and Card Editor` statement or test case that you can derive from the scenario: add it and log the decision.
   - Files named in the plan that changed since it was written: re-read them; continue if the scenario still holds, otherwise stop as a plan deviation.
   - A gap where two readings give different in-game results: stop as a plan deviation.

### Step 2: Implement

1. Write the scenario tests first (named after the scenario), then apply the planned changes.
2. Run the targeted verification commands once at the end of the edits, using `rtk`:
   - `rtk npx vitest run <relevant_test_files>` (0 failures, 0 skipped; do not run the full suite)
   - `rtk npm run typecheck`
   - `rtk npm run lint`
   - `rtk npm run docs:check` when the plan touched documentation or `.agents/`, or renamed or removed a file, script or symbol that documentation may cite
   Do not re-run any check if zero files changed since it passed.

### Step 3: Post-Task Hygiene, Recap and Delivery

1. Verify that all tests succeeded with **0 failures and 0 skipped tests** (Zero Skipped Tests Invariant).
2. Add a changelog fragment in `changes/unreleased/` (see `changes/README.md`).
3. If card supplemental JSON was modified, run `rtk npm run report:declarations`.
4. Write the recap per [`post-task-checklist.md`](../../rules/post-task-checklist.md): **Try it in game**, **Decisions I made**, **Debt removed**, verification results.
5. Deliver through `commit-and-push` (full chain, including the squash-merge on green CI). The approved plan authorizes it; no extra request is needed unless a plan deviation is still open.
