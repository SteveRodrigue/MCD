# Supplemental Card Declarations Usage & Impact Report

> **Generated:** `2026-10-10T21:28:03.542Z`  
> **Source Packs Scanned:** `aoa_encounter, core, core_encounter, cw_encounter, mts`

---

## 📊 1. Executive Summary & Code Path Health

| Metric | Count | Health / Coverage | Description |
| :--- | :---: | :---: | :--- |
| **Total Cards Registered** | **160** | 100% | Total cards present in `src/data/supplemental/` |
| **Active Declared Cards** | **145** | - | Cards with executable `abilities: [...]` |
| **No Supplemental Needed** | [14](detailed_reports/vanilla_and_passive_cards.md) | Verified | Vanilla / passive cards explicitly requiring no supplemental hooks |
| **Open Ambiguity Reports** | **2** | Blocked | Cards isolated in `docs/ambiguities/` (Inbox Zero Queue) |
| **False-Vanilla Violations** | **0** | 🟢 0 | Cards marked `noSupplementalNeeded` that have printed rules text |
| **Overall Schema Engine Coverage** | **100.0%** | [Matrix](detailed_reports/schema_code_path_audit.md) | Percentage of all schema primitives with active engine code paths |
| **Effect Types Code Path Coverage** | **100.0%** | **55/55** | [47 In Use](detailed_reports/effects_usage.md) |
| **Target Selectors Code Path Coverage** | **100.0%** | **43/43** | [29 In Use](detailed_reports/target_selectors_usage.md) |
| **Condition Gates Code Path Coverage** | **100.0%** | **9/9** | [9 In Use](detailed_reports/condition_gates_usage.md) |
| **Step Conditions Code Path Coverage** | **100.0%** | **0/0** | [0 In Use](detailed_reports/condition_gates_usage.md) |
| **Trigger Types Code Path Coverage** | **100.0%** | **31/31** | [21 In Use](detailed_reports/timing_and_triggers_usage.md) |
| **Timing Types Code Path Coverage** | **100.0%** | **19/19** | [15 In Use](detailed_reports/timing_and_triggers_usage.md) |
| **Total Abilities Declared** | **164** | - | Total individual ability definitions declared |
| **Multi-Step Pipelines (2+ Steps)** | [32](detailed_reports/multi_ability_and_multistep_cards.md) | - | Abilities decomposed into sequenced execution pipelines |
| **Cards with Multiple Abilities (2+)** | [17](detailed_reports/multi_ability_and_multistep_cards.md) | - | Cards declaring more than 1 distinct ability header |

---

## 🔴 2. Active Ambiguity & Blocker Queue (2 Cards)

These cards are currently isolated in [`docs/ambiguities/`](../../ambiguities/README.md) pending rules engine primitives or targeting extensions:

| Card Code | Card Name | Pack | Confidence | Blocker Category | Ambiguity Report File |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `21054` | **Eternity** | `mts` | `50%` | `MISSING_ENGINE_PRIMITIVE` | [`mts_21054_eternity.md`](../../ambiguities/mts_21054_eternity.md) |
| `56128b` | **Now It** | `cw_encounter` | `50%` | `MISSING_ENGINE_PRIMITIVE` | [`cw_56128b_now-its-personal.md`](../../ambiguities/cw_56128b_now-its-personal.md) |

---

## 🃏 3. Card-Level Declarations Summary

| Category | Active Count | Detailed Breakdown |
| :--- | :---: | :--- |
| **Vanilla / Passive Cards** | **14** | [View Full List](detailed_reports/vanilla_and_passive_cards.md) |
| **Play Requirements** | **2** | `identityForm` (1), `controlFilter` (4) |
| **Card Uses & Counters** | **6** | `uses (web)` (1), `uses (energy)` (1), `uses (attack)` (1), `uses (snoop)` (1), `uses (arrow)` (1), `uses (medical)` (1) |
| **Keywords** | **0** | *(None declared directly in supplemental)* |
| **Player Recipient Overrides** | **1** | `FIRST_PLAYER` (1) |
| **Stat & Rule Overrides** | **3** | `attackCost` (1), `maxPerPlayer` (7), `playUnderAnyPlayerControl` (3) |

---

## ⚡ 4. Ability Headers, Timings & Triggers Summary

| Component | In Use | Schema Total | Coverage | Detailed Report |
| :--- | :---: | :---: | :---: | :--- |
| **Ability Timings** | **15** | 19 | 100.0% | [View Declaring Cards](detailed_reports/timing_and_triggers_usage.md) |
| **Trigger Windows** | **21** | 31 | 100.0% | [View Declaring Cards](detailed_reports/timing_and_triggers_usage.md#2-trigger-windows-triggertypeschema) |
| **Trigger Filters** | **10** | - | - | `attackerKind` (1), `targetPlayerScope` (3), `damageSource` (1), `targetScope` (1), `attackedBy` (1), `sourceCardCode` (1), `targetType` (3), `defeatedByAttackOf` (2), `defenderType` (1), `threatSource` (1) |
| **Cost Primitives** | **9** | - | - | `discardSelf` (13), `resourceCost` (9), `exhaustSelf` (20), `spendCounters` (5), `resources` (2), `heal` (1), `discardCard` (2), `damageHero` (1), `damageSelf` (1) |
| **Multi-Ability Cards (2+)** | **17** | - | - | [View 17 Cards](detailed_reports/multi_ability_and_multistep_cards.md) |

---

## 🎯 5. Target Selectors Summary

| Top Target Selectors | Occurrences | Cards Count | Link to Details |
| :--- | :---: | :---: | :--- |
| `CHOSEN_ENEMY` | **16** | 16 | [Inspect Cards](detailed_reports/target_selectors_usage.md#chosen-enemy) |
| `CHOSEN_SCHEME` | **11** | 10 | [Inspect Cards](detailed_reports/target_selectors_usage.md#chosen-scheme) |
| `SELF` | **10** | 10 | [Inspect Cards](detailed_reports/target_selectors_usage.md#self) |
| `SELF_IDENTITY` | **10** | 10 | [Inspect Cards](detailed_reports/target_selectors_usage.md#self-identity) |
| `SELF_HERO` | **5** | 5 | [Inspect Cards](detailed_reports/target_selectors_usage.md#self-hero) |
| `CHOSEN_PLAYER` | **4** | 4 | [Inspect Cards](detailed_reports/target_selectors_usage.md#chosen-player) |
| `VILLAIN` | **4** | 4 | [Inspect Cards](detailed_reports/target_selectors_usage.md#villain) |
| `MAIN_SCHEME` | **4** | 3 | [Inspect Cards](detailed_reports/target_selectors_usage.md#main-scheme) |
| `CHOSEN_MINION` | **2** | 2 | [Inspect Cards](detailed_reports/target_selectors_usage.md#chosen-minion) |
| `ALL_ENEMIES` | **2** | 2 | [Inspect Cards](detailed_reports/target_selectors_usage.md#all-enemies) |

> 🔗 **[View all 29 Target Selectors in Use →](detailed_reports/target_selectors_usage.md)**

---

## 🚦 6. Condition Gates & Step Conditions Summary

| Mechanism | In Use | Schema Total | Coverage | Detailed Breakdown |
| :--- | :---: | :---: | :---: | :--- |
| **Condition Gates** | **9** | 9 | 100.0% | [View Gates Breakdown](detailed_reports/condition_gates_usage.md#1-condition-gates-conditiongateschema) |
| **Step Conditions** | **0** | 0 | 100.0% | [View Step Conditions](detailed_reports/condition_gates_usage.md#2-step-conditions-stepconditionschema) |
| **Gate Parameters** | **10** | - | - | `trait` (4), `resource` (5), `count` (2), `form` (7), `negate` (5), `result` (5), `cardCode` (3), `step` (3), `attackerKind` (2), `zone` (1) |

---

## 💥 7. Effect Primitives Summary

### High-Impact Effects (Blast Radius $\ge 5$ Cards):

| Effect Primitive | Declaring Cards | Occurrences | Detailed Card List |
| :--- | :---: | :---: | :--- |
| `DEAL_DAMAGE` | **23 cards** | 24 steps | [View Cards](detailed_reports/effects_usage.md#deal-damage) |
| `DISCARD` | **15 cards** | 16 steps | [View Cards](detailed_reports/effects_usage.md#discard) |
| `ADD_STATUS` | **13 cards** | 15 steps | [View Cards](detailed_reports/effects_usage.md#add-status) |
| `DRAW` | **11 cards** | 11 steps | [View Cards](detailed_reports/effects_usage.md#draw) |
| `MODIFY_STAT` | **11 cards** | 13 steps | [View Cards](detailed_reports/effects_usage.md#modify-stat) |
| `SURGE` | **11 cards** | 11 steps | [View Cards](detailed_reports/effects_usage.md#surge) |
| `REMOVE_THREAT` | **10 cards** | 12 steps | [View Cards](detailed_reports/effects_usage.md#remove-threat) |
| `PLAYER_CHOICE` | **10 cards** | 10 steps | [View Cards](detailed_reports/effects_usage.md#player-choice) |
| `ADD_THREAT` | **9 cards** | 10 steps | [View Cards](detailed_reports/effects_usage.md#add-threat) |
| `HEAL_DAMAGE` | **6 cards** | 6 steps | [View Cards](detailed_reports/effects_usage.md#heal-damage) |
| `SEARCH` | **6 cards** | 6 steps | [View Cards](detailed_reports/effects_usage.md#search) |
| `READY` | **5 cards** | 5 steps | [View Cards](detailed_reports/effects_usage.md#ready) |
| `CHANGE_FORM` | **5 cards** | 5 steps | [View Cards](detailed_reports/effects_usage.md#change-form) |

> 🔗 **[View all 47 Effects in Use →](detailed_reports/effects_usage.md)**

---

## 🔍 8. Dynamic Values & Universal Filters Summary

| Feature | In Use | Declared Keys / Resolvers |
| :--- | :---: | :--- |
| **Dynamic Value Sources** | **14** | `HAS_IDENTITY`, `RESOURCES_SPENT`, `COUNTERS (counter: energy)`, `STAT_VALUE (stat: SUFFERED_DAMAGE)`, `DISCARDED_CARDS (attr: COUNT)`, `ENTITY_COUNT` *(+8 more)* |
| **Filter Criteria Keys** | **5** | `resourceIcons` (2), `codes` (2), `types` (17), `traits` (10), `sets` (3) |
| **Filter Compositions** | **0** | *(None declared)* |

---

## ⚠️ 9. Code Path Verification & Zero-Usage Detection

Every schema primitive is verified for a matching engine handler. Check the complete **[Schema Primitives Code Path Matrix](detailed_reports/schema_code_path_audit.md)** for status on all 157 schema definitions.

### Summary of Unhandled or Zero-Usage Primitives:
| Category | Schema Total | Unused in Cards (0 Cards) | Missing Engine Handler |
| :--- | :---: | :---: | :---: |
| **Effects** | 55 | 8 | 🟢 0 |
| **Targets** | 43 | 14 | 🟢 0 |
| **Gates** | 9 | 0 | 🟢 0 |
| **Step Conditions** | 0 | 0 | 🟢 0 |
| **Triggers** | 31 | 10 | 🟢 0 |
| **Timings** | 19 | 4 | 🟢 0 |