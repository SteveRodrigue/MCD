# 🔍 Schema Primitives Code Path Verification Matrix

[← Back to Main Usage Report](../usage_report.md)

> **Generated:** `2026-10-07T01:54:50.056Z` | **Overall Coverage:** **100.0%**

This matrix audits every schema primitive defined in `src/data/supplemental/schema.ts` across 3 dimensions:
1. **In Schema**: Is the enum option formally defined in schema.ts?
2. **In Supplemental Data**: Is it declared by active card packages?
3. **In Engine / Pipeline**: Does a live code path (handler / evaluator / resolver) exist in `src/engine/`?

### Health Status Legend:
- 🟢 **Active / Healthy**: Defined in Schema + Code Path Implemented + Used by Cards.
- 🔵 **Engine-Ready (Unused)**: Defined in Schema + Code Path Implemented + 0 Cards (ready for new cards).
- 🔴 **Missing Engine Handler**: Declared by Cards + **No Engine Code Path** (Runtime failure risk!).
- ⚠️ **Schema Ghost / Dead Schema**: Defined in Schema + **No Code Path** + 0 Cards (Unused schema debt).

### 1. Effect Primitives (`EffectTypeSchema` — 100.0% Engine Coverage)

| Primitive Value | In Engine Code Path? | Cards Declaring | Status | Health Rationale / Code Location |
| :--- | :---: | :---: | :---: | :--- |
| `DRAW` | ✅ Yes | **10** | 🟢 Active | Handled in `src/engine/effects/index.ts` / specialized pipelines; declared by 10 card(s). |
| `ADD_ACCELERATION` | ✅ Yes | **0** | 🔵 Engine-Ready | Handled in `src/engine/effects/index.ts` / specialized pipelines; 0 cards currently declare this. |
| `ADD_COUNTERS` | ✅ Yes | **1** | 🟢 Active | Handled in `src/engine/effects/index.ts` / specialized pipelines; declared by 1 card(s). |
| `ADD_STATUS` | ✅ Yes | **14** | 🟢 Active | Handled in `src/engine/effects/index.ts` / specialized pipelines; declared by 14 card(s). |
| `ADD_THREAT` | ✅ Yes | **10** | 🟢 Active | Handled in `src/engine/effects/index.ts` / specialized pipelines; declared by 10 card(s). |
| `ADD_TRAIT` | ✅ Yes | **2** | 🟢 Active | Handled in `src/engine/effects/index.ts` / specialized pipelines; declared by 2 card(s). |
| `ATTACHMENT_DAMAGE_SHIELD` | ✅ Yes | **1** | 🟢 Active | Handled in `src/engine/effects/index.ts` / specialized pipelines; declared by 1 card(s). |
| `ATTACH_FACEDOWN_CARDS_FROM_HAND` | ✅ Yes | **1** | 🟢 Active | Handled in `src/engine/effects/index.ts` / specialized pipelines; declared by 1 card(s). |
| `ATTACH_TO_HOST` | ✅ Yes | **3** | 🟢 Active | Handled in `src/engine/effects/index.ts` / specialized pipelines; declared by 3 card(s). |
| `CANCEL_ATTACK` | ✅ Yes | **1** | 🟢 Active | Handled in `src/engine/effects/index.ts` / specialized pipelines; declared by 1 card(s). |
| `CANCEL_WHEN_REVEALED` | ✅ Yes | **2** | 🟢 Active | Handled in `src/engine/effects/index.ts` / specialized pipelines; declared by 2 card(s). |
| `CANCEL_WHEN_REVEALED_AND_REVEAL_ANOTHER` | ✅ Yes | **1** | 🟢 Active | Handled in `src/engine/effects/index.ts` / specialized pipelines; declared by 1 card(s). |
| `CHANGE_FORM` | ✅ Yes | **5** | 🟢 Active | Handled in `src/engine/effects/index.ts` / specialized pipelines; declared by 5 card(s). |
| `DEAL_DAMAGE` | ✅ Yes | **25** | 🟢 Active | Handled in `src/engine/effects/index.ts` / specialized pipelines; declared by 25 card(s). |
| `DECLARE_DEFENDER` | ✅ Yes | **0** | 🔵 Engine-Ready | Handled in `src/engine/effects/index.ts` / specialized pipelines; 0 cards currently declare this. |
| `DISCARD` | ✅ Yes | **16** | 🟢 Active | Handled in `src/engine/effects/index.ts` / specialized pipelines; declared by 16 card(s). |
| `DISTRIBUTE_AMOUNT` | ✅ Yes | **0** | 🔵 Engine-Ready | Handled in `src/engine/effects/index.ts` / specialized pipelines; 0 cards currently declare this. |
| `DOUBLE_RESOURCE_FOR_ASPECT` | ✅ Yes | **4** | 🟢 Active | Handled in `src/engine/effects/index.ts` / specialized pipelines; declared by 4 card(s). |
| `EXECUTE_SPECIAL` | ✅ Yes | **0** | 🔵 Engine-Ready | Handled in `src/engine/effects/index.ts` / specialized pipelines; 0 cards currently declare this. |
| `EXECUTE_WAKANDA_FOREVER` | ✅ Yes | **4** | 🟢 Active | Handled in `src/engine/effects/index.ts` / specialized pipelines; declared by 4 card(s). |
| `EXHAUST` | ✅ Yes | **1** | 🟢 Active | Handled in `src/engine/effects/index.ts` / specialized pipelines; declared by 1 card(s). |
| `FLIP_FORM` | ✅ Yes | **1** | 🟢 Active | Handled in `src/engine/effects/index.ts` / specialized pipelines; declared by 1 card(s). |
| `GENERATE_RESOURCE` | ✅ Yes | **3** | 🟢 Active | Handled in `src/engine/effects/index.ts` / specialized pipelines; declared by 3 card(s). |
| `GIVE_ADDITIONAL_BOOST_CARD` | ✅ Yes | **1** | 🟢 Active | Handled in `src/engine/effects/index.ts` / specialized pipelines; declared by 1 card(s). |
| `GRANT_KEYWORD` | ✅ Yes | **4** | 🟢 Active | Handled in `src/engine/effects/index.ts` / specialized pipelines; declared by 4 card(s). |
| `HEAL_DAMAGE` | ✅ Yes | **6** | 🟢 Active | Handled in `src/engine/effects/index.ts` / specialized pipelines; declared by 6 card(s). |
| `MODIFY_ALLY_LIMIT` | ✅ Yes | **1** | 🟢 Active | Handled in `src/engine/effects/index.ts` / specialized pipelines; declared by 1 card(s). |
| `MODIFY_HAND_SIZE` | ✅ Yes | **1** | 🟢 Active | Handled in `src/engine/effects/index.ts` / specialized pipelines; declared by 1 card(s). |
| `MODIFY_MAX_HEALTH` | ✅ Yes | **2** | 🟢 Active | Handled in `src/engine/effects/index.ts` / specialized pipelines; declared by 2 card(s). |
| `MODIFY_RESTRICTED_LIMIT` | ✅ Yes | **0** | 🔵 Engine-Ready | Handled in `src/engine/effects/index.ts` / specialized pipelines; 0 cards currently declare this. |
| `MODIFY_STAT` | ✅ Yes | **13** | 🟢 Active | Handled in `src/engine/effects/index.ts` / specialized pipelines; declared by 13 card(s). |
| `PLACE_CARD_UNDER_HOST` | ✅ Yes | **0** | 🔵 Engine-Ready | Handled in `src/engine/effects/index.ts` / specialized pipelines; 0 cards currently declare this. |
| `PLAYER_CHOICE` | ✅ Yes | **10** | 🟢 Active | Handled in `src/engine/effects/index.ts` / specialized pipelines; declared by 10 card(s). |
| `PLAY_FROM_ZONE` | ✅ Yes | **1** | 🟢 Active | Handled in `src/engine/effects/index.ts` / specialized pipelines; declared by 1 card(s). |
| `PREVENT_DAMAGE` | ✅ Yes | **2** | 🟢 Active | Handled in `src/engine/effects/index.ts` / specialized pipelines; declared by 2 card(s). |
| `PREVENT_THREAT` | ✅ Yes | **3** | 🟢 Active | Handled in `src/engine/effects/index.ts` / specialized pipelines; declared by 3 card(s). |
| `PUT_INTO_PLAY` | ✅ Yes | **3** | 🟢 Active | Handled in `src/engine/effects/index.ts` / specialized pipelines; declared by 3 card(s). |
| `READY` | ✅ Yes | **5** | 🟢 Active | Handled in `src/engine/effects/index.ts` / specialized pipelines; declared by 5 card(s). |
| `REDUCE_NEXT_CARD_COST` | ✅ Yes | **1** | 🟢 Active | Handled in `src/engine/effects/index.ts` / specialized pipelines; declared by 1 card(s). |
| `REMOVE_COUNTERS` | ✅ Yes | **0** | 🔵 Engine-Ready | Handled in `src/engine/effects/index.ts` / specialized pipelines; 0 cards currently declare this. |
| `REMOVE_COUNTERS_MATCHING_FILTER` | ✅ Yes | **0** | 🔵 Engine-Ready | Handled in `src/engine/effects/index.ts` / specialized pipelines; 0 cards currently declare this. |
| `REMOVE_FROM_GAME` | ✅ Yes | **0** | 🔵 Engine-Ready | Handled in `src/engine/effects/index.ts` / specialized pipelines; 0 cards currently declare this. |
| `REMOVE_THREAT` | ✅ Yes | **12** | 🟢 Active | Handled in `src/engine/effects/index.ts` / specialized pipelines; declared by 12 card(s). |
| `RETURN_TO_HAND` | ✅ Yes | **2** | 🟢 Active | Handled in `src/engine/effects/index.ts` / specialized pipelines; declared by 2 card(s). |
| `REVEAL_ENCOUNTER_CARD` | ✅ Yes | **1** | 🟢 Active | Handled in `src/engine/effects/index.ts` / specialized pipelines; declared by 1 card(s). |
| `SEARCH` | ✅ Yes | **6** | 🟢 Active | Handled in `src/engine/effects/index.ts` / specialized pipelines; declared by 6 card(s). |
| `SHUFFLE_INTO_DECK` | ✅ Yes | **1** | 🟢 Active | Handled in `src/engine/effects/index.ts` / specialized pipelines; declared by 1 card(s). |
| `SPEND_COUNTERS` | ✅ Yes | **0** | 🔵 Engine-Ready | Handled in `src/engine/effects/index.ts` / specialized pipelines; 0 cards currently declare this. |
| `SURGE` | ✅ Yes | **11** | 🟢 Active | Handled in `src/engine/effects/index.ts` / specialized pipelines; declared by 11 card(s). |
| `TRANSFER_DAMAGE` | ✅ Yes | **1** | 🟢 Active | Handled in `src/engine/effects/index.ts` / specialized pipelines; declared by 1 card(s). |
| `ENEMY_ATTACKS` | ✅ Yes | **1** | 🟢 Active | Handled in `src/engine/effects/index.ts` / specialized pipelines; declared by 1 card(s). |
| `VILLAIN_AND_ENGAGED_MINIONS_ATTACK` | ✅ Yes | **1** | 🟢 Active | Handled in `src/engine/effects/index.ts` / specialized pipelines; declared by 1 card(s). |
| `VILLAIN_ATTACKS` | ✅ Yes | **3** | 🟢 Active | Handled in `src/engine/effects/index.ts` / specialized pipelines; declared by 3 card(s). |
| `VILLAIN_SCHEMES` | ✅ Yes | **1** | 🟢 Active | Handled in `src/engine/effects/index.ts` / specialized pipelines; declared by 1 card(s). |
| `REMOVE_STATUS` | ✅ Yes | **0** | 🔵 Engine-Ready | Handled in `src/engine/effects/index.ts` / specialized pipelines; 0 cards currently declare this. |

### 2. Target Selectors (`TargetSelectorSchema` — 100.0% Engine Coverage)

| Primitive Value | In Engine Code Path? | Cards Declaring | Status | Health Rationale / Code Location |
| :--- | :---: | :---: | :---: | :--- |
| `SELF` | ✅ Yes | **10** | 🟢 Active | Handled in `src/engine/effects/target-resolver.ts`; declared by 10 card(s). |
| `SELF_IDENTITY` | ✅ Yes | **13** | 🟢 Active | Handled in `src/engine/effects/target-resolver.ts`; declared by 13 card(s). |
| `SELF_HERO` | ✅ Yes | **2** | 🟢 Active | Handled in `src/engine/effects/target-resolver.ts`; declared by 2 card(s). |
| `ACTIVE_PLAYER` | ✅ Yes | **1** | 🟢 Active | Handled in `src/engine/effects/target-resolver.ts`; declared by 1 card(s). |
| `ALL_PLAYERS` | ✅ Yes | **2** | 🟢 Active | Handled in `src/engine/effects/target-resolver.ts`; declared by 2 card(s). |
| `DEFENDING_PLAYER` | ✅ Yes | **1** | 🟢 Active | Handled in `src/engine/effects/target-resolver.ts`; declared by 1 card(s). |
| `ALL_HEROES` | ✅ Yes | **2** | 🟢 Active | Handled in `src/engine/effects/target-resolver.ts`; declared by 2 card(s). |
| `ALL_HEROES_AND_ALLIES` | ✅ Yes | **1** | 🟢 Active | Handled in `src/engine/effects/target-resolver.ts`; declared by 1 card(s). |
| `TRIGGERING_HERO` | ✅ Yes | **0** | 🔵 Engine-Ready | Handled in `src/engine/effects/target-resolver.ts`; 0 cards currently declare this. |
| `DAMAGED_CHARACTER` | ✅ Yes | **1** | 🟢 Active | Handled in `src/engine/effects/target-resolver.ts`; declared by 1 card(s). |
| `CHOSEN_PLAYER` | ✅ Yes | **4** | 🟢 Active | Handled in `src/engine/effects/target-resolver.ts`; declared by 4 card(s). |
| `VILLAIN` | ✅ Yes | **4** | 🟢 Active | Handled in `src/engine/effects/target-resolver.ts`; declared by 4 card(s). |
| `MAIN_SCHEME` | ✅ Yes | **4** | 🟢 Active | Handled in `src/engine/effects/target-resolver.ts`; declared by 4 card(s). |
| `CHOSEN_SCHEME` | ✅ Yes | **11** | 🟢 Active | Handled in `src/engine/effects/target-resolver.ts`; declared by 11 card(s). |
| `CHOSEN_ENEMY` | ✅ Yes | **16** | 🟢 Active | Handled in `src/engine/effects/target-resolver.ts`; declared by 16 card(s). |
| `ALL_ENEMIES` | ✅ Yes | **2** | 🟢 Active | Handled in `src/engine/effects/target-resolver.ts`; declared by 2 card(s). |
| `ENGAGED_ENEMIES` | ✅ Yes | **2** | 🟢 Active | Handled in `src/engine/effects/target-resolver.ts`; declared by 2 card(s). |
| `ENGAGED_MINIONS` | ✅ Yes | **0** | 🔵 Engine-Ready | Handled in `src/engine/effects/target-resolver.ts`; 0 cards currently declare this. |
| `CHOSEN_MINION` | ✅ Yes | **2** | 🟢 Active | Handled in `src/engine/effects/target-resolver.ts`; declared by 2 card(s). |
| `CHOSEN_ENGAGED_MINION` | ✅ Yes | **0** | 🔵 Engine-Ready | Handled in `src/engine/effects/target-resolver.ts`; 0 cards currently declare this. |
| `ALL_MINIONS` | ✅ Yes | **0** | 🔵 Engine-Ready | Handled in `src/engine/effects/target-resolver.ts`; 0 cards currently declare this. |
| `CHOSEN_ALLY` | ✅ Yes | **2** | 🟢 Active | Handled in `src/engine/effects/target-resolver.ts`; declared by 2 card(s). |
| `CHOSEN_CONTROLLED_ALLY` | ✅ Yes | **0** | 🔵 Engine-Ready | Handled in `src/engine/effects/target-resolver.ts`; 0 cards currently declare this. |
| `ALL_CONTROLLED_ALLIES` | ✅ Yes | **0** | 🔵 Engine-Ready | Handled in `src/engine/effects/target-resolver.ts`; 0 cards currently declare this. |
| `ALL_CONTROLLED_TABLEAU` | ✅ Yes | **0** | 🔵 Engine-Ready | Handled in `src/engine/effects/target-resolver.ts`; 0 cards currently declare this. |
| `ALL_ALLIES` | ✅ Yes | **0** | 🔵 Engine-Ready | Handled in `src/engine/effects/target-resolver.ts`; 0 cards currently declare this. |
| `CHOSEN_CHARACTER` | ✅ Yes | **1** | 🟢 Active | Handled in `src/engine/effects/target-resolver.ts`; declared by 1 card(s). |
| `CHOSEN_CONTROLLED_CHARACTER` | ✅ Yes | **0** | 🔵 Engine-Ready | Handled in `src/engine/effects/target-resolver.ts`; 0 cards currently declare this. |
| `ALL_CONTROLLED_CHARACTERS` | ✅ Yes | **1** | 🟢 Active | Handled in `src/engine/effects/target-resolver.ts`; declared by 1 card(s). |
| `CHOSEN_FRIENDLY_CHARACTER` | ✅ Yes | **1** | 🟢 Active | Handled in `src/engine/effects/target-resolver.ts`; declared by 1 card(s). |
| `ALL_FRIENDLY_CHARACTERS` | ✅ Yes | **0** | 🔵 Engine-Ready | Handled in `src/engine/effects/target-resolver.ts`; 0 cards currently declare this. |
| `ALL_CHARACTERS` | ✅ Yes | **1** | 🟢 Active | Handled in `src/engine/effects/target-resolver.ts`; declared by 1 card(s). |
| `CHOSEN_SIDE_SCHEME` | ✅ Yes | **0** | 🔵 Engine-Ready | Handled in `src/engine/effects/target-resolver.ts`; 0 cards currently declare this. |
| `THIS_SIDE_SCHEME` | ✅ Yes | **2** | 🟢 Active | Handled in `src/engine/effects/target-resolver.ts`; declared by 2 card(s). |
| `ALL_SIDE_SCHEMES` | ✅ Yes | **1** | 🟢 Active | Handled in `src/engine/effects/target-resolver.ts`; declared by 1 card(s). |
| `ALL_SCHEMES` | ✅ Yes | **1** | 🟢 Active | Handled in `src/engine/effects/target-resolver.ts`; declared by 1 card(s). |
| `TRIGGERING_SCHEME` | ✅ Yes | **0** | 🔵 Engine-Ready | Handled in `src/engine/effects/target-resolver.ts`; 0 cards currently declare this. |
| `PREVIOUS_TARGET` | ✅ Yes | **1** | 🟢 Active | Handled in `src/engine/effects/target-resolver.ts`; declared by 1 card(s). |
| `PREVIOUS_SELECTED_CARD` | ✅ Yes | **0** | 🔵 Engine-Ready | Handled in `src/engine/effects/target-resolver.ts`; 0 cards currently declare this. |
| `TRIGGERING_MINION` | ✅ Yes | **1** | 🟢 Active | Handled in `src/engine/effects/target-resolver.ts`; declared by 1 card(s). |
| `TRIGGERING_ENEMY` | ✅ Yes | **2** | 🟢 Active | Handled in `src/engine/effects/target-resolver.ts`; declared by 2 card(s). |
| `HOST` | ✅ Yes | **0** | 🔵 Engine-Ready | Handled in `src/engine/effects/target-resolver.ts`; 0 cards currently declare this. |
| `HOST_ENEMY` | ✅ Yes | **1** | 🟢 Active | Handled in `src/engine/effects/target-resolver.ts`; declared by 1 card(s). |

### 3. Condition Gates (`ConditionGateSchema` — 100.0% Engine Coverage)

| Primitive Value | In Engine Code Path? | Cards Declaring | Status | Health Rationale / Code Location |
| :--- | :---: | :---: | :---: | :--- |
| `ALWAYS` | ✅ Yes | **0** | 🔵 Engine-Ready | Handled in `src/engine/pipeline/step-gate-evaluator.ts`; 0 cards currently declare this. |
| `THEN` | ✅ Yes | **1** | 🟢 Active | Handled in `src/engine/pipeline/step-gate-evaluator.ts`; declared by 1 card(s). |
| `IF_PREVIOUS_SUCCESS` | ✅ Yes | **0** | 🔵 Engine-Ready | Handled in `src/engine/pipeline/step-gate-evaluator.ts`; 0 cards currently declare this. |
| `IF_AMOUNT_ZERO` | ✅ Yes | **2** | 🟢 Active | Handled in `src/engine/pipeline/step-gate-evaluator.ts`; declared by 2 card(s). |
| `IF_ZERO_HEALED` | ✅ Yes | **0** | 🔵 Engine-Ready | Handled in `src/engine/pipeline/step-gate-evaluator.ts`; 0 cards currently declare this. |
| `IF_FAILED` | ✅ Yes | **3** | 🟢 Active | Handled in `src/engine/pipeline/step-gate-evaluator.ts`; declared by 3 card(s). |
| `IF_ALREADY_HAS_STATUS` | ✅ Yes | **2** | 🟢 Active | Handled in `src/engine/pipeline/step-gate-evaluator.ts`; declared by 2 card(s). |
| `IF_RESOURCE_MATCH` | ✅ Yes | **4** | 🟢 Active | Handled in `src/engine/pipeline/step-gate-evaluator.ts`; declared by 4 card(s). |
| `IF_CONDITION_MET` | ✅ Yes | **6** | 🟢 Active | Handled in `src/engine/pipeline/step-gate-evaluator.ts`; declared by 6 card(s). |
| `IF_CONDITION_NOT_MET` | ✅ Yes | **1** | 🟢 Active | Handled in `src/engine/pipeline/step-gate-evaluator.ts`; declared by 1 card(s). |
| `IF_CARD_IN_PLAY` | ✅ Yes | **2** | 🟢 Active | Handled in `src/engine/pipeline/step-gate-evaluator.ts`; declared by 2 card(s). |
| `IF_CARD_NOT_IN_PLAY` | ✅ Yes | **1** | 🟢 Active | Handled in `src/engine/pipeline/step-gate-evaluator.ts`; declared by 1 card(s). |
| `IF_FORM` | ✅ Yes | **7** | 🟢 Active | Handled in `src/engine/pipeline/step-gate-evaluator.ts`; declared by 7 card(s). |
| `IF_ACTIVATION_DEALT_DAMAGE` | ✅ Yes | **1** | 🟢 Active | Handled in `src/engine/pipeline/step-gate-evaluator.ts`; declared by 1 card(s). |

### 4. Step Conditions (`StepConditionSchema` — 100.0% Engine Coverage)

| Primitive Value | In Engine Code Path? | Cards Declaring | Status | Health Rationale / Code Location |
| :--- | :---: | :---: | :---: | :--- |
| `SCHEME_EMPTY` | ✅ Yes | **0** | 🔵 Engine-Ready | Handled in `src/engine/effects/index.ts` / `step-gate-evaluator.ts`; 0 cards currently declare this. |
| `TARGET_DEFEATED` | ✅ Yes | **0** | 🔵 Engine-Ready | Handled in `src/engine/effects/index.ts` / `step-gate-evaluator.ts`; 0 cards currently declare this. |
| `FULLY_HEALED` | ✅ Yes | **0** | 🔵 Engine-Ready | Handled in `src/engine/effects/index.ts` / `step-gate-evaluator.ts`; 0 cards currently declare this. |
| `STATUS_APPLIED` | ✅ Yes | **0** | 🔵 Engine-Ready | Handled in `src/engine/effects/index.ts` / `step-gate-evaluator.ts`; 0 cards currently declare this. |
| `EXCESS_DAMAGE_DEALT` | ✅ Yes | **0** | 🔵 Engine-Ready | Handled in `src/engine/effects/index.ts` / `step-gate-evaluator.ts`; 0 cards currently declare this. |
| `ALREADY_HAS_STATUS` | ✅ Yes | **0** | 🔵 Engine-Ready | Handled in `src/engine/effects/index.ts` / `step-gate-evaluator.ts`; 0 cards currently declare this. |
| `TARGET_TRAIT_MATCH` | ✅ Yes | **4** | 🟢 Active | Handled in `src/engine/effects/index.ts` / `step-gate-evaluator.ts`; declared by 4 card(s). |
| `UNDEFENDED_ATTACK` | ✅ Yes | **2** | 🟢 Active | Handled in `src/engine/effects/index.ts` / `step-gate-evaluator.ts`; declared by 2 card(s). |
| `ZONE_EMPTY` | ✅ Yes | **1** | 🟢 Active | Handled in `src/engine/effects/index.ts` / `step-gate-evaluator.ts`; declared by 1 card(s). |

### 5. Trigger Windows (`TriggerTypeSchema` — 100.0% Engine Coverage)

| Primitive Value | In Engine Code Path? | Cards Declaring | Status | Health Rationale / Code Location |
| :--- | :---: | :---: | :---: | :--- |
| `WHEN_REVEALED` | ✅ Yes | **35** | 🟢 Active | Handled in `src/engine/triggers/` & scenario pipelines; declared by 35 card(s). |
| `ENEMY_INITIATES_ATTACK` | ✅ Yes | **1** | 🟢 Active | Handled in `src/engine/triggers/` & scenario pipelines; declared by 1 card(s). |
| `DAMAGE_WOULD_BE_TAKEN` | ✅ Yes | **3** | 🟢 Active | Handled in `src/engine/triggers/` & scenario pipelines; declared by 3 card(s). |
| `CARD_PLAYED` | ✅ Yes | **1** | 🟢 Active | Handled in `src/engine/triggers/` & scenario pipelines; declared by 1 card(s). |
| `ENTERS_PLAY` | ✅ Yes | **10** | 🟢 Active | Handled in `src/engine/triggers/` & scenario pipelines; declared by 10 card(s). |
| `MINION_ENTERS_PLAY` | ✅ Yes | **1** | 🟢 Active | Handled in `src/engine/triggers/` & scenario pipelines; declared by 1 card(s). |
| `TREACHERY_REVEALED` | ✅ Yes | **3** | 🟢 Active | Handled in `src/engine/triggers/` & scenario pipelines; declared by 3 card(s). |
| `CHARACTER_DEFEATED` | ✅ Yes | **3** | 🟢 Active | Handled in `src/engine/triggers/` & scenario pipelines; declared by 3 card(s). |
| `SCHEME_DEFEATED` | ✅ Yes | **0** | 🔵 Engine-Ready | Handled in `src/engine/triggers/` & scenario pipelines; 0 cards currently declare this. |
| `HOST_WOULD_ATTACK` | ✅ Yes | **1** | 🟢 Active | Handled in `src/engine/triggers/` & scenario pipelines; declared by 1 card(s). |
| `THREAT_WOULD_BE_PLACED` | ✅ Yes | **3** | 🟢 Active | Handled in `src/engine/triggers/` & scenario pipelines; declared by 3 card(s). |
| `BASIC_ATTACK_PERFORMED` | ✅ Yes | **1** | 🟢 Active | Handled in `src/engine/triggers/` & scenario pipelines; declared by 1 card(s). |
| `ATTACK_DEFENDED` | ✅ Yes | **2** | 🟢 Active | Handled in `src/engine/triggers/` & scenario pipelines; declared by 2 card(s). |
| `ATTACK_RESOLVED` | ✅ Yes | **2** | 🟢 Active | Handled in `src/engine/triggers/` & scenario pipelines; declared by 2 card(s). |
| `THWART_RESOLVED` | ✅ Yes | **1** | 🟢 Active | Handled in `src/engine/triggers/` & scenario pipelines; declared by 1 card(s). |
| `MINION_ATTACKED` | ✅ Yes | **2** | 🟢 Active | Handled in `src/engine/triggers/` & scenario pipelines; declared by 2 card(s). |
| `ATTACK` | ✅ Yes | **0** | 🔵 Engine-Ready | Handled in `src/engine/triggers/` & scenario pipelines; 0 cards currently declare this. |
| `ROUND_BEGAN` | ✅ Yes | **0** | 🔵 Engine-Ready | Handled in `src/engine/triggers/` & scenario pipelines; 0 cards currently declare this. |
| `ROUND_ENDED` | ✅ Yes | **1** | 🟢 Active | Handled in `src/engine/triggers/` & scenario pipelines; declared by 1 card(s). |
| `PLAYER_PHASE_BEGAN` | ✅ Yes | **0** | 🔵 Engine-Ready | Handled in `src/engine/triggers/` & scenario pipelines; 0 cards currently declare this. |
| `PLAYER_PHASE_ENDED` | ✅ Yes | **0** | 🔵 Engine-Ready | Handled in `src/engine/triggers/` & scenario pipelines; 0 cards currently declare this. |
| `VILLAIN_PHASE_BEGAN` | ✅ Yes | **0** | 🔵 Engine-Ready | Handled in `src/engine/triggers/` & scenario pipelines; 0 cards currently declare this. |
| `VILLAIN_PHASE_ENDED` | ✅ Yes | **0** | 🔵 Engine-Ready | Handled in `src/engine/triggers/` & scenario pipelines; 0 cards currently declare this. |
| `DEFEATED` | ✅ Yes | **2** | 🟢 Active | Handled in `src/engine/triggers/` & scenario pipelines; declared by 2 card(s). |
| `DAMAGE_TAKEN` | ✅ Yes | **0** | 🔵 Engine-Ready | Handled in `src/engine/triggers/` & scenario pipelines; 0 cards currently declare this. |
| `THREAT_PLACED` | ✅ Yes | **0** | 🔵 Engine-Ready | Handled in `src/engine/triggers/` & scenario pipelines; 0 cards currently declare this. |
| `FORM_CHANGED` | ✅ Yes | **1** | 🟢 Active | Handled in `src/engine/triggers/` & scenario pipelines; declared by 1 card(s). |
| `STATUS_REMOVED` | ✅ Yes | **0** | 🔵 Engine-Ready | Handled in `src/engine/triggers/` & scenario pipelines; 0 cards currently declare this. |
| `BOOST` | ✅ Yes | **6** | 🟢 Active | Handled in `src/engine/triggers/` & scenario pipelines; declared by 6 card(s). |

### 6. Ability Timings (`TimingTypeSchema` — 100.0% Engine Coverage)

| Primitive Value | In Engine Code Path? | Cards Declaring | Status | Health Rationale / Code Location |
| :--- | :---: | :---: | :---: | :--- |
| `FORCED_INTERRUPT` | ✅ Yes | **3** | 🟢 Active | Handled in `src/engine/` timing evaluation paths; declared by 3 card(s). |
| `INTERRUPT` | ✅ Yes | **4** | 🟢 Active | Handled in `src/engine/` timing evaluation paths; declared by 4 card(s). |
| `HERO_INTERRUPT` | ✅ Yes | **5** | 🟢 Active | Handled in `src/engine/` timing evaluation paths; declared by 5 card(s). |
| `ALTER_EGO_INTERRUPT` | ✅ Yes | **1** | 🟢 Active | Handled in `src/engine/` timing evaluation paths; declared by 1 card(s). |
| `HERO_ACTION` | ✅ Yes | **26** | 🟢 Active | Handled in `src/engine/` timing evaluation paths; declared by 26 card(s). |
| `ALTER_EGO_ACTION` | ✅ Yes | **8** | 🟢 Active | Handled in `src/engine/` timing evaluation paths; declared by 8 card(s). |
| `ACTION` | ✅ Yes | **16** | 🟢 Active | Handled in `src/engine/` timing evaluation paths; declared by 16 card(s). |
| `RESOURCE` | ✅ Yes | **6** | 🟢 Active | Handled in `src/engine/` timing evaluation paths; declared by 6 card(s). |
| `HERO_RESOURCE` | ✅ Yes | **1** | 🟢 Active | Handled in `src/engine/` timing evaluation paths; declared by 1 card(s). |
| `ALTER_EGO_RESOURCE` | ✅ Yes | **0** | 🔵 Engine-Ready | Handled in `src/engine/` timing evaluation paths; 0 cards currently declare this. |
| `FORCED_RESPONSE` | ✅ Yes | **18** | 🟢 Active | Handled in `src/engine/` timing evaluation paths; declared by 18 card(s). |
| `RESPONSE` | ✅ Yes | **11** | 🟢 Active | Handled in `src/engine/` timing evaluation paths; declared by 11 card(s). |
| `HERO_RESPONSE` | ✅ Yes | **1** | 🟢 Active | Handled in `src/engine/` timing evaluation paths; declared by 1 card(s). |
| `ALTER_EGO_RESPONSE` | ✅ Yes | **0** | 🔵 Engine-Ready | Handled in `src/engine/` timing evaluation paths; 0 cards currently declare this. |
| `CONSTANT` | ✅ Yes | **20** | 🟢 Active | Handled in `src/engine/` timing evaluation paths; declared by 20 card(s). |
| `SPECIAL` | ✅ Yes | **4** | 🟢 Active | Handled in `src/engine/` timing evaluation paths; declared by 4 card(s). |
| `SETUP` | ✅ Yes | **1** | 🟢 Active | Handled in `src/engine/` timing evaluation paths; declared by 1 card(s). |
| `WHEN_REVEALED` | ✅ Yes | **31** | 🟢 Active | Handled in `src/engine/` timing evaluation paths; declared by 31 card(s). |
| `BOOST` | ✅ Yes | **6** | 🟢 Active | Handled in `src/engine/` timing evaluation paths; declared by 6 card(s). |

[← Back to Main Usage Report](../usage_report.md)