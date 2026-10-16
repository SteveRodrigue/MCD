# [ADR-0083] Schema-Driven Card Editor and Upstream-Derived Fields

- **Status:** Accepted
- **Date:** 2026-10-16
- **Authors:** MCD Core Team
- **Deciders:** Owner & Claude
- **Related Issues:** [#319](https://github.com/SteveRodrigue/MCD/issues/319) (Card Editor re-architecture), [#316](https://github.com/SteveRodrigue/MCD/issues/316) (dash power values, fixed first), [#318](https://github.com/SteveRodrigue/MCD/issues/318) (variable X costs)
- **Plan:** [`docs/backlog/plan_card_editor_rearchitecture.md`](../backlog/plan_card_editor_rearchitecture.md)
- **Supersedes in part:** [ADR-0069](0069-card-editor-field-binding-completeness-and-trigger-filter-orphan-purge.md), [ADR-0078](0078-one-damage-pipeline-and-the-attack-label.md), [ADR-0055](0055-universal-ability-resource-payment-and-action-verb-unification.md), [ADR-0011](0011-card-orientation-and-art-caching.md), [ADR-0077](0077-chosen-target-vs-event-target-and-step-level-target-choice.md)

---

## Context and Problem Statement

The Card Editor described the supplemental schema a second time, by hand. `effect-parameter-registry.ts` held 1,365 lines of per-effect field lists, `CardAttributesSection.tsx` held 1,283 lines of accordions, and every enum was copied into a form. Each copy could drift from `schema.ts`, and several did.

The schema itself also asked authors to declare values the upstream card data already provides: `traits`, `keywords`, `maxPerPlayer`, `isLandscape`, `restrictedSlots`, `additionalBoostCards`, `attackCost`, `thwartCost` and `victoryPoints`. It carried manual ability `labels` (derived from printed text since Issue #270), step-level `target`, `filter` and `distinctFrom` (duplicates of the `effectParams` keys), and two ways to write an ability resource cost (`cost.resources` and an untyped numeric `resourceCost`). Hand-copied values hid the upstream ones, and some were wrong: the loader defaulted a missing ally `attack_cost` to 1 where Rules Reference v1.8 (Consequential Damage) means no icon, so 0; and three event cards pinned a copy of their printed cost.

---

## Decision Drivers

- One source of truth: the Zod schema defines what is valid, what the editor shows, and what the JSON Schema file contains.
- Authors declare only what the upstream card data cannot provide.
- Headless layering (ADR-0002): the schema and its introspection must not depend on React, the DOM or CSS.
- A new effect, gate or enum value must reach the editor without editing a form.
- An uncluttered editor: show what is set, offer the rest on demand.

---

## Considered Options

1. **Option A:** Annotate the Zod v4 schemas with `.meta()`, introspect them in a headless module, and render forms from the result.
2. **Option B:** Keep the hand-written registry and add a test that compares it to the schema.
3. **Option C:** Generate forms from the emitted JSON Schema (`schema.json`).

---

## Decision Outcome

**Chosen Option:** **Option A: Zod `.meta()` plus a headless introspector as the single source of truth.**

### Rationale ("The Why")

- `.meta()` keeps the label, description, placeholder, `primary` flag and widget hint next to the field they describe, so a schema change and its editor change are one edit.
- `src/data/supplemental/schema-introspector.ts` walks the Zod v4 `_zod.def` tree (the walker `schema-member-coverage.ts` already used) and returns `FieldDescriptor[]`. It throws on a node kind it cannot describe, so an unsupported schema fails a test instead of rendering a blank form. The engine, audit tools and editor share it.
- Option B keeps two descriptions and only detects drift after the fact. Option C loses `.meta()` hints and the Zod-only constraints that `superRefine` enforces.

### What changed

1. **Schemas as the contract.**
   - `EFFECT_PARAM_SCHEMAS` in `effect-params.ts` holds one strict, annotated object schema for each of the 56 effect primitives. `EFFECT_PARAM_KEYS` is derived from it. `AbilityStepSchema` validates `effectParams` against `EFFECT_PARAM_SCHEMAS[step.effect]` and `gateParams` against the gate's schema, so unknown or mistyped parameters are rejected when a pack loads (all 196 parameterized pack steps pass).
   - `GATE_REGISTRY[gate].fields` and `hasRequiredParams` in `gate-params.ts` are derived from the gate schemas through the introspector.
   - The leaf schemas moved to an internal `schema-primitives.ts` that `schema.ts` re-exports, which breaks the load cycle between `schema.ts` and `effect-params.ts`. Importers keep using `schema.ts`.
2. **Upstream-derived fields removed.** `CardEnrichmentSchema` (strict) no longer accepts `traits`, `keywords`, `maxPerPlayer`, `isLandscape`, `restrictedSlots`, `additionalBoostCards`, `attackCost`, `thwartCost` and `victoryPoints`. `card-loader.ts` derives each from the upstream card: `Victory X` from the printed text with a signed pattern (so `Victory 0` and negative values work), `maxPerPlayer` from the text, and ally consequential damage as `attack_cost ?? 0` / `thwart_cost ?? 0`. The editor shows them as read-only badges.
3. **Duplicates removed.** Ability `labels` (derived by `parseAbilityLabelsFromText`; the runtime `CardAbility.labels` stays), step-level `target` / `filter` / `distinctFrom` (only `effectParams` remains) and the dead `ADD_THREAT.condition` (retired by ADR-0080).
4. **One cost shape.** `AbilityCostSchema.resourceCost` is a strict typed map (`{ physical?, energy?, mental?, wild? }`, positive integers). `cost.resources` and the numeric form are gone. An event's printed cost is read from upstream `raw.cost` through `getEffectiveAbilityCost` when an ability declares no resource cost, so Enhanced Spider-Sense (`01004`), One-Two Punch (`01024`) and Get Behind Me! (`01078`) declare no `cost`.
5. **Editor rendered from schemas.** `<ZodSchemaForm />` renders descriptors (selects, pills, numbers including negatives where the schema allows, checkboxes, text, and the card filter, card location and dynamic value builders) and shows unset optional fields as `+ Add` chips. Card level, ability level and step level each use a chip bar; the Visual Review tab is gone, leaving Form Builder and Raw JSON. Audit & Metadata stays a collapsible section. The editor never stamps `audit.updatedAt` or `audit.reviewedAt`: the save endpoint (`src/tools/editor/api-middleware.ts`) does.
6. **CI guard.** `tests/ui/editor-schema-parity.test.ts` fails when an effect or gate has no schema, when a schema cannot be introspected, or when a file under `src/ui/components/editor/` hardcodes a string array that duplicates an exported schema enum.

### Deferred

- Re-exporting the engine's `TriggerType`, `EffectType`, `AbilityTiming`, `AbilityCost` and `CardUsesDefinition` from `schema.ts` (plan Phase 1.5) is not behavior-neutral, because the engine types are wider. It needs an owner decision.
- Aligning `KeywordSchema` (8 values) with the engine keyword enum (23 values) needs the same decision, and renaming `Toughness` to `Tough` (#280).
- Variable "Spend X" costs (Energy Channel `01018`) cannot be expressed by the positive-integer map. #318 will extend it; `<ZodSchemaForm />` picks up the new shape through `.meta()`.

---

## Evaluation of Options

### Option A: `.meta()` plus a headless introspector

- **Pros:**
  - One description of every field; forms, validation and `schema.json` cannot disagree.
  - The editor needs no change for a new effect or enum value.
  - Headless, so tools and tests reuse it.
- **Cons:**
  - Presentation hints live in the data layer (kept small and free of React and CSS).
  - The introspector depends on Zod v4 internals (`_zod.def`), guarded by its own tests.

### Option B: Registry plus drift test

- **Pros:**
  - No change to schema files.
- **Cons:**
  - Two descriptions to maintain; the test only catches drift after it happens.

### Option C: Forms from JSON Schema

- **Pros:**
  - Standard format.
- **Cons:**
  - Loses `.meta()` hints and refinement rules; one more generation step to keep in sync.

---

## Consequences

### Positive Consequences

- Roughly 2,600 lines of hand-written editor description are deleted; the editor is smaller and cannot drift from the schema.
- Pack authors write less, and wrong values (the ally consequential damage default of 1, copied event costs) are fixed at the source.
- Strict `effectParams` validation catches typos when a pack loads.

### Negative Consequences / Risks & Mitigations

- Any pack that still declares a removed field now fails to load. Mitigation: `tests/data/supplemental-pack-guards.test.ts` and the strict schema tests catch it in CI, and all five Gate 1 packs were migrated.
- Allies of later packs with no printed consequential icons now take 0 consequential damage (the Deadpool-pack allies `44013` to `44016`, `44043` to `44045`). Mitigation: verify against card images when those packs are integrated (Gate 4); no Gate 1 impact.
- The schema is authoritative for the editor but the engine types are still separate until Phase 1.5 is decided. Mitigation: the typecheck and the parity tests cover the shared surface.
