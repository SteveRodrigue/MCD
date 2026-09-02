---
name: next-task
description: >-
  Automated Technical Product Manager & Work Prioritization skill that evaluates all open
  GitHub issues, active roadmap milestones, and 170-pack card catalog ROI. Computes a
  weighted composite score to recommend the Top 3-5 next actionable tasks with ready-to-trigger
  prompts for feature-delivery, bug-fix, or card-integration-protocol.
  Enforces automatic transition to the Mandatory Pre-Execution Plan Review Gate upon selection.
  Trigger whenever asking "What should I work on next?" or prefixed with 'next-task'.
---

# 🎯 Next-Task Prioritization & Dispatch Protocol

**Path Policy:** Use paths relative to the MCD repository root for all local project files. Never use personal filesystem paths, drive-letter paths, `file:///` links, or `vscode://` links.

This skill acts as the **Automated Release Orchestrator & Technical Product Manager** for MCD. It computes real-time, data-driven recommendations for what the developer or agent should implement next by balancing:

1. **GitHub Issue Priority:** P0 (Blocker) vs P1 (High) vs P2 (Medium) vs P3 (Low).
2. **Active Roadmap Milestone:** Focuses on current sprint deliverables in [`docs/roadmap_and_milestones.md`](../../docs/roadmap_and_milestones.md).
3. **Card Catalog ROI:** Calculates exact card counts unblocked/enabled across all 170 expansion packs.
4. **Architectural Blast Radius:** High-impact engine invariants vs localized data definitions.

---

## 🔄 Dual-Phase Execution Workflow

```mermaid
flowchart TD
    subgraph Phase1["Phase 1: Prioritized Task Recommendation"]
        S1["1. Run Automated Task Evaluator (npx tsx tools/audit/next-task-evaluator.ts)"]
        S1 --> S2["2. Ingest GitHub Issues, Active Milestone & Card Data"]
        S2 --> S3["3. Compute Weighted Composite Scores"]
        S3 --> S4["4. Present Ranked Options Table to User"]
    end

    subgraph Phase2["Phase 2: Task Selection & Mandatory Plan Review Gate"]
        S4 --> S5["5. User Selects Option (e.g. 'Option 1')"]
        S5 --> S6["6. Agent Researches RR v1.8 Rules & Codebase"]
        S6 --> S7["7. Agent Creates 'implementation_plan.md' (request_feedback: true)"]
        S7 --> S8["🛑 HARD STOP: Interactive Review UI ('Approve / Proceed')"]
        S8 --> S9["8. User Reviews & Approves → Execution Begins"]
    end
```

---

### Phase 1: Evaluation & Recommendation

1. Run the dynamic evaluator tool:
   ```bash
   npx tsx tools/audit/next-task-evaluator.ts
   ```
2. Present the Top 3 to 5 ranked candidates to the user in a clean table with medals (🥇, 🥈, 🥉), scores, card impact, and clickable option triggers.

---

### Phase 2: Selection & Mandatory Implementation Plan Gate 🛑

When the user selects an option (e.g., replying `"Option 1"`, `"1"`, or triggering `feature-delivery: ...`):

1. **Do NOT write or modify code yet.**
2. **Research Rules & Codebase:** Audit `references/mc_rulesreference_v18_compressed.pdf`, relevant ADRs, and related engine pipelines.
3. **Create `implementation_plan.md` Artifact:**
   Create `<appDataDir>\brain\<conversation-id>/implementation_plan.md` with:
   - **`ArtifactMetadata: { RequestFeedback: true, UserFacing: true }`**
   - Detailed Rules Reference analysis
   - Proposed file changes (`[NEW]`, `[MODIFY]`)
   - Acceptance / contract tests plan
   - Open questions or design decisions
4. **STOP AND WAIT:** Conclude the turn immediately so the interactive "Approve / Proceed" review modal is presented to the user. Do not begin implementation until explicit user approval is granted.

---

## 📊 Standard Presentation Template

```markdown
### 🎯 Next-Task Recommendations: Ranked Priority & Card ROI

Here are the Top ranked candidates evaluated against active roadmap milestones, issue priorities, and card catalog ROI:

|   Rank    | Issue                                                              |  Priority & Impact   | Target Milestone | Card ROI / Impact           |   Score    |
| :-------: | :----------------------------------------------------------------- | :------------------: | :--------------: | :-------------------------- | :--------: |
| 🥇 **#1** | **[#XX](https://github.com/SteveRodrigue/MCD/issues/XX)**: _Title_ | `P1` / `impact:high` |   Milestone 2D   | 43 cards across 170 packs   | **90 pts** |
| 🥈 **#2** | **[#YY](https://github.com/SteveRodrigue/MCD/issues/YY)**: _Title_ | `P1` / `impact:high` |   Milestone 2D   | 100 cards (Deck exhaustion) | **90 pts** |
| 🥉 **#3** | **[#ZZ](https://github.com/SteveRodrigue/MCD/issues/ZZ)**: _Title_ | `P1` / `impact:high` |   Milestone 2D   | 28 cards (Search/look)      | **81 pts** |

---

### 🚀 Ready-to-Run Action Options:

1. **Option 1 (Top Pick):**
   - **Prompt:** \`feature-delivery: <Title> (Issue #XX)\`
   - **Why:** <Concise rationale explaining milestone and card value>

2. **Option 2 (Runner-Up):**
   - **Prompt:** \`feature-delivery: <Title> (Issue #YY)\`
   - **Why:** <Concise rationale>

3. **Option 3 (High Value):**
   - **Prompt:** \`feature-delivery: <Title> (Issue #ZZ)\`
   - **Why:** <Concise rationale>

_Reply with your choice (e.g. "1" or "Let's do Option 1"). I will immediately author the detailed \`implementation_plan.md\` and prompt you for review and approval before modifying any code!_
```

---

## 💡 Prompt Examples

- `"What should we work on next?"`
- `"next-task"`
- `"next-task --milestone 2D"`
- `"next-task --max-cards"`
