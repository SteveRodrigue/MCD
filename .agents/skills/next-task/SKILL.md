---
name: next-task
description: 'Picks the next task fast: the oldest open bug of the active gate milestone, else the first open row of the backlog queue, else the top-ranked open issue of the gate. Then writes the plan and stops for approval. Trigger when asking what to work on next, when continuing work, or prefixed with "next-task".'
hooks:
  PreToolUse:
    - matcher: 'Edit|Write'
      hooks:
        - type: command
          command: 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/plan-gate.mjs"'
---

# Next Task

**Shared rules:** Apply [`.agents/rules/shared-quality-gates.md`](../../rules/shared-quality-gates.md), including the [Stop policy](../../rules/shared-quality-gates.md#stop-policy) and the [Plan and approval gate](../../rules/shared-quality-gates.md#plan-and-approval-gate).

**Needs:** `rtk` (see [`antigravity-rtk-rules.md`](../../rules/antigravity-rtk-rules.md)), Node.js with `npm ci`, and the GitHub CLI authenticated via `gh auth login`.

Pick first, analyze later. Do no research before the task is chosen.

## Step 1: Baseline

1. `rtk git pull`, `rtk git status`.
2. A `docs/backlog/plan_*.md` file for unfinished work: that is the task. Say so and continue it.
3. Uncommitted changes that are not yours: list them in one line and continue (delivery stages files by name, so they stay out).

## Step 2: Pick the task

1. **Active gate:** the open milestone named `Gate N — ...` with the lowest N that still has open issues.
   ```sh
   gh api "repos/{owner}/{repo}/milestones?state=open" --jq '.[] | "\(.number)|\(.title)|\(.open_issues)"'
   ```
2. **Oldest bug in the gate:** if one exists, it is the task. Stop picking.
   ```sh
   gh issue list --milestone "<gate>" --state open --label bug --search "sort:created-asc" --limit 1 --json number,title,url
   ```
3. **No open bug: deeper pick**, in this order:
   1. The first open row of section 3 of [`docs/backlog/teamwork_status_and_next_target.md`](../../../docs/backlog/teamwork_status_and_next_target.md) (owner's order; never re-rank it). Skip a row whose issue is closed (remove the row) or that waits for an owner decision in section 5.
   2. Otherwise the top open issue of the gate: priority label (`P0` > `P1` > `P2` > `P3` > none), then oldest first.
   3. Never pick from `Tech Debt & Tooling` or a later gate unless the user asks.
4. **Gate empty:** before saying a gate is done, `gh issue list --milestone "<gate>" --state open` must be empty and `rtk npm run docs:check -- --github` must report no open issue without a milestone. Then say so and name the next gate.

Report the pick in one line: issue number, title, and why (`oldest bug in Gate N`, `queue row 1`, or `top P1 in Gate N`). Name the runner-up in the same line. Do not wait for a choice.

## Step 3: Plan and stop

1. Research only the chosen issue: its body, `npm run rule -- <term>` and `references/rules/` (raw PDF only below 95% confidence), the related ADRs and code.
2. **Refactor-First Check and Debt Removed:** look for similar functions, duplicate paths, dead data or tech debt in the path of the change ([No Tech Debt Mandate](../../rules/shared-quality-gates.md#no-tech-debt-mandate)).
3. Write `docs/backlog/plan_issue_<n>_<slug>.md` following the plan anatomy in [`docs/backlog/README.md`](../../../docs/backlog/README.md), **In-Game Scenario** first.
4. Post it, create `temp/.plan-pending`, and stop for approval. After approval, `execute-plan` implements, verifies and delivers.
