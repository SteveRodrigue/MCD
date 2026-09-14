# Card Supplemental Editor UI Upgrade: Comprehensive Integration Plan

**Tracking Issue:** Phase 6 UI Completion & Section 4 Proposition Alignment  
**Governing ADRs:** ADR-0045 (Card Supplemental Editor), ADR-0046 (Universal Card Filter), ADR-0049 & ADR-0052 (Dynamic Values), ADR-0054 (Structured Keywords), ADR-0055 & ADR-0057 (Cost Engine & Uses), ADR-0058 (Declarative Taxonomy)  
**Approval Gate:** Hard stop. No source or test modifications will begin until this plan is reviewed and approved.

---

## 1. Rules Reference (RR v1.8) & Specification Analysis

The Card Supplemental Editor is the developer & authoring interface for declaring card enrichment metadata (`CardEnrichmentSchema`) across all 170+ Marvel Champions cards. To achieve 100% declarative authoring without requiring raw JSON editing, the visual editor must support the complete declarative grammar:

1. **Universal Card Filter (RR v1.8 p. 19, 26, ADR-0046):**
   - Evaluating atomic criteria: `codes`, `names`, `types`, `traits`, `aspects`, `sets`, `isUnique`, `isIdentitySpecific`, `isExhausted`, `cost` comparison (`min`, `max`, `equals`), `resourceIcons`, `hasKeyword`, and `hasStatus`.
   - Composable boolean grouping: `all` (AND), `any` (OR), `none` (NOT) branches with 1-level visual nesting.
   - **Eager Output Sanitization (Gap 3C.1):** Pruning empty arrays (`[]`), blank strings, and `undefined` keys so serialized filters strictly satisfy `UniversalCardFilterSchema.strict()` and keep the Live JSON editor valid.
2. **Dynamic Values & Multi-Modal Quantities (ADR-0049, ADR-0052):**
   - Multi-modal support via a **3-Way Segmented Switcher (Gap 3A.1)**: Fixed numbers, `'ALL'` literal (for `DISCARD`, `REMOVE_COUNTERS`), and dynamic formulas (`from: 'STAT_VALUE' | 'COUNTERS' | 'ENTITY_COUNT' | 'DISCARDED_COUNT' | 'INTERCEPTED_VALUE' | 'PREVIOUS_RESULT' | 'CARD_ATTRIBUTE'`).
   - Dynamic formula parameters: `stat`, `counterType`, `attribute`, `multiplier`, `offset`, `clamp: { min, max }`, `target: TargetSelector`.
   - **Collapsible Filter Accordion for `ENTITY_COUNT` (Gap 3B.2):** Expandable `<UniversalCardFilterBuilder>` inside `DynamicValueBuilder` showing criteria summary badges to prevent excessive visual nesting.
3. **Card-Level Attributes & Uses (RR v1.8 p. 30 'Uses', ADR-0054, ADR-0057):**
   - Structured keywords matrix: `Guard`, `Overkill`, `Ranged`, `Toughness`, `Crisis`, `Hazard`, `Acceleration`, `Quickstrike`, `Retaliate` (+ numeric amount input).
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
   - Step sequencing: Reordering controls (Move Up `↑` / Move Down `↓`).
   - Step gates: `gate` (`THEN`, `IF_PREVIOUS_SUCCESS`, `IF_AMOUNT_ZERO`, `IF_FAILED`).
   - Step milestone conditions: `condition` (`TARGET_DEFEATED`, `SCHEME_EMPTY`, `STATUS_APPLIED`, `RESOURCE_KICKER_MET`).
   - Step-level `filter` and `id`.

---

## 2. Comprehensive Gap Analysis & Resolved Technical Decisions

| Gap Item | Root Cause / Status | Resolved Architectural Decision |
| :--- | :--- | :--- |
| **Gap 1: Component Test Environment** | `vitest` runs in pure `node` environment without DOM simulation. | **Option B (Happy-DOM):** Install `happy-dom`, `@testing-library/react`, and `@testing-library/user-event`. Scoped exclusively to `tests/ui/**/*.test.tsx` via Vitest `environmentMatchGlobs`. Headless engine tests remain in pure Node for maximum speed. |
| **Gap 2: Parameter Registry Typing** | Registry numeric parameters lacked dynamic capability flags. | **`allowDynamic?: boolean` and `allowAll?: boolean`**: Orthogonal modifier flags on `ParameterDescriptor` with base `type: 'number'`. Avoids enum explosion, preserves backward compatibility, and supports `'ALL'`. |
| **Gap 3A: Value Mode Switcher** | `DynamicValueBuilder` only had binary Fixed/Formula toggle without `'ALL'`. | **3-Way Segmented Switcher (3A.1):** Top pill bar displaying `[ Fixed Number ]`, `[ Entire Pool ("ALL") ]` (when `allowAll: true`), and `[ Dynamic Formula ]`. Zero ambiguous intermediate states. |
| **Gap 3B: `ENTITY_COUNT` Filter** | `DynamicValueSource` filter editing was unhandled. | **Collapsible Filter Accordion (3B.2):** Expandable accordion with a summary badge (e.g. `Filter: 2 criteria configured`) hosting `<UniversalCardFilterBuilder>` inside `DynamicValueBuilder`. |
| **Gap 3C: Strict Schema Sanitation** | `UniversalCardFilterSchema.strict()` rejects empty arrays and blank strings. | **Eager Component-Level Sanitation (3C.1):** `UniversalCardFilterBuilder` cleans empty arrays, blank strings, and undefined keys before emitting `onChange`, emitting `undefined` when empty. |
| **Styling Consistency** | Existing builders used dark mode gray styling. | **Comic Pop-Art Design System:** All new/upgraded builders restyled to `bg-comic-paper`, `border-black`, `shadow-comic-xs`, bold typography, and uppercase tag labels. |

---

## 3. Proposed Changes (File-by-File)

### 📁 `package.json` [MODIFY]
- Add devDependencies for UI component testing:
  - `happy-dom`: High-performance DOM simulation environment.
  - `@testing-library/react`: Standard React component test runner.
  - `@testing-library/user-event`: User interaction simulation.

### 📁 `vitest.config.ts` [MODIFY]
- Configure targeted DOM environment for UI component tests:
  ```typescript
  test: {
    globals: true,
    environment: 'node', // Preserves ultra-fast pure Node environment for engine/rules tests
    environmentMatchGlobs: [
      ['tests/ui/**/*.test.tsx', 'happy-dom'], // Targeted DOM environment for React UI tests only
    ],
  }
  ```

### 📁 `src/ui/components/editor/effect-parameter-registry.ts` [MODIFY]
- Extend `ParameterDescriptor` interface:
  ```typescript
  export interface ParameterDescriptor {
    key: string;
    label: string;
    type: 'number' | 'text' | 'select' | 'boolean' | 'card-filter' | 'json';
    allowDynamic?: boolean;  // Enables <DynamicValueBuilder> formula mode
    allowAll?: boolean;      // Enables 'ALL' choice (e.g. for DISCARD, REMOVE_COUNTERS)
    options?: readonly string[];
    placeholder?: string;
    defaultValue?: any;
    description?: string;
  }
  ```
- Add `filter` parameter descriptor to `SEARCH` effect (`type: 'card-filter'`).
- Flag dynamic-capable parameters (`allowDynamic: true`):
  - `DEAL_DAMAGE`: `amount`
  - `REMOVE_THREAT`: `amount`
  - `HEAL_DAMAGE`: `amount`
  - `DRAW`: `count`
  - `DISCARD`: `count` (`allowAll: true`)
  - `SEARCH`: `lookCount`, `takeCount`
  - `ADD_COUNTERS`: `amount`
  - `REMOVE_COUNTERS`: `amount` (`allowAll: true`)
  - `SPEND_COUNTERS`: `amount`

### 📁 `src/ui/components/editor/UniversalCardFilterBuilder.tsx` [MODIFY]
- Restyle to Comic Pop-Art theme (`bg-comic-paper`, `border-black`, `text-black`, `font-bold`).
- Expand UI to support all `CardCriteria` fields:
  - **Identity & Codes:** `codes` input, `names` input, `isUnique` toggle, `isIdentitySpecific` toggle, `isExhausted` toggle.
  - **Classification:** `types` chip matrix, `traits` tag input, `aspects` chip matrix, `sets` input.
  - **Comparison & Resources:** `cost` range controls (`min`, `max`, `equals`), `resourceIcons` multi-select chips (`physical`, `energy`, `mental`, `wild`).
  - **Status & Keywords:** `hasKeyword` dropdown, `hasStatus` multi-select chips (`STUNNED`, `CONFUSED`, `TOUGH`).
  - **Boolean Combinators (Level 1):** Add UI controls to add and configure `all`, `any`, and `none` sub-filter branches.
- Implement **Eager Output Sanitization (3C.1)**: Strip empty arrays, blank strings, and `undefined` keys before emitting `onChange`, emitting `undefined` if no criteria remain.

### 📁 `src/ui/components/editor/DynamicValueBuilder.tsx` [MODIFY]
- Restyle to Comic Pop-Art theme.
- Implement **3-Way Segmented Switcher (3A.1)**:
  - `[ Fixed Number ]` `[ Entire Pool ("ALL") ]` (when `allowAll: true`) `[ Dynamic Formula ]`.
- Implement full `DynamicValueSourceSchema` fields:
  - `from` selector: `STAT_VALUE`, `COUNTERS`, `ENTITY_COUNT`, `DISCARDED_COUNT`, `INTERCEPTED_VALUE`, `PREVIOUS_RESULT`, `CARD_ATTRIBUTE`.
  - Conditional sub-fields: `stat`, `counterType`, `attribute`, `multiplier`, `offset`, `clamp.min`, `clamp.max`, `target`.
  - Implement **Collapsible Filter Accordion (3B.2)**: When `from === 'ENTITY_COUNT'`, render a collapsible accordion hosting `<UniversalCardFilterBuilder>` for `sourceValue.filter`.

### 📁 `src/ui/components/editor/AbilityFormBuilder.tsx` [MODIFY]
1. **Import & Wire Sub-Builders:**
   - Import `<UniversalCardFilterBuilder>` and `<DynamicValueBuilder>`.
2. **Upgrade Card-Level Attributes Accordion:**
   - **Uses (X) Sub-Form:** `count`, `type` / `counterType`, `max`, `discardOnEmpty`.
   - **Structured Keywords Matrix:** Interactive toggle chips for `Guard`, `Overkill`, `Ranged`, `Toughness`, `Crisis`, `Hazard`, `Acceleration`, `Quickstrike`, plus `Retaliate` with numeric amount input.
   - **Card Properties:** `restrictedSlots`, `additionalBoostCards`, `victoryPoints`, `attackCost`, `thwartCost`, `isLandscape`.
   - **Play Requirements:** Use `<UniversalCardFilterBuilder>` for `controlFilter`.
3. **Add Trigger Filter Section:**
   - When an ability has an event trigger (e.g. `ENEMY_INITIATES_ATTACK`, `DEFEATED`, etc.), render a collapsible **Trigger Filter (Scope & Target)** sub-form (`attackerKind`, `targetPlayerScope`, `damageSourceType`, `defeatByAttack`, etc.).
4. **Upgrade Ability Cost Section:**
   - Add Resource Cost picker (`physical`, `energy`, `mental`, `wild` counts).
   - Add `spendCounters` sub-form (`amount`, `counterType`, `target: SELF | IDENTITY`).
   - Add `discardCard` sub-form (`count`, `maxCount`, `from: HAND | DECK | PLAY`).
   - Add `damageHero` input.
5. **Upgrade Multi-Step Sequence Pipeline:**
   - Add step reordering buttons (Move Up `↑`, Move Down `↓`).
   - Add `condition` dropdown (`StepConditionSchema.options`).
   - Replace old inline card-filter textboxes with `<UniversalCardFilterBuilder>`.
   - For parameters with `allowDynamic: true`, render `<DynamicValueBuilder>` with `allowAll={param.allowAll}`.

### 📁 `tests/ui/AbilityFormBuilder.test.tsx` [NEW]
- Interactive React component tests using `happy-dom` and `@testing-library/react`:
  - Renders card-level uses & keywords and updates parent state via `onChange`.
  - Renders trigger filter when trigger selected and updates state.
  - Mounts `UniversalCardFilterBuilder` for card-filter parameters and updates filter criteria.
  - Mounts `DynamicValueBuilder` for numeric parameters with `allowDynamic: true` and switches between fixed number, formula, and 'ALL'.
  - Handles step reordering (moving Step 2 up to Step 1).

### 📁 `tests/ui/UniversalCardFilterBuilder.test.tsx` [MODIFY / CONVERT]
- Convert to `.tsx` and verify interactive filter criteria toggling, cost ranges, resource icon chips, and empty-property sanitization.

### 📁 `tests/ui/DynamicValueBuilder.test.tsx` [MODIFY / CONVERT]
- Convert to `.tsx` and verify 3-way mode switching, formula source selection, collapsible entity-count filter, and sub-field updates.

### 📁 `tests/ui/effect-parameter-registry.test.ts` [MODIFY]
- Verify `allowDynamic` and `allowAll` flags on applicable effect parameters.
- Verify `filter` parameter presence on `SEARCH`.

### 📁 `docs/reports/card_editor_and_supplemental_schema_audit_report.md` [MODIFY]
- Synchronize Phase 6 task descriptions with the verified implementation.

---

## 4. Acceptance & Contract Tests Plan

1. **Round-Trip Form Editing:**
   - Build an ability with `SEARCH` + `filter: { traits: ['Tech'], types: ['upgrade'], cost: { max: 3 } }` via UI $\to$ outputs canonical Zod-valid JSON $\to$ re-loading into UI accurately populates all chips and inputs.
2. **Dynamic Value Round-Trip & Mode Switching:**
   - Switch mode to Formula $\to$ configure `amount: { from: 'STAT_VALUE', stat: 'ATTACK', multiplier: 2 }` via UI $\to$ outputs valid `DynamicValueSource` $\to$ switch mode to 'ALL' $\to$ outputs `'ALL'` $\to$ switch mode to Fixed Number $\to$ outputs integer.
3. **Card-Level Uses & Keywords Round-Trip:**
   - Configure `uses: { count: 3, type: 'charge', discardOnEmpty: true }` and `keywords: ['Guard', { keyword: 'Retaliate', amount: 1 }]` $\to$ valid `CardEnrichmentSchema`.
4. **Trigger Filter Round-Trip:**
   - Configure `trigger: 'ENEMY_INITIATES_ATTACK'`, `triggerFilter: { attackerKind: 'VILLAIN', targetPlayerScope: 'SELF' }` $\to$ valid `CardAbilitySchema`.
5. **Step Sequencing & Conditions:**
   - Add 3 steps $\to$ reorder step 3 to step 2 $\to$ add `gate: 'IF_PREVIOUS_SUCCESS'` and `condition: 'TARGET_DEFEATED'` $\to$ valid `AbilityStepSchema`.
6. **Zero Regression Full Suite Quality Gate:**
   - `npm run format:check && npm run lint && npm run typecheck && npm test && npm run build && npm run report:declarations`.

---

## 5. Open Questions & Design Decisions (All Resolved)

* **DOM Test Runner:** `happy-dom` selected and isolated via `vitest.config.ts` `environmentMatchGlobs`.
* **Dynamic Parameter Schema:** `allowDynamic?: boolean` and `allowAll?: boolean` flags selected on `type: 'number'`.
* **Value Mode Switcher:** 3-Way Segmented Switcher (`Fixed Number` / `'ALL'` / `Dynamic Formula`) selected.
* **`ENTITY_COUNT` Filter:** Collapsible accordion with criteria count badge selected.
* **Schema Sanitation:** Eager component-level output sanitation on `onChange` selected.
* **Aesthetics:** Pop-Art comic design system (`bg-comic-paper`, `border-black`, `shadow-comic-xs`) selected across all sub-builders.

---

## 6. Execution Order

1. **Sub-Phase 6.1:** Install `happy-dom`, `@testing-library/react`, `@testing-library/user-event` and configure `vitest.config.ts` with `environmentMatchGlobs`.
2. **Sub-Phase 6.2:** Upgrade `effect-parameter-registry.ts` (`allowDynamic`, `allowAll`, `filter` on `SEARCH`).
3. **Sub-Phase 6.3:** Upgrade `<UniversalCardFilterBuilder>` with full `CardCriteria` fields, chip selectors, range inputs, Level 1 combinators, Pop-Art styling, and eager schema sanitization.
4. **Sub-Phase 6.4:** Upgrade `<DynamicValueBuilder>` with 3-way mode switcher, all `from` sources, conditional parameters, collapsible accordion filter for `ENTITY_COUNT`, and Pop-Art styling.
5. **Sub-Phase 6.5:** Expand `AbilityFormBuilder.tsx`:
   - Uses & Structured Keywords sub-forms.
   - Numeric metadata inputs (`restrictedSlots`, `victoryPoints`, etc.).
   - Full Ability Cost sub-form (`resources`, `spendCounters`, `discardCard`, `damageHero`).
   - Trigger Filter sub-form.
   - Step reordering controls and `condition` selector.
   - Integrate `<UniversalCardFilterBuilder>` and `<DynamicValueBuilder>`.
6. **Sub-Phase 6.6:** Author component and interaction tests (`tests/ui/AbilityFormBuilder.test.tsx`, `tests/ui/UniversalCardFilterBuilder.test.tsx`, `tests/ui/DynamicValueBuilder.test.tsx`, and registry tests).
7. **Sub-Phase 6.7:** Run the full quality gate (`format:check`, `lint`, `typecheck`, `test`, `build`, `report:declarations`) and update documentation/reports.
