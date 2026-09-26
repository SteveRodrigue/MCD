# Marvel Champions Digital (MCD) - Agent Instructions

The canonical shared policies and quality gates are in
[`.agents/rules/shared-quality-gates.md`](.agents/rules/shared-quality-gates.md).
The shell policy is in [`.agents/rules/command-execution.md`](.agents/rules/command-execution.md),
and the post-task procedure is in
[`.agents/rules/post-task-checklist.md`](.agents/rules/post-task-checklist.md).

## Project principles

- Follow Marvel Champions Rules Reference v1.8 for gameplay behavior.
- **Rules Reference Inspection Policy:** Agents must use the structured Markdown reference in `references/rules/` (or the lookup command `npm run rule -- <term>` / `python scripts/lookup-rule.py <term>`) for all gameplay rules research, card translations, and engine verification. Agents must **not** open or read the raw PDF (`references/mc_rulesreference_v18_compressed.pdf`) unless confidence on an ambiguous reading is low (<95%) or explicitly requested by the user.
- **Cross-Cutting Rules Protocol:** When researching a rule or mechanic in `references/rules/`:
  1. Inspect the primary entry in `references/rules/glossary/`.
  2. Follow and inspect all direct `See also:` and `Referenced by:` links, plus any linked FAQ/errata items.
  3. Verify against the relevant operational cluster in `references/rules/TOPIC_MAP.md` (e.g. Combat & Damage, Timing & Triggers, Card Economy) to ensure all interrelated mechanics are satisfied.
  4. If ambiguity remains across entries, run a targeted ripgrep (`rg -i "<term>" references/rules/`).
- Keep `src/engine/` headless and decoupled from React, DOM, and CSS.
- Keep card-specific behavior declarative in `src/data/supplemental/`; engine primitives must be generic.
- Align implementation work with the currently active roadmap and milestone gates unless the user
  explicitly changes scope. Read-only audits may inspect any user-selected scope.
- Preserve the project's comic pop-art visual direction in user-facing UI work.
- Do not introduce unapproved legacy shims, aliases, deprecated names, duplicate paths, or temporary shortcuts.
- Never add skipped or todo tests to hide unfinished work.
- **Supplemental Card Comments Policy:** The `comment` field resides strictly inside `audit.comment` and is reserved for human/user notes. Agents must never autonomously add or update `audit.comment`. If explicitly instructed by the user to add or update a comment, the agent must clearly state the reason in the review recap and commit message. Card ambiguities or defects must be resolved with user interaction or in `docs/ambiguities/`, never by embedding informal notes in `audit.comment`.

## Before implementation

For source, test, supplemental-data, dependency, or configuration changes, create or update a reviewable implementation plan with rules/spec analysis, file changes, tests, and open decisions. State UI/Card Editor impact explicitly when relevant, then stop for user approval before implementation. The plan may use the host's user-facing artifact location or a repository-relative plan file; do not overwrite an unrelated existing plan.

## Delivery

Commit and push only happen in response to the user's explicit request in the current message (e.g. "commit and push", "commit this"); the agent never initiates delivery on its own. Once requested, the delivery workflow stages the reviewed file set, runs quality gates, states the commit message, and proceeds through commit and push directly without a separate mid-flow approval round-trip, reporting the verification results and any issue-state discrepancies afterward.

## Skill index

| Task                                  | Skill                                               |
| ------------------------------------- | --------------------------------------------------- |
| Specific card translation/refinement  | `.agents/skills/card-integration-protocol/SKILL.md` |
| New generic capability                | `.agents/skills/feature-delivery/SKILL.md`          |
| Defect or regression                  | `.agents/skills/bug-fix/SKILL.md`                   |
| Documentation drift                   | `.agents/skills/documentation-audit/SKILL.md`       |
| Dependency alert                      | `.agents/skills/dependabot/SKILL.md`                |
| Code health and maintainability audit | `.agents/skills/code-audit/SKILL.md`                |
| Approved plan execution               | `.agents/skills/execute-plan/SKILL.md`              |
| Prioritization                        | `.agents/skills/next-task/SKILL.md`                 |
| Local problem reports                 | `.agents/skills/problem-report-triage/SKILL.md`     |
| User-approved commit/push             | `.agents/skills/commit-and-push/SKILL.md`           |
