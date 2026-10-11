---
name: next-task
description: 'Picks the next task: the first open row of the backlog queue, or, when the queue is empty, the top open issue of the active gate milestone on GitHub. Then writes the plan and stops for approval. Trigger when asking what to work on next, when continuing work, or prefixed with "next-task".'
hooks:
  PreToolUse:
    - matcher: 'Edit|Write'
      hooks:
        - type: command
          command: 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/plan-gate.mjs"'
---

# Next Task

**Shared rules:** Apply [`.agents/rules/shared-quality-gates.md`](../../rules/shared-quality-gates.md), including path, scope, plan, verification, and delivery policies.

**Needs:** `rtk` (see [`antigravity-rtk-rules.md`](../../rules/antigravity-rtk-rules.md)), Node.js with `npm ci`, and the GitHub CLI authenticated via `gh auth login`.

Sources, in this order:

1. The queue: section 3 of [`docs/backlog/teamwork_status_and_next_target.md`](../../../docs/backlog/teamwork_status_and_next_target.md). Its order is the owner's order; never re-rank it.
2. When the queue has no open row: the GitHub milestones, one per release gate.

## Step 1: Baseline

1. `rtk git pull`, `rtk git status`. Stop and report if the tree is not clean or a plan file in `docs/backlog/` belongs to unfinished work.
2. `rtk npm test`. Compare with the baseline in the status file header; report any difference before going on.

## Step 2: Pick the task

### A. From the queue

1. Read sections 1, 3 and 5 of the status file.
2. Take the first row of section 3. Skip a row only if it waits for an owner decision (section 5) or its issue is closed; say why in one line.
3. Check the issue: `gh issue view <N> --json number,state,title,milestone,labels,body`.
   - Closed: remove its row from the status file, tell the user, take the next row.
   - Open but not in the active gate milestone: say so and ask whether to keep it in the queue.

### B. Fallback: GitHub issues (the queue is empty)

1. Find the active gate: the open milestone named `Gate N — ...` with the lowest N that still has open issues:
   ```sh
   gh api "repos/{owner}/{repo}/milestones?state=open" --jq '.[] | "\(.number)|\(.title)|\(.open_issues)"'
   ```
2. List its open issues:
   ```sh
   gh issue list --milestone "<title>" --state open --limit 200 --json number,title,labels,url
   ```
3. Rank: priority label (`P0` > `P1` > `P2` > `P3` > none), then `bug` before other types, then lower issue number.
4. Issues with no milestone are untriaged: list them separately and offer the `problem-report-triage` skill before picking.
5. Never pick from `Tech Debt & Tooling` or a later gate unless the user asks.
6. Present the top 3 (format below) and let the user choose. Write the chosen ones into section 3 of the status file so the queue is the source again.

## Step 3: Plan and stop

1. Say which task in one line (issue number, title, queue row or milestone).
2. Research: the issue body, `npm run rule -- <term>` and `references/rules/` (raw PDF only below 95% confidence), the related ADRs and code.
3. Write `docs/backlog/plan_issue_<n>_<slug>.md` following the plan anatomy in [`docs/backlog/README.md`](../../../docs/backlog/README.md).
4. **Stop.** No code, test or data change until the owner approves the plan. Create `temp/.plan-pending` when you post the plan and delete it once the owner approves. While it exists, a hook blocks edits under `src/`, `tests/`, `data/`, `tools/` and `scripts/`.

## Presentation (fallback only)

```markdown
Queue empty. Active gate: <milestone title> (<n> open issues).

| #   | Issue     | Priority | Type | Why first        |
| :-- | :-------- | :------- | :--- | :--------------- |
| 1   | [#N](url) | P1       | bug  | <one short line> |
| 2   | ...       |          |      |                  |
| 3   | ...       |          |      |                  |

Untriaged (no milestone): #A, #B.

Pick 1, 2 or 3.
```
