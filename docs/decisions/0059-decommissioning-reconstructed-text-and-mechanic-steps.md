# [ADR-0059] Decommissioning Reconstructed Text and Mechanic Steps

- **Status:** Accepted
- **Date:** 2026-09-14
- **Authors:** MCD Core Team
- **Deciders:** User & Antigravity

---

## Context and Problem Statement

During early development (formalized in [ADR-0021](0021-card-integration-workflow-and-composable-primitives.md)), `reconstructedText` (a machine-decompiled pseudo-text string) and `mechanicSteps` (an array of English translations) were introduced as auditing aids during card integration. They served as early proofs-of-work to compare declarative representations against printed card rules.

As the declarative schema matured through [ADR-0030](0030-unified-ability-step-sequence-architecture.md), [ADR-0046](0046-universal-declarative-card-filtering-architecture.md), [ADR-0049](0049-composable-value-transformers-and-event-interception.md), and [ADR-0058](0058-declarative-schema-taxonomy-and-primitive-consolidation.md), these redundant textual fields became liabilities:
1. **Desynchronization and Drift:** The textual summaries frequently fell out of sync with actual executable `abilities: [...]` trees during refactoring and schema migrations.
2. **Split-Brain Invariant Violation:** Card authoring tools and agents frequently read or relied upon `mechanicSteps` or `reconstructedText` rather than the official printed `originalText` or machine-executable effect primitives.
3. **Redundant Maintenance Overhead:** Maintaining two pseudo-code representations of card rules added unnecessary payload bloat to pack files without any engine runtime utility.

How should the engine data model, supplemental packs, tooling, and documentation eliminate this redundant tech debt while preserving strict fidelity to Marvel Champions Rules Reference v1.8?

---

## Decision Drivers

- **Declarative Data-First Invariant:** Machine execution must derive strictly and exclusively from structured declarative models (`abilities: [...]`), while card rules comparison must reference verbatim printed text (`originalText`).
- **Single Source of Truth:** Eliminate split-brain scenarios where human-authored or decompiled text diverges from executable abilities.
- **Strict Schema Enforcement:** Prevent stale or unvalidated fields from lingering in supplemental pack files.
- **Zero Runtime Engine Disruption:** Ensure removal does not affect game engine execution or valid card definitions.
- **Tooling and Skill Alignment:** Align developer tools, analyzers, editor API middleware, and agent protocols with the canonical schema.

---

## Considered Options

1. **Option 1: Retain `reconstructedText` and `mechanicSteps` as optional annotations**
2. **Option 2: Implement dynamic runtime/build-time decompiler to keep `reconstructedText` continuously regenerated**
3. **Option 3: Decommission and purge `reconstructedText` and `mechanicSteps` across schema, packs, tools, and documentation**

---

## Decision Outcome

**Chosen Option:** **Option 3: Decommission and purge `reconstructedText` and `mechanicSteps` across schema, packs, tools, and documentation**

### Rationale ("The Why")

- `originalText` provides 100% of the necessary human reference by capturing the exact printed card rules from upstream data.
- `abilities: [...]` provides 100% of the executable mechanics parsed and run by the rules engine.
- `mechanicSteps` and `reconstructedText` were intermediate stepping stones during early prototyping that have now been rendered obsolete by composable declarative primitives and comprehensive automated acceptance tests.
- Removing both fields from `CardAuditRecordSchema` and `CardEnrichmentSchema` (with `.strict()` validation) ensures neither field can accidentally be reintroduced or linger undetected.
- Pack payloads (`core.json`, `core_encounter.json`) are simplified, and audit analyzers focus cleanly on executable properties and printed text parity.

---

## Evaluation of Options

### Option 1: Retain as optional annotations
- **Pros:**
  - Zero schema breaking change.
- **Cons:**
  - Continued maintenance debt, desynchronization, and confusion for agent workflows and developers.
  - Pack files remain bloated with outdated pseudo-text.

### Option 2: Dynamic build-time decompiler
- **Pros:**
  - Always guarantees `reconstructedText` matches `abilities`.
- **Cons:**
  - Significant tooling complexity to decompile complex multi-step abilities, value transformers, and condition gates into natural language.
  - Adds no runtime engine value, as `abilities` already represents the ground truth.

### Option 3: Complete decommission and purge
- **Pros:**
  - Establishes a clean, singular source of truth: `originalText` for printed text, `abilities` for rules logic.
  - Reduces cognitive load and token count in supplemental data files.
  - Eliminates silent schema drift and dead code paths across analyzers and editors.
- **Cons:**
  - Requires a one-time migration of existing pack data, schema definitions, tooling, test suites, and documentation.

---

## Consequences

### Positive Consequences

- `CardAuditRecordSchema` and `CardEnrichmentSchema` strictly reject `reconstructedText` and `mechanicSteps`.
- Supplemental packs `core.json` and `core_encounter.json` are purged of 127 `mechanicSteps` arrays and 155 `reconstructedText` properties.
- Tooling (`api-middleware.ts`, `supplemental-declarations-analyzer.ts`, `migrate-declarative-taxonomy.ts`, `card-text-parser.ts`, `run-ambiguity-cards-review.ts`) is streamlined and no longer references obsolete fields.
- Agent instructions in [AGENTS.md](../../AGENTS.md), [CHEATSHEET.md](../../CHEATSHEET.md), and [card-integration-protocol](../../.agents/skills/card-integration-protocol/SKILL.md) are synchronized.

### Negative Consequences / Risks & Mitigations

- **Risk:** Existing external or unmerged card drafts containing `reconstructedText` or `mechanicSteps` will fail schema validation.
  - **Mitigation:** The `.strict()` Zod error immediately flags the invalid key, and removing the property restores valid status.
