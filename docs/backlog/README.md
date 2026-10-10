# docs/backlog

Working space for the current gate. It holds two kinds of file only:

| File                                                                     | Role                                                                     |
| :----------------------------------------------------------------------- | :----------------------------------------------------------------------- |
| [teamwork_status_and_next_target.md](teamwork_status_and_next_target.md) | State, ordered work queue, open owner decisions. Update after each item. |
| `plan_issue_<n>_<slug>.md`                                               | Plan of one change in flight. Delete it in the commit that delivers it.  |

Open work lives in the GitHub milestones (one per gate). Long-lived designs go to `docs/specifications/`, decisions to `docs/decisions/`. Policies are in [AGENTS.md](../../AGENTS.md) and `.agents/rules/`.

## Starting a session

Prompt: `next-task`. The skill checks the baseline, takes the first open row of section 3 of the status file (or, when the queue is empty, the top issue of the active gate milestone), writes the plan and stops for approval.

## Plan anatomy

Status line at the top, then: printed card text; original and proposed data (fenced `json` blocks from `npm run card:get -- <code>`, changed lines shown before/after); why (rules analysis, evidence with file references); engine and schema changes; Card Editor and documentation impact; tests (written first); files; open decisions. Example: `git show 8f20d39:docs/backlog/plan_issue_238_highway_robbery.md`.

## Owner preferences (not in AGENTS.md)

- An optional ability keeps its "Do you want to use...? Yes / No" prompt; a target choice is a separate, later prompt.
- Any supplemental data change needs the owner's explicit approval, even a one-line fix found mid-task.
- Out-of-scope gaps become GitHub issues (printed text, evidence, acceptance, milestone), never silent notes.
- If a fix exposes debt in its path, remove it in scope. We are early: refactor now.
- Commit messages: `Fixes #N` only when the issue is fully done, `Refs #N` otherwise; write the message to a file and use `git commit -F`; check the issue state after the push.
