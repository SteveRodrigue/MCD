---
name: feature-delivery
description: 'Specification-driven protocol for designing, testing, and shipping new engine capabilities, primitives, UI components, and milestones. Trigger when building features or prefixed with "feature-delivery:".'
---

# 🚀 Feature Delivery Protocol (Specification-Driven Development & Milestone Lifecycle)

**Shared rules:** Apply [`.agents/rules/shared-quality-gates.md`](../../rules/shared-quality-gates.md), including path, scope, plan, verification, and delivery policies.

This skill guides the agent through an authoritative, rules-verified, specification-first, and milestone-tracked protocol to deliver new features cleanly, composably, and with zero regressions.

---

## Architectural Pre-Conditions & Rules Authority

Before writing any implementation code or tests for a new feature, verify the following architectural prerequisites:

1. **📖 Rules Reference Audit (RR v1.8):**
   - Research rules using structured Markdown in `references/rules/` (or `npm run rule -- <term>`). Follow `See also:` links and consult `references/rules/TOPIC_MAP.md`. Do not open the raw PDF unless confidence is $< 95\%$.
   - **Strict Confidence Threshold ($\ge 95\%$):** If confidence in how the rules operate is $< 95\%$, **STOP IMMEDIATELY** and trigger the **Ambiguity RFC Circuit Breaker** below. Never implement speculative heuristics.
2. **Approved Architecture Decision Record (ADR):**
   - Check [`docs/decisions/`](../../docs/decisions/) to identify the controlling ADR.
   - If introducing a new paradigm, draft a **Proposed ADR** first using [`docs/decisions/template.md`](../../../docs/decisions/template.md) and register it in `docs/decisions/README.md`.
3. **Schema & Model Design Alignment:**
   - If introducing effect primitives or supplemental fields, update [`src/data/supplemental/schema.ts`](../../src/data/supplemental/schema.ts) with strict Zod types and update [`docs/specifications/`](../../docs/specifications/).
   - If extending game state, update [`src/engine/models/state.ts`](../../src/engine/models/state.ts).
   - Keep the Card Supplemental Editor aligned per [`docs/specifications/tooling/card_supplemental_editor.md`](../../docs/specifications/tooling/card_supplemental_editor.md).
4. **Core Invariants (from `shared-quality-gates.md`):**
   - Headless & decoupled engine (`src/engine/` contains no UI/DOM/CSS dependencies).
   - Declarative data-first (generic primitives in `src/engine/effects/`, card-specific parameters in `src/data/supplemental/`).
   - Rhino release scope boundary (Core set player cards & Rhino encounters for Gate 1).
   - Zero tech debt (no unapproved shims, aliases, or duplicate paths; purge confirmed legacy/orphan code).


---

## 🛑 Ambiguity RFC / Peer Review Circuit Breaker (When Confidence $< 95\%$)

If the rules interpretation, timing trigger sequence, or card interactions are ambiguous or disputed (confidence $< 95\%$):

1. **Halt Execution:** Do NOT proceed to writing acceptance tests or modifying code.
2. **Post RFC Peer Review Comment on GitHub Issue:**
   Use `gh issue comment <NUM> --body "..."` with this structured template:

   ```markdown
   ### 📢 RFC / Peer Review Request: Rules Ambiguity on Feature #<NUM>

   **Confidence Level:** <XX>% (< 95% threshold required for automated implementation)

   #### ❓ The Ambiguity / Edge Case

   <Detailed description of the conflicting rules interpretations, timing windows, or underspecified state interactions>

   #### 📜 Rules Reference Citations

   - Marvel Champions Rules Reference v1.8 Section: `<Citation>`
   - Official Rulings / Precedents: `<Citation or N/A>`

   #### ⚖️ Architectural Options for Review

   - **Option A (<Short Title>):**
     - _Implementation:_ <How it works mechanically>
     - _Pros:_ <Advantages>
     - _Cons / Risks:_ <Drawbacks / Potential edge cases>
   - **Option B (<Short Title>):**
     - _Implementation:_ <How it works mechanically>
     - _Pros:_ <Advantages>
     - _Cons / Risks:_ <Drawbacks / Potential edge cases>

   #### 💡 Architect Recommendation

   <Clear recommendation with underlying rationale>

   ---

   _Awaiting peer review and alignment before proceeding with implementation._
   ```

3. **Tag GitHub Issue:**
   ```bash
   gh issue edit <NUM> --add-label "needs-review,status:blocked-by-rfc"
   ```
4. **Log Ambiguity:** If card-specific, create or update a 1-file report in `docs/ambiguities/`.
5. **End Turn Safely:** Report the RFC link to the user and pause until alignment is reached.

---

## 🔄 The 8-Step Feature Delivery Lifecycle

```mermaid
flowchart TD
    S1["1. Scope & GitHub Issue Linkage (gh issue view/create)"] --> S2["2. Rules Reference Audit (RR v1.8) & ADR Alignment"]
    S2 --> S2Check{"Confidence ≥ 95%?"}
    S2Check -- "No (< 95%)" --> RFC["🛑 Trigger RFC Circuit Breaker<br/>• Post RFC Comment on GitHub<br/>• Tag 'needs-review' & pause"]
    S2Check -- "Yes (≥ 95%)" --> S3Plan["3. Author Implementation Plan & Wait for User Approval (implementation_plan.md)"]
    S3Plan --> S4["4. Write Acceptance / Contract Tests (BDD Red)"]
    S4 --> S5["5. Composable & Modular Implementation (Green)"]
    S5 --> S6["6. Declarative Supplemental Wiring & Card Promotion"]
    S6 --> S7["7. Full Verification Suite (npm test, typecheck, build, declarations)"]
   S7 --> S8["8. Prepare walkthrough, recap, and proposed commit"]
```

---

### Step 1: Scope & GitHub Issue Linkage

1. Identify the controlling Roadmap Milestone in [`docs/roadmap_and_milestones.md`](../../docs/roadmap_and_milestones.md) (e.g. Milestone 2C, Milestone 2D, Phase 3).
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

1. **Audit Rules Reference:** Thoroughly inspect `references/mc_rulesreference_v18_compressed.pdf` for all timing, cost, and trigger definitions.
2. **Evaluate Confidence:** Assess confidence level ($0–100\%$). If $< 95\%$, trigger the **Ambiguity RFC Circuit Breaker** and stop.
3. **Audit ADR & Schemas:**
   - Read the controlling ADR in `docs/decisions/`.
   - Update `src/data/supplemental/schema.ts` with strict Zod types if introducing new primitives.
   - Update `src/engine/models/abilities.ts` or `src/engine/models/state.ts`.
   - Trace the change into the Card Supplemental Editor and its specification. Identify every affected editor descriptor, builder control, validation path, persistence shape, and editor test before implementation.
   - Identify confirmed legacy/orphan code and references that the feature supersedes. Record the cleanup targets in the implementation plan; flag uncertain ownership or usage as an explicit user decision instead of inferring deletion.
   - Run schema tests: `npm test tests/data/supplemental-validation.test.ts`.

---

### Step 3: Author Implementation Plan & Wait for User Approval 🛑

- **MANDATORY REVIEW GATE:** Because of the complexity of Marvel Champions rules and state invariants, you MUST always create an `implementation_plan.md` artifact detailing:
  1. **Rules Reference & Spec Analysis:** Exact citations from RR v1.8, timing priority, and active ADRs.
  2. **Proposed Changes:** File-by-file breakdown (`[NEW]`, `[MODIFY]`) across engine pipelines, effect primitives, and supplemental data.
  3. **UI and Card Editor Impact:** Explicitly state the impact and required files. If neither surface is affected, include exactly:

     ```markdown
     ## UI and Card Editor

     No change required.
     ```

     If either surface is affected, list the affected components, specifications, validation/persistence paths, and required UI/Card Editor tests. Never leave this section implied or omit it because the change appears engine-only.

  4. **Verification Plan:** Complete test inventory covering engine/data behavior, integration contracts, boundary conditions, and UI/Card Editor behavior whenever affected. Every planned code path must have a corresponding test or an explicit rationale for why an existing test is sufficient.
  5. **Open Questions & Design Decisions:** Any trade-offs or design choices highlighted for user review.
- **STOP AND WAIT:** Set `request_feedback: true` in the artifact metadata. You MUST NOT proceed to writing code or modifying files until the user explicitly reviews and approves the implementation plan.
- **Execution Handoff:** Before approval, feature-delivery must stop and must not delegate implementation. After explicit approval, hand the approved plan to `/execute-plan`; `/execute-plan` performs its own ambiguity gate and delegates execution only for the plan's unambiguous, explicitly authorized work. Feature-delivery must not interpret missing requirements or bypass that handoff.

---

### Step 4: Write Acceptance & Contract Tests (BDD Red)

- **Golden Rule:** NEVER implement a feature before writing comprehensive, contract-defining tests demonstrating all intended behaviors and edge cases.
- Create a dedicated test file in `tests/engine/`, `tests/ui/`, or `tests/scenarios/` (e.g. `tests/engine/feature-name.test.ts`).
- The implementation plan must identify every required test file and case before implementation. This includes Card Editor tests whenever the UI or editor is affected: schema/form round-trips, control visibility and choices, validation diagnostics, persistence payloads, and reload behavior as applicable.
- If the UI and Card Editor are unaffected, preserve the explicit plan statement `UI and Card Editor / No change required.` and add the focused evidence supporting that conclusion (for example, engine/data-only file scope and unchanged editor contract).
- Write unit and integration tests covering:
  - **Happy Path:** Standard execution and expected state transitions.
  - **Edge Cases:** Boundary conditions, 0-amount scenarios, empty decks, defeated characters.
  - **Rules Invariants:** Unicity checks, form restrictions, timing priorities.
- **Zero Skipped Tests Invariant:** Tests must strictly pass or fail. NEVER write `it.skip`, `describe.skip`, `test.skip`, `it.todo`, or commented-out assertions.
- Run the test suite (`npx vitest run tests/<file>.test.ts`) and confirm it fails because the capability is not yet implemented (**Red**).

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
- Run the acceptance test suite to confirm all tests pass cleanly (**Green**).

---

### Step 6: Declarative Supplemental Retrofit, Wiring & Audit Metadata Update 🃏

- Whenever a feature, primitive, keyword, or mechanic is implemented or modified:
  1. **Search Supplemental Data:** Search all pack files in `src/data/supplemental/pack/*.json` for every card that utilizes or is affected by the new capability.
  2. **Retrofit Card Definitions:** Apply the new declarative schema and primitives to all affected card entries.
  3. **Update Audit Metadata:** For every modified card entry, update:
     - `"updatedAt"`: Current ISO timestamp with `HH:MM` (e.g. `2026-09-01T09:48:00Z`).
     - `"reviewedAt"`: Current ISO timestamp with `HH:MM`.
     - `"reviewedBy"`: `"antigravity"` (or current agent identity).
  4. **Card Promotion & Ambiguity Pruning:** If previously blocked, promote `audit.confidence: 1.0` and prune resolved ambiguity files in `docs/ambiguities/` (Inbox Zero).
  5. **Run Declarations Analyzer:** Execute `npm run report:declarations` to ensure zero schema violations.

---

### Step 7: Full Verification Suite & Quality Gate

Execute the full multi-tier verification suite:

```bash
npm run format:check && npm run lint && npm run typecheck && npm test && npm run build && npm run report:declarations
```

- **Vitest Suite:** All test files and suites pass with 0 failures and **0 skipped tests** (Zero Skipped Tests Invariant: `passed: N, failed: 0, skipped: 0`). Tests must strictly pass or fail; never introduce `it.skip` or commented-out assertions.
- **TypeScript:** 0 compilation errors (`tsc --noEmit`).
- **Vite Production Build:** Production bundle compiles cleanly without warnings.
- **Declarations Analyzer:** `docs/reports/supplemental_declarations_usage_report.md` compiles with 0 schema violations.

---

### Step 8: Post-Task Hygiene & Delivery Recap

1. **Execute Post-Task Protocol:**
   Execute [`.agents/rules/post-task-checklist.md`](../../rules/post-task-checklist.md) scoped to Tier 2/3: update CHANGELOG, synchronize specs and docs, verify Card Editor alignment, check off roadmap tasks in `docs/roadmap_and_milestones.md`, and run `npm run report:declarations`.
2. **Present Verification & Solution Recap:**
   Present the completed feature, verification logs, and proposed diff to the user.
3. **Delivery Authorization:**
   Per `AGENTS.md`, commit and push occur only upon explicit user request in the current message. When authorized, follow `commit-and-push`:
   - Stage reviewed files (`git add <files>`).
   - Commit with auto-closing syntax: `feat(<scope>): <description> (Closes #<NUM>)`.
   - Push to remote and confirm issue closure.


---

## 💡 Prompt Examples

- `feature-delivery: Implement SEARCH_AND_SELECT two-pile destination routing primitive (Issue #10)`
- `feature-delivery: Enforce Max 1 per player and global unicity board invariants (Issue #3)`
- `feature-delivery: Implement Wakanda Forever! Special ability execution sequence (Issue #18)`
- `feature-delivery: Build modular encounter set customizer in ScenarioSelector.tsx (Milestone 2C)`
- `feature-delivery: Implement PLAY_FROM_DISCARD primitive for Make the Call (Issue #25)`
