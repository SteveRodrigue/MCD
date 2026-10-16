---
type: Changed
---

- **Card Editor re-architecture, Phase 1: supplemental schema purge (plan `docs/backlog/plan_card_editor_rearchitecture.md`)**
  - Supplemental cards no longer declare values the upstream card data already provides: `traits`, `keywords`, `maxPerPlayer`, `isLandscape`, `restrictedSlots`, `additionalBoostCards`, `attackCost`, `thwartCost`, `victoryPoints` and ability `labels` are removed from the schema and derived by the loader.
  - Printed `Victory X` (including `Victory 0` and negative values) is now parsed into the Victory keyword.
  - Allies with no printed consequential damage icon now take 0 consequential damage (was 1 when upstream omitted the value).
  - Ability resource costs use one typed map (`resourceCost: { energy: 1 }`); `cost.resources` and the untyped numeric `resourceCost` are gone. Enhanced Spider-Sense, One-Two Punch and Get Behind Me! now pay their printed event cost instead of a copied value.
  - Steps declare `target`, `filter` and `distinctFrom` only inside `effectParams`.
  - Event abilities played from hand with no declared cost are now checked against the printed event cost before payment, matching how they are paid.
- **Phase 2: schema-driven parameters**
  - New headless `schema-introspector.ts` turns `.meta()`-annotated Zod schemas into form field descriptors.
  - Every effect primitive now has a strict `effectParams` schema (`EFFECT_PARAM_SCHEMAS`); unknown or wrongly typed parameters are rejected when packs load. All 196 parameterized steps in the 5 packs validate.
  - Gate parameter fields are derived from their schemas instead of hand-written lists.
