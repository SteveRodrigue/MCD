---
always_on: true
description: 'Canonical 8-point post-task documentation and hygiene protocol'
---

# Canonical Post-Task Documentation & Hygiene Protocol

After implementation and verification, execute this checklist before concluding. To eliminate token waste, scope checks by the task's Blast-Radius Tier (defined in `shared-quality-gates.md`):

- **Tier 1 (Localized UI, Data, or Test change):** Check Item 1 (CHANGELOG fragment). If card data changed, check Item 8. Do not generate verbose N/A notes for unaffected items.
- **Tier 2 (Shared Subsystems, generic primitives, schemas):** Check Items 1 (CHANGELOG fragment), 2 (Docs), 3 (Specs), 6 (Ambiguities/Issues), and 8 (Declarations).
- **Tier 3 (Core Architecture, state model, new paradigms):** Execute the full 8-point protocol including Items 4 (Guidelines), 5 (ADRs), and 7 (Roadmap).

---

## The 8 Checklist Items


### 1. CHANGELOG Fragment

- Add a change fragment in `changes/unreleased/` following the format in `changes/README.md` (`<issue>-<short-slug>.md` or `YYYY-MM-DD-<short-slug>.md`).
- Specify the Keep a Changelog `type` in the YAML front matter (`Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`).
- Detail user-facing features, rules engine changes, and UI improvements with clear context and component references.

### 2. Documentation Updates

- Run `rtk npm run docs:check` (links, anchors, cited paths and scripts, symbols, ADR index, orphan docs, removed-feature wording, hard-coded counts).
- Reverse lookup: `rg` every file and symbol you renamed, moved, removed or changed across `docs/`, `.agents/` and the root `*.md` files, and update each hit. Docs and skills describe the current state only (see `shared-quality-gates.md`).

### 3. Specifications Documentation Updates

- Check if mechanics, effect primitives, state interfaces, data structures, or schemas were altered.
- Update relevant specification documents in `docs/specifications/` (e.g. `docs/specifications/supplemental/` modular specs 01–11, `supplemental_data_schema.md`).

### 4. Guidelines Documentation Updates

- Check if development practices, coding conventions, architectural standards, or design guidelines were added or modified.
- Update `docs/coding_guidelines.md` or general guidelines to keep team and agent standards synchronized.

### 5. Architecture Decision Records (ADRs)

- Check if a major design decision, technical architecture, or user interaction pattern was introduced or modified.
- If a new paradigm is established (e.g. Action Dispatching, Hand Layout, Decision Prompts), create or update the ADR in `docs/decisions/` and register it in `docs/decisions/README.md`.

### 6. Git Issues and Ambiguity Tracking

- Check if any documented ambiguities in `docs/ambiguities/` have been resolved.
- Reference related GitHub issue numbers or mark ambiguity files as resolved with status and timestamp.

### 7. Roadmap and Milestones

- Check `docs/roadmap_and_milestones.md` when the task affects roadmap work or milestone status.
- Synchronize completed tasks, active milestone badges, and release scope when applicable.

### 8. Card Integration and Declarations

- If any card definitions, abilities, or rules implementations (e.g. in `src/data/supplemental/` or `src/engine/effects/`) were added or modified:
  - Verify supplemental data conformance (`rtk npx vitest run tests/data` and `rtk npm run schema:generate`).
  - Ensure ambiguity docs in `docs/ambiguities/` follow the 8-step Card Integration Protocol.
  - Run `npm run report:declarations` and review the generated report.
