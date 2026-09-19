# [ADR-0067] Encapsulating Supplemental Comments into Audit Metadata

- **Status:** Accepted
- **Date:** 2026-09-19
- **Authors:** MCD Core Team
- **Deciders:** User & Antigravity

---

## Context and Problem Statement

During early development (formalized in [ADR-0021](0021-card-integration-workflow-and-composable-primitives.md)), an optional root-level `comment` string was added to card supplemental definitions (`CardEnrichment`). Over time, across `core.json` (99 entries) and `core_encounter.json` (54 entries), these root-level comments accumulated informal rules summaries, pseudo-code snippets, and paraphrased mechanics.

As the declarative architecture matured with composable primitives and strict automated schemas ([ADR-0022](0022-authoritative-zod-supplemental-schema-and-cicd-quality-gate.md), [ADR-0058](0058-declarative-schema-taxonomy-and-primitive-consolidation.md), [ADR-0059](0059-decommissioning-reconstructed-text-and-mechanic-steps.md)), these root comments introduced several problems:

1. **Split-Brain Misinformation:** Unstructured comments drifted from the actual executable `abilities: [...]` declarations and verbatim printed `originalText`, misleading developers and autonomous AI agents during card translation and debugging.
2. **Improper Domain Encapsulation:** Free-text commentary represents provenance and human developer notes rather than an intrinsic property of a card or its game engine rules. Such metadata belongs encapsulated inside `audit` (`CardAuditMetadata` / `CardAuditRecordSchema`).
3. **Agent Pollution:** AI agents frequently authored speculative or redundant comments rather than relying strictly on declarative primitives, unit tests, and ambiguity files in `docs/ambiguities/`.

How should card supplemental definitions, schemas, tooling, and agent workflows structure developer commentary while preserving single-source-of-truth invariants?

---

## Decision Drivers

- **Proper Metadata Encapsulation:** Non-engine provenance, review notes, and human documentation belong strictly in `audit` metadata.
- **Single Source of Truth:** Card mechanics are defined by declarative `abilities: [...]`, and printed text is defined by `originalText`. Supplemental files must not carry drifted informal mechanics summaries.
- **Zero Legacy Text Debt:** Outdated or inaccurate legacy comments must not be grandfathered into `audit.comment`; clean slate over blind migration.
- **Strict Schema Enforcement:** Both `CardEnrichmentSchema` and `CardAuditRecordSchema` enforce `.strict()`, rejecting misplaced or undeclared keys at compile and runtime.
- **Card Editor Support:** Human users must retain the ability to view and edit developer comments in the Card Supplemental Editor UI.
- **Agent Governance:** Strict repository rules must prohibit autonomous AI agents from adding unsolicited comments.

---

## Considered Options

1. **Option 1: Retain root-level `comment` in `CardEnrichment` and clean up inaccuracies manually**
2. **Option 2: Delete comments entirely from schema and tooling with no developer comment mechanism**
3. **Option 3: Encapsulate `comment?: string` in `audit`, remove from `CardEnrichmentSchema`, purge legacy pack comments, update Card Editor, and establish agent governance**

---

## Decision Outcome

**Chosen Option:** **Option 3: Encapsulate `comment?: string` in `audit`, remove from `CardEnrichmentSchema`, purge legacy pack comments, update Card Editor, and establish agent governance**

### Rationale ("The Why")

- Moving `comment` into `CardAuditRecordSchema` properly groups all human provenance and documentation (`confidence`, `reviewedBy`, `reviewedAt`, `originalText`, `ambiguityFile`, `comment`) in a single cohesive sub-object.
- Because `CardEnrichmentSchema` is `.strict()`, any leftover or accidentally reintroduced root-level `comment` is immediately rejected by Zod validation and CI test suites.
- Purging all 153 legacy comments from `core.json` and `core_encounter.json` ensures no obsolete, drifted, or inaccurate text persists.
- Binding the Card Attributes Editor comment input to `supplemental.audit.comment` preserves the workflow for human developers who need internal notes.
- Updating `AGENTS.md`, `.agents/rules/shared-quality-gates.md`, and `.agents/skills/card-integration-protocol/SKILL.md` establishes a firm policy: `audit.comment` is for human notes; agents must never author comments without explicit user request.

---

## Evaluation of Options

### Option 1: Retain root-level `comment`

- **Pros:**
  - No schema modification needed.
- **Cons:**
  - Violates separation of concerns between card gameplay definitions and audit metadata.
  - Leaves open the risk of continued agent pollution and drifted textual summaries at card root.

### Option 2: Remove comments entirely

- **Pros:**
  - Minimal schema complexity.
- **Cons:**
  - Prevents human developers and maintainers from leaving legitimate developer notes or integration caveats in the Card Editor UI.

### Option 3: Encapsulate in `audit`, purge pack debt, enforce agent rules

- **Pros:**
  - Cohesive audit domain model.
  - Clean supplemental JSON packs with 0 legacy comments.
  - Strict validation prevents regressions.
  - Clear governance for human vs agent contributions.
- **Cons:**
  - Requires one-time schema regeneration, pack purge, tooling updates, test updates, and rule synchronization.

---

## Consequences

### Positive Consequences

- `src/engine/models/abilities.ts`: `CardAuditMetadata` includes `comment?: string;`; `CardEnrichment` no longer has `comment`.
- `src/data/supplemental/schema.ts`: `CardAuditRecordSchema` accepts optional `comment: z.string().optional()`; `CardEnrichmentSchema` strictly rejects root-level `comment`.
- `src/data/supplemental/schema.json`: Regenerated via `npm run schema:generate`.
- `src/data/supplemental/pack/`: 99 legacy comments purged from `core.json`, 54 from `core_encounter.json`.
- `src/ui/components/editor/`: `CardAttributesSection.tsx` and `DualCardInspector.tsx` read/write `supplemental.audit.comment`.
- `tools/audit/supplemental-declarations-analyzer.ts`: Reads `entry.audit?.comment`.
- Agent rules in `AGENTS.md`, `shared-quality-gates.md`, and `card-integration-protocol` forbid autonomous comment generation by agents.

### Negative Consequences / Risks & Mitigations

- **Risk:** Existing drafts or PRs with root-level `comment` will fail schema validation.
  - **Mitigation:** The `.strict()` Zod error flags `unrecognized_keys: ["comment"]`. Moving the string to `audit.comment` or removing it resolves the error immediately.

---

## References

- [ADR-0021: Standard Card Integration Protocol & Composable Primitives Architecture](0021-card-integration-workflow-and-composable-primitives.md)
- [ADR-0022: Authoritative Zod Supplemental Schema & CI/CD Quality Gate](0022-authoritative-zod-supplemental-schema-and-cicd-quality-gate.md)
- [ADR-0045: Card Supplemental Editor & Live Data Reviewer GUI](0045-card-supplemental-editor-and-live-reviewer-gui.md)
- [ADR-0059: Decommissioning Reconstructed Text and Mechanic Steps](0059-decommissioning-reconstructed-text-and-mechanic-steps.md)
