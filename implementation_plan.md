# Card Supplemental Editor UI Upgrade: Comprehensive Integration Plan

**Tracking Issue:** Phase 6 UI Completion & Section 4 Proposition Alignment  
**Governing ADRs:** ADR-0045 (Card Supplemental Editor), ADR-0046 (Universal Card Filter), ADR-0049 & ADR-0052 (Dynamic Values), ADR-0054 (Structured Keywords), ADR-0055 & ADR-0057 (Cost Engine & Uses), ADR-0058 (Declarative Taxonomy)  
**Approval Gate:** Hard stop. No source or test modifications will begin until this plan is reviewed and approved.

---

## 1. Rules Reference (RR v1.8) & Specification Analysis

The Card Supplemental Editor is the developer & authoring interface for declaring card enrichment metadata (`CardEnrichmentSchema`) across all 170+ Marvel Champions cards. To achieve 100% declarative authoring without resorting to raw JSON editing, the visual editor must support the complete declarative grammar:

1. **Universal Card Filter (RR v1.8 p. 19, 26, ADR-0046):**
   - Evaluating atomic criteria: `codes`, `names`, `types`, `traits`, `aspects`, `sets`, `isUnique`, `isIdentitySpecific`, `isExhausted`, `cost` comparison (`min`, `max`, `equals`), `resourceIcons`, `hasKeyword`, and `hasStatus`.
   - Composable boolean grouping: `all` (AND), `any` (OR), `none` (NOT) branches.
2. **Dynamic Values & Formulas (ADR-0049, ADR-0052):**
   - Static numeric constants vs. dynamic formulas (`from: 'STAT_VALUE' | 'COUNTERS' | 'ENTITY_COUNT' | 'DISCARDED_COUNT' | 'INTERCEPTED_VALUE' | 'PREVIOUS_RESULT' | 'CARD_ATTRIBUTE'`).
   - Dynamic parameters: `stat`, `counterType`, `attribute`, `multiplier`, `offset`, `clamp: { min, max }`.
3. **Card-Level Attributes & Uses (RR v1.8 p. 30 'Uses', ADR-0054, ADR-0057):**
   - Structured keywords matrix: `Guard`, `Overkill`, `Ranged`, `Toughness`, `Crisis`, `Hazard`, `Acceleration`, `Quickstrike`, `Retaliate` (+ numeric amount).
   - "Uses" counters lifecycle: `count`, `type` / `counterType`, `max`, `discardOnEmpty`.
   - Numeric metadata: `restrictedSlots`, `additionalBoostCards`, `victoryPoints`, `attackCost`, `thwartCost`, `isLandscape`, `traits`.
4. **Trigger Filters (ADR-0058):**
   - Event scoping: `attackerKind` (`VILLAIN` | `MINION` | `ANY_ENEMY`), `targetPlayerScope` (`SELF` | `OTHER` | `ANY`), `targetForm`, `isEngaged`, `damageSourceType`, `defeatEntityType`, `defeatByAttack`, `formChangeDirection`.
5. **Full Ability Cost Specification (RR v1.8 p. 10 'Cost', ADR-0051, ADR-0055):**
   - Host card manipulation: `exhaustSelf`, `discardSelf`.
   - Damage costs: `damageSelf`, `damageHero`.
   - Resource payments: `resources` (Physical, Energy, Mental, Wild counts) and `resourceCost` array.
   - Counter payments: `spendCounters` (`counterType`, `amount`, `target: SELF | IDENTITY`).
   - Card discarding: `discardCard` (`count`, `maxCount`, `from: HAND | DECK | PLAY`).
6. **Multi-Step Resolution Pipelines (ADR-0030, ADR-0058):**
   - Step sequencing: Reordering controls (Move Up / Move Down).
   - Step gates: `gate` (`THEN`, `IF_PREVIOUS_SUCCESS`, `IF_AMOUNT_ZERO`, `IF_FAILED`).
   - Step milestone conditions: `condition` (`TARGET_DEFEATED`, `SCHEME_EMPTY`, `STATUS_APPLIED`, `RESOURCE_KICKER_MET`).
   - Step-level `filter` and `id`.

---

## 2. Comprehensive Gap Analysis of Built vs. Integrated Editor Features

Here is the exact audit of what exists in code vs. what is actually integrated into the live editor:

| Feature / Sub-System                     | Existing Scaffolded Code                                                                         | Current Integration Status in Editor                                                  | Missing Integration / Gaps                                                                                                                                                                                                                                                                                                                                                                  |
| :--------------------------------------- | :----------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **1. Universal Card Filter**             | `src/ui/components/editor/UniversalCardFilterBuilder.tsx` exists                                 | ❌ **NOT Integrated** (Hardcoded 3-textbox fallback used in `AbilityFormBuilder.tsx`) | • Component is never imported in `AbilityFormBuilder.tsx`.<br>• Component itself lacks `cost` range, `resourceIcons`, `keywords`, `statuses`, `isUnique`, `isExhausted`, and `all`/`any`/`none` groups.<br>• `SEARCH` in `effect-parameter-registry.ts` is missing `filter` parameter.<br>• `playRequirements.controlFilter` and `triggerFilter.attackerCardFilter` do not use the builder. |
| **2. Dynamic Value Builder**             | `src/ui/components/editor/DynamicValueBuilder.tsx` exists                                        | ❌ **NOT Integrated**                                                                 | • Component is never imported or rendered in `AbilityFormBuilder.tsx`.<br>• All numeric effect parameters only render `<input type="number">` without dynamic toggle.                                                                                                                                                                                                                       |
| **3. Card Attributes (Uses & Keywords)** | Zod schema in `schema.ts` (`CardUsesSchema`, `StructuredKeywordSchema`, `restrictedSlots`, etc.) | ❌ **NOT Integrated**                                                                 | • `AbilityFormBuilder.tsx` only renders `comment`, `maxPerPlayer`, `confidence`, `reviewedBy`, and `noSupplementalNeeded`.<br>• Zero UI for `uses` (`count`, `type`, `max`, `discardOnEmpty`).<br>• Zero UI for `keywords` chip matrix.<br>• Zero UI for `restrictedSlots`, `additionalBoostCards`, `victoryPoints`, `attackCost`, `thwartCost`, `isLandscape`.                             |
| **4. Trigger Filter Builder**            | Zod schema in `schema.ts` (`TriggerFilterSchema`)                                                | ❌ **NOT Integrated**                                                                 | • `AbilityFormBuilder.tsx` only has a flat trigger dropdown.<br>• Zero UI for configuring `triggerFilter` (`attackerKind`, `targetPlayerScope`, `damageSourceType`, `defeatByAttack`, etc.).                                                                                                                                                                                                |
| **5. Ability Cost Specification**        | Zod schema in `schema.ts` (`AbilityCostSchema`)                                                  | ⚠️ **Partially Implemented (20%)**                                                    | • Only has checkboxes for `exhaustSelf`, `discardSelf`, and `damageSelf`.<br>• Missing `resources` / `resourceCost` picker.<br>• Missing `spendCounters` sub-form.<br>• Missing `discardCard` sub-form.<br>• Missing `damageHero` input.                                                                                                                                                    |
| **6. Multi-Step Sequencing & Gates**     | Zod schema in `schema.ts` (`AbilityStepSchema`, `StepConditionSchema`)                           | ⚠️ **Partially Implemented (30%)**                                                    | • Has basic `gate` dropdown and effect selector.<br>• Missing Step Reordering buttons (Move Up / Move Down).<br>• Missing `condition` (milestone condition) dropdown.<br>• Missing step-level `filter` builder.                                                                                                                                                                             |
| **7. Parameter Registry Completeness**   | `effect-parameter-registry.ts`                                                                   | ⚠️ **Mostly Complete (95%)**                                                          | • Missing `filter` parameter descriptor on `SEARCH`.<br>• Missing `type: 'dynamic-number'` or dynamic capability descriptor on scalable parameters.                                                                                                                                                                                                                                         |

---

## 3. Proposed Changes (File-by-File)

### 📁 `src/ui/components/editor/UniversalCardFilterBuilder.tsx` [MODIFY]

- Expand UI to support all `CardCriteria` fields:
  - **Identity & Codes:** `codes` input, `names` input, `isUnique` toggle, `isIdentitySpecific` toggle, `isExhausted` toggle.
  - **Classification:** `types` chip matrix, `traits` tag input, `aspects` chip matrix, `sets` input.
  - **Comparison & Resources:** `cost` range controls (`min`, `max`, `equals`), `resourceIcons` multi-select chips (`physical`, `energy`, `mental`, `wild`).
  - **Status & Keywords:** `hasKeyword` dropdown, `hasStatus` multi-select chips (`STUNNED`, `CONFUSED`, `TOUGH`).
  - **Boolean Combinators (Level 1):** Add toggle to add/manage `all`, `any`, `none` sub-filter branches.
- Provide clean styling matching Comic Pop-Art theme.

### 📁 `src/ui/components/editor/DynamicValueBuilder.tsx` [MODIFY]

- Ensure full alignment with `DynamicValueSourceSchema`:
  - `from` selector: `STAT_VALUE`, `COUNTERS`, `ENTITY_COUNT`, `DISCARDED_COUNT`, `INTERCEPTED_VALUE`, `PREVIOUS_RESULT`, `CARD_ATTRIBUTE`.
  - Conditional parameter sub-fields: `stat`, `counterType`, `attribute`, `multiplier`, `offset`, `clamp.min`, `clamp.max`, `target`.
- Support seamless toggle between a fixed number and dynamic formula.

### 📁 `src/ui/components/editor/effect-parameter-registry.ts` [MODIFY]

- Add `filter` parameter to `SEARCH` effect descriptor (`type: 'card-filter'`).
- Support `dynamic-number` or mark numeric parameters supporting `DynamicValueSource` (`amount`, `count`, `bonusDamage`, `threatAmount`).

### 📁 `src/ui/components/editor/AbilityFormBuilder.tsx` [MODIFY]

1. **Import & Wire Sub-Builders:**
   - Import `<UniversalCardFilterBuilder>` and `<DynamicValueBuilder>`.
2. **Upgrade Card-Level Attributes Accordion:**
   - **Uses (X) Sub-Form:** `count`, `type` / `counterType`, `max`, `discardOnEmpty`.
   - **Structured Keywords Matrix:** Interactive toggle chips for `Guard`, `Overkill`, `Ranged`, `Toughness`, `Crisis`, `Hazard`, `Acceleration`, `Quickstrike`, plus `Retaliate` with numeric amount input.
   - **Card Properties:** `restrictedSlots`, `additionalBoostCards`, `victoryPoints`, `attackCost`, `thwartCost`, `isLandscape`.
   - **Play Requirements:** Use `<UniversalCardFilterBuilder>` for `controlFilter`.
3. **Add Trigger Filter Section:**
   - When an ability has a `trigger` (e.g. `ENEMY_INITIATES_ATTACK`, `DEFEATED`, etc.), show a collapsible **Trigger Filter (Scope & Target)** sub-form (`attackerKind`, `targetPlayerScope`, `damageSourceType`, `defeatByAttack`, etc.).
4. **Upgrade Ability Cost Section:**
   - Add Resource Cost picker (`physical`, `energy`, `mental`, `wild` counts).
   - Add `spendCounters` sub-form (`amount`, `counterType`, `target: SELF | IDENTITY`).
   - Add `discardCard` sub-form (`count`, `maxCount`, `from: HAND | DECK | PLAY`).
   - Add `damageHero` input.
5. **Upgrade Multi-Step Sequence Pipeline:**
   - Add step reordering buttons (Move Up `↑`, Move Down `↓`).
   - Add `condition` dropdown (`StepConditionSchema.options`).
   - Replace old inline card-filter textboxes with `<UniversalCardFilterBuilder>`.
   - Replace numeric effect parameters with `<DynamicValueBuilder>`.

### 📁 `tests/ui/AbilityFormBuilder.test.tsx` [NEW]

- Visual & interaction tests for `AbilityFormBuilder`:
  - Renders card-level uses & keywords and updates state.
  - Renders trigger filter when trigger selected and updates state.
  - Mounts `UniversalCardFilterBuilder` for card-filter parameters and round-trips filter criteria.
  - Mounts `DynamicValueBuilder` for numeric parameters and switches to formula mode.
  - Allows step reordering (moving Step 2 up to Step 1).

### 📁 `tests/ui/UniversalCardFilterBuilder.test.ts` & `DynamicValueBuilder.test.ts` [MODIFY]

- Update unit tests to verify extended criteria rendering and state changes.

### 📁 `docs/reports/card_editor_and_supplemental_schema_audit_report.md` [MODIFY]

- Update Section 4 and Phase 6 status accurately based on real implementation verification.

---

## 4. Acceptance & Contract Tests Plan

1. **Round-Trip Form Editing:**
   - Build an ability with `SEARCH` + `filter: { traits: ['Tech'], types: ['upgrade'], cost: { max: 3 } }` via UI $\to$ outputs canonical Zod-valid JSON $\to$ re-loading into UI accurately populates all chips and inputs.
2. **Dynamic Value Round-Trip:**
   - Configure `amount: { from: 'STAT_VALUE', stat: 'ATTACK', multiplier: 2 }` via UI $\to$ outputs valid `DynamicValueSource` $\to$ switching back to fixed number resets to numeric value.
3. **Card-Level Uses & Keywords Round-Trip:**
   - Configure `uses: { count: 3, type: 'charge', discardOnEmpty: true }` and `keywords: ['Guard', { keyword: 'Retaliate', amount: 1 }]` $\to$ valid `CardEnrichmentSchema`.
4. **Trigger Filter Round-Trip:**
   - Configure `trigger: 'ENEMY_INITIATES_ATTACK'`, `triggerFilter: { attackerKind: 'VILLAIN', targetPlayerScope: 'SELF' }` $\to$ valid `CardAbilitySchema`.
5. **Step Sequencing & Conditions:**
   - Add 3 steps $\to$ reorder step 3 to step 2 $\to$ add `gate: 'IF_PREVIOUS_SUCCESS'` and `condition: 'TARGET_DEFEATED'` $\to$ valid `AbilityStepSchema`.
6. **Full Suite Quality Gate:**
   - `npm run format:check && npm run lint && npm run typecheck && npm test && npm run build && npm run report:declarations`.

---

## 5. Open Questions & Design Decisions

> [!IMPORTANT]
> **Pop-Art Visual Consistency:** All new builder sub-forms will adopt the project's Comic Pop-Art style (`bg-comic-paper`, `border-black`, `shadow-comic-xs`, bold typography, uppercase label tags) to maintain cohesive aesthetics across the Editor suite.

> [!NOTE]
> **Nesting Depth for Filter Combinators:** In this phase, `all`, `any`, and `none` groups will support 1 level of nesting depth within the visual UI. Deeper arbitrary recursion can be configured via the Raw JSON Editor tab if ever needed.

---

## 6. Execution Order

1. **Sub-Phase 6.1:** Upgrade `<UniversalCardFilterBuilder>` component with full `CardCriteria` fields, chip selectors, range inputs, and Level 1 combinators.
2. **Sub-Phase 6.2:** Upgrade `<DynamicValueBuilder>` with all `from` sources and parameters.
3. **Sub-Phase 6.3:** Update `effect-parameter-registry.ts` to include `filter` on `SEARCH` and dynamic parameter tags.
4. **Sub-Phase 6.4:** Expand `AbilityFormBuilder.tsx` with:
   - Uses & Structured Keywords sub-forms.
   - Numeric metadata inputs (`restrictedSlots`, `victoryPoints`, etc.).
   - Full Ability Cost sub-form (`resources`, `spendCounters`, `discardCard`, `damageHero`).
   - Trigger Filter sub-form.
   - Step reordering controls and `condition` selector.
   - Integrated `<UniversalCardFilterBuilder>` and `<DynamicValueBuilder>`.
5. **Sub-Phase 6.5:** Add comprehensive component & integration tests in `tests/ui/`.
6. **Sub-Phase 6.6:** Run the full quality gate (`format:check`, `lint`, `typecheck`, `test`, `build`, `report:declarations`) and update documentation/reports.
