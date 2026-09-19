# [ADR-0069] Card Editor Field Binding Completeness, Trigger Filter Orphan Purge & Powered Gauntlets Correction

- **Status:** Accepted
- **Date:** 2026-09-19
- **Authors:** MCD Core Team
- **Deciders:** User & Antigravity

---

## Context and Problem Statement

Following the development of the Card Supplemental Editor ([ADR-0045](0045-card-supplemental-editor-and-live-reviewer-gui.md)) and Declarative Schema Taxonomy Consolidation ([ADR-0058](0058-declarative-schema-taxonomy-and-primitive-consolidation.md)), an exhaustive codebase audit across `src/engine/` and all supplemental data packs revealed three interconnected issues:

1. **Card Editor UI Incompleteness:**  
   The rules engine has active, evaluated logic for numerous card attributes, ability costs, step pipeline fields, and trigger filters, but the visual Card Editor UI ([src/ui/components/editor/](../../src/ui/components/editor/)) lacked input controls and two-way bindings for them:
   - Ability costs: `resourceCost` (both typed object map and generic number), `exhaustCard`, and `discardCard.maxCount` / `discardCard.filter`.
   - Card attributes: `attackCost` (consequential attack damage override), `thwartCost` (consequential thwart damage override), `playUnderAnyPlayerControl`, `errata`, and `playRequirements.controlZones` / `playRequirements.identityNames`.
   - Step pipeline: `step.id`, `step.target`, and `step.filter`.
   - Trigger filters: `sourceCardCode`, `sourceInstanceId`, `targetType`, and `attackerCardFilter`.

2. **Speculative Orphan Fields in `TriggerFilterSchema`:**  
   Five fields in `TriggerFilterSchema` (`damageSourceType`, `damageTargetType`, `defeatEntityType`, `defeatByAttack`, `formChangeDirection`) had zero references in `src/engine/` and zero occurrences in any pack JSON. The trigger dispatcher (`matchesTriggerFilter` in `src/engine/triggers/trigger-dispatcher.ts`) never evaluated them. Maintaining non-functional schema fields violates the project principle against unapproved legacy shims or dead definitions.

3. **Data Defect on Powered Gauntlets (`01038`):**  
   Iron Man's *Powered Gauntlets* (`01038`) erroneously declared `"resourceCost": { "energy": 1 }` in its ability cost in `src/data/supplemental/pack/core.json`. Its printed text (*"Hero Action (attack): Exhaust Powered Gauntlets → deal 1 damage to an enemy..."*) and Rules Reference v1.8 p. 9 ("Cost Arrow") mandate that only exhaustion precedes the cost arrow; no resource payment is required.

---

## Decision Drivers

- **Field Binding Completeness:** The Card Editor must expose visual controls for 100% of active, evaluated declarative properties supported by the rules engine.
- **Strict Schema Hygiene & Anti-Drift:** Schemas must reflect what the engine actually evaluates. Dead, speculative, or un-evaluated fields must be purged to maintain strict Zod contract integrity (`.strict()`).
- **Official Rules Authority (RR v1.8 p. 9, 11, 16):** Ability costs and card attributes must faithfully match card text and rules reference specifications.
- **Provenance Encapsulation (ADR-0067):** Maintain `audit.comment` separation and adhere to the policy that agents must never autonomously add or modify comments.

---

## Considered Options

1. **Option 1: Status Quo**  
   Leave the Card Editor incomplete, keep the 5 un-evaluated trigger filter fields as speculative declarations, and leave `01038` requiring an energy resource.
2. **Option 2: Implement Engine Logic for the 5 Speculative Trigger Filter Fields**  
   Expand `matchesTriggerFilter` to evaluate `damageSourceType`, `damageTargetType`, `defeatEntityType`, `defeatByAttack`, and `formChangeDirection`, adding corresponding event metadata at all trigger dispatch sites.
3. **Option 3: Full Editor Binding Completeness, Orphan Purge from `TriggerFilterSchema`, and Card Data Fix (Selected)**  
   - Add visual inputs and bindings across all editor sections for all active engine fields.
   - Purge the 5 un-evaluated orphan fields from `TriggerFilterSchema` and remove their dummy inputs from `TriggerFilterSection.tsx`.
   - Correct `01038` Powered Gauntlets in `src/data/supplemental/pack/core.json` (removing `resourceCost`).
   - Align supplemental specifications (`01_metadata_and_audit.md`, `02_timings_and_triggers.md`, `03_costs_and_targeting.md`) and audit reports.

---

## Decision Outcome

**Chosen Option:** **Option 3: Full Editor Binding Completeness, Orphan Purge from `TriggerFilterSchema`, and Card Data Fix**

### Rationale ("The Why")

- **Zero Speculative Dead Weight:** Implementing engine features without real card requirements creates dead code and maintenance burden. Purging the 5 un-evaluated fields aligns the schema directly with `matchesTriggerFilter`, which actively evaluates exactly 8 canonical properties (`attackerKind`, `attackerCardFilter`, `sourceCardCode`, `sourceInstanceId`, `targetPlayerScope`, `targetForm`, `targetType`, `isEngaged`).
- **Editor Completeness:** Cards like Black Cat (`01002`, `attackCost: 0`), Tac Team (`01072`, `playUnderAnyPlayerControl: true`), Hulk (`01050`, `sourceCardCode: "01050"`), and Tony Stark (`01029a`, `step.filter` for Tech upgrades) can now be viewed, edited, and verified natively in the Card Supplemental Editor GUI.
- **Gameplay Fidelity:** Powered Gauntlets (`01038`) can now be activated as printed: exhausting the card to deal 1 damage (2 if Aerial) without requiring an energy resource payment.

---

## Consequences

### Positive Consequences

- **Strict Schema Integrity:** `TriggerFilterSchema` is `.strict()`, rejecting the 5 purged orphan fields at compile and runtime.
- **Card Editor Parity:** The Card Editor UI now covers all active supplemental engine capabilities including consequential damage overrides, cross-player control, step IDs, targets, card filters, and dual resource representations.
- **Accurate Gameplay:** Iron Man can activate Powered Gauntlets with 0 cards in hand and 0 resources.
- **Documented Architecture:** Supplemental specifications 01, 02, and 03 accurately describe active schema structures and historical decisions.

### Negative Consequences / Risks & Mitigations

- **Breaking Change for Speculative Supplemental Data:** If any external or future supplemental data declared one of the 5 purged trigger filter fields, Zod validation would fail.  
  *Mitigation:* Codebase grep verified 0 occurrences across all supplemental pack files.
