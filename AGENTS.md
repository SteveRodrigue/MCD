# Marvel Champions Digital (MCD) — Agent Instructions

## 🏛️ Project Principles
1. **Marvel Champions Rules Reference (RR v1.8):** Adhere strictly to the official rules, timing priority, costs, and state machine transitions.
2. **Headless Engine / Presentation Decoupling:** Engine logic in `src/engine/` is pure TypeScript and decoupled from React UI in `src/ui/`.
3. **1960s Comic Pop-Art Aesthetics:** Vibrant colors, Ben-Day halftone patterns, bold typography, and comic onomatopoeias.

---

## 🛑 Mandatory Pre-Execution Protocol (Enforce Before Writing Code)
BEFORE writing or modifying any source code (`src/`), test files (`tests/`), or card supplemental data (`src/data/supplemental/`), the agent **MUST ALWAYS** execute this 3-step pre-execution gate:

1. **Author `implementation_plan.md` Artifact:**
   Create `<appDataDir>\brain\<conversation-id>/implementation_plan.md` using `write_to_file` with `ArtifactMetadata: { RequestFeedback: true, UserFacing: true }`.
2. **Include Mandatory Sections in the Plan:**
   * **📖 Rules Reference (RR v1.8) & Spec Analysis:** Exact citations from RR v1.8, timing priority, cost resolution, and active ADRs.
   * **📁 Proposed Changes:** File-by-file breakdown (`[NEW]`, `[MODIFY]`, `[DELETE]`) across engine pipelines, effect primitives, and supplemental JSON.
   * **🧪 Acceptance / Contract Tests Plan:** Exact test files and test cases covering both standard behavior and boundary conditions.
   * **❓ Open Questions & Design Decisions:** Any architectural trade-offs flagged with GitHub alert callouts (`> [!IMPORTANT]`, `> [!WARNING]`).
3. **HARD STOP & WAIT FOR APPROVAL:**
   The agent **MUST STOP CALLING TOOLS IMMEDIATELY** and conclude the turn. You MUST NOT modify or create any source code or test files until the user explicitly reviews, refines, and clicks "Approve / Proceed" on the plan.

---

## 📋 Mandatory Post-Task Protocol (Enforce on Every Turn)
After executing automated tests and code verification (`npm test && npm run typecheck && npm run build`), **ALWAYS** execute this 7-point checklist before concluding the turn:

1. **Check CHANGELOG.md:** Update `[Unreleased]` with all new features, fixes, and engine changes.
2. **Check Documentation:** Update relevant files in `docs/` or `README.md`.
3. **Check Specifications:** Update specifications documentation (e.g. `docs/specifications/` or schemas) when mechanics, primitives, or schemas change.
4. **Check Guidelines:** Update guidelines documentation (e.g. `docs/coding_guidelines.md`) when development standards, conventions, or design patterns change.
5. **Check ADRs:** Check if a new or updated Architecture Decision Record (`docs/decisions/`) is needed.
6. **Check Git Issues & Ambiguities:** Check if an issue or `docs/ambiguities/` file can be closed/resolved.
7. **Check Card Integration Protocol & Usage Report:** Check if card supplemental definitions were altered and validate supplemental schemas. **ALWAYS run `npm run report:declarations` (or `npx tsx tools/audit/supplemental-declarations-analyzer.ts`)** whenever cards, abilities, effects, or ambiguity reports are modified to ensure `docs/reports/supplemental_declarations_usage_report.md` provides an accurate, up-to-date view of card integration metrics and open ambiguities.
