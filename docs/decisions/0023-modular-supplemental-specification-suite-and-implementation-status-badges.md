# [ADR-0023] Modular Supplemental Specification Suite & Implementation Status Badges

- **Status:** **Accepted**
- **Date:** 2026-08-30
- **Authors:** MCD Core Team
- **Deciders:** User & Antigravity

---

## Context and Problem Statement

Early in the project, declarative ability schemas and effect primitives were documented in a single monolithic markdown file (`docs/specifications/supplemental_data_schema.md`). As more effect types, dynamic formulas, trigger windows, and prompt options were added, this document grew to over 1,000 lines.

This monolithic approach caused two major problems:

1. **Sprawl & Navigability:** Contributors and AI agents struggled to quickly find specific specifications (e.g. how `FilterSchema` works or how dynamic math formulas are structured).
2. **Ambiguous Maturity Status:** It was unclear from the documentation which effect primitives were actually coded and working in the engine. Planning status belongs in GitHub issues and the project roadmap, not in the implemented specification suite.

---

## Decision Drivers

- **Domain Separation:** Clean, modular organization by domain (Metadata, Timings, Costs, Combat, Zones, Status, Formulations, Modals).
- **Maturity Transparency:** Specification entries must describe only implemented, tested primitives and link to their code and relevant tracking issues where useful. Planned work remains in GitHub issues and the project roadmap.
- **Skill Integration:** Direct integration with the `card-integration-protocol` skill, allowing AI agents to anchor confidence ratings directly to specification maturity.

---

## Decision Outcome

**Chosen Option:** **Modular 10-Part Specification Suite in `docs/specifications/supplemental/` + Central Index (`README.md`).**

### Structure:

- `README.md`: Master index, quick reference table, and status badge definitions.
- `01_metadata_and_audit.md`: Root schema, Audit standard (HH:MM, confidence), errata.
- `02_timings_and_triggers.md`: 8+ timing types & event trigger windows.
- `04_universal_card_filter.md`: Exhaustive card filter schema, predicates, and cross-primitive filtering.
- `05_effects_combat_threat.md`: `DEAL_DAMAGE`, `REMOVE_THREAT`, `ADD_THREAT`[^names], keywords.
- `06_effects_zones_cards.md`: `DRAW_CARDS`, `MODIFY_HAND_SIZE`, `SEARCH_AND_SELECT`[^names], `PLAY_FROM_ZONE`.
- `07_effects_status_economy.md`: `ADD_STATUS`[^names], Toughness keyword, `GENERATE_RESOURCE`[^names], `DOUBLE_RESOURCE`.
- `08_effects_villain_nemesis.md`: `VILLAIN_SCHEMES`, `VILLAIN_ATTACKS`, `SPAWN_NEMESIS`, `ATTACH_TO_HOST`.
- `09_dynamic_formulas.md`: `amountCalculated`, state tokens (`PLAYER_MAX_HEALTH`, `SUFFERED_DAMAGE`), clamps.
- `10_sequences_and_prompts.md`: `steps: []`[^names] multi-action chaining, `PLAYER_CHOICE` Pop-Art modals.
- `11_play_requirements.md`: Card-level form, trait, and control constraints (RR v1.8 p. 16).

[^names]: **Errata (2026-09-02 / 2026-09-06, `documentation-audit`).** The primitive names and module numbers in this list were updated after this ADR was accepted; the list above has been updated to the current engine vocabulary and 11-module numbering suite so the suite index stays navigable. The original 2026-08-30 wording read `PLACE_THREAT`, `SEARCH_AND_DRAW`, `APPLY_STATUS`, `TOUGHNESS`, `RESOURCE_GENERATION`, `SCRY_AND_SELECT_TRAIT`, and `sequence: []`. The `sequence` → `steps` rename is the vocabulary standardization mandated by [ADR-0030](0030-unified-ability-step-sequence-architecture.md); the remaining renames align the docs with the actual `switch (step.effect)` labels in `src/engine/effects/index.ts`. This decision's substance is unchanged.

---

## Consequences

### Positive Consequences

- **Instant Discoverability:** Developers and AI subagents can view small, focused ~100-line specification files rather than parsing giant documents.
- **Implementation-First Documentation:** The specification suite contains only behavior that exists in the codebase and is covered by automated tests. New planned capabilities are recorded in GitHub issues or `docs/roadmap_and_milestones.md` until implemented and verified.
- **Single Active Specification Status:** Implemented specification entries use 🟢 `IMPLEMENTED (v1.0)`. `ROADMAP`, `SPECIFIED`, and similar planning labels are not used as specification maturity statuses.
