# 📋 Multi-Ability & Multi-Step Pipelines Inventory

[← Back to Main Usage Report](../usage_report.md)

## 1. Cards with Multiple Abilities (2+ Declared Abilities — 55 Cards)

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
| `01114` | **Klaw** | `villain` | `core_encounter` | **2** | • `klaw_stage_ii_forced_interrupt_boost` (`FORCED_INTERRUPT` / `INITIATES_ATTACK`, **1 step**)<br/>• `klaw_stage_ii_when_revealed` (`WHEN_REVEALED` / `WHEN_REVEALED`, **1 step**) |
| `01118` | **Sonic Converter** | `attachment` | `core_encounter` | **3** | • `sonic_converter_atk_bonus` (`CONSTANT`, **1 step**)<br/>• `sonic_converter_stun_damaged` (`FORCED_RESPONSE` / `HOST_ATTACK_ENDED`, **1 step**)<br/>• `sonic_converter_discard_action` (`HERO_ACTION`, **1 step**) |
| `01119` | **Solid-Sound Body** | `attachment` | `core_encounter` | **2** | • `solid_sound_body_retaliate` (`CONSTANT`, **1 step**)<br/>• `solid_sound_body_discard_action` (`HERO_ACTION`, **1 step**) |
| `01123` | **Sonic Boom** | `treachery` | `core_encounter` | **2** | • `sonic_boom_when_revealed` (`WHEN_REVEALED` / `WHEN_REVEALED`, **1 step**)<br/>• `sonic_boom_boost` (`BOOST` / `BOOST`, **1 step**) |
| `01129` | **Radioactive Man** | `minion` | `core_encounter` | **2** | • `radioactive_man_forced_response` (`FORCED_RESPONSE` / `MINION_ATTACKED`, **1 step**)<br/>• `radioactive_man_boost` (`BOOST` / `BOOST`, **1 step**) |
| `01130` | **Whirlwind** | `minion` | `core_encounter` | **2** | • `whirlwind_interrupt_multi_hero_attack` (`FORCED_INTERRUPT` / `INITIATES_ATTACK`, **1 step**)<br/>• `whirlwind_boost` (`BOOST` / `BOOST`, **1 step**) |
| `01131` | **Tiger Shark** | `minion` | `core_encounter` | **2** | • `tiger_shark_forced_response` (`FORCED_RESPONSE` / `MINION_ATTACKED`, **1 step**)<br/>• `tiger_shark_boost` (`BOOST` / `BOOST`, **1 step**) |
| `01132` | **Melter** | `minion` | `core_encounter` | **2** | • `melter_defend_with_ally_restriction` (`CONSTANT`, **1 step**)<br/>• `melter_boost` (`BOOST` / `BOOST`, **1 step**) |
| `01136` | **Ultron** | `villain` | `core_encounter` | **2** | • `ultron_iii_drones` (`CONSTANT`, **3 steps**)<br/>• `ultron_iii_when_revealed` (`WHEN_REVEALED` / `WHEN_REVEALED`, **1 step**) |
| `01141` | **Program Transmitter** | `attachment` | `core_encounter` | **3** | • `program_transmitter_scheme_bonus` (`CONSTANT`, **1 step**)<br/>• `program_transmitter_after_scheme` (`FORCED_RESPONSE` / `VILLAIN_SCHEMED`, **1 step**)<br/>• `program_transmitter_discard` (`HERO_ACTION`, **1 step**) |
| `01142` | **Upgraded Drones** | `attachment` | `core_encounter` | **2** | • `upgraded_drones_constant` (`CONSTANT`, **2 steps**)<br/>• `upgraded_drones_discard` (`HERO_ACTION`, **1 step**) |
| `01144a` | **Android Efficiency** | `treachery` | `core_encounter` | **2** | • `android_efficiency_a_when_revealed` (`WHEN_REVEALED` / `WHEN_REVEALED`, **1 step**)<br/>• `android_efficiency_a_boost` (`BOOST` / `BOOST`, **1 step**) |
| `01144b` | **Android Efficiency** | `treachery` | `core_encounter` | **2** | • `android_efficiency_b_when_revealed` (`WHEN_REVEALED` / `WHEN_REVEALED`, **1 step**)<br/>• `android_efficiency_b_boost` (`BOOST` / `BOOST`, **1 step**) |
| `01144c` | **Android Efficiency** | `treachery` | `core_encounter` | **2** | • `android_efficiency_c_when_revealed` (`WHEN_REVEALED` / `WHEN_REVEALED`, **1 step**)<br/>• `android_efficiency_c_boost` (`BOOST` / `BOOST`, **1 step**) |
| `01146` | **Repair Sequence** | `treachery` | `core_encounter` | **2** | • `repair_sequence_when_revealed` (`WHEN_REVEALED` / `WHEN_REVEALED`, **2 steps**)<br/>• `repair_sequence_boost` (`BOOST` / `BOOST`, **1 step**) |
| `01152` | **Vibranium Armor** | `attachment` | `core_encounter` | **2** | • `vibranium_armor_tough` (`FORCED_RESPONSE` / `DAMAGE_TAKEN`, **1 step**)<br/>• `vibranium_armor_discard` (`HERO_ACTION`, **1 step**) |
| `01153` | **Concussion Blasters** | `attachment` | `core_encounter` | **2** | • `concussion_blasters_retaliate` (`CONSTANT`, **1 step**)<br/>• `concussion_blasters_discard` (`HERO_ACTION`, **1 step**) |
| `01154` | **Concussive Blast** | `treachery` | `core_encounter` | **2** | • `concussive_blast_when_revealed` (`WHEN_REVEALED` / `WHEN_REVEALED`, **1 step**)<br/>• `concussive_blast_boost` (`BOOST` / `BOOST`, **1 step**) |
| `01158` | **Heart-Shaped Herb** | `treachery` | `core_encounter` | **2** | • `heart_shaped_herb_when_revealed` (`WHEN_REVEALED` / `WHEN_REVEALED`, **1 step**)<br/>• `heart_shaped_herb_boost` (`BOOST` / `BOOST`, **1 step**) |
| `01164` | **Titania's Fury** | `treachery` | `core_encounter` | **2** | • `titanias_fury_when_revealed` (`FORCED_RESPONSE` / `WHEN_REVEALED`, **3 steps**)<br/>• `titanias_fury_boost` (`BOOST` / `BOOST`, **1 step**) |
| `01166` | **Highway Robbery** | `side_scheme` | `core_encounter` | **2** | • `highway_robbery_when_revealed` (`WHEN_REVEALED`, **1 step**)<br/>• `highway_robbery_when_defeated` (`FORCED_RESPONSE` / `DEFEATED`, **1 step**) |
| `01168` | **Sweeping Swoop** | `treachery` | `core_encounter` | **2** | • `sweeping_swoop_when_revealed` (`WHEN_REVEALED` / `WHEN_REVEALED`, **2 steps**)<br/>• `sweeping_swoop_boost` (`BOOST` / `BOOST`, **1 step**) |
| `01173` | **Electric Whip Attack** | `treachery` | `core_encounter` | **2** | • `electric_whip_attack_when_revealed` (`WHEN_REVEALED` / `WHEN_REVEALED`, **1 step**)<br/>• `electric_whip_attack_boost` (`BOOST` / `BOOST`, **1 step**) |
| `01178` | **Kree Manipulator** | `treachery` | `core_encounter` | **2** | • `kree_manipulator_when_revealed` (`WHEN_REVEALED` / `WHEN_REVEALED`, **1 step**)<br/>• `kree_manipulator_boost` (`BOOST` / `BOOST`, **1 step**) |
| `01181` | **Madame Hydra** | `minion` | `core_encounter` | **3** | • `madame_hydra_immunity` (`CONSTANT`, **1 step**)<br/>• `madame_hydra_attacks` (`FORCED_RESPONSE` / `MINION_ATTACKED`, **1 step**)<br/>• `madame_hydra_schemes` (`FORCED_RESPONSE` / `MINION_SCHEMED`, **1 step**) |
| `02033` | **Goblin Glider** | `attachment` | `gob_encounter` | **2** | • `goblin_glider_atk_bonus` (`CONSTANT`, **1 step**)<br/>• `goblin_glider_discard` (`HERO_ACTION`, **1 step**) |
| `02034` | **Pumpkin Bombs** | `attachment` | `gob_encounter` | **2** | • `pumpkin_bombs_damage_response` (`FORCED_RESPONSE` / `ATTACK_RESOLVED`, **2 steps**)<br/>• `pumpkin_bombs_discard` (`HERO_ACTION`, **1 step**) |
| `02035` | **Intimidation** | `treachery` | `gob_encounter` | **2** | • `intimidation_when_revealed` (`WHEN_REVEALED` / `WHEN_REVEALED`, **1 step**)<br/>• `intimidation_boost` (`BOOST` / `BOOST`, **1 step**) |
| `02036` | **Regenerative Healing** | `treachery` | `gob_encounter` | **2** | • `regenerative_healing_when_revealed` (`WHEN_REVEALED` / `WHEN_REVEALED`, **2 steps**)<br/>• `regenerative_healing_boost` (`BOOST` / `BOOST`, **1 step**) |
| `02040` | **Tail Sweep** | `treachery` | `gob_encounter` | **2** | • `tail_sweep_when_revealed` (`WHEN_REVEALED` / `WHEN_REVEALED`, **2 steps**)<br/>• `tail_sweep_boost` (`BOOST` / `BOOST`, **1 step**) |
| `02042` | **Electro** | `minion` | `gob_encounter` | **2** | • `electro_attack_response` (`FORCED_RESPONSE` / `MINION_ATTACKED`, **2 steps**)<br/>• `electro_boost` (`BOOST` / `BOOST`, **1 step**) |
| `02043` | **Electromagnetic Pulse** | `treachery` | `gob_encounter` | **2** | • `electromagnetic_pulse_when_revealed` (`WHEN_REVEALED` / `WHEN_REVEALED`, **2 steps**)<br/>• `electromagnetic_pulse_boost` (`BOOST` / `BOOST`, **1 step**) |
| `02044` | **Lightning Bolt** | `treachery` | `gob_encounter` | **2** | • `lightning_bolt_when_revealed` (`WHEN_REVEALED` / `WHEN_REVEALED`, **2 steps**)<br/>• `lightning_bolt_boost` (`BOOST` / `BOOST`, **1 step**) |
| `02045` | **Shock Therapy** | `treachery` | `gob_encounter` | **2** | • `shock_therapy_when_revealed` (`WHEN_REVEALED` / `WHEN_REVEALED`, **2 steps**)<br/>• `shock_therapy_boost` (`BOOST` / `BOOST`, **1 step**) |
| `03024` | **Avengers Tower** | `support` | `cap` | **2** | • `avengers_tower_ally_limit` (`CONSTANT`, **1 step**)<br/>• `avengers_tower_action` (`ACTION`, **1 step**) |
| `24029` | **Cruel Intentions** | `treachery` | `hood_encounter` | **2** | • `cruel_intentions_when_revealed` (`WHEN_REVEALED` / `WHEN_REVEALED`, **2 steps**)<br/>• `cruel_intentions_boost` (`BOOST` / `BOOST`, **1 step**) |
| `24032` | **Slug It Out** | `treachery` | `hood_encounter` | **2** | • `slug_it_out_when_revealed` (`WHEN_REVEALED` / `WHEN_REVEALED`, **2 steps**)<br/>• `slug_it_out_boost` (`BOOST` / `BOOST`, **2 steps**) |
| `24050` | **Dark Dealings** | `treachery` | `hood_encounter` | **2** | • `dark_dealings_when_revealed` (`WHEN_REVEALED` / `WHEN_REVEALED`, **1 step**)<br/>• `dark_dealings_boost` (`BOOST` / `BOOST`, **1 step**) |
| `24052` | **Overwhelming Force** | `treachery` | `hood_encounter` | **2** | • `overwhelming_force_when_revealed` (`WHEN_REVEALED` / `WHEN_REVEALED`, **1 step**)<br/>• `overwhelming_force_boost` (`BOOST` / `BOOST`, **1 step**) |
| `24054` | **Total Annihilation** | `treachery` | `hood_encounter` | **2** | • `total_annihilation_when_revealed` (`WHEN_REVEALED` / `WHEN_REVEALED`, **2 steps**)<br/>• `total_annihilation_boost` (`BOOST` / `BOOST`, **1 step**) |
| `45076` | **Dark Designs** | `treachery` | `aoa_encounter` | **2** | • `dark_designs_when_revealed` (`WHEN_REVEALED` / `WHEN_REVEALED`, **2 steps**)<br/>• `dark_designs_boost` (`BOOST` / `BOOST`, **1 step**) |
| `45078` | **Evil Alliance** | `treachery` | `aoa_encounter` | **2** | • `evil_alliance_when_revealed` (`WHEN_REVEALED` / `WHEN_REVEALED`, **2 steps**)<br/>• `evil_alliance_boost` (`BOOST` / `BOOST`, **1 step**) |
| `45079` | **Nowhere is Safe** | `treachery` | `aoa_encounter` | **2** | • `nowhere_is_safe_when_revealed` (`WHEN_REVEALED` / `WHEN_REVEALED`, **2 steps**)<br/>• `nowhere_is_safe_boost` (`BOOST` / `BOOST`, **1 step**) |
| `45080` | **Drawing Near** | `obligation` | `aoa_encounter` | **2** | • `drawing_near_turn_begins` (`FORCED_RESPONSE` / `PLAYER_TURN_BEGAN`, **2 steps**)<br/>• `drawing_near_action` (`ALTER_EGO_ACTION`, **1 step**) |
| `45109` | **The Fittest** | `attachment` | `aoa_encounter` | **2** | • `the_fittest_hit_points` (`CONSTANT`, **1 step**)<br/>• `the_fittest_tough` (`FORCED_RESPONSE` / `WHEN_REVEALED`, **1 step**) |

## 2. Multi-Step Execution Pipelines (2+ Steps — 68 Pipelines Across 67 Cards)

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
| `01122` | **Klaw's Vengeance (treachery)** | `core_encounter` | `klaws_vengeance_when_revealed` | `WHEN_REVEALED` | **3** | `[1] DISCARD ➔ [2] VILLAIN_ATTACKS ➔ [3] ADD_THREAT` |
| `01124` | **Sound Manipulation (treachery)** | `core_encounter` | `sound_manipulation_when_revealed` | `WHEN_REVEALED` | **4** | `[1] HEAL_DAMAGE ➔ [2] SURGE ➔ [3] DEAL_DAMAGE ➔ [4] HEAL_DAMAGE` |
| `01133` | **Masters of Mayhem (treachery)** | `core_encounter` | `masters_of_mayhem_when_revealed` | `WHEN_REVEALED` | **2** | `[1] ENEMY_ATTACKS ➔ [2] SEARCH` |
| `01135` | **Ultron (villain)** | `core_encounter` | `ultron_ii_when_attacks` | `FORCED_INTERRUPT` | **2** | `[1] EXECUTE_SPECIAL ➔ [2] MODIFY_STAT` |
| `01136` | **Ultron (villain)** | `core_encounter` | `ultron_iii_drones` | `CONSTANT` | **3** | `[1] MODIFY_STAT ➔ [2] MODIFY_MAX_HEALTH ➔ [3] CANNOT_TAKE_DAMAGE` |
| `01142` | **Upgraded Drones (attachment)** | `core_encounter` | `upgraded_drones_constant` | `CONSTANT` | **2** | `[1] MODIFY_STAT ➔ [2] MODIFY_MAX_HEALTH` |
| `01145` | **Rage of Ultron (treachery)** | `core_encounter` | `rage_of_ultron_when_revealed` | `WHEN_REVEALED` | **4** | `[1] VILLAIN_SCHEMES ➔ [2] DISCARD ➔ [3] VILLAIN_ATTACKS ➔ [4] DISCARD` |
| `01146` | **Repair Sequence (treachery)** | `core_encounter` | `repair_sequence_when_revealed` | `WHEN_REVEALED` | **2** | `[1] HEAL_DAMAGE ➔ [2] SURGE` |
| `01147` | **Swarm Attack (treachery)** | `core_encounter` | `swarm_attack_when_revealed` | `WHEN_REVEALED` | **2** | `[1] ENEMY_ATTACKS ➔ [2] EXECUTE_SPECIAL` |
| `01148` | **Drone Factory (side_scheme)** | `core_encounter` | `drone_factory_when_revealed` | `WHEN_REVEALED` | **2** | `[1] EXECUTE_SPECIAL ➔ [2] ADD_THREAT` |
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
| `01180` | **Legions of Hydra (side_scheme)** | `core_encounter` | `legions_of_hydra_when_revealed` | `WHEN_REVEALED` | **2** | `[1] SEARCH ➔ [2] ADD_THREAT` |
| `01185` | **Biomechanical Upgrades (attachment)** | `core_encounter` | `biomechanical_upgrades_defeat_replacement` | `FORCED_INTERRUPT` | **2** | `[1] HEAL_DAMAGE ➔ [2] DISCARD` |
| `01187` | **Assault (treachery)** | `core_encounter` | `assault_when_revealed` | `WHEN_REVEALED` | **2** | `[1] VILLAIN_ATTACKS ➔ [2] SURGE` |
| `01189` | **Gang-Up (treachery)** | `core_encounter` | `gang_up_when_revealed` | `WHEN_REVEALED` | **2** | `[1] VILLAIN_AND_ENGAGED_MINIONS_ATTACK ➔ [2] SURGE` |
| `01190` | **Shadow of the Past (treachery)** | `core_encounter` | `shadow_of_the_past_when_revealed` | `WHEN_REVEALED` | **4** | `[1] PUT_INTO_PLAY ➔ [2] PUT_INTO_PLAY ➔ [3] SHUFFLE_INTO_DECK ➔ [4] SURGE` |
| `01192` | **Masterplan (treachery)** | `core_encounter` | `masterplan_when_revealed` | `WHEN_REVEALED` | **2** | `[1] ADD_THREAT ➔ [2] DISCARD` |
| `02034` | **Pumpkin Bombs (attachment)** | `gob_encounter` | `pumpkin_bombs_damage_response` | `FORCED_RESPONSE` | **2** | `[1] DISCARD ➔ [2] DEAL_DAMAGE` |
| `02036` | **Regenerative Healing (treachery)** | `gob_encounter` | `regenerative_healing_when_revealed` | `WHEN_REVEALED` | **2** | `[1] HEAL_DAMAGE ➔ [2] SURGE` |
| `02039` | **Gang-Up (treachery)** | `gob_encounter` | `gang_up_when_revealed` | `WHEN_REVEALED` | **2** | `[1] SURGE ➔ [2] VILLAIN_AND_ENGAGED_MINIONS_ATTACK` |
| `02040` | **Tail Sweep (treachery)** | `gob_encounter` | `tail_sweep_when_revealed` | `WHEN_REVEALED` | **2** | `[1] ENEMY_ATTACKS ➔ [2] ADD_STATUS` |
| `02041` | **Power Drain (side_scheme)** | `gob_encounter` | `power_drain_when_defeated` | `FORCED_INTERRUPT` | **2** | `[1] DISCARD ➔ [2] DISCARD` |
| `02042` | **Electro (minion)** | `gob_encounter` | `electro_attack_response` | `FORCED_RESPONSE` | **2** | `[1] DISCARD ➔ [2] DEAL_DAMAGE` |
| `02043` | **Electromagnetic Pulse (treachery)** | `gob_encounter` | `electromagnetic_pulse_when_revealed` | `WHEN_REVEALED` | **2** | `[1] DISCARD ➔ [2] SURGE` |
| `02044` | **Lightning Bolt (treachery)** | `gob_encounter` | `lightning_bolt_when_revealed` | `WHEN_REVEALED` | **2** | `[1] DISCARD ➔ [2] DEAL_DAMAGE` |
| `02045` | **Shock Therapy (treachery)** | `gob_encounter` | `shock_therapy_when_revealed` | `WHEN_REVEALED` | **2** | `[1] DISCARD ➔ [2] HEAL_DAMAGE` |
| `04134` | **Master Strategist (attachment)** | `trors_encounter` | `master_strategist_forced_interrupt_activation` | `FORCED_INTERRUPT` | **2** | `[1] GIVE_ADDITIONAL_BOOST_CARD ➔ [2] DISCARD` |
| `21054` | **Eternity (event)** | `mts` | `eternity_when_revealed` | `WHEN_REVEALED` | **2** | `[1] DRAW ➔ [2] REMOVE_FROM_GAME` |
| `24029` | **Cruel Intentions (treachery)** | `hood_encounter` | `cruel_intentions_when_revealed` | `WHEN_REVEALED` | **2** | `[1] DEAL_FACEDOWN_ENCOUNTER_CARD ➔ [2] DEAL_FACEDOWN_ENCOUNTER_CARD` |
| `24030` | **Ruination (treachery)** | `hood_encounter` | `ruination_when_revealed` | `WHEN_REVEALED` | **2** | `[1] DISCARD ➔ [2] ADD_THREAT` |
| `24032` | **Slug It Out (treachery)** | `hood_encounter` | `slug_it_out_when_revealed` | `WHEN_REVEALED` | **2** | `[1] EXHAUST ➔ [2] DEAL_DAMAGE` |
| `24032` | **Slug It Out (treachery)** | `hood_encounter` | `slug_it_out_boost` | `BOOST` | **2** | `[1] DEAL_DAMAGE ➔ [2] GIVE_ADDITIONAL_BOOST_CARD` |
| `24051` | **Mob Mentality (treachery)** | `hood_encounter` | `mob_mentality_when_revealed` | `WHEN_REVEALED` | **3** | `[1] DISCARD ➔ [2] VILLAIN_AND_ENGAGED_MINIONS_ATTACK ➔ [3] SURGE` |
| `24053` | **Shadow of the Past (treachery)** | `hood_encounter` | `shadow_of_the_past_ii_when_revealed` | `WHEN_REVEALED` | **4** | `[1] PUT_INTO_PLAY ➔ [2] PUT_INTO_PLAY ➔ [3] SHUFFLE_INTO_DECK ➔ [4] SURGE` |
| `24054` | **Total Annihilation (treachery)** | `hood_encounter` | `total_annihilation_when_revealed` | `WHEN_REVEALED` | **2** | `[1] GRANT_ATTACK_KEYWORD ➔ [2] VILLAIN_ATTACKS` |
| `45075a` | **Pursued by the Past (environment)** | `aoa_encounter` | `pursued_by_the_past_threshold` | `FORCED_RESPONSE` | **3** | `[1] REMOVE_COUNTERS ➔ [2] ACTIVATE_MINIONS ➔ [3] FLIP_CARD` |
| `45075b` | **Pursued by the Past (environment)** | `aoa_encounter` | `pursued_by_the_past_flipped` | `FORCED_RESPONSE` | **4** | `[1] SEARCH ➔ [2] PUT_INTO_PLAY ➔ [3] SHUFFLE_INTO_DECK ➔ [4] FLIP_CARD` |
| `45076` | **Dark Designs (treachery)** | `aoa_encounter` | `dark_designs_when_revealed` | `WHEN_REVEALED` | **2** | `[1] ADD_COUNTERS ➔ [2] VILLAIN_SCHEMES` |
| `45077` | **Sinister Strike (treachery)** | `aoa_encounter` | `sinister_strike_when_revealed` | `WHEN_REVEALED` | **3** | `[1] ADD_COUNTERS ➔ [2] SURGE ➔ [3] VILLAIN_ATTACKS` |
| `45078` | **Evil Alliance (treachery)** | `aoa_encounter` | `evil_alliance_when_revealed` | `WHEN_REVEALED` | **2** | `[1] ACTIVATE_MINIONS ➔ [2] ADD_COUNTERS` |
| `45079` | **Nowhere is Safe (treachery)** | `aoa_encounter` | `nowhere_is_safe_when_revealed` | `WHEN_REVEALED` | **2** | `[1] ADD_COUNTERS ➔ [2] DISCARD` |
| `45080` | **Drawing Near (obligation)** | `aoa_encounter` | `drawing_near_turn_begins` | `FORCED_RESPONSE` | **2** | `[1] DISCARD ➔ [2] ADD_COUNTERS` |

[← Back to Main Usage Report](../usage_report.md)