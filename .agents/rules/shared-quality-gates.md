---
always_on: true
description: 'Shared policies and quality gates for all MCD agent workflows'
---

# Shared Quality Gates

This file is the canonical source for policies shared by MCD agent workflows. Skills should link here instead of repeating these rules.

## Repository and command policy

- Use repository-relative paths in project documentation. Do not use drive-letter, `file:///`, or `vscode://` links for local files.
- Run commands directly in the native PowerShell environment. Do not wrap commands in `powershell -Command` or `powershell -NoProfile -Command`.
- Preserve unrelated working-tree changes. Never reset, checkout, clean, or overwrite them without explicit approval.

## Project invariants

- Follow Marvel Champions Rules Reference v1.8 for gameplay behavior.
- Use the structured Markdown reference in `references/rules/` (or `npm run rule -- <term>`) for rules research. Agents must not open or view the raw PDF (`references/mc_rulesreference_v18_compressed.pdf`) unless confidence on an ambiguous reading is low (<95%) or explicitly requested by the user. Always follow `See also:` links and consult `references/rules/TOPIC_MAP.md` for cross-cutting interactions.
- Keep `src/engine/` headless and decoupled from React, DOM, and CSS.
- Keep card-specific behavior in `src/data/supplemental/`; engine primitives must remain generic.
- Align implementation work with the currently active roadmap and milestone gates unless the user
  explicitly changes scope. Read-only audits may inspect any user-selected scope.
- Do not introduce permanent shims, aliases, deprecated names, duplicate paths, or temporary shortcuts without explicit approval.
- Tests must pass or fail; never add or retain skipped or todo tests to hide unfinished work.

## Supplemental card comments policy

The `comment` field resides strictly inside `audit.comment` and is reserved for human/user notes. Agents must never autonomously add or update `audit.comment`. If explicitly instructed by the user to add or update a comment, the agent must clearly state the reason in the review recap and commit message. Card ambiguities or defects must be resolved with user interaction or in `docs/ambiguities/`, never by embedding informal notes in `audit.comment`.

## Plan and approval gate

Before modifying source, tests, supplemental data, dependencies, or configuration:

1. Create or update a reviewable implementation plan with rules/spec analysis, file changes, tests, and open decisions.
2. State the UI/Card Editor impact explicitly when the task could affect those surfaces.
3. Stop for user review and approval before implementation.

If rules confidence is below the required threshold, record the ambiguity in the plan and block implementation until it is resolved. Do not bypass the plan gate.

The plan may live in the host's user-facing artifact location or a repository-relative plan file. Do not overwrite an unrelated existing plan.

## Blast-radius tiers

| Tier | Change                                                                          | Required handling                                           |
| ---- | ------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| 1    | Local UI, data, test, or existing-dispatcher change                             | Focused implementation and validation                       |
| 2    | Shared pipeline, generic primitive, schema, or reducer change                   | Regression coverage and full verification                   |
| 3    | Core state model, public contracts, phase architecture, or structural migration | Plan approval before implementation; explicit design review |

## Verification matrix

Run the narrowest relevant executable check first, then widen verification to match the blast radius.

| Change surface                                             | Minimum verification                                                                                                        |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Agent or Markdown documentation only                       | Markdown/link checks available in the repository, structural instruction audit, and `git diff --check`                      |
| Local UI or data change                                    | Focused tests plus applicable lint and typecheck                                                                            |
| Shared engine, schema, taxonomy, or cross-cutting behavior | `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, and `npm run report:declarations` |
| Supplemental declarations or related primitives            | Also run `npm run report:declarations` after affected data is updated                                                       |

Report unavailable commands rather than inventing results.

## Delivery authorization

Commit and push only happen in response to the user's explicit request in the current message (e.g. "commit and push", "commit this"); the agent never initiates delivery on its own. Once requested, the workflow stages the reviewed file set, runs quality gates, states the commit message, and proceeds through commit and push directly without a separate mid-flow approval round-trip, reporting verification results and any issue-state discrepancies afterward.

## Skill selection

| Primary task                                                     | Skill                       |
| ---------------------------------------------------------------- | --------------------------- |
| Specific card translation or refinement                          | `card-integration-protocol` |
| New generic mechanic, schema, UI capability, or scenario feature | `feature-delivery`          |
| Defect or regression                                             | `bug-fix`                   |
| Documentation drift                                              | `documentation-audit`       |
| Dependency alert                                                 | `dependabot`                |
| Code health, duplication, test hygiene, or naming audit          | `code-audit`                |
| Approved plan execution                                          | `execute-plan`              |
| Work prioritization                                              | `next-task`                 |
| Local problem-report filing                                      | `problem-report-triage`     |
| User-approved commit or push                                     | `commit-and-push`           |

When a card requires a new generic primitive, `feature-delivery` owns the primitive and `card-integration-protocol` owns the card retrofit; the plan must state the order.
