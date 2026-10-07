# docs/backlog

**Temporary working space.** It holds the status file and the plan of any change in flight. Open work items live in GitHub issues, not in files here. Policies (plan approval, quality gates, delivery, rules lookup, no legacy) are in [AGENTS.md](../../AGENTS.md) and `.agents/rules/`; this file does not repeat them.

> **When a change is committed, DELETE its plan file from this folder (in the same commit) and update the status file.** Never leave finished plans, drafts or trackers here. The record of a change is its commit, `CHANGELOG.md`, the spec and the ADR; `git log -- docs/backlog` recovers old plans.

| File                                                                     | Role                                                                                       |
| :----------------------------------------------------------------------- | :----------------------------------------------------------------------------------------- |
| [teamwork_status_and_next_target.md](teamwork_status_and_next_target.md) | Current state, ordered work queue, open owner decisions. Keep it current after every item. |
| `plan_issue_<n>_<slug>.md`                                               | Plan of one change awaiting approval or in progress. Deleted after the commit.             |

## Starting a session

Prompt: `Continue work on Marvel Champions Digital. Follow docs/backlog/README.md, then take the next task of docs/backlog/teamwork_status_and_next_target.md.`

1. `rtk git pull`, `rtk git status`, `rtk npm test` (baseline in the status file header).
2. Read the status file (sections 1 to 4) and the issue you take: the first item of section 3.1 not done. Say which in one line.
3. Write the plan (below), stop for approval, then work test-first.

## Plan anatomy

Printed card text; original data; proposed data (both as fenced ```` ```json ```` blocks copied from `npm run card:get -- <code>`, pretty-printed, the changed lines marked or shown as a before/after pair; never prose or inline code); why (rules analysis, evidence with file references); engine and schema changes; Card Editor and documentation impact; tests (written first); files; open decisions. Status line at the top. Worked example: `git show 8f20d39:docs/backlog/plan_issue_238_highway_robbery.md`.

## Owner preferences (not in AGENTS.md)

- An optional ability keeps its "Do you want to use...? Yes / No" prompt; a target choice is a separate, later prompt.
- Any supplemental data change needs the owner's explicit approval, even a one-line fix found mid-task.
- Out-of-scope gaps become GitHub issues (printed text, evidence, acceptance), never silent notes. Do not call a filed issue a "follow-up" unless it blocks the status file queue.
- If a fix exposes debt in its path, remove it in scope. We are early: refactor now.
- Commit messages: `Fixes #N` only when the issue is fully done, `Refs #N` otherwise; write the message to a file and use `git commit -F`; check the issue state after the push.
- ADHD mode (`/i-have-adhd`): lead with the next action, short numbered steps, one question.

## Where to find things

| Need                             | Where                                                                                           |
| :------------------------------- | :---------------------------------------------------------------------------------------------- |
| Schema and effect specifications | `docs/specifications/supplemental/`                                                             |
| Design decisions                 | `docs/decisions/`                                                                               |
| Blocked cards and why            | `docs/ambiguities/`                                                                             |
| `effectParams` audit evidence    | [../reports/effect_params_orphan_audit.md](../reports/effect_params_orphan_audit.md)            |
| Card data quickly                | `npm run card:get -- <code>` (printed text plus supplemental)                                   |
| In-app bug reports               | `logs/reports/`, then the `problem-report-triage` skill                                         |
| Coding and testing rules         | `.agents/rules/coding-and-testing-rules.md` (rules), `docs/coding_guidelines.md` (explanations) |
| Open work                        | GitHub issues of `SteveRodrigue/MCD` (`gh` is authenticated here)                               |
