# Marvel Champions Digital (MCD) — Agent Instructions

## 🏛️ Project Principles

1. **Marvel Champions Rules Reference (RR v1.8):** Adhere strictly to the official rules, timing priority, costs, and state machine transitions.
2. **Headless Engine / Presentation Decoupling:** Engine logic in `src/engine/` is pure TypeScript and decoupled from React UI in `src/ui/`.
3. **1960s Comic Pop-Art Aesthetics:** Vibrant colors, Ben-Day halftone patterns, bold typography, and comic onomatopoeias.
4. **Declarative Data-First Invariant:** All card-specific logic resides exclusively in `src/data/supplemental/`. The engine (`src/engine/`) only contains universal, card-agnostic state machines and effect primitives. When triaging any card issue, **always audit and correct the supplemental JSON first**. Altering engine code for a single card is an anti-pattern unless a truly universal primitive is missing.
5. **🎯 Rhino Release First (Scope Boundary Invariant):** All current active development tasks, features, improvements, and bug fixes must strictly target the **Core Set Player Cards (101 cards across 5 Heroes + 4 Aspects + Basic)** and the **Rhino Scenario (Rhino I/II/III, Standard, Expert, Bomb Scare, and 5 Nemesis Sets - 34 cards)**. Any expansion cards, multi-form mechanics, or non-Rhino villains (Klaw, Ultron) are strictly deferred to subsequent releases. We explicitly accept localized tech debt or refactors later to achieve immediate vertical slice completion and maximum velocity.

## Path Policy

All agent and skill documentation MUST use paths relative to the MCD repository root. Never add personal filesystem paths, drive-letter paths, `file:///` links, or `vscode://` links for local project files. Use repository-relative paths such as `src/engine/` or `docs/README.md`; reserve absolute URLs for external resources only.

---

## 🛑 Mandatory Pre-Execution Protocol (Enforce Before Writing Code)

BEFORE writing or modifying any source code (`src/`), test files (`tests/`), or card supplemental data (`src/data/supplemental/`), the agent **MUST ALWAYS** execute this 3-step pre-execution gate:

1. **Author `implementation_plan.md` Artifact:**
   Create `<appDataDir>\brain\<conversation-id>/implementation_plan.md` using `write_to_file` with `ArtifactMetadata: { RequestFeedback: true, UserFacing: true }`.
2. **Include Mandatory Sections in the Plan:**
   - **📖 Rules Reference (RR v1.8) & Spec Analysis:** Exact citations from RR v1.8, timing priority, cost resolution, and active ADRs.
   - **📁 Proposed Changes:** File-by-file breakdown (`[NEW]`, `[MODIFY]`, `[DELETE]`) across engine pipelines, effect primitives, and supplemental JSON.
   - **🧪 Acceptance / Contract Tests Plan:** Exact test files and test cases covering both standard behavior and boundary conditions.
   - **❓ Open Questions & Design Decisions:** Any architectural trade-offs flagged with GitHub alert callouts (`> [!IMPORTANT]`, `> [!WARNING]`).
3. **HARD STOP & WAIT FOR APPROVAL:**
   The agent **MUST STOP CALLING TOOLS IMMEDIATELY** and conclude the turn. You MUST NOT modify or create any source code or test files until the user explicitly reviews, refines, and clicks "Approve / Proceed" on the plan.

---

## 📋 Mandatory Post-Task Protocol (Enforce on Every Turn)

After executing automated tests and code verification (`npm run format:check && npm run lint && npm run typecheck && npm test && npm run build && npm run report:declarations`), **ALWAYS** execute this 8-point checklist before concluding the turn:

1. **Check CHANGELOG.md:** Update `[Unreleased]` with all new features, fixes, and engine changes.
2. **Check Documentation:** Update relevant files in `docs/` or `README.md`.
3. **Check Specifications:** Update specifications documentation (e.g. `docs/specifications/` or schemas) when mechanics, primitives, or schemas change.
4. **Check Guidelines:** Update guidelines documentation (e.g. `docs/coding_guidelines.md`) when development standards, conventions, or design patterns change.
5. **Check ADRs:** Check if a new or updated Architecture Decision Record (`docs/decisions/`) is needed. **Every ADR — new or edited — MUST follow [`docs/decisions/template.md`](docs/decisions/template.md) exactly:** copy the template, keep the `# [ADR-XXXX] Title` heading and the `Status` / `Date` / `Authors` / `Deciders` metadata block, and keep the standard section order (Context and Problem Statement, Decision Drivers, Considered Options, Decision Outcome, Evaluation of Options, Consequences). Never invent an alternative header or status format, and always add the matching row to the `docs/decisions/README.md` log table in ascending ID order.
6. **Check Git Issues & Ambiguities:** Check if an issue or `docs/ambiguities/` file can be closed/resolved.
7. **Check Roadmap & Milestones:** Check off completed tasks, update active milestone status badges, and keep `docs/roadmap_and_milestones.md` synchronized.
8. **Check Card Supplemental Retrofit, Integration Protocol & Usage Report:** If any mechanic, keyword, effect primitive, cost, or timing logic was added or modified, **ALWAYS**:
   - **Search Supplemental Data:** Search all pack files in `src/data/supplemental/pack/*.json` for any cards that use or benefit from this capability.
   - **Retrofit Card Definitions:** Apply the new/updated declarative schema to all affected card entries.
   - **Update Audit Metadata:** If card data was changed, update `"updatedAt"`, `"reviewedAt"` (current ISO timestamp with `HH:MM`, e.g. `2026-09-01T09:48:00Z`), `"reviewedBy": "antigravity"`, `"originalText"` (exact printed card text), and `"reconstructedText"`.
   - **Run Declarations Analyzer:** **ALWAYS run `npm run report:declarations` (or `npx tsx tools/audit/supplemental-declarations-analyzer.ts`)** whenever cards, abilities, effects, or ambiguity reports are modified to ensure `docs/reports/supplemental_declarations_usage_report.md` reflects updated metrics and zero schema violations.
