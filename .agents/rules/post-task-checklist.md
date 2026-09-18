---
always_on: true
description: 'Canonical 8-point post-task documentation and hygiene protocol'
---

# Canonical Post-Task Documentation & Hygiene Protocol

After implementation and verification, execute this checklist before concluding. Apply each item when relevant and record why a conditional item does not apply.

---

## The 8-Point Protocol

### 1. CHANGELOG Update

- Review `CHANGELOG.md` and ensure the `[Unreleased]` section is updated under appropriate subheadings (`Added`, `Changed`, `Fixed`, `Removed`).
- Detail user-facing features, rules engine changes, and UI improvements with clear context and component references.

### 2. Documentation Updates

- Check if architectural guides, `README.md`, `docs/algorithmic_rules_reference.md`, or component documentation need updates.
- Ensure all code references, paths, and invariants reflect current code reality.

### 3. Specifications Documentation Updates

- Check if mechanics, effect primitives, state interfaces, data structures, or schemas were altered.
- Update relevant specification documents in `docs/specifications/` (e.g. `docs/specifications/supplemental/` modular specs 01–09, `supplemental_data_schema.md`).

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
  - Verify supplemental data conformance (`npm run validate:supplemental` / schema checks).
  - Ensure ambiguity docs in `docs/ambiguities/` follow the 8-step Card Integration Protocol.
  - Run `npm run report:declarations` and review the generated report.
