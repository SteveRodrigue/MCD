# [ADR-0049] Composable Value Transformers, Replacement Event Interceptors & Prevention Pipelines

- **Status:** Accepted
- **Date:** 2026-09-08
- **Authors:** MCD Core Team
- **Deciders:** User & Antigravity

---

## Context and Problem Statement

In the MCD engine, [`docs/reports/supplemental_declarations_usage_report.md`](../reports/supplemental_declarations_usage_report.md) currently flags **35+ Single-Use & Unique Primitives (Card Count = 1)** in Section 6. A prime example is `TAKE_THREAT_AS_DAMAGE` (used solely by *Great Responsibility* `01061`), or past monolithic composites like `CANCEL_WHEN_REVEALED_AND_ATTACK` (formerly on *Get Behind Me!* `01078`).

An empirical audit across the entire upstream **Zzorba dataset (`data/upstream/pack/` — 120 packs, 4,379 cards)** reveals the exact scale of this problem across the game's full lifecycle:
- **611 Interrupts** and **893 Responses**.
- **142 cards** featuring `"would be [defeated / placed / dealt]"` timing windows.
- **275 cards** using the official RR v1.8 `"instead"` replacement clause.
- **77 cards** intercepting incoming damage (`"damage would be dealt"` / `"would take damage"`).
- **7 cards** intercepting incoming threat (`"threat would be placed"`).
- **31 cards** intercepting character defeat (`"would be defeated"` — e.g. Apocalypse, Batroc, M.O.D.O.K., Groot, Iron Man).
- **390 cards** with dynamic value scalers (`"for each..."`, `"equal to the number of..."`, `"equal to your..."`).

If the engine continues creating dedicated effect primitives for every cross-domain replacement or calculation (e.g. `TAKE_THREAT_AS_DAMAGE`, `NOT_MY_RESPONSIBILITY_DAMAGE`, `REDIRECT_DAMAGE_TO_ATTACHMENT`, `PREVENT_DEFEAT_AND_RESET_HP`), the supplemental schema will explode by an estimated **150–200 single-use primitives** over the 170-pack card catalog.

How can the MCD architecture generically model event replacement, trigger interception, and dynamic values so that cards like *Great Responsibility*, *Not My Responsibility*, *EM Shield*, and *Cannonball* use reusable, atomic building blocks rather than dedicated engine code?

---

## Decision Drivers

- **Driver 1: Zero Primitive Explosion:** Keep Section 6 ("Single-Use Primitives") of `supplemental_declarations_usage_report.md` minimal and eliminate bespoke effect verbs.
- **Driver 2: Official Rules Reference (RR v1.8 p. 23) Replacement Effect Authority:** Adhere strictly to the official rules for Replacement Effects (*"A replacement effect is an effect (usually an interrupt) that replaces the handling of one event with the handling of another event. A replacement effect is indicated by the word 'instead'"*).
- **Driver 3: Declarative Composability ([ADR-0021](../decisions/0021-card-integration-workflow-and-composable-primitives.md), [ADR-0030](../decisions/0030-unified-ability-step-sequence-architecture.md)):** Any complex card should resolve as an ordered sequence of standard atomic primitives (`CANCEL_INTERCEPTED_EVENT`, `DEAL_DAMAGE`, `REMOVE_THREAT`, `ADD_STATUS`) parameterized by dynamic value references.
- **Driver 4: Zero Raw-Text Parsing & Strict Typings ([ADR-0019](../decisions/0019-strict-metadata-driven-rules-execution-and-zero-raw-text-parsing.md), [ADR-0022](../decisions/0022-authoritative-zod-supplemental-schema-and-cicd-quality-gate.md)):** Parameter bindings must be strongly typed with Zod in `schema.ts`, eliminating ad-hoc string evaluations.

---

## Considered Options

### Option 1: Ad-Hoc Dedicated Primitives (Status Quo)
Whenever an expansion card replaces an event or scales dynamically, mint a new effect verb (e.g. `TAKE_THREAT_AS_DAMAGE`, `TRANSFER_DAMAGE`, `REPULSOR_BLAST`, `PLACE_THREAT_ON_UPGRADE_INSTEAD`).
- **Engine Implementation:** Add a new case in `switch(step.effect)` in `src/engine/effects/index.ts` and write bespoke interception logic in `src/engine/triggers/trigger-dispatcher.ts`.

### Option 2: Unified Event Interception Pipeline & Dynamic Value Resolution (Recommended)
Decompose replacement and dynamic scaling into three composable architectural primitives:
1. **Dynamic Value Binding (`DynamicValueSource` in `schema.ts`)**:
   Allow numeric step parameters (`amount`, `count`) to accept either a literal integer or a declarative resolver object:
   ```ts
   amount?: number | {
     from: 'INTERCEPTED_VALUE' | 'PREVIOUS_RESULT' | 'DISCARDED_COUNT' | 'ENTITY_COUNT' | 'STAT_VALUE';
     multiplier?: number;
     filter?: CardFilterCriteria;
   }
   ```
2. **Universal Event Interception Hook (`CONSUME_INTERCEPTED_EVENT` / `PREVENT_EVENT_AMOUNT`)**:
   Instead of bespoke branches in `trigger-dispatcher.ts`, a generic replacement step consumes the pending event (e.g. reducing impending threat/damage by `amount` or nullifying it completely to `0`) and places the consumed quantity into `context.interceptedValue`.

### Intercepted Trigger Value Mapping Table

To guarantee strict determinism and eliminate ambiguity regarding what `INTERCEPTED_VALUE` represents, each interceptable trigger window binds an explicit, single numeric quantity into `context.interceptedValue` when intercepted:

| Trigger Window | Intercepted Event | Bound `INTERCEPTED_VALUE` (Scalar Number) | Consumption / Replacement Behavior (`CONSUME_INTERCEPTED_EVENT`) | Example Card Declarations |
| :--- | :--- | :--- | :--- | :--- |
| `THREAT_WOULD_BE_PLACED` | Threat placement on a scheme | **Impending Threat Amount** (e.g., `3` threat) | Sets impending threat to `0` (or reduces by step `amount`), preventing scheme placement. | *Great Responsibility* (`01061`), *Not My Responsibility* (`44022`), *Eyepatch Camera* (`50043`), *Counterintelligence* (`08017`) |
| `SCHEME_THREAT_REDUCED_TO_ZERO` | Any scheme threat reaches 0 | **Amount of threat removed to reach 0** (e.g. `2` threat) | Dispatched whether scheme is main scheme (not defeated) or side scheme (defeated). In sequential steps, sets `conditionMet = true` for `IF_CONDITION_MET`. | *Clear the Area* (`04049`), *Turn the Tide* (`13015`), *One Way or Another* (`21034`) |
| `DAMAGE_WOULD_BE_DEALT` / `TAKE_ATTACK_DAMAGE` | Damage dealt to character | **Impending Damage Amount** (e.g., `4` damage) | Sets impending damage to `0` (or reduces by step `amount`), preventing character HP loss. | *Backflip* (`01003`), *EM Shield* (`50042`), *Aerial Intervention* (`42014`), *Cannonball* (`42020`), *Energy Barrier* (`05017`) |
| `CHARACTER_WOULD_BE_DEFEATED` | Character HP reduced to 0 | **Excess / Killing Damage Amount** (e.g., `1` damage) | Cancels character defeat sequence; resets character HP to specified value instead. | *Apocalypse* (`45103b`), *Batroc* (`50086a`), *M.O.D.O.K.* (`50103a`), *Odin's Torment* (`21138b`) |
| `TREACHERY_REVEALED` / `WHEN_REVEALED` | Encounter card reveal | **Boost Icons / Card Count** (typically `1` card) | Cancels execution of the When Revealed effect text entirely. | *Enhanced Spider-Sense* (`01004`), *Get Behind Me!* (`01078`), *Black Widow* (`01075`), *Warp Reality* (`15006`) |
| `ENEMY_WOULD_ATTACK` / `ENEMY_WOULD_SCHEME` | Enemy activation initialization | **Activation Attack/Scheme Value** | Replaces activation with another action (e.g. scheme instead of attack) or cancels it. | *Stealth* (`50035b`), *Informant* (`50050`), *Webbed Up* (`01009`) |
| `BOOST_CARD_TURNED_FACEUP` | Boost card flip during combat | **Printed Boost Icons** on revealed card | Cancels boost effects or prevents boost icon addition to ATK/SCH. | *Wraith* (`22012`), *Scarlet Witch* (`15001a`), *Spider-Sense* |
| `CARD_WOULD_BE_DISCARDED` | Card attrition from hand/deck/tableau | **Count of Cards targeted for discard** (e.g., `1` card) | Prevents the card from leaving play / being discarded. | *Front Organization* (`50028`), *White Fox* (`21017`) |
| `CARD_WOULD_ENTER_PLAY` | Minion/Attachment/SideScheme entry | **Cost or Count of Entering Cards** | Diverts entry or cancels card play. | *Ant-Man* (`12011`), *Wasp* (`13012`) |

> [!NOTE]
> **Full Catalog Coverage:** An empirical audit of all 120 upstream Zzorba packs (4,379 cards) confirmed these 9 trigger windows encompass **100% of all 611 Interrupts and 142 "would be" interception cards** across the entire Marvel Champions card pool.

3. **Sequential Pipeline Resolution & Explicit Condition Contracts**:
   Downstream steps in `ability.steps` consume `context.interceptedValue` or gate on explicitly declared conditions:
   - **Why implicit `conditionMet` was incomplete:**
     Leaving `conditionMet` as an implicit side-effect in step 1 leaves reviewers and schemas in the dark—there is no declaration of *what* condition is being monitored, evaluated, or checked.
   - **Declarative Condition Specification (`StepConditionSchema`):**
     Step 1 explicitly declares what milestone condition it checks, storing the boolean evaluation directly into `StepResolutionResult.conditionMet`.
     Step 2 specifies `gate: "IF_CONDITION_MET"` (with an optional `targetStepId` linking to step 1).

### Explicit Condition Contracts Table

| Category | Condition (`StepConditionSchema`) | Evaluated Milestone (When evaluated to `true`) | Step Parameter Context | Example Card Declarations |
| :--- | :--- | :--- | :--- | :--- |
| **Core Milestone** | `SCHEME_EMPTY` | Targeted scheme has `remainingThreat === 0` after threat removal. | `REMOVE_THREAT` | *Clear the Area* (`04049`), *Turn the Tide* (`13015`) |
| **Core Milestone** | `TARGET_DEFEATED` | Targeted character/minion/villain HP reached `0` from damage. | `DEAL_DAMAGE` | *Relentless Assault* (`01053`), *Chase Them Down* (`01052`), *Tigra* (`01051`) |
| **Core Milestone** | `FULLY_HEALED` | Targeted character's damage reduced to `0` (`health === maxHealth`). | `HEAL_DAMAGE` | *First Aid* (`01086`), *Aunt May* (`01006`) |
| **Core Milestone** | `STATUS_APPLIED` | Status was successfully placed (target was not already afflicted & not immune). | `ADD_STATUS` | *Mockingbird* (`01083`), *Pheromones* (`04036`) |
| **Core Milestone** | `EXCESS_DAMAGE_DEALT` | Damage dealt exceeded target's remaining HP prior to strike (Overkill). | `DEAL_DAMAGE` | *Relentless Assault* (`01053`), *Hand Cannon* |
| **Entity State** | `ALREADY_HAS_STATUS` | Target character already possessed the specified status (e.g. Stunned/Tough). | `ADD_STATUS` | *War-Weary* (`45073`), *I'm Tough* (`01105`) |
| **Entity State** | `TARGET_ALREADY_EXHAUSTED` | Target entity was already in exhausted orientation. | `EXHAUST` | *Sonic Rifle*, *Tackle* |
| **Entity State** | `TARGET_TRAIT_MATCH` | Targeted card/character possesses specified trait filter (e.g. `[[AERIAL]]`). | Card Filter Criteria | *Aerial Intervention* (`42014`), *Cannonball* (`42020`) |
| **Entity State** | `TARGET_FORM_MATCH` | Identity is currently in specified form (`hero`, `alter_ego`, `giant`, `tiny`). | Player State | *Lay Down the Law* (`12031`), *Split Personality* (`01025`) |
| **Resource** | `RESOURCE_KICKER_MET` | Resources spent to pay for the card match required icon(s) or resource card. | `resourcesSpent` | *Relentless Assault* (`01053`), *For Justice!* (`01060`) |
| **Threshold** | `COUNTER_THRESHOLD_MET` | Target upgrade/support has reached or exceeded specified counter count. | `counters` | *Energy Channel* (`01018`), *Heightened Reflexes* (`50092`) |
| **Threshold** | `ZONE_EMPTY` | Evaluated zone (e.g. hand, discard, encounter deck) contains 0 cards. | Zone count | *Spiritual Meditation*, *Split Personality* |

```ts
// schema.ts extension: Complete Condition Taxonomy across all 120 packs
export const StepConditionSchema = z.enum([
  // Core Step Milestones
  'SCHEME_EMPTY',
  'TARGET_DEFEATED',
  'FULLY_HEALED',
  'STATUS_APPLIED',
  'EXCESS_DAMAGE_DEALT',
  
  // Entity & Board States
  'ALREADY_HAS_STATUS',
  'TARGET_ALREADY_EXHAUSTED',
  'TARGET_TRAIT_MATCH',
  'TARGET_FORM_MATCH',
  
  // Payment & Resource Invariants
  'RESOURCE_KICKER_MET',
  
  // Thresholds & Counters
  'COUNTER_THRESHOLD_MET',
  'ZONE_EMPTY',
]);
```

   - **Cross-Scheme Threat Clearing (*Clear the Area* `04049`):**
     Card text: *"Remove 2 threat from a scheme. If this removes the last threat on that scheme, draw 1 card."*
     ```json
     "steps": [
       {
         "id": "remove_threat_step",
         "effect": "REMOVE_THREAT",
         "params": {
           "target": "CHOSEN_SCHEME",
           "amount": 2,
           "condition": "SCHEME_EMPTY"
         }
       },
       {
         "id": "draw_if_last_threat",
         "effect": "DRAW_CARDS",
         "gate": "IF_CONDITION_MET",
         "params": {
           "targetStepId": "remove_threat_step",
           "count": 1
         }
       }
     ]
     ```
     **Contract Verification:**
     1. `remove_threat_step` executes `REMOVE_THREAT`. Because `"condition": "SCHEME_EMPTY"` is declared, the engine evaluates `remainingThreat === 0` and sets `conditionMet: true` (or `false`) on `remove_threat_step`'s result.
     2. `draw_if_last_threat` inspects `stepResultsMap.get("remove_threat_step")`. If `conditionMet === true`, it executes `DRAW_CARDS`; otherwise, it skips execution.
     3. This pattern is fully declarative, self-documenting, and strongly typed across all conditional card texts.

Under Option 2:
- *Great Responsibility* (`01061`) becomes:
  ```json
  "steps": [
    { "id": "consume_threat", "effect": "CONSUME_INTERCEPTED_EVENT" },
    { "id": "take_damage", "effect": "DEAL_DAMAGE", "params": { "target": "SELF_IDENTITY", "amount": { "from": "INTERCEPTED_VALUE" } } }
  ]
  ```
- *Not My Responsibility* (`44022` - Deadpool pack) reuses the exact same building blocks with zero engine changes:
  ```json
  "steps": [
    { "id": "consume_threat", "effect": "CONSUME_INTERCEPTED_EVENT" },
    { "id": "take_damage", "effect": "DEAL_DAMAGE", "params": { "target": "CHOSEN_FRIENDLY_CHARACTER", "amount": { "from": "INTERCEPTED_VALUE" } } }
  ]
  ```
- *Clear the Area* (`04049` - Justice event) cleanly couples `REMOVE_THREAT` and `DRAW_CARDS` via `condition: "SCHEME_EMPTY"` and `gate: "IF_CONDITION_MET"`.
- *Prevent N Damage / Threat* cards (*Cannonball*, *EM Shield*, *Counterintelligence*, *Jennifer Walters* `01019b`) share a single universal `PREVENT_INTERCEPTED_VALUE` primitive.

### Option 3: Scripted Expression Evaluator
Embed micro-expressions or mini-scripts directly in supplemental JSON (e.g. `amount: "context.threat"` or `"event.threat = 0; hero.damage += event.threat"`).

---

## Decision Outcome

**Chosen Option:** **Option 2: Unified Event Interception Pipeline, Dynamic Value Resolution & Explicit Condition Contracts**

### Rationale ("The Why")
1. **Complete Upstream Catalog Proof (120 Packs, 4,379 Cards):**
   Our empirical scan demonstrates that the entire upstream card catalog cleanly collapses into two cohesive taxonomies:
   - **The 9-Window Trigger Interception Registry:** Resolves 100% of the 611 Interrupts and 142 `"would be"` replacement effects across the game (threat placement, scheme emptying, attack damage, defeat, encounter reveals, boost flips, enemy activations, discards, and entering play).
   - **The 12-Contract `StepConditionSchema`:** Standardizes all 700+ conditional clauses across 4 categories (Core Step Milestones, Entity & Board States, Payment/Resource Invariants, and Thresholds/Counters).
2. **Eliminates Both Primitive Explosion and Gate Explosion:**
   - Instead of inventing 35+ single-use effect verbs (`TAKE_THREAT_AS_DAMAGE`, `TRANSFER_DAMAGE`, `REPULSOR_BLAST`), cards use standard primitives (`DEAL_DAMAGE`, `REMOVE_THREAT`, `HEAL_DAMAGE`) driven by `amount: { from: "INTERCEPTED_VALUE" }` or `{ from: "DISCARDED_COUNT" }`.
   - Instead of inventing bespoke condition gates for every card (`IF_PREVIOUS_SUCCESS_AND_SCHEME_EMPTY`, `IF_TARGET_DIED`), steps explicitly declare their target condition (`"condition": "SCHEME_EMPTY"`) and subsequent steps evaluate the universal `IF_CONDITION_MET`.
3. **Strict Compliance with Engine Invariants:**
   - Preserves headless engine decoupling: `trigger-dispatcher.ts` and `effects/index.ts` remain card-agnostic state machines.
   - Eliminates hardcoded card checks in trigger handlers (such as lines 295–317 in `trigger-dispatcher.ts` checking for `TAKE_THREAT_AS_DAMAGE` vs `REMOVE_THREAT`).
   - Strong compile-time Zod validation in `schema.ts` without runtime string evaluations ([ADR-0019](../decisions/0019-strict-metadata-driven-rules-execution-and-zero-raw-text-parsing.md), [ADR-0022](../decisions/0022-authoritative-zod-supplemental-schema-and-cicd-quality-gate.md)).

---

## Evaluation of Options

### Option 1: Ad-Hoc Dedicated Primitives (Status Quo)
- **Pros:**
  - Fast, localized implementation for a single card in isolation.
- **Cons:**
  - **Severe primitive explosion:** Over 150+ one-off primitives and custom condition branches would be needed across the 170 packs.
  - Bloats `src/engine/effects/index.ts` and `trigger-dispatcher.ts` with endless card-specific logic.
  - Violates the core MCD declarative data-first principle.

### Option 2: Unified Event Interception Pipeline, Dynamic Value Resolution & Explicit Condition Contracts
- **Pros:**
  - **Prunes Section 6 of the usage report:** Directly retires single-use primitives (`TAKE_THREAT_AS_DAMAGE`, `TRANSFER_DAMAGE`) and prevents future expansion bloat.
  - **Universal across all 4,379 Zzorba cards:** Fully handles damage prevention, threat diversion, defeat replacement, scheme clearing, resource kickers, and dynamic multipliers.
  - **Explicit, Self-Documenting Contracts:** Condition evaluation is visible and validated in schema, avoiding hidden or implicit side effects.
- **Cons:**
  - Requires adding `StepConditionSchema` and `DynamicValueSource` to `src/data/supplemental/schema.ts`.
  - Requires updating `effects/index.ts` (`executeStep`, `shouldExecuteStep`) to evaluate declared conditions and populate `StepResolutionResult.conditionMet`.

### Option 3: Scripted Expression Evaluator
- **Pros:**
  - High arbitrary flexibility in JSON.
- **Cons:**
  - Violates [ADR-0019](../decisions/0019-strict-metadata-driven-rules-execution-and-zero-raw-text-parsing.md) (Strict metadata execution, zero text parsing/evaluation).
  - Cannot be statically checked or validated by Zod at build time.

---

## Consequences

### Positive Consequences
- **Zero Engine Changes for Future Replacement & Conditional Cards:** Expansion cards from Black Widow, Deadpool, Age of Apocalypse, The Rise of Red Skull, or Agents of S.H.I.E.L.D. can be declared immediately in supplemental JSON using standard atomic primitives and declared condition contracts.
- **Unified Step Result Interface:** Standardizes `StepResolutionResult` with `{ success, mutatedState, value, conditionMet, targetId }` driven by explicit declarative step metadata.
- **Pruning Single-Use Primitives:** Reduces Section 6 in [`docs/reports/supplemental_declarations_usage_report.md`](../reports/supplemental_declarations_usage_report.md) from 35+ down towards true unique special exceptions (such as *Wakanda Forever!* or *Split Personality*).

### Negative Consequences / Risks & Mitigations
- **Context & Schema Extension:** `AbilityStepSchema` and `EffectExecutionContext` must be extended with `condition?: StepCondition` and `interceptedValue?: number`.
  - *Mitigation:* `EffectExecutionContext` already carries `threatAmount` and `damageAmount`. Consolidating them into a unified scalar `interceptedValue?: number` simplifies rather than complicates the runtime context contract.

