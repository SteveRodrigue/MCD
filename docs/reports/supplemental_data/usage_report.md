# Supplemental Card Declarations Usage & Impact Report

> **Source Packs Scanned:** `aoa_encounter, aos_encounter, cap, core, core_encounter, cw_encounter, gmw_encounter, gob_encounter, hood_encounter, mts, trors_encounter`

---

## 📊 1. Executive Summary & Code Path Health

| Metric | Count | Health / Coverage | Description |
| :--- | :---: | :---: | :--- |
| **Total Cards Registered** | **254** | 100% | Total cards present in `src/data/supplemental/` |
| **Active Declared Cards** | **235** | - | Cards with executable `abilities: [...]` |
| **No Supplemental Needed** | [18](detailed_reports/vanilla_and_passive_cards.md) | Verified | Vanilla / passive cards explicitly requiring no supplemental hooks |
| **Open Ambiguity Reports** | **3** | Blocked | Cards isolated in `docs/ambiguities/` (Inbox Zero Queue) |
| **False-Vanilla Violations** | **0** | 🟢 0 | Cards marked `noSupplementalNeeded` that have printed rules text |
| **Overall Schema Engine Coverage** | **100.0%** | [Matrix](detailed_reports/schema_code_path_audit.md) | Percentage of all schema primitives with active engine code paths |
| **Effect Types Code Path Coverage** | **100.0%** | **61/61** | [54 In Use](detailed_reports/effects_usage.md) |
| **Target Selectors Code Path Coverage** | **100.0%** | **48/48** | [36 In Use](detailed_reports/target_selectors_usage.md) |
| **Step Gates Code Path Coverage** | **100.0%** | **11/11** | [11 In Use](detailed_reports/step_gates_usage.md) |
| **Trigger Types Code Path Coverage** | **100.0%** | **38/38** | [29 In Use](detailed_reports/timing_and_triggers_usage.md) |
| **Timing Types Code Path Coverage** | **100.0%** | **19/19** | [15 In Use](detailed_reports/timing_and_triggers_usage.md) |
| **Total Abilities Declared** | **295** | - | Total individual ability definitions declared |
| **Multi-Step Pipelines (2+ Steps)** | [68](detailed_reports/multi_ability_and_multistep_cards.md) | - | Abilities decomposed into sequenced execution pipelines |
| **Cards with Multiple Abilities (2+)** | [55](detailed_reports/multi_ability_and_multistep_cards.md) | - | Cards declaring more than 1 distinct ability header |

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
| **Vanilla / Passive Cards** | **18** | [View Full List](detailed_reports/vanilla_and_passive_cards.md) |
| **Play Requirements** | **2** | `identityForm` (1), `controlFilter` (4) |
| **Card Uses & Counters** | **6** | `uses (web)` (1), `uses (energy)` (1), `uses (attack)` (1), `uses (snoop)` (1), `uses (arrow)` (1), `uses (medical)` (1) |
| **Player Recipient Overrides** | **1** | `FIRST_PLAYER` (1) |
| **Stat & Rule Overrides** | **1** | `playUnderAnyPlayerControl` (3) |

---

## ⚡ 4. Ability Headers, Timings & Triggers Summary

| Component | In Use | Schema Total | Coverage | Detailed Report |
| :--- | :---: | :---: | :---: | :--- |
| **Ability Timings** | **15** | 19 | 100.0% | [View Declaring Cards](detailed_reports/timing_and_triggers_usage.md) |
| **Trigger Windows** | **29** | 38 | 100.0% | [View Declaring Cards](detailed_reports/timing_and_triggers_usage.md#2-trigger-windows-triggertypeschema) |
| **Trigger Filters** | **13** | - | - | `countersHere` (1), `attackerKind` (3), `targetPlayerScope` (3), `damageSource` (1), `cardFilter` (2), `targetScope` (8), `attackedBy` (2), `sourceCardCode` (1), `targetType` (3), `defeatedByAttackOf` (3), `defenderType` (2), `threatSource` (2), `isSecondaryAttack` (1) |
| **Cost Primitives** | **9** | - | - | `discardCard` (3), `exhaustSelf` (21), `spendCounters` (5), `resourceCost` (18), `heal` (1), `discardSelf` (5), `damageHero` (1), `damageSelf` (1), `exhaustCard` (3) |
| **Multi-Ability Cards (2+)** | **55** | - | - | [View 55 Cards](detailed_reports/multi_ability_and_multistep_cards.md) |

---

## 🎯 5. Target Selectors Summary

| Top Target Selectors | Occurrences | Cards Count | Link to Details |
| :--- | :---: | :---: | :--- |
| `VILLAIN` | **17** | 14 | [Inspect Cards](detailed_reports/target_selectors_usage.md#villain) |
| `SELF` | **16** | 16 | [Inspect Cards](detailed_reports/target_selectors_usage.md#self) |
| `CHOSEN_ENEMY` | **16** | 16 | [Inspect Cards](detailed_reports/target_selectors_usage.md#chosen-enemy) |
| `ALL_PLAYERS` | **14** | 14 | [Inspect Cards](detailed_reports/target_selectors_usage.md#all-players) |
| `SELF_IDENTITY` | **12** | 11 | [Inspect Cards](detailed_reports/target_selectors_usage.md#self-identity) |
| `CHOSEN_SCHEME` | **11** | 10 | [Inspect Cards](detailed_reports/target_selectors_usage.md#chosen-scheme) |
| `SELF_HERO` | **10** | 8 | [Inspect Cards](detailed_reports/target_selectors_usage.md#self-hero) |
| `THIS_SIDE_SCHEME` | **7** | 7 | [Inspect Cards](detailed_reports/target_selectors_usage.md#this-side-scheme) |
| `HOST` | **5** | 5 | [Inspect Cards](detailed_reports/target_selectors_usage.md#host) |
| `CHOSEN_PLAYER` | **4** | 4 | [Inspect Cards](detailed_reports/target_selectors_usage.md#chosen-player) |

> 🔗 **[View all 36 Target Selectors in Use →](detailed_reports/target_selectors_usage.md)**

---

## 🚦 6. Step Gates Summary

| Mechanism | In Use | Schema Total | Coverage | Detailed Breakdown |
| :--- | :---: | :---: | :---: | :--- |
| **Step Gates** | **11** | 11 | 100.0% | [View Gates Breakdown](detailed_reports/step_gates_usage.md) |
| **Gate Parameters** | **14** | - | - | `cardCode` (14), `counterType` (4), `form` (22), `step` (13), `negate` (11), `filter` (2), `trait` (4), `resource` (5), `count` (2), `result` (13), `target` (2), `attackerKind` (2), `zone` (1), `controller` (3) |

---

## 💥 7. Effect Primitives Summary

### High-Impact Effects (Blast Radius $\ge 5$ Cards):

| Effect Primitive | Declaring Cards | Occurrences | Detailed Card List |
| :--- | :---: | :---: | :--- |
| `DISCARD` | **44 cards** | 54 steps | [View Cards](detailed_reports/effects_usage.md#discard) |
| `DEAL_DAMAGE` | **30 cards** | 33 steps | [View Cards](detailed_reports/effects_usage.md#deal-damage) |
| `PLAYER_CHOICE` | **21 cards** | 21 steps | [View Cards](detailed_reports/effects_usage.md#player-choice) |
| `SURGE` | **19 cards** | 19 steps | [View Cards](detailed_reports/effects_usage.md#surge) |
| `ADD_THREAT` | **18 cards** | 20 steps | [View Cards](detailed_reports/effects_usage.md#add-threat) |
| `MODIFY_STAT` | **17 cards** | 19 steps | [View Cards](detailed_reports/effects_usage.md#modify-stat) |
| `ADD_STATUS` | **16 cards** | 20 steps | [View Cards](detailed_reports/effects_usage.md#add-status) |
| `SEARCH` | **15 cards** | 15 steps | [View Cards](detailed_reports/effects_usage.md#search) |
| `EXECUTE_SPECIAL` | **15 cards** | 15 steps | [View Cards](detailed_reports/effects_usage.md#execute-special) |
| `GIVE_ADDITIONAL_BOOST_CARD` | **12 cards** | 12 steps | [View Cards](detailed_reports/effects_usage.md#give-additional-boost-card) |
| `DRAW` | **11 cards** | 11 steps | [View Cards](detailed_reports/effects_usage.md#draw) |
| `HEAL_DAMAGE` | **11 cards** | 14 steps | [View Cards](detailed_reports/effects_usage.md#heal-damage) |
| `REMOVE_THREAT` | **10 cards** | 12 steps | [View Cards](detailed_reports/effects_usage.md#remove-threat) |
| `VILLAIN_ATTACKS` | **7 cards** | 7 steps | [View Cards](detailed_reports/effects_usage.md#villain-attacks) |
| `MODIFY_MAX_HEALTH` | **7 cards** | 7 steps | [View Cards](detailed_reports/effects_usage.md#modify-max-health) |
| `GRANT_KEYWORD` | **7 cards** | 7 steps | [View Cards](detailed_reports/effects_usage.md#grant-keyword) |
| `ADD_COUNTERS` | **6 cards** | 9 steps | [View Cards](detailed_reports/effects_usage.md#add-counters) |
| `READY` | **5 cards** | 5 steps | [View Cards](detailed_reports/effects_usage.md#ready) |
| `ENEMY_ATTACKS` | **5 cards** | 5 steps | [View Cards](detailed_reports/effects_usage.md#enemy-attacks) |
| `CHANGE_FORM` | **5 cards** | 5 steps | [View Cards](detailed_reports/effects_usage.md#change-form) |

> 🔗 **[View all 54 Effects in Use →](detailed_reports/effects_usage.md)**

---

## 🔍 8. Dynamic Values & Universal Filters Summary

| Feature | In Use | Declared Keys / Resolvers |
| :--- | :---: | :--- |
| **Dynamic Value Sources** | **17** | `DISCARDED_CARDS (attr: RESOURCE_ICONS)`, `HAS_IDENTITY`, `RESOURCES_SPENT`, `COUNTERS (counter: energy)`, `STAT_VALUE (stat: SUFFERED_DAMAGE)`, `DISCARDED_CARDS (attr: COUNT)` *(+11 more)* |
| **Filter Criteria Keys** | **8** | `types` (48), `sets` (12), `isIdentitySpecific` (1), `traits` (29), `resourceIcons` (3), `codes` (9), `isFacedown` (2), `hasStatus` (2) |
| **Filter Compositions** | **0** | *(None declared)* |

---

## ⚠️ 9. Code Path Verification & Zero-Usage Detection

Every schema primitive is verified for a matching engine handler. Check the complete **[Schema Primitives Code Path Matrix](detailed_reports/schema_code_path_audit.md)** for status on all 177 schema definitions.

### Summary of Unhandled or Zero-Usage Primitives:
| Category | Schema Total | Unused in Cards (0 Cards) | Missing Engine Handler |
| :--- | :---: | :---: | :---: |
| **Effects** | 61 | 7 | 🟢 0 |
| **Targets** | 48 | 12 | 🟢 0 |
| **Gates** | 11 | 0 | 🟢 0 |
| **Triggers** | 38 | 9 | 🟢 0 |
| **Timings** | 19 | 4 | 🟢 0 |