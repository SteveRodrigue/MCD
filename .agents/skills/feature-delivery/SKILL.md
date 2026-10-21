---
name: feature-delivery
description: 'Specification-driven protocol for designing, testing, and shipping new engine capabilities, primitives, UI components, and milestones. Trigger when building features or prefixed with "feature-delivery:".'
hooks:
  PreToolUse:
    - matcher: 'Edit|Write'
      hooks:
        - type: command
          command: 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/plan-gate.mjs"'
---

# 🚀 Feature Delivery Protocol (Specification-Driven Development & Milestone Lifecycle)

**Shared rules:** Apply [`.agents/rules/shared-quality-gates.md`](../../rules/shared-quality-gates.md), including path, scope, plan, verification, and delivery policies.

**Needs:** `rtk` (see [`antigravity-rtk-rules.md`](../../rules/antigravity-rtk-rules.md)), Node.js with `npm ci`, Python 3 (for `npm run rule`), and the GitHub CLI authenticated via `gh auth login` (check with `gh auth status`).

---

## Architectural Pre-Conditions & Rules Authority

Before writing any implementation code or tests for a new feature, verify the following architectural prerequisites:

1. **📖 Rules Reference Audit (RR v1.8):**
   - Research rules using structured Markdown in `references/rules/` (or `npm run rule -- <term>`). Follow `See also:` links and consult `references/rules/TOPIC_MAP.md`. Do not open the raw PDF unless confidence is $< 95\%$.
   - **Strict Confidence Threshold ($\ge 95\%$):** If confidence in how the rules operate is $< 95\%$, **STOP IMMEDIATELY** and trigger the **Ambiguity RFC Circuit Breaker** below. Never implement speculative heuristics.
2. **Approved Architecture Decision Record (ADR):**
   - Check [`docs/decisions/`](../../../docs/decisions/) to identify the controlling ADR.
   - If introducing a new paradigm, draft a **Proposed ADR** first using [`docs/decisions/template.md`](../../../docs/decisions/template.md) and register it in `docs/decisions/README.md`.
3. **Schema & Model Design Alignment:**
   - If introducing effect primitives or supplemental fields, update [`src/data/supplemental/schema.ts`](../../../src/data/supplemental/schema.ts) with strict Zod types and update [`docs/specifications/`](../../../docs/specifications/).
   - If extending game state, update [`src/engine/models/state.ts`](../../../src/engine/models/state.ts).
   - Keep the Card Supplemental Editor aligned per [`docs/specifications/tooling/card_supplemental_editor.md`](../../../docs/specifications/tooling/card_supplemental_editor.md).
4. **Core Invariants (from `shared-quality-gates.md`):**
   - Headless & decoupled engine (`src/engine/` contains no UI/DOM/CSS dependencies).
   - Declarative data-first (generic primitives in `src/engine/effects/`, card-specific parameters in `src/data/supplemental/`).
    - Rhino release scope boundary (Core set player cards & Rhino encounters for Gate 1).
   - **Refactor-First & Zero Tech Debt:** Follow `coding-and-testing-rules.md`; the plan must list what is merged, parameterized, or deleted.


---

## 🛑 Ambiguity RFC / Peer Review Circuit Breaker (When Confidence $< 95\%$)

If the rules interpretation, timing trigger sequence, or card interactions are ambiguous or disputed (confidence $< 95\%$):

1. **Halt Execution:** Do NOT proceed to writing acceptance tests or modifying code.
2. **Post RFC Peer Review Comment on GitHub Issue:**
   Use the template in [`rfc-template.md`](rfc-template.md) (strict: keep every heading), posted with `gh issue comment <NUM> --body-file <file>`.

3. **Tag GitHub Issue:**
   ```bash
   gh issue edit <NUM> --add-label "needs-review,status:blocked-by-rfc"
   ```
4. **Log Ambiguity:** If card-specific, create or update a 1-file report in `docs/ambiguities/`.
5. **End Turn Safely:** Report the RFC link to the user and pause until alignment is reached.

---

## 🔄 The 8-Step Feature Delivery Lifecycle

Copy this checklist and tick each step as you go:

- [ ] Step 1: Scope and link the GitHub issue
- [ ] Step 2: Rules Reference audit and ADR alignment (confidence below 95%: trigger the RFC circuit breaker and stop)
- [ ] Step 3: Author the implementation plan, wait for approval
- [ ] Step 4: Write acceptance and contract tests (Red)
- [ ] Step 5: Implement (Green)
- [ ] Step 6: Supplemental wiring and card promotion
- [ ] Step 7: Targeted verification
- [ ] Step 8: Post-task hygiene, recap, and proposed commit

If a check fails in Step 4, 5 or 7, go back to the step named on that check line.

---

### Step 1: Scope & GitHub Issue Linkage

1. Identify the controlling Roadmap Milestone in [`docs/roadmap_and_milestones.md`](../../../docs/roadmap_and_milestones.md) (e.g. Milestone 2C, Milestone 2D, Phase 3).
2. Check existing open GitHub issues (`gh issue list`) or create a new tracked feature issue:

   ```bash
   gh issue create \
     --title "feat(<subsystem>): <concise feature title>" \
     --label "feature,priority:P1-high,impact:high,subsystem:<engine|ui|data>" \
     --body "### 🚀 Feature Scope & Objectives
   <Detailed description of the new capability and rules requirements>

   ### 📜 Rules Reference / Spec
   - Marvel Champions Rules Reference v1.8: <citation>
   - Controlling ADR: [ADR-XXXX](docs/decisions/00XX-....md)

   ### 🎯 Deliverables
   1. Acceptance tests in \`tests/<subsystem>/...\`
   2. Engine / UI modular implementation
   3. Supplemental schema integration and card promotion"
   ```

3. Record the issue number `#<NUM>` for commit auto-closing.

---

### Step 2: Rules Reference Audit (RR v1.8) & ADR Alignment

1. **Audit Rules Reference:** Use `npm run rule -- <term>` and `references/rules/` for all timing, cost, and trigger definitions. Open the raw PDF only if confidence stays below 95%.
2. **Evaluate Confidence:** Assess confidence level ($0–100\%$). If $< 95\%$, trigger the **Ambiguity RFC Circuit Breaker** and stop.
3. **Audit ADR, Schemas & Refactor Opportunities:**
   - Read the controlling ADR in `docs/decisions/`.
   - Search existing primitives and helpers first: can an existing primitive/function be parameterized or two similar functions merged instead of adding a new one?
   - Update `src/data/supplemental/schema.ts` with strict Zod types if introducing or parameterizing primitives.
   - Update `src/engine/models/abilities.ts` or `src/engine/models/state.ts`.
   - Trace the change into the Card Supplemental Editor and its specification. Identify every affected editor descriptor, builder control, validation path, persistence shape, and editor test before implementation.
   - Identify confirmed legacy/orphan/redundant code in the path that the feature supersedes or should consolidate. Record the refactor targets in the implementation plan.

---

### Step 3: Author Implementation Plan & Wait for User Approval 🛑

- **MANDATORY REVIEW GATE:** Because of the complexity of Marvel Champions rules and state invariants, you MUST always create an `implementation_plan.md` artifact detailing (strict structure: all five sections, in this order):
  1. **Rules Reference & Spec Analysis:** Exact citations from RR v1.8, timing priority, and active ADRs.
  2. **Proposed Changes (with Simplification & Refactor Check):** Explicitly state what existing functions/primitives are being reused, parameterized, merged, or cleaned up (never propose "supporting both" or duplicating functions), followed by the file-by-file breakdown (`[NEW]`, `[MODIFY]`, `[DELETE]`).
  3. **UI and Card Editor Impact:** Explicitly state the impact and required files. If neither surface is affected, include exactly:

     ```markdown
     ## UI and Card Editor

     No change required.
     ```

     If either surface is affected, list the affected components, specifications, validation/persistence paths, and required UI/Card Editor tests. Never leave this section implied or omit it because the change appears engine-only.

  4. **Verification Plan:** Complete targeted test inventory covering engine/data behavior, integration contracts, boundary conditions, and UI/Card Editor behavior whenever affected. Prefer extending existing test files or `it.each` tables over duplicating test setup boilerplate.
  5. **Open Questions & Design Decisions:** Any trade-offs or design choices highlighted for user review.
- **STOP AND WAIT:** Set `request_feedback: true` in the artifact metadata. Create `temp/.plan-pending` when you post the plan and delete it once the user approves. While it exists, a hook blocks edits under `src/`, `tests/`, `data/`, `tools/` and `scripts/`; implementing before approval skips the review gate.
- **Execution Handoff:** Before approval, feature-delivery must stop and must not delegate implementation. After explicit approval, hand the approved plan to `/execute-plan`; `/execute-plan` performs its own ambiguity gate and implements only the plan's unambiguous, explicitly authorized work. Feature-delivery must not interpret missing requirements or bypass that handoff.

---

### Step 4: Write Acceptance & Contract Tests (BDD Red)

- **Golden Rule:** NEVER implement a feature before writing comprehensive, contract-defining tests demonstrating all intended behaviors and edge cases.
- Create or extend a test file in `tests/engine/`, `tests/ui/`, or `tests/cards/` (e.g. `tests/engine/feature-name.test.ts`).
- The implementation plan must identify every required test file and case before implementation. This includes Card Editor tests whenever the UI or editor is affected: schema/form round-trips, control visibility and choices, validation diagnostics, persistence payloads, and reload behavior as applicable.
- If the UI and Card Editor are unaffected, preserve the explicit plan statement `UI and Card Editor / No change required.` and add the focused evidence supporting that conclusion (for example, engine/data-only file scope and unchanged editor contract).
- Write unit and integration tests covering:
  - **Happy Path:** Standard execution and expected state transitions.
  - **Edge Cases:** Boundary conditions, 0-amount scenarios, empty decks, defeated characters.
  - **Rules Invariants:** Unicity checks, form restrictions, timing priorities.
- No skipped, todo, focused, or commented-out tests (a hook enforces this).
- Run the targeted test file (`rtk npx vitest run tests/<file>.test.ts`) and confirm it fails because the capability is not yet implemented (**Red**). If it passes before implementation, go back and tighten the test.

---

### Step 5: Composable & Modular Implementation (Green)

- Implement the capability cleanly in the appropriate subsystem:
  - **Phase Pipelines:** `src/engine/pipeline/` (`player-phase.ts`, `villain-phase.ts`, `round-upkeep.ts`, `combat-pipeline.ts`).
  - **Effect Primitives:** `src/engine/effects/index.ts` (parameterized, composable functions).
  - **Cost & Legality:** `src/engine/pipeline/cost-engine.ts` and `legality-checker.ts`.
  - **Scenario Plugins:** `src/engine/scenarios/` (`ScenarioPlugin` implementations).
  - **UI Components:** `src/ui/components/` (React presentation, Tailwind styling, Pop-Art aesthetic).
- Keep the Card Supplemental Editor usable for the new canonical shape. Update the relevant editor registry, form builder, validation, persistence, and round-trip tests whenever the feature changes what a card can express or how it is reviewed.
- Remove confirmed legacy/orphan implementations and references made obsolete by the feature. Do not leave duplicate code paths or dead compatibility branches behind.
- Run the targeted acceptance test file to confirm all tests pass cleanly (**Green**). If any fail, fix the implementation and re-run before moving to Step 6.

---

### Step 6: Declarative Supplemental Retrofit, Wiring & Audit Metadata Update 🃏

- Whenever a feature, primitive, keyword, or mechanic is implemented or modified:
  1. **Search Supplemental Data:** Search all pack files in `src/data/supplemental/pack/*.json` for every card that utilizes or is affected by the new capability.
  2. **Retrofit Card Definitions:** Apply the new declarative schema and primitives to all affected card entries.
  3. **Update Audit Metadata:** For every modified card entry, update:
     - `updatedAt`, `reviewedAt`, `reviewedBy`: per the [audit stamp rules](../../rules/shared-quality-gates.md#audit-stamp).
  4. **Card Promotion & Ambiguity Pruning:** If previously blocked, promote `audit.confidence: 1.0` and prune resolved ambiguity files in `docs/ambiguities/` (Inbox Zero).
  5. **Run Declarations Analyzer:** Execute `rtk npm run report:declarations` once to ensure zero schema violations.

---

### Step 7: Targeted Verification Gate (No Redundant Full-Suite Runs)

Run the targeted verification checks **once** (skip any check that already passed if zero files changed since):

```bash
rtk npx prettier --check <changed-files> && rtk npm run lint && rtk npm run typecheck && rtk npx vitest related <changed-files> --run
```

- **Related Vitest Suite:** All related test files pass with 0 failures and **0 skipped tests** (Zero Skipped Tests Invariant: `passed: N, failed: 0, skipped: 0`).
- **TypeScript & Lint:** 0 compilation errors (`tsc --noEmit`) and 0 ESLint warnings/errors.
- If any check fails, fix it and go back to Step 5, then re-run the failed check.
- Skip the full `npm test` suite and `npm run build` (the pre-push hook runs them; see the shared quality gates).

---

### Step 8: Post-Task Hygiene & Delivery Recap

1. **Execute Post-Task Protocol:**
   Execute [`.agents/rules/post-task-checklist.md`](../../rules/post-task-checklist.md) scoped to Tier 2/3: add a CHANGELOG fragment in `changes/unreleased/`, synchronize specs and docs (run `rtk npm run docs:check` and search `docs/` and `.agents/` for every changed name), verify Card Editor alignment, and check off roadmap tasks in `docs/roadmap_and_milestones.md`.
2. **Present Verification & Solution Recap:**
   Present the completed feature, verification logs, and proposed diff to the user.
3. **Delivery Authorization:**
   Per `AGENTS.md`, commit and push occur only upon explicit user request in the current message. When authorized, follow `commit-and-push`:
   - Stage reviewed files (`rtk git add <files>`).
   - Commit with auto-closing syntax: `rtk git commit -m "feat(<scope>): <description> (Closes #<NUM>)"` (letting `.githooks/pre-commit` run `format:check`, `lint`, `typecheck`).
   - Push to remote and confirm issue closure (`rtk git push`, letting `.githooks/pre-push` run the full `npm test` suite once).


---

## 💡 Prompt Examples

- `feature-delivery: Implement SEARCH_AND_SELECT two-pile destination routing primitive (Issue #10)`
- `feature-delivery: Enforce Max 1 per player and global unicity board invariants (Issue #3)`
- `feature-delivery: Implement Wakanda Forever! Special ability execution sequence (Issue #18)`
- `feature-delivery: Build modular encounter set customizer in ScenarioSelector.tsx (Milestone 2C)`
- `feature-delivery: Implement PLAY_FROM_DISCARD primitive for Make the Call (Issue #25)`
