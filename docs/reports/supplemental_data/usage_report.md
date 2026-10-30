# Supplemental Card Declarations Usage & Impact Report

> **Source Packs Scanned:** `aoa_encounter, core, core_encounter, cw_encounter, mts`

---

## 📊 1. Executive Summary & Code Path Health

| Metric | Count | Health / Coverage | Description |
| :--- | :---: | :---: | :--- |
| **Total Cards Registered** | **176** | 100% | Total cards present in `src/data/supplemental/` |
| **Active Declared Cards** | **157** | - | Cards with executable `abilities: [...]` |
| **No Supplemental Needed** | [15](detailed_reports/vanilla_and_passive_cards.md) | Verified | Vanilla / passive cards explicitly requiring no supplemental hooks |
| **Open Ambiguity Reports** | **5** | Blocked | Cards isolated in `docs/ambiguities/` (Inbox Zero Queue) |
| **False-Vanilla Violations** | **0** | 🟢 0 | Cards marked `noSupplementalNeeded` that have printed rules text |
| **Overall Schema Engine Coverage** | **100.0%** | [Matrix](detailed_reports/schema_code_path_audit.md) | Percentage of all schema primitives with active engine code paths |
| **Effect Types Code Path Coverage** | **100.0%** | **58/58** | [50 In Use](detailed_reports/effects_usage.md) |
| **Target Selectors Code Path Coverage** | **100.0%** | **46/46** | [34 In Use](detailed_reports/target_selectors_usage.md) |
| **Condition Gates Code Path Coverage** | **100.0%** | **9/9** | [9 In Use](detailed_reports/condition_gates_usage.md) |
| **Step Conditions Code Path Coverage** | **100.0%** | **0/0** | [0 In Use](detailed_reports/condition_gates_usage.md) |
| **Trigger Types Code Path Coverage** | **100.0%** | **32/32** | [21 In Use](detailed_reports/timing_and_triggers_usage.md) |
| **Timing Types Code Path Coverage** | **100.0%** | **19/19** | [15 In Use](detailed_reports/timing_and_triggers_usage.md) |
| **Total Abilities Declared** | **184** | - | Total individual ability definitions declared |
| **Multi-Step Pipelines (2+ Steps)** | [33](detailed_reports/multi_ability_and_multistep_cards.md) | - | Abilities decomposed into sequenced execution pipelines |
| **Cards with Multiple Abilities (2+)** | [24](detailed_reports/multi_ability_and_multistep_cards.md) | - | Cards declaring more than 1 distinct ability header |

---

## 🔴 2. Active Ambiguity & Blocker Queue (5 Cards)

These cards are currently isolated in [`docs/ambiguities/`](../../ambiguities/README.md) pending rules engine primitives or targeting extensions:

| Card Code | Card Name | Pack | Confidence | Blocker Category | Ambiguity Report File |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `01133` | **Masters of Mayhem** | `core_encounter` | `75%` | `TIER_3_STRUCTURAL_REFACTOR` | [`core_encounter_01133_masters-of-mayhem.md`](../../ambiguities/core_encounter_01133_masters-of-mayhem.md) |
| `01152` | **Vibranium Armor** | `core_encounter` | `75%` | `TIER_3_STRUCTURAL_REFACTOR` | [`core_encounter_01152_vibranium-armor.md`](../../ambiguities/core_encounter_01152_vibranium-armor.md) |
| `01185` | **Biomechanical Upgrades** | `core_encounter` | `75%` | `TIER_3_STRUCTURAL_REFACTOR` | [`core_encounter_01185_biomechanical-upgrades.md`](../../ambiguities/core_encounter_01185_biomechanical-upgrades.md) |
| `21054` | **Eternity** | `mts` | `50%` | `MISSING_ENGINE_PRIMITIVE` | [`mts_21054_eternity.md`](../../ambiguities/mts_21054_eternity.md) |
| `56128b` | **Now It** | `cw_encounter` | `50%` | `MISSING_ENGINE_PRIMITIVE` | [`cw_56128b_now-its-personal.md`](../../ambiguities/cw_56128b_now-its-personal.md) |

---

## 🃏 3. Card-Level Declarations Summary

| Category | Active Count | Detailed Breakdown |
| :--- | :---: | :--- |
| **Vanilla / Passive Cards** | **15** | [View Full List](detailed_reports/vanilla_and_passive_cards.md) |
| **Play Requirements** | **2** | `identityForm` (1), `controlFilter` (4) |
| **Card Uses & Counters** | **6** | `uses (web)` (1), `uses (energy)` (1), `uses (attack)` (1), `uses (snoop)` (1), `uses (arrow)` (1), `uses (medical)` (1) |
| **Player Recipient Overrides** | **1** | `FIRST_PLAYER` (1) |
| **Stat & Rule Overrides** | **1** | `playUnderAnyPlayerControl` (3) |

---

## ⚡ 4. Ability Headers, Timings & Triggers Summary

| Component | In Use | Schema Total | Coverage | Detailed Report |
| :--- | :---: | :---: | :---: | :--- |
| **Ability Timings** | **15** | 19 | 100.0% | [View Declaring Cards](detailed_reports/timing_and_triggers_usage.md) |
| **Trigger Windows** | **21** | 32 | 100.0% | [View Declaring Cards](detailed_reports/timing_and_triggers_usage.md#2-trigger-windows-triggertypeschema) |
| **Trigger Filters** | **12** | - | - | `attackerKind` (2), `targetPlayerScope` (3), `damageSource` (1), `cardFilter` (2), `targetScope` (2), `attackedBy` (1), `sourceCardCode` (1), `targetType` (3), `defeatedByAttackOf` (3), `defenderType` (2), `threatSource` (1), `isSecondaryAttack` (1) |
| **Cost Primitives** | **9** | - | - | `exhaustSelf` (20), `spendCounters` (5), `resourceCost` (9), `heal` (1), `discardCard` (2), `discardSelf` (5), `damageHero` (1), `damageSelf` (1), `exhaustCard` (1) |
| **Multi-Ability Cards (2+)** | **24** | - | - | [View 24 Cards](detailed_reports/multi_ability_and_multistep_cards.md) |

---

## 🎯 5. Target Selectors Summary

| Top Target Selectors | Occurrences | Cards Count | Link to Details |
| :--- | :---: | :---: | :--- |
| `CHOSEN_ENEMY` | **16** | 16 | [Inspect Cards](detailed_reports/target_selectors_usage.md#chosen-enemy) |
| `SELF` | **12** | 12 | [Inspect Cards](detailed_reports/target_selectors_usage.md#self) |
| `CHOSEN_SCHEME` | **11** | 10 | [Inspect Cards](detailed_reports/target_selectors_usage.md#chosen-scheme) |
| `SELF_IDENTITY` | **10** | 10 | [Inspect Cards](detailed_reports/target_selectors_usage.md#self-identity) |
| `VILLAIN` | **7** | 7 | [Inspect Cards](detailed_reports/target_selectors_usage.md#villain) |
| `SELF_HERO` | **5** | 5 | [Inspect Cards](detailed_reports/target_selectors_usage.md#self-hero) |
| `CHOSEN_PLAYER` | **4** | 4 | [Inspect Cards](detailed_reports/target_selectors_usage.md#chosen-player) |
| `ALL_HEROES` | **3** | 3 | [Inspect Cards](detailed_reports/target_selectors_usage.md#all-heroes) |
| `THIS_SIDE_SCHEME` | **3** | 3 | [Inspect Cards](detailed_reports/target_selectors_usage.md#this-side-scheme) |
| `DEFENDING_PLAYER` | **3** | 2 | [Inspect Cards](detailed_reports/target_selectors_usage.md#defending-player) |

> 🔗 **[View all 34 Target Selectors in Use →](detailed_reports/target_selectors_usage.md)**

---

## 🚦 6. Condition Gates & Step Conditions Summary

| Mechanism | In Use | Schema Total | Coverage | Detailed Breakdown |
| :--- | :---: | :---: | :---: | :--- |
| **Condition Gates** | **9** | 9 | 100.0% | [View Gates Breakdown](detailed_reports/condition_gates_usage.md#1-condition-gates-conditiongateschema) |
| **Step Conditions** | **0** | 0 | 100.0% | [View Step Conditions](detailed_reports/condition_gates_usage.md#2-step-conditions-stepconditionschema) |
| **Gate Parameters** | **10** | - | - | `trait` (4), `resource` (5), `count` (2), `form` (7), `negate` (7), `result` (5), `cardCode` (6), `step` (3), `attackerKind` (2), `zone` (1) |

---

## 💥 7. Effect Primitives Summary

### High-Impact Effects (Blast Radius $\ge 5$ Cards):

| Effect Primitive | Declaring Cards | Occurrences | Detailed Card List |
| :--- | :---: | :---: | :--- |
| `DEAL_DAMAGE` | **25 cards** | 27 steps | [View Cards](detailed_reports/effects_usage.md#deal-damage) |
| `DISCARD` | **17 cards** | 19 steps | [View Cards](detailed_reports/effects_usage.md#discard) |
| `ADD_STATUS` | **12 cards** | 15 steps | [View Cards](detailed_reports/effects_usage.md#add-status) |
| `DRAW` | **11 cards** | 11 steps | [View Cards](detailed_reports/effects_usage.md#draw) |
| `MODIFY_STAT` | **11 cards** | 13 steps | [View Cards](detailed_reports/effects_usage.md#modify-stat) |
| `PLAYER_CHOICE` | **11 cards** | 11 steps | [View Cards](detailed_reports/effects_usage.md#player-choice) |
| `SURGE` | **11 cards** | 11 steps | [View Cards](detailed_reports/effects_usage.md#surge) |
| `ADD_THREAT` | **11 cards** | 13 steps | [View Cards](detailed_reports/effects_usage.md#add-threat) |
| `REMOVE_THREAT` | **10 cards** | 12 steps | [View Cards](detailed_reports/effects_usage.md#remove-threat) |
| `SEARCH` | **9 cards** | 9 steps | [View Cards](detailed_reports/effects_usage.md#search) |
| `HEAL_DAMAGE` | **6 cards** | 6 steps | [View Cards](detailed_reports/effects_usage.md#heal-damage) |
| `MODIFY_MAX_HEALTH` | **5 cards** | 5 steps | [View Cards](detailed_reports/effects_usage.md#modify-max-health) |
| `READY` | **5 cards** | 5 steps | [View Cards](detailed_reports/effects_usage.md#ready) |
| `CHANGE_FORM` | **5 cards** | 5 steps | [View Cards](detailed_reports/effects_usage.md#change-form) |

> 🔗 **[View all 50 Effects in Use →](detailed_reports/effects_usage.md)**

---

## 🔍 8. Dynamic Values & Universal Filters Summary

| Feature | In Use | Declared Keys / Resolvers |
| :--- | :---: | :--- |
| **Dynamic Value Sources** | **14** | `HAS_IDENTITY`, `RESOURCES_SPENT`, `COUNTERS (counter: energy)`, `STAT_VALUE (stat: SUFFERED_DAMAGE)`, `DISCARDED_CARDS (attr: COUNT)`, `ENTITY_COUNT` *(+8 more)* |
| **Filter Criteria Keys** | **5** | `resourceIcons` (2), `codes` (5), `types` (18), `traits` (13), `sets` (3) |
| **Filter Compositions** | **0** | *(None declared)* |

---

## ⚠️ 9. Code Path Verification & Zero-Usage Detection

Every schema primitive is verified for a matching engine handler. Check the complete **[Schema Primitives Code Path Matrix](detailed_reports/schema_code_path_audit.md)** for status on all 164 schema definitions.

### Summary of Unhandled or Zero-Usage Primitives:
| Category | Schema Total | Unused in Cards (0 Cards) | Missing Engine Handler |
| :--- | :---: | :---: | :---: |
| **Effects** | 58 | 8 | 🟢 0 |
| **Targets** | 46 | 12 | 🟢 0 |
| **Gates** | 9 | 0 | 🟢 0 |
| **Step Conditions** | 0 | 0 | 🟢 0 |
| **Triggers** | 32 | 11 | 🟢 0 |
| **Timings** | 19 | 4 | 🟢 0 |