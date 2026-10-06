# Supplemental Card Declarations Usage & Impact Report

> **Generated:** `2026-10-06T20:10:50.473Z`  
> **Source Packs Scanned:** `core, core_encounter, cw_encounter`

---

## 📊 1. Executive Summary & Code Path Health

| Metric | Count | Health / Coverage | Description |
| :--- | :---: | :---: | :--- |
| **Total Cards Registered** | **158** | 100% | Total cards present in `src/data/supplemental/` |
| **Active Declared Cards** | **145** | - | Cards with executable `abilities: [...]` |
| **No Supplemental Needed** | [11](detailed_reports/vanilla_and_passive_cards.md) | Verified | Vanilla / passive cards explicitly requiring no supplemental hooks |
| **Open Ambiguity Reports** | **2** | Blocked | Cards isolated in `docs/ambiguities/` (Inbox Zero Queue) |
| **False-Vanilla Violations** | **0** | 🟢 0 | Cards marked `noSupplementalNeeded` that have printed rules text |
| **Overall Schema Engine Coverage** | **98.4%** | [Matrix](detailed_reports/schema_code_path_audit.md) | Percentage of all schema primitives with active engine code paths |
| **Effect Types Code Path Coverage** | **100.0%** | **64/64** | [44 In Use](detailed_reports/effects_usage.md) |
| **Target Selectors Code Path Coverage** | **100.0%** | **43/43** | [29 In Use](detailed_reports/target_selectors_usage.md) |
| **Condition Gates Code Path Coverage** | **100.0%** | **14/14** | [11 In Use](detailed_reports/condition_gates_usage.md) |
| **Step Conditions Code Path Coverage** | **76.9%** | **10/13** | [4 In Use](detailed_reports/condition_gates_usage.md) |
| **Trigger Types Code Path Coverage** | **100.0%** | **32/32** | [20 In Use](detailed_reports/timing_and_triggers_usage.md) |
| **Timing Types Code Path Coverage** | **100.0%** | **19/19** | [17 In Use](detailed_reports/timing_and_triggers_usage.md) |
| **Total Abilities Declared** | **165** | - | Total individual ability definitions declared |
| **Multi-Step Pipelines (2+ Steps)** | [30](detailed_reports/multi_ability_and_multistep_cards.md) | - | Abilities decomposed into sequenced execution pipelines |
| **Cards with Multiple Abilities (2+)** | [19](detailed_reports/multi_ability_and_multistep_cards.md) | - | Cards declaring more than 1 distinct ability header |

---

## 🔴 2. Active Ambiguity & Blocker Queue (2 Cards)

These cards are currently isolated in [`docs/ambiguities/`](../../ambiguities/README.md) pending rules engine primitives or targeting extensions:

| Card Code | Card Name | Pack | Confidence | Blocker Category | Ambiguity Report File |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `01163` | **Genetically Enhanced** | `core_encounter` | `70%` | `MISSING_ENGINE_PRIMITIVE` | [`core_encounter_01163_genetically-enhanced.md`](../../ambiguities/core_encounter_01163_genetically-enhanced.md) |
| `56128b` | **Now It** | `cw_encounter` | `50%` | `MISSING_ENGINE_PRIMITIVE` | [`cw_56128b_now-its-personal.md`](../../ambiguities/cw_56128b_now-its-personal.md) |

---

## 🃏 3. Card-Level Declarations Summary

| Category | Active Count | Detailed Breakdown |
| :--- | :---: | :--- |
| **Vanilla / Passive Cards** | **11** | [View Full List](detailed_reports/vanilla_and_passive_cards.md) |
| **Play Requirements** | **2** | `identityForm` (1), `controlFilter` (4) |
| **Card Uses & Counters** | **6** | `uses (web)` (1), `uses (energy)` (1), `uses (attack)` (1), `uses (snoop)` (1), `uses (arrow)` (1), `uses (medical)` (1) |
| **Keywords** | **0** | *(None declared directly in supplemental)* |
| **Player Recipient Overrides** | **1** | `FIRST_PLAYER` (1) |
| **Stat & Rule Overrides** | **3** | `attackCost` (1), `maxPerPlayer` (7), `playUnderAnyPlayerControl` (3) |

---

## ⚡ 4. Ability Headers, Timings & Triggers Summary

| Component | In Use | Schema Total | Coverage | Detailed Report |
| :--- | :---: | :---: | :---: | :--- |
| **Ability Timings** | **17** | 19 | 100.0% | [View Declaring Cards](detailed_reports/timing_and_triggers_usage.md) |
| **Trigger Windows** | **20** | 32 | 100.0% | [View Declaring Cards](detailed_reports/timing_and_triggers_usage.md#2-trigger-windows-triggertypeschema) |
| **Trigger Filters** | **8** | - | - | `attackerKind` (1), `targetPlayerScope` (3), `targetScope` (1), `sourceCardCode` (1), `targetType` (3), `defeatedByAttackOf` (2), `defenderType` (1), `threatSource` (1) |
| **Cost Primitives** | **9** | - | - | `discardSelf` (13), `resourceCost` (9), `exhaustSelf` (20), `spendCounters` (5), `resources` (2), `heal` (1), `discardCard` (2), `damageHero` (1), `damageSelf` (1) |
| **Multi-Ability Cards (2+)** | **19** | - | - | [View 19 Cards](detailed_reports/multi_ability_and_multistep_cards.md) |

---

## 🎯 5. Target Selectors Summary

| Top Target Selectors | Occurrences | Cards Count | Link to Details |
| :--- | :---: | :---: | :--- |
| `CHOSEN_ENEMY` | **16** | 16 | [Inspect Cards](detailed_reports/target_selectors_usage.md#chosen-enemy) |
| `SELF` | **15** | 15 | [Inspect Cards](detailed_reports/target_selectors_usage.md#self) |
| `SELF_IDENTITY` | **14** | 14 | [Inspect Cards](detailed_reports/target_selectors_usage.md#self-identity) |
| `CHOSEN_SCHEME` | **11** | 10 | [Inspect Cards](detailed_reports/target_selectors_usage.md#chosen-scheme) |
| `CHOSEN_PLAYER` | **4** | 4 | [Inspect Cards](detailed_reports/target_selectors_usage.md#chosen-player) |
| `VILLAIN` | **4** | 4 | [Inspect Cards](detailed_reports/target_selectors_usage.md#villain) |
| `MAIN_SCHEME` | **4** | 3 | [Inspect Cards](detailed_reports/target_selectors_usage.md#main-scheme) |
| `CHOSEN_MINION` | **2** | 2 | [Inspect Cards](detailed_reports/target_selectors_usage.md#chosen-minion) |
| `ALL_ENEMIES` | **2** | 2 | [Inspect Cards](detailed_reports/target_selectors_usage.md#all-enemies) |
| `TRIGGERING_ENEMY` | **2** | 2 | [Inspect Cards](detailed_reports/target_selectors_usage.md#triggering-enemy) |

> 🔗 **[View all 29 Target Selectors in Use →](detailed_reports/target_selectors_usage.md)**

---

## 🚦 6. Condition Gates & Step Conditions Summary

| Mechanism | In Use | Schema Total | Coverage | Detailed Breakdown |
| :--- | :---: | :---: | :---: | :--- |
| **Condition Gates** | **11** | 14 | 100.0% | [View Gates Breakdown](detailed_reports/condition_gates_usage.md#1-condition-gates-conditiongateschema) |
| **Step Conditions** | **4** | 13 | 76.9% | [View Step Conditions](detailed_reports/condition_gates_usage.md#2-step-conditions-stepconditionschema) |
| **Gate Parameters** | **10** | - | - | `trait` (4), `resource` (4), `count` (1), `form` (7), `status` (2), `target` (2), `cardCode` (3), `targetStepId` (3), `attackerKind` (2), `zone` (1) |

---

## 💥 7. Effect Primitives Summary

### High-Impact Effects (Blast Radius $\ge 5$ Cards):

| Effect Primitive | Declaring Cards | Occurrences | Detailed Card List |
| :--- | :---: | :---: | :--- |
| `DEAL_DAMAGE` | **24 cards** | 25 steps | [View Cards](detailed_reports/effects_usage.md#deal-damage) |
| `DISCARD` | **15 cards** | 16 steps | [View Cards](detailed_reports/effects_usage.md#discard) |
| `ADD_STATUS` | **14 cards** | 17 steps | [View Cards](detailed_reports/effects_usage.md#add-status) |
| `MODIFY_STAT` | **11 cards** | 13 steps | [View Cards](detailed_reports/effects_usage.md#modify-stat) |
| `SURGE` | **11 cards** | 11 steps | [View Cards](detailed_reports/effects_usage.md#surge) |
| `DRAW` | **10 cards** | 10 steps | [View Cards](detailed_reports/effects_usage.md#draw) |
| `REMOVE_THREAT` | **10 cards** | 12 steps | [View Cards](detailed_reports/effects_usage.md#remove-threat) |
| `PLAYER_CHOICE` | **10 cards** | 10 steps | [View Cards](detailed_reports/effects_usage.md#player-choice) |
| `ADD_THREAT` | **9 cards** | 10 steps | [View Cards](detailed_reports/effects_usage.md#add-threat) |
| `HEAL_DAMAGE` | **6 cards** | 6 steps | [View Cards](detailed_reports/effects_usage.md#heal-damage) |
| `SEARCH` | **6 cards** | 6 steps | [View Cards](detailed_reports/effects_usage.md#search) |
| `READY` | **5 cards** | 5 steps | [View Cards](detailed_reports/effects_usage.md#ready) |
| `CHANGE_FORM` | **5 cards** | 5 steps | [View Cards](detailed_reports/effects_usage.md#change-form) |

> 🔗 **[View all 44 Effects in Use →](detailed_reports/effects_usage.md)**

---

## 🔍 8. Dynamic Values & Universal Filters Summary

| Feature | In Use | Declared Keys / Resolvers |
| :--- | :---: | :--- |
| **Dynamic Value Sources** | **12** | `HAS_IDENTITY`, `COUNTERS (counter: energy)`, `STAT_VALUE (stat: SUFFERED_DAMAGE)`, `ENTITY_COUNT`, `DISCARDED_CARDS (attr: RESOURCE_ICONS)`, `HAS_TRAIT` *(+6 more)* |
| **Filter Criteria Keys** | **5** | `resourceIcons` (2), `codes` (2), `types` (15), `traits` (10), `sets` (3) |
| **Filter Compositions** | **0** | *(None declared)* |

---

## ⚠️ 9. Code Path Verification & Zero-Usage Detection

Every schema primitive is verified for a matching engine handler. Check the complete **[Schema Primitives Code Path Matrix](detailed_reports/schema_code_path_audit.md)** for status on all 185 schema definitions.

### Summary of Unhandled or Zero-Usage Primitives:
| Category | Schema Total | Unused in Cards (0 Cards) | Missing Engine Handler |
| :--- | :---: | :---: | :---: |
| **Effects** | 64 | 20 | 🟢 0 |
| **Targets** | 43 | 14 | 🟢 0 |
| **Gates** | 14 | 3 | 🟢 0 |
| **Step Conditions** | 13 | 9 | ⚠️ 3 (TARGET_ALREADY_EXHAUSTED, TARGET_FORM_MATCH, COUNTER_THRESHOLD_MET) |
| **Triggers** | 32 | 12 | 🟢 0 |
| **Timings** | 19 | 2 | 🟢 0 |