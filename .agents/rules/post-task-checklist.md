---
always_on: true
description: "Mandatory 5-Step Post-Task Documentation & Hygiene Protocol enforced after testing"
---

# Mandatory Post-Task Documentation & Hygiene Protocol

Whenever implementing features, resolving bugs, or refactoring code, after running tests and verification, **ALWAYS** execute this 5-point checklist before concluding:

---

## 📋 The 5-Point Protocol

### 1. 📝 CHANGELOG Update
* Review `CHANGELOG.md` and ensure the `[Unreleased]` section is updated under appropriate subheadings (`Added`, `Changed`, `Fixed`, `Removed`).
* Detail user-facing features, rules engine changes, and UI improvements with clear context and component references.

### 2. 📚 Documentation Updates
* Check if architectural guides, `README.md`, `docs/algorithmic_rules_reference.md`, `docs/coding_guidelines.md`, or component documentation need updates.
* Ensure all code references, paths, and invariants reflect current code reality.

### 3. 🏛️ Architecture Decision Records (ADRs)
* Check if a major design decision, technical architecture, or user interaction pattern was introduced or modified.
* If a new paradigm is established (e.g. Action Dispatching, Hand Layout, Decision Prompts), create or update the ADR in `docs/decisions/` and register it in `docs/decisions/README.md`.

### 4. 🎯 Git Issues & Ambiguity Tracking
* Check if any documented ambiguities in `docs/ambiguities/` have been resolved.
* Reference related GitHub issue numbers or mark ambiguity files as resolved with status and timestamp.

### 5. 🃏 Card Integration Protocol
* If any card definitions, abilities, or rules implementations (e.g. in `src/data/supplemental/` or `src/engine/effects/`) were added or modified:
  * Verify supplemental data conformance (`npm run validate:supplemental` / schema checks).
  * Ensure progress logs in `logs/skills/` and ambiguity docs in `docs/ambiguities/` follow the 8-step Card Integration Protocol.
