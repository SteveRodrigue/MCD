---
name: execute-plan
description: 'Executes an approved implementation plan step by step, then runs targeted verification. Triggers automatically on plan approval, clicking "Proceed", or prefixed with "execute-plan:".'
---

# ⚡ Execute-Plan Protocol (Direct Implementation)

**Shared rules:** Apply [`.agents/rules/shared-quality-gates.md`](../../rules/shared-quality-gates.md), including path, command, verification, and delivery authorization policies.

**Needs:** `rtk` (see [`antigravity-rtk-rules.md`](../../rules/antigravity-rtk-rules.md)) and Node.js with `npm ci`.

## 🛑 Hard rules (read first)

- **Plan fidelity:** User approval is not permission to interpret an ambiguous plan. Stop and request validation using the **Why This Is Blocking** / **What I Need From You** format before any edit that depends on an unstated decision.
- **No tech debt:** Implement the plan's **Debt Removed** items in full; do not drop one to finish faster. Debt you find while implementing, in the path of the change, is fixed in the same change (see the [No Tech Debt Mandate](../../rules/shared-quality-gates.md#no-tech-debt-mandate)); a plan that omits it is revised, not worked around.
- **Never commit or push** unless the user's request authorized delivery.
- **Circuit breaker:** If compile errors or broken test contracts cannot be resolved in 2 iterations, stop, inspect the failure, and give the user an actionable diagnosis.
- **Drift:** If files named in the plan have drifted significantly, halt and inform the user before attempting any unguided structural refactor.

---

## 🛠️ Step-by-Step Instructions

### Step 1: Read the Approved Plan

When the user clicks "Proceed" or approves:

1. Read the approved plan from wherever it was written: the host's user-facing artifact or plan location (e.g. Claude Code's plan file or a published artifact), or the repository-relative plan file. If more than one candidate exists, use the one the user approved; if unclear, ask.
2. Extract only the explicit file list (`[NEW]`, `[MODIFY]`, `[DELETE]`), edits, UI/Card Editor impact statement, test inventory, acceptance criteria, and verification commands. Do **not** infer omitted behavior, expand scope, choose between alternatives, or reinterpret requirements from surrounding repository context.
3. Run the ambiguity gate before editing. Treat the plan as ambiguous when any required behavior, file-level change, acceptance criterion, verification command, dependency, migration choice, or conflict with the current worktree is unspecified or admits more than one reasonable interpretation.

- The plan is also blocked if it lacks an explicit `UI and Card Editor` section. It must either list the affected UI/Card Editor files and tests, or state `No change required.` with supporting evidence.
- The plan is also blocked if its test inventory omits a changed behavior or lacks Card Editor tests for an affected editor surface.

4. When ambiguity exists, halt execution. Present a concise user-facing validation request with exactly these headings:

```markdown
### Why This Is Blocking

<the specific decision or missing information that prevents faithful execution>

### What I Need From You

<the concrete choice, confirmation, or plan revision required>
```

Do not edit files or continue implementation until the user resolves the ambiguity. A prior approval authorizes only the plan's unambiguous, explicitly stated work; it does not authorize interpretation.

5. Implement only after every ambiguity is resolved explicitly by the user or by a revised plan that removes it.

### Step 2: Implement

1. Apply the file modifications specified in the plan (target files and changes only).
2. Run the targeted verification commands once at the end of the edits, using `rtk`:
   - `rtk npx vitest run <relevant_test_files>` (0 failures, 0 skipped; do not run the full suite)
   - `rtk npm run typecheck`
   - `rtk npm run lint`
   - `rtk npm run docs:check` when the plan touched documentation or `.agents/`, or renamed or removed a file, script or symbol that documentation may cite
   Do not re-run any check if zero files changed since it passed.
3. Do not infer missing requirements, select between plausible designs, expand scope, or modify files not authorized by the plan. On ambiguity, stop and report using the "Why This Is Blocking" / "What I Need From You" headings.

### Step 3: Post-Task Hygiene & Walkthrough

After implementation:

1. Verify that all tests succeeded with **0 failures and 0 skipped tests** (Zero Skipped Tests Invariant).
2. Add a changelog fragment in `changes/unreleased/` with what was implemented (see `changes/README.md`).
3. If card supplemental JSON was modified, run `rtk npm run report:declarations`.
4. Create or update the walkthrough/recap in the host's user-facing artifact location when available.
5. Present the walkthrough and verification results to the user. If the user's original request already authorized delivery (e.g. "implement and commit/push this plan"), proceed directly through commit and push; otherwise wait for an explicit commit/push request before delivering.
