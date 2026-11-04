# Supplemental Card Declarations Usage & Impact Report

> **Source Packs Scanned:** `aoa_encounter, cap, core, core_encounter, cw_encounter, mts`

---

## 📊 1. Executive Summary & Code Path Health

| Metric | Count | Health / Coverage | Description |
| :--- | :---: | :---: | :--- |
| **Total Cards Registered** | **211** | 100% | Total cards present in `src/data/supplemental/` |
| **Active Declared Cards** | **190** | - | Cards with executable `abilities: [...]` |
| **No Supplemental Needed** | [20](detailed_reports/vanilla_and_passive_cards.md) | Verified | Vanilla / passive cards explicitly requiring no supplemental hooks |
| **Open Ambiguity Reports** | **3** | Blocked | Cards isolated in `docs/ambiguities/` (Inbox Zero Queue) |
| **False-Vanilla Violations** | **0** | 🟢 0 | Cards marked `noSupplementalNeeded` that have printed rules text |
| **Overall Schema Engine Coverage** | **100.0%** | [Matrix](detailed_reports/schema_code_path_audit.md) | Percentage of all schema primitives with active engine code paths |
| **Effect Types Code Path Coverage** | **100.0%** | **59/59** | [51 In Use](detailed_reports/effects_usage.md) |
| **Target Selectors Code Path Coverage** | **100.0%** | **47/47** | [36 In Use](detailed_reports/target_selectors_usage.md) |
| **Step Gates Code Path Coverage** | **100.0%** | **10/10** | [10 In Use](detailed_reports/step_gates_usage.md) |
| **Trigger Types Code Path Coverage** | **100.0%** | **34/34** | [25 In Use](detailed_reports/timing_and_triggers_usage.md) |
| **Timing Types Code Path Coverage** | **100.0%** | **19/19** | [15 In Use](detailed_reports/timing_and_triggers_usage.md) |
| **Total Abilities Declared** | **230** | - | Total individual ability definitions declared |
| **Multi-Step Pipelines (2+ Steps)** | [43](detailed_reports/multi_ability_and_multistep_cards.md) | - | Abilities decomposed into sequenced execution pipelines |
| **Cards with Multiple Abilities (2+)** | [35](detailed_reports/multi_ability_and_multistep_cards.md) | - | Cards declaring more than 1 distinct ability header |

---

## 🔴 2. Active Ambiguity & Blocker Queue (3 Cards)

These cards are currently isolated in [`docs/ambiguities/`](../../ambiguities/README.md) pending rules engine primitives or targeting extensions:

| Card Code | Card Name | Pack | Confidence | Blocker Category | Ambiguity Report File |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `01144` | **Unknown** | `core` | `70%` | `RULES_AMBIGUITY` | [`core_01144_android-efficiency.md`](../../ambiguities/core_01144_android-efficiency.md) |
| `21054` | **Eternity** | `mts` | `50%` | `MISSING_ENGINE_PRIMITIVE` | [`mts_21054_eternity.md`](../../ambiguities/mts_21054_eternity.md) |
| `56128b` | **Now It** | `cw_encounter` | `50%` | `MISSING_ENGINE_PRIMITIVE` | [`cw_56128b_now-its-personal.md`](../../ambiguities/cw_56128b_now-its-personal.md) |

---

## 🃏 3. Card-Level Declarations Summary

| Category | Active Count | Detailed Breakdown |
| :--- | :---: | :--- |
| **Vanilla / Passive Cards** | **20** | [View Full List](detailed_reports/vanilla_and_passive_cards.md) |
| **Play Requirements** | **2** | `identityForm` (1), `controlFilter` (4) |
| **Card Uses & Counters** | **6** | `uses (web)` (1), `uses (energy)` (1), `uses (attack)` (1), `uses (snoop)` (1), `uses (arrow)` (1), `uses (medical)` (1) |
| **Player Recipient Overrides** | **1** | `FIRST_PLAYER` (1) |
| **Stat & Rule Overrides** | **1** | `playUnderAnyPlayerControl` (3) |

---

## ⚡ 4. Ability Headers, Timings & Triggers Summary

| Component | In Use | Schema Total | Coverage | Detailed Report |
| :--- | :---: | :---: | :---: | :--- |
| **Ability Timings** | **15** | 19 | 100.0% | [View Declaring Cards](detailed_reports/timing_and_triggers_usage.md) |
| **Trigger Windows** | **25** | 34 | 100.0% | [View Declaring Cards](detailed_reports/timing_and_triggers_usage.md#2-trigger-windows-triggertypeschema) |
| **Trigger Filters** | **12** | - | - | `attackerKind` (3), `targetPlayerScope` (3), `damageSource` (1), `cardFilter` (2), `targetScope` (5), `attackedBy` (2), `sourceCardCode` (1), `targetType` (3), `defeatedByAttackOf` (3), `defenderType` (2), `threatSource` (2), `isSecondaryAttack` (1) |
| **Cost Primitives** | **9** | - | - | `exhaustSelf` (21), `spendCounters` (5), `resourceCost` (13), `heal` (1), `discardCard` (2), `discardSelf` (5), `damageHero` (1), `damageSelf` (1), `exhaustCard` (3) |
| **Multi-Ability Cards (2+)** | **35** | - | - | [View 35 Cards](detailed_reports/multi_ability_and_multistep_cards.md) |

---

## 🎯 5. Target Selectors Summary

| Top Target Selectors | Occurrences | Cards Count | Link to Details |
| :--- | :---: | :---: | :--- |
| `SELF` | **16** | 16 | [Inspect Cards](detailed_reports/target_selectors_usage.md#self) |
| `CHOSEN_ENEMY` | **16** | 16 | [Inspect Cards](detailed_reports/target_selectors_usage.md#chosen-enemy) |
| `CHOSEN_SCHEME` | **11** | 10 | [Inspect Cards](detailed_reports/target_selectors_usage.md#chosen-scheme) |
| `ALL_PLAYERS` | **10** | 10 | [Inspect Cards](detailed_reports/target_selectors_usage.md#all-players) |
| `SELF_IDENTITY` | **10** | 10 | [Inspect Cards](detailed_reports/target_selectors_usage.md#self-identity) |
| `VILLAIN` | **10** | 9 | [Inspect Cards](detailed_reports/target_selectors_usage.md#villain) |
| `SELF_HERO` | **6** | 6 | [Inspect Cards](detailed_reports/target_selectors_usage.md#self-hero) |
| `THIS_SIDE_SCHEME` | **6** | 6 | [Inspect Cards](detailed_reports/target_selectors_usage.md#this-side-scheme) |
| `CHOSEN_PLAYER` | **4** | 4 | [Inspect Cards](detailed_reports/target_selectors_usage.md#chosen-player) |
| `FIRST_PLAYER` | **4** | 4 | [Inspect Cards](detailed_reports/target_selectors_usage.md#first-player) |

> 🔗 **[View all 36 Target Selectors in Use →](detailed_reports/target_selectors_usage.md)**

---

## 🚦 6. Step Gates Summary

| Mechanism | In Use | Schema Total | Coverage | Detailed Breakdown |
| :--- | :---: | :---: | :---: | :--- |
| **Step Gates** | **10** | 10 | 100.0% | [View Gates Breakdown](detailed_reports/step_gates_usage.md) |
| **Gate Parameters** | **12** | - | - | `filter` (2), `trait` (4), `resource` (5), `count` (2), `form` (10), `negate` (8), `result` (9), `cardCode` (6), `target` (1), `step` (6), `attackerKind` (2), `zone` (1) |

---

## 💥 7. Effect Primitives Summary

### High-Impact Effects (Blast Radius $\ge 5$ Cards):

| Effect Primitive | Declaring Cards | Occurrences | Detailed Card List |
| :--- | :---: | :---: | :--- |
| `DISCARD` | **27 cards** | 30 steps | [View Cards](detailed_reports/effects_usage.md#discard) |
| `DEAL_DAMAGE` | **25 cards** | 27 steps | [View Cards](detailed_reports/effects_usage.md#deal-damage) |
| `PLAYER_CHOICE` | **17 cards** | 17 steps | [View Cards](detailed_reports/effects_usage.md#player-choice) |
| `MODIFY_STAT` | **16 cards** | 18 steps | [View Cards](detailed_reports/effects_usage.md#modify-stat) |
| `ADD_THREAT` | **16 cards** | 18 steps | [View Cards](detailed_reports/effects_usage.md#add-threat) |
| `EXECUTE_SPECIAL` | **15 cards** | 15 steps | [View Cards](detailed_reports/effects_usage.md#execute-special) |
| `ADD_STATUS` | **14 cards** | 17 steps | [View Cards](detailed_reports/effects_usage.md#add-status) |
| `SEARCH` | **13 cards** | 13 steps | [View Cards](detailed_reports/effects_usage.md#search) |
| `SURGE` | **12 cards** | 12 steps | [View Cards](detailed_reports/effects_usage.md#surge) |
| `DRAW` | **11 cards** | 11 steps | [View Cards](detailed_reports/effects_usage.md#draw) |
| `REMOVE_THREAT` | **10 cards** | 12 steps | [View Cards](detailed_reports/effects_usage.md#remove-threat) |
| `HEAL_DAMAGE` | **8 cards** | 9 steps | [View Cards](detailed_reports/effects_usage.md#heal-damage) |
| `MODIFY_MAX_HEALTH` | **7 cards** | 7 steps | [View Cards](detailed_reports/effects_usage.md#modify-max-health) |
| `READY` | **5 cards** | 5 steps | [View Cards](detailed_reports/effects_usage.md#ready) |
| `VILLAIN_ATTACKS` | **5 cards** | 5 steps | [View Cards](detailed_reports/effects_usage.md#villain-attacks) |
| `CHANGE_FORM` | **5 cards** | 5 steps | [View Cards](detailed_reports/effects_usage.md#change-form) |

> 🔗 **[View all 51 Effects in Use →](detailed_reports/effects_usage.md)**

---

## 🔍 8. Dynamic Values & Universal Filters Summary

| Feature | In Use | Declared Keys / Resolvers |
| :--- | :---: | :--- |
| **Dynamic Value Sources** | **15** | `HAS_IDENTITY`, `RESOURCES_SPENT`, `COUNTERS (counter: energy)`, `STAT_VALUE (stat: SUFFERED_DAMAGE)`, `DISCARDED_CARDS (attr: COUNT)`, `ENTITY_COUNT` *(+9 more)* |
| **Filter Criteria Keys** | **6** | `types` (35), `traits` (29), `resourceIcons` (2), `codes` (8), `isFacedown` (2), `sets` (3) |
| **Filter Compositions** | **0** | *(None declared)* |

---

## ⚠️ 9. Code Path Verification & Zero-Usage Detection

Every schema primitive is verified for a matching engine handler. Check the complete **[Schema Primitives Code Path Matrix](detailed_reports/schema_code_path_audit.md)** for status on all 169 schema definitions.

### Summary of Unhandled or Zero-Usage Primitives:
| Category | Schema Total | Unused in Cards (0 Cards) | Missing Engine Handler |
| :--- | :---: | :---: | :---: |
| **Effects** | 59 | 8 | 🟢 0 |
| **Targets** | 47 | 11 | 🟢 0 |
| **Gates** | 10 | 0 | 🟢 0 |
| **Triggers** | 34 | 9 | 🟢 0 |
| **Timings** | 19 | 4 | 🟢 0 |