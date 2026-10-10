# 📋 Multi-Ability & Multi-Step Pipelines Inventory

[← Back to Main Usage Report](../usage_report.md)

> **Generated:** `2026-10-10T21:28:03.542Z`

## 1. Cards with Multiple Abilities (2+ Declared Abilities — 17 Cards)

| Card Code | Card Name | Type | Pack | Ability Count | Declared Abilities Summary |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `01007` | **Spider-Tracer** | `upgrade` | `core` | **2** | • `spider_tracer_attach` (`ACTION`, **1 step**)<br/>• `spider_tracer_defeat_trigger` (`FORCED_INTERRUPT` / `CHARACTER_DEFEATED`, **1 step**) |
| `01009` | **Webbed Up** | `upgrade` | `core` | **2** | • `webbed_up_attach` (`HERO_ACTION`, **1 step**)<br/>• `webbed_up_interrupt` (`FORCED_INTERRUPT` / `HOST_WOULD_ATTACK`, **3 steps**) |
| `01017` | **Cosmic Flight** | `upgrade` | `core` | **2** | • `cosmic_flight_aerial` (`CONSTANT`, **1 step**)<br/>• `cosmic_flight_prevent` (`HERO_INTERRUPT` / `DAMAGE_WOULD_BE_TAKEN`, **1 step**) |
| `01018` | **Energy Channel** | `upgrade` | `core` | **2** | • `energy_channel_add` (`ACTION`, **1 step**)<br/>• `energy_channel_blast` (`HERO_ACTION`, **1 step**) |
| `01028` | **Superhuman Strength** | `upgrade` | `core` | **2** | • `superhuman_strength_atk` (`CONSTANT`, **1 step**)<br/>• `superhuman_strength_stun` (`FORCED_RESPONSE` / `ATTACK_RESOLVED`, **1 step**) |
| `01039` | **Rocket Boots** | `upgrade` | `core` | **2** | • `rocket_boots_hp` (`CONSTANT`, **1 step**)<br/>• `rocket_boots_aerial` (`HERO_ACTION`, **1 step**) |
| `01074` | **Inspired** | `upgrade` | `core` | **3** | • `inspired_attach` (`ACTION`, **1 step**)<br/>• `inspired_thw_bonus` (`CONSTANT`, **1 step**)<br/>• `inspired_atk_bonus` (`CONSTANT`, **1 step**) |
| `01084` | **Nick Fury** | `ally` | `core` | **2** | • `nick_fury_enters_play` (`FORCED_RESPONSE` / `ENTERS_PLAY`, **1 step**)<br/>• `nick_fury_round_end_discard` (`FORCED_RESPONSE` / `ROUND_ENDED`, **1 step**) |
| `01099` | **Charge** | `attachment` | `core_encounter` | **3** | • `charge_atk_bonus` (`CONSTANT`, **1 step**)<br/>• `charge_overkill` (`CONSTANT`, **1 step**)<br/>• `charge_discard` (`FORCED_RESPONSE` / `HOST_ATTACK_ENDED`, **1 step**) |
| `01100` | **Enhanced Ivory Horn** | `attachment` | `core_encounter` | **2** | • `ivory_horn_atk_bonus` (`CONSTANT`, **1 step**)<br/>• `ivory_horn_discard_action` (`HERO_ACTION`, **1 step**) |
| `01158` | **Heart-Shaped Herb** | `treachery` | `core_encounter` | **2** | • `heart_shaped_herb_when_revealed` (`WHEN_REVEALED` / `WHEN_REVEALED`, **1 step**)<br/>• `heart_shaped_herb_boost` (`BOOST` / `BOOST`, **1 step**) |
| `01164` | **Titania's Fury** | `treachery` | `core_encounter` | **2** | • `titanias_fury_when_revealed` (`FORCED_RESPONSE` / `WHEN_REVEALED`, **3 steps**)<br/>• `titanias_fury_boost` (`BOOST` / `BOOST`, **1 step**) |
| `01166` | **Highway Robbery** | `side_scheme` | `core_encounter` | **2** | • `highway_robbery_when_revealed` (`WHEN_REVEALED`, **1 step**)<br/>• `highway_robbery_when_defeated` (`FORCED_RESPONSE` / `DEFEATED`, **1 step**) |
| `01168` | **Sweeping Swoop** | `treachery` | `core_encounter` | **2** | • `sweeping_swoop_when_revealed` (`WHEN_REVEALED` / `WHEN_REVEALED`, **2 steps**)<br/>• `sweeping_swoop_boost` (`BOOST` / `BOOST`, **1 step**) |
| `01173` | **Electric Whip Attack** | `treachery` | `core_encounter` | **2** | • `electric_whip_attack_when_revealed` (`WHEN_REVEALED` / `WHEN_REVEALED`, **1 step**)<br/>• `electric_whip_attack_boost` (`BOOST` / `BOOST`, **1 step**) |
| `01178` | **Kree Manipulator** | `treachery` | `core_encounter` | **2** | • `kree_manipulator_when_revealed` (`WHEN_REVEALED` / `WHEN_REVEALED`, **1 step**)<br/>• `kree_manipulator_boost` (`BOOST` / `BOOST`, **1 step**) |
| `45109` | **The Fittest** | `attachment` | `aoa_encounter` | **2** | • `the_fittest_hit_points` (`CONSTANT`, **1 step**)<br/>• `the_fittest_tough` (`FORCED_RESPONSE` / `WHEN_REVEALED`, **1 step**) |

## 2. Multi-Step Execution Pipelines (2+ Steps — 32 Pipelines Across 32 Cards)

| Card Code | Card Name | Pack | Ability ID | Timing | Steps | Pipeline Execution Sequence |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `01009` | **Webbed Up (upgrade)** | `core` | `webbed_up_interrupt` | `FORCED_INTERRUPT` | **3** | `[1] CANCEL_ATTACK ➔ [2] DISCARD ➔ [3] ADD_STATUS` |
| `01012` | **Crisis Interdiction (event)** | `core` | `crisis_interdiction` | `HERO_ACTION` | **2** | `[1] REMOVE_THREAT ➔ [2] REMOVE_THREAT` |
| `01013` | **Photonic Blast (event)** | `core` | `photonic_blast` | `HERO_ACTION` | **2** | `[1] DEAL_DAMAGE ➔ [2] DRAW` |
| `01016` | **Captain Marvel's Helmet (upgrade)** | `core` | `captain_marvel_helmet_def` | `CONSTANT` | **2** | `[1] MODIFY_STAT ➔ [2] MODIFY_STAT` |
| `01025` | **Split Personality (event)** | `core` | `split_personality` | `ACTION` | **2** | `[1] FLIP_FORM ➔ [2] DRAW` |
| `01031` | **Repulsor Blast (event)** | `core` | `repulsor_blast` | `HERO_ACTION` | **2** | `[1] DISCARD ➔ [2] DEAL_DAMAGE` |
| `01037` | **Mark V Helmet (upgrade)** | `core` | `mark_v_helmet` | `HERO_ACTION` | **2** | `[1] REMOVE_THREAT ➔ [2] REMOVE_THREAT` |
| `01050` | **Hulk (ally)** | `core` | `hulk_smash_response` | `FORCED_RESPONSE` | **4** | `[1] DISCARD ➔ [2] DEAL_DAMAGE ➔ [3] DEAL_DAMAGE ➔ [4] DISCARD` |
| `01053` | **Relentless Assault (event)** | `core` | `relentless_assault` | `HERO_ACTION` | **2** | `[1] GRANT_ATTACK_KEYWORD ➔ [2] DEAL_DAMAGE` |
| `01061` | **Great Responsibility (event)** | `core` | `great_responsibility_interrupt` | `HERO_INTERRUPT` | **2** | `[1] PREVENT_THREAT ➔ [2] DEAL_DAMAGE` |
| `01078` | **Get Behind Me! (event)** | `core` | `get_behind_me_interrupt` | `HERO_INTERRUPT` | **2** | `[1] CANCEL_WHEN_REVEALED ➔ [2] VILLAIN_ATTACKS` |
| `01104` | **Hard to Keep Down (treachery)** | `core_encounter` | `hard_to_keep_down_heal` | `WHEN_REVEALED` | **2** | `[1] HEAL_DAMAGE ➔ [2] SURGE` |
| `01105` | **"I'm Tough" (treachery)** | `core_encounter` | `im_tough_status` | `WHEN_REVEALED` | **2** | `[1] ADD_STATUS ➔ [2] SURGE` |
| `01106` | **Stampede (treachery)** | `core_encounter` | `stampede_attack` | `WHEN_REVEALED` | **3** | `[1] VILLAIN_ATTACKS ➔ [2] ADD_STATUS ➔ [3] SURGE` |
| `01111` | **Explosion (treachery)** | `core_encounter` | `explosion_when_revealed` | `WHEN_REVEALED` | **2** | `[1] DISTRIBUTE_AMOUNT ➔ [2] SURGE` |
| `01112` | **False Alarm (treachery)** | `core_encounter` | `false_alarm_confuse` | `WHEN_REVEALED` | **2** | `[1] ADD_STATUS ➔ [2] SURGE` |
| `01155` | **Affairs of State (obligation)** | `core_encounter` | `affairs_of_state_resolve` | `FORCED_RESPONSE` | **2** | `[1] CHANGE_FORM ➔ [2] PLAYER_CHOICE` |
| `01159` | **Ritual Combat (treachery)** | `core_encounter` | `ritual_combat_when_revealed` | `WHEN_REVEALED` | **2** | `[1] DISCARD ➔ [2] PLAYER_CHOICE` |
| `01160` | **Legal Work (obligation)** | `core_encounter` | `legal_work_resolve` | `FORCED_RESPONSE` | **2** | `[1] CHANGE_FORM ➔ [2] PLAYER_CHOICE` |
| `01164` | **Titania's Fury (treachery)** | `core_encounter` | `titanias_fury_when_revealed` | `FORCED_RESPONSE` | **3** | `[1] ENEMY_ATTACKS ➔ [2] HEAL_DAMAGE ➔ [3] SURGE` |
| `01165` | **Eviction Notice (obligation)** | `core_encounter` | `eviction_notice_resolve` | `FORCED_RESPONSE` | **2** | `[1] CHANGE_FORM ➔ [2] PLAYER_CHOICE` |
| `01168` | **Sweeping Swoop (treachery)** | `core_encounter` | `sweeping_swoop_when_revealed` | `WHEN_REVEALED` | **2** | `[1] ADD_STATUS ➔ [2] SURGE` |
| `01169` | **The Vulture's Plans (treachery)** | `core_encounter` | `the_vultures_plans_when_revealed` | `WHEN_REVEALED` | **2** | `[1] DISCARD ➔ [2] ADD_THREAT` |
| `01170` | **Business Problems (obligation)** | `core_encounter` | `business_problems_resolve` | `FORCED_RESPONSE` | **2** | `[1] CHANGE_FORM ➔ [2] PLAYER_CHOICE` |
| `01174` | **Electromagnetic Backlash (treachery)** | `core_encounter` | `electromagnetic_backlash_when_revealed` | `WHEN_REVEALED` | **2** | `[1] DISCARD ➔ [2] DEAL_DAMAGE` |
| `01175` | **Family Emergency (obligation)** | `core_encounter` | `family_emergency_resolve` | `FORCED_RESPONSE` | **2** | `[1] CHANGE_FORM ➔ [2] PLAYER_CHOICE` |
| `01179` | **Yon-Rogg's Treason (treachery)** | `core_encounter` | `yon_roggs_treason_when_revealed` | `WHEN_REVEALED` | **2** | `[1] DISCARD ➔ [2] SURGE` |
| `01187` | **Assault (treachery)** | `core_encounter` | `assault_when_revealed` | `WHEN_REVEALED` | **2** | `[1] VILLAIN_ATTACKS ➔ [2] SURGE` |
| `01189` | **Gang-Up (treachery)** | `core_encounter` | `gang_up_when_revealed` | `WHEN_REVEALED` | **2** | `[1] VILLAIN_AND_ENGAGED_MINIONS_ATTACK ➔ [2] SURGE` |
| `01190` | **Shadow of the Past (treachery)** | `core_encounter` | `shadow_of_the_past_when_revealed` | `WHEN_REVEALED` | **4** | `[1] PUT_INTO_PLAY ➔ [2] PUT_INTO_PLAY ➔ [3] SHUFFLE_INTO_DECK ➔ [4] SURGE` |
| `01192` | **Masterplan (treachery)** | `core_encounter` | `masterplan_when_revealed` | `WHEN_REVEALED` | **2** | `[1] ADD_THREAT ➔ [2] DISCARD` |
| `21054` | **Eternity (event)** | `mts` | `eternity_when_revealed` | `WHEN_REVEALED` | **2** | `[1] DRAW ➔ [2] REMOVE_FROM_GAME` |

[← Back to Main Usage Report](../usage_report.md)