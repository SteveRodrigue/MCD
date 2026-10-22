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
- **No Tech Debt Mandate:** Fix debt in the path of the change in the same change. See [No Tech Debt Mandate](#no-tech-debt-mandate); it overrides any skill step that reads as permission to defer, skip or report separately.
- **Refactor-First & Single-Path Mandate:** Never propose "supporting both" or duplicating functions for minor variations. Always prefer merging similar functions, adding a parameter to an existing function, or refactoring complex/spaghetti code in the path of the change and updating all callers in scope.
- Tests must pass or fail; never add or retain skipped or todo tests to hide unfinished work.

## No Tech Debt Mandate

This project is early; every bit of debt left behind is paid for many times. Every task, in every skill, follows these rules. A skill step that seems to allow otherwise (a triage outcome, a "separately" suggestion, a tracked gap) does not.

1. **Fix debt in the path of the change, in the same change.** The path is: the file, function, data entry and mechanic you touch; every caller and data entry of anything you edit; and anything your investigation proved wrong (orphan or dead data, duplicate or parallel logic, stale allow-list entries, a tracked gap for the effect you touch, tangled code). Delete, merge or parameterize it and update all callers and card data.
2. **Never offer "do less" as an option.** For debt in the path, do not offer or choose: leave it, defer it, "report it separately", "file a follow-up", "close as invalid", "keep both", "add a shim or alias", "add an allow-list entry", or "document it as a tracked gap". The plan contains the cleanup, and the recommended option is always the cleanest complete one. Ask the user only for a real design or rules decision, never "should I clean this up?".
3. **A wrong premise does not end the work.** When an issue, report or plan turns out to be wrong in part (wrong card code, no live repro), correct the issue with the facts and fix the real defect or debt the investigation found. Do not close it and walk away.
4. **Debt your change creates is never deferrable.** No new tracked-gap, allow-list, `any`, skipped test or TODO to make a change land.
5. **Two narrow exceptions, both stated in the plan with evidence.** (a) The cleanup is a Tier 3 structural migration or needs a rules decision below 95% confidence: plan it as a named step and ask for approval of that step; do not drop it. (b) The debt is unrelated to the path of the change: open a GitHub issue for it (labels verified to exist) and say so in the recap. This is the only case where "separately" is correct.
6. **Plan and recap name the debt.** Every plan has a **Debt Removed** list (what is deleted, merged, parameterized, or "none found, and where I looked"). The recap reports what was actually removed.
7. **Self-check before sending a plan or options.** Search your own text for: defer, separately, follow-up, later, leave, keep for now, out of scope, tracked gap, close as invalid. If a hit describes in-path debt, rewrite it as work in the plan.

## Supplemental card comments policy

The `comment` field resides strictly inside `audit.comment` and is reserved for human/user notes. Agents must never autonomously add or update `audit.comment`. If explicitly instructed by the user to add or update a comment, the agent must clearly state the reason in the review recap and commit message. Card ambiguities or defects must be resolved with user interaction or in `docs/ambiguities/`, never by embedding informal notes in `audit.comment`.

Enforced by `.claude/hooks/no-audit-comment.mjs` (Claude Code). When the user explicitly asks for a comment, create `temp/.allow-audit-comment` before the edit and delete it afterwards.

## Audit stamp

Supplemental card entries carry `audit.createdAt`, `audit.updatedAt`, `audit.reviewedAt` and `audit.reviewedBy`.

- Timestamps use `YYYY-MM-DDTHH:mm:ssZ` (e.g. `2026-09-14T18:37:00Z`).
- `reviewedBy` is the current agent identity (for example `claude`), not a fixed value.
- New card: set `createdAt`, `updatedAt`, `reviewedAt`. Logic change or bug fix: bump `updatedAt` and `reviewedAt`. Re-confirming an unchanged card: bump `reviewedAt` only.

## Plan and approval gate

Before modifying source, tests, supplemental data, dependencies, or configuration:

1. Create or update a reviewable implementation plan with rules/spec analysis, a **Simplification & Refactor Check** (explicitly identifying existing functions/types to reuse, parameterize, merge, or delete instead of adding parallel code), a **Debt Removed** list ([No Tech Debt Mandate](#no-tech-debt-mandate)), file changes, tests, and open decisions.
2. State the UI/Card Editor impact explicitly when the task could affect those surfaces.
3. Stop for user review and approval before implementation.

If rules confidence is below the required threshold, record the ambiguity in the plan and block implementation until it is resolved. Do not bypass the plan gate.

The plan may live in the host's user-facing artifact location or a repository-relative plan file. Do not overwrite an unrelated existing plan.

## Blast-radius tiers

| Tier | Change                                                                          | Required handling                                           |
| ---- | ------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| 1    | Local UI, data, test, or existing-dispatcher change                             | Focused implementation and targeted validation              |
| 2    | Shared pipeline, generic primitive, schema, or reducer change                   | Targeted + related regression tests (`vitest related`)      |
| 3    | Core state model, public contracts, phase architecture, or structural migration | Plan approval before implementation; explicit design review |

## Verification matrix (Run Once, Targeted First)

Run only the narrowest relevant check during development. **Never re-run a test, `typecheck`, or `lint` command when zero files have changed since it last passed.** Leave the full test suite (`npm test`) to `.githooks/pre-push` on push.

| Change surface                                             | Task verification (run once after edits)                                                                                                    |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Agent or Markdown documentation only                       | `rtk git diff --check`                                                                                                                      |
| Local UI, card data, or single-subsystem change (Tier 1)   | `rtk npx vitest run <targeted-test-files>`, `rtk npm run typecheck`, `rtk npm run lint`, and `rtk npx prettier --check <changed-files>`     |
| Shared engine, schema, taxonomy, or cross-cutting (Tier 2) | `rtk npx vitest related <changed-files> --run`, `rtk npm run typecheck`, `rtk npm run lint`, and `rtk npx prettier --check <changed-files>` |
| Supplemental declarations or related primitives            | Also run `rtk npm run report:declarations` once after affected data is updated                                                              |

Report unavailable commands rather than inventing results. Compress shell outputs with `rtk` across all `git`, `npm`, `vitest`, and `npx` commands per [`antigravity-rtk-rules.md`](antigravity-rtk-rules.md).
Coverage thresholds in `vitest.config.ts` are a ratchet; raise them when coverage rises, never lower them.

## Delivery authorization

Commit and push only happen in response to the user's explicit request in the current message (e.g. "commit and push", "commit this"); the agent never initiates delivery on its own. Once requested, the workflow stages the reviewed file set, states the commit message, and proceeds through `git commit` (which runs `pre-commit`: `format:check`, `lint`, `typecheck`) and `git push` (which runs `pre-push`: `npm test`) directly without manually duplicating those checks beforehand.

## Documentation invariants

- Documentation, specifications and skills describe the **current state** only. History (what was removed, retired or renamed, and why) lives in ADRs and git, never as a "removed in #N" note.
- Do not write numbers that change with every commit (test counts, card counts, report timestamps). Point at the command that prints them.
- Before deleting, renaming or merging a document, `rg` for inbound references (links and plain-text paths) and fix them in the same commit.
- `rtk npm run docs:check` must pass; it runs in the pre-commit hook (when docs are staged) and in the full test suite. An intentional exception goes in `tools/audit/docs-check.allow.json` with a reason, and an entry tied to an issue (`until`) is removed when that issue closes.

### Primitive and Card Retrofit Ordering

When a card requires a new generic primitive, `feature-delivery` owns the primitive and `card-integration-protocol` owns the card retrofit; the plan must state the order.
