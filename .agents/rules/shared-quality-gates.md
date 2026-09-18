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
- Keep `src/engine/` headless and decoupled from React, DOM, and CSS.
- Keep card-specific behavior in `src/data/supplemental/`; engine primitives must remain generic.
- Keep active work within the Rhino Release boundary unless the user explicitly changes scope.
- Do not introduce permanent shims, aliases, deprecated names, duplicate paths, or temporary shortcuts without explicit approval.
- Tests must pass or fail; never add or retain skipped or todo tests to hide unfinished work.

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

The delivery workflow may prepare staged changes, a proposed commit message, a walkthrough, and a verification recap. It must ask the user to confirm or approve that recap before creating a commit. Pushing requires separate explicit authorization.

## Skill selection

| Primary task                                                     | Skill                       |
| ---------------------------------------------------------------- | --------------------------- |
| Specific card translation or refinement                          | `card-integration-protocol` |
| New generic mechanic, schema, UI capability, or scenario feature | `feature-delivery`          |
| Defect or regression                                             | `bug-fix`                   |
| Documentation drift                                              | `documentation-audit`       |
| Dependency alert                                                 | `dependabot`                |
| Approved plan execution                                          | `execute-plan`              |
| Work prioritization                                              | `next-task`                 |
| Local problem-report filing                                      | `problem-report-triage`     |
| User-approved commit or push                                     | `commit-and-push`           |

When a card requires a new generic primitive, `feature-delivery` owns the primitive and `card-integration-protocol` owns the card retrofit; the plan must state the order.
