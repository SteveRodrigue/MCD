# Supplemental Card Declarations Usage & Impact Report

> **Generated:** `2026-09-01T17:31:59.955Z`  
> **Source Packs Scanned:** `core, core_encounter`

---

## 📊 1. Executive Summary

| Metric | Count | Description |
| :--- | :--- | :--- |
| **Total Cards Registered** | **156** | Total cards present in `src/data/supplemental/` |
| **Active Declared Cards** | **146** | Cards with executable `abilities: [...]` |
| **No Supplemental Needed** | **10** | Vanilla / passive cards explicitly verified as requiring no supplemental hooks |
| **Open Ambiguity Reports** | **0** | Blocked cards isolated in `docs/ambiguities/` (Inbox Zero Queue) |
| **False-Vanilla Violations** | **0** | 🚨 Cards marked `noSupplementalNeeded` that have printed rules text |
| **Total Abilities Declared** | **167** | Total individual ability definitions declared |
| **Single-Step Abilities (1 Step)** | **162** | Abilities with exactly 1 atomic execution step |
| **Multi-Step Abilities (2+ Steps)** | **5** | Abilities decomposed into sequenced execution pipelines |
| **Cards with Multi-Step Sequences** | **5** | Cards containing at least 1 ability with 2+ steps |
| **Cards with Multiple Abilities (2+)** | **18** | Cards declaring more than 1 distinct ability header |
| **Unique Effects In Use** | **66** | Distinct effect primitive types actively declared |
| **Unique Triggers In Use** | **22** | Distinct trigger window types actively declared |
| **Unique Timings In Use** | **15** | Distinct timing categories actively declared |
| **Unique Cost Keys In Use** | **10** | Distinct ability cost types actively declared |

---

## 🔴 2. Active Ambiguity & Blocker Queue (Inbox Zero Queue — 0 Cards)

These **0 cards** are currently isolated in [`docs/ambiguities/`](../ambiguities/README.md) pending rules engine primitives, targeting extensions, or nested resolution stack implementations. As each card is integrated and reaches $\ge 95\%$ confidence, its file is deleted to achieve **Inbox Zero**:

| Card Code | Card Name | Pack | Confidence | Blocker Category | Ambiguity Report File |
| :--- | :--- | :--- | :--- | :--- | :--- |

---

## 🟢 3. Cards Explicitly Requiring No Supplemental Data (Vanilla / Passive — 10 Cards)

These **10 cards** have been audited and explicitly verified as `"noSupplementalNeeded": true` (standard double resource generators, vanilla baseline minions, basic identity cards, or schemes with no custom trigger hooks):

| Card Code | Card Name | Type | Faction / Aspect | Pack | Description / Comment |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `01014` | **Energy Absorption** | `resource` | `hero` | `core` | RESOURCE: Energy Absorption |
| `01044` | **Vibranium** | `resource` | `hero` | `core` | RESOURCE: Vibranium |
| `01088` | **Energy** | `resource` | `basic` | `core` | RESOURCE: Energy |
| `01089` | **Genius** | `resource` | `basic` | `core` | RESOURCE: Genius |
| `01090` | **Strength** | `resource` | `basic` | `core` | RESOURCE: Strength |
| `01094` | **Rhino** | `villain` | `encounter` | `core_encounter` | VILLAIN: Rhino |
| `01097a` | **The Break-In!** | `main_scheme` | `encounter` | `core_encounter` | MAIN_SCHEME: The Break-In! |
| `01097b` | **The Break-In!** | `main_scheme` | `encounter` | `core_encounter` | MAIN_SCHEME: The Break-In! |
| `01156` | **Usurp The Throne** | `side_scheme` | `encounter` | `core_encounter` | Vanilla card (no printed abilities). |
| `01167` | **Vulture** | `minion` | `encounter` | `core_encounter` | Minion: Vulture. Printed Quickstrike keyword is natively handled by engine. |

---

## 📋 4. Cards with Multiple Abilities (2+ Abilities Declared — 18 Cards)

These **18 cards** declare multiple distinct ability headers (e.g. dual Hero/Alter-Ego actions, combined Constant modifiers with triggered Actions, or multiple Response triggers):

| Card Code | Card Name | Type | Pack | Ability Count | Declared Abilities Summary |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `01007` | **Spider-Tracer** | `upgrade` | `core` | **2** | • `spider_tracer_attach` (`CARD_PLAYED`, **1 step**)<br/>• `spider_tracer_defeat_trigger` (`FORCED_INTERRUPT` / `MINION_DEFEATED`, **1 step**) |
| `01009` | **Webbed Up** | `upgrade` | `core` | **2** | • `webbed_up_attach` (`CARD_PLAYED`, **1 step**)<br/>• `webbed_up_intercept` (`FORCED_INTERRUPT` / `VILLAIN_INITIATES_ATTACK`, **1 step**) |
| `01017` | **Cosmic Flight** | `upgrade` | `core` | **2** | • `cosmic_flight_aerial` (`CONSTANT`, **1 step**)<br/>• `cosmic_flight_prevent` (`HERO_INTERRUPT` / `TAKE_DAMAGE`, **1 step**) |
| `01018` | **Energy Channel** | `upgrade` | `core` | **2** | • `energy_channel_add` (`ACTION`, **1 step**)<br/>• `energy_channel_blast` (`HERO_ACTION`, **1 step**) |
| `01028` | **Superhuman Strength** | `upgrade` | `core` | **2** | • `superhuman_strength_atk` (`CONSTANT`, **1 step**)<br/>• `superhuman_strength_stun` (`FORCED_RESPONSE` / `ATTACK_RESOLVED`, **1 step**) |
| `01039` | **Rocket Boots** | `upgrade` | `core` | **2** | • `rocket_boots_hp` (`CONSTANT`, **1 step**)<br/>• `rocket_boots_aerial` (`HERO_ACTION`, **1 step**) |
| `01074` | **Inspired** | `upgrade` | `core` | **3** | • `inspired_attach` (`CARD_PLAYED`, **1 step**)<br/>• `inspired_thw_bonus` (`CONSTANT`, **1 step**)<br/>• `inspired_atk_bonus` (`CONSTANT`, **1 step**) |
| `01084` | **Nick Fury** | `ally` | `core` | **2** | • `nick_fury_enters_play` (`CARD_PLAYED` / `CARD_PLAYED`, **1 step**)<br/>• `nick_fury_round_end_discard` (`FORCED_RESPONSE` / `ROUND_END`, **1 step**) |
| `01096` | **Rhino** | `villain` | `core_encounter` | **2** | • `rhino_stage_iii_when_revealed` (`WHEN_REVEALED` / `WHEN_REVEALED`, **1 step**)<br/>• `rhino_stage_iii_tough` (`SETUP`, **1 step**) |
| `01098` | **Armored Rhino Suit** | `attachment` | `core_encounter` | **2** | • `armored_rhino_suit_attach` (`WHEN_REVEALED` / `WHEN_REVEALED`, **1 step**)<br/>• `armored_rhino_suit_shield` (`FORCED_INTERRUPT` / `TAKE_ATTACK_DAMAGE`, **1 step**) |
| `01099` | **Charge** | `attachment` | `core_encounter` | **3** | • `charge_attach` (`WHEN_REVEALED` / `WHEN_REVEALED`, **1 step**)<br/>• `charge_atk_bonus` (`CONSTANT`, **1 step**)<br/>• `charge_overkill` (`CONSTANT`, **1 step**) |
| `01100` | **Enhanced Ivory Horn** | `attachment` | `core_encounter` | **3** | • `ivory_horn_attach` (`WHEN_REVEALED` / `WHEN_REVEALED`, **1 step**)<br/>• `ivory_horn_atk_bonus` (`CONSTANT`, **1 step**)<br/>• `ivory_horn_discard_action` (`ACTION`, **1 step**) |
| `01102` | **Sandman** | `minion` | `core_encounter` | **2** | • `sandman_toughness` (`SETUP`, **1 step**)<br/>• `sandman_attack_discard` (`FORCED_RESPONSE` / `MINION_ATTACKED`, **1 step**) |
| `01164` | **Titania's Fury** | `treachery` | `core_encounter` | **2** | • `titanias_fury` (`FORCED_RESPONSE` / `WHEN_REVEALED`, **1 step**)<br/>• `titanias_fury_boost` (`BOOST` / `BOOST`, **1 step**) |
| `01166` | **Highway Robbery** | `side_scheme` | `core_encounter` | **2** | • `highway_robbery_when_revealed` (`WHEN_REVEALED`, **1 step**)<br/>• `highway_robbery_when_defeated` (`FORCED_RESPONSE` / `DEFEATED`, **1 step**) |
| `01168` | **Sweeping Swoop** | `treachery` | `core_encounter` | **2** | • `sweeping_swoop` (`FORCED_RESPONSE` / `WHEN_REVEALED`, **1 step**)<br/>• `sweeping_swoop_boost` (`BOOST` / `BOOST`, **1 step**) |
| `01173` | **Electric Whip Attack** | `treachery` | `core_encounter` | **2** | • `electric_whip_attack` (`CONSTANT`, **1 step**)<br/>• `electric_whip_attack_boost` (`BOOST` / `BOOST`, **1 step**) |
| `01178` | **Kree Manipulator** | `treachery` | `core_encounter` | **2** | • `kree_manipulator_when_revealed` (`WHEN_REVEALED` / `WHEN_REVEALED`, **1 step**)<br/>• `kree_manipulator_boost` (`BOOST` / `BOOST_STAR_RESOLVED`, **1 step**) |

---

## 💥 5. High-Impact Primitives (Blast-Radius $\ge 5$ Cards)

Changing these primitives will affect many cards across the entire game engine:

| Category | Primitive Name | Card Count | Example Cards |
| :--- | :--- | :--- | :--- |
| **Effect** | `DEAL_DAMAGE` | **23** | `01005` Swinging Web Kick (event), `01013` Photonic Blast (event), `01018` Energy Channel (upgrade) *(+20 more)* |
| **Effect** | `ADD_STATUS` | **16** | `01011` Spider-Woman (ally), `01028` Superhuman Strength (upgrade), `01076` Luke Cage (ally) *(+12 more)* |
| **Effect** | `REMOVE_THREAT` | **11** | `01012` Crisis Interdiction (event), `01019b` Jennifer Walters (alter_ego), `01023` Legal Practice (event) *(+8 more)* |
| **Effect** | `MODIFY_STAT` | **11** | `01016` Captain Marvel's Helmet (upgrade), `01028` Superhuman Strength (upgrade), `01057` Combat Training (upgrade) *(+7 more)* |
| **Effect** | `DRAW_CARDS` | **7** | `01001a` Spider-Man (hero), `01010b` Carol Danvers (alter_ego), `01015` Alpha Flight Station (support) *(+4 more)* |
| **Effect** | `HEAL_DAMAGE` | **7** | `01006` Aunt May (support), `01010a` Captain Marvel (hero), `01051` Tigra (ally) *(+4 more)* |
| **Effect** | `DISCARD_SELF` | **7** | `01084` Nick Fury (ally), `01155` Affairs of State (obligation), `01160` Legal Work (obligation) *(+4 more)* |
| **Effect** | `ATTACH_TO_HOST` | **6** | `01007` Spider-Tracer (upgrade), `01009` Webbed Up (upgrade), `01074` Inspired (upgrade) *(+3 more)* |
| **Effect** | `ADD_THREAT_PER_PLAYER` | **5** | `01107` Breakin' & Takin' (side_scheme), `01109` Bomb Scare (side_scheme), `01161` Personal Challenge (side_scheme) *(+2 more)* |
| **Trigger** | `WHEN_REVEALED` | **46** | `01004` Enhanced Spider-Sense (event), `01095` Rhino (villain), `01096` Rhino (villain) *(+43 more)* |
| **Trigger** | `CARD_PLAYED` | **6** | `01002` Black Cat (ally), `01011` Spider-Woman (ally), `01041` Shuri (ally) *(+3 more)* |

---

## 🔍 6. Single-Use & Unique Primitives (Card Count = 1)

These primitives are only declared on a single card. They represent high specialization and are prime candidates for decomposition into composable generic primitives:

| Category | Primitive Name | Card Code | Card Name & Pack | Ability ID |
| :--- | :--- | :--- | :--- | :--- |
| **Effect** | `ADD_COUNTERS` | `01018` | Energy Channel (upgrade) (core) | `energy_channel_add` |
| **Effect** | `ADD_TRAIT` | `01017` | Cosmic Flight (upgrade) (core) | `cosmic_flight_aerial` |
| **Effect** | `ATTACH_FACEDOWN_CARDS_FROM_HAND` | `01166` | Highway Robbery (side_scheme) (core_encounter) | `highway_robbery_when_revealed` |
| **Effect** | `ATTACHMENT_DAMAGE_SHIELD` | `01098` | Armored Rhino Suit (attachment) (core_encounter) | `armored_rhino_suit_shield` |
| **Effect** | `BOOST_STAT_CHOICE` | `01068` | Vision (ally) (core) | `vision_boost` |
| **Effect** | `BUFF_ALL_FRIENDLY_CHARACTERS` | `01070` | Lead from the Front (event) (core) | `lead_from_the_front_action` |
| **Effect** | `CANCEL_WHEN_REVEALED` | `01004` | Enhanced Spider-Sense (event) (core) | `enhanced_spider_sense` |
| **Effect** | `CANCEL_WHEN_REVEALED_AND_ATTACK` | `01078` | Get Behind Me! (event) (core) | `get_behind_me_interrupt` |
| **Effect** | `CANCEL_WHEN_REVEALED_AND_REVEAL_ANOTHER` | `01075` | Black Widow (ally) (core) | `black_widow_cancel` |
| **Effect** | `DEAL_DAMAGE_ALL_ENEMIES` | `01046` | Energy Daggers (upgrade) (core) | `energy_daggers_special` |
| **Effect** | `DISCARD_ATTACHMENT` | `01100` | Enhanced Ivory Horn (attachment) (core_encounter) | `ivory_horn_discard_action` |
| **Effect** | `DISCARD_ENCOUNTER_DECK` | `01102` | Sandman (minion) (core_encounter) | `sandman_attack_discard` |
| **Effect** | `DISCARD_TOP_DECK_FILTER` | `01002` | Black Cat (ally) (core) | `black_cat_when_played` |
| **Effect** | `DISCARD_UPGRADE_OR_SUPPORT` | `01173` | Electric Whip Attack (treachery) (core_encounter) | `electric_whip_attack_boost` |
| **Effect** | `DISCARD_UPGRADE_OR_SUPPORT_OR_SURGE` | `01188` | Caught Off Guard (treachery) (core_encounter) | `caught_off_guard_when_revealed` |
| **Effect** | `DRAW_UP_TO_HAND_SIZE` | `01025` | Split Personality (event) (core) | `split_personality` |
| **Effect** | `EXPLOSION` | `01111` | Explosion (treachery) (core_encounter) | `explosion_when_revealed` |
| **Effect** | `FLIP_FORM` | `01025` | Split Personality (event) (core) | `split_personality` |
| **Effect** | `FORM_BRANCH_VILLAIN_ATTACK_OR_SURGE` | `01106` | Stampede (treachery) (core_encounter) | `stampede_attack` |
| **Effect** | `GENERATE_TOP_DISCARD_RESOURCES` | `01033` | Pepper Potts (support) (core) | `pepper_potts_res` |
| **Effect** | `GIVE_ADDITIONAL_BOOST_CARD` | `01164` | Titania's Fury (treachery) (core_encounter) | `titanias_fury_boost` |
| **Effect** | `GIVE_STATUS` | `01102` | Sandman (minion) (core_encounter) | `sandman_toughness` |
| **Effect** | `HULK_DISCARD_RESOLUTION` | `01050` | Hulk (ally) (core) | `hulk_after_attack` |
| **Effect** | `INTERCEPT_ATTACK` | `01009` | Webbed Up (upgrade) (core) | `webbed_up_intercept` |
| **Effect** | `MODIFY_ALLY_LIMIT` | `01073` | The Triskelion (support) (core) | `triskelion_ally_limit` |
| **Effect** | `MODIFY_HAND_SIZE` | `01029a` | Iron Man (hero) (core) | `iron_man_hand_size` |
| **Effect** | `PLACE_THREAT_PER_SIDE_SCHEME` | `01192` | Masterplan (treachery) (core_encounter) | `masterplan_when_revealed` |
| **Effect** | `PLAY_ALLY_FROM_DISCARD` | `01071` | Make the Call (event) (core) | `make_the_call` |
| **Effect** | `REDUCE_NEXT_CARD_COST` | `01092` | Helicarrier (support) (core) | `helicarrier_action` |
| **Effect** | `REPULSOR_BLAST` | `01031` | Repulsor Blast (event) (core) | `repulsor_blast_action` |
| **Effect** | `RETRIEVE_TECH_UPGRADE_FROM_DISCARD` | `01034` | Stark Tower (support) (core) | `stark_tower_retrieve` |
| **Effect** | `RETURN_FACEDOWN_CARDS_TO_OWNERS` | `01166` | Highway Robbery (side_scheme) (core_encounter) | `highway_robbery_when_defeated` |
| **Effect** | `RETURN_TO_HAND` | `01020` | Hellcat (ally) (core) | `hellcat_return` |
| **Effect** | `REVEAL_ENCOUNTER_CARD` | `01193` | Under Fire (treachery) (core_encounter) | `under_fire_when_revealed` |
| **Effect** | `SEARCH_AND_REVEAL_SIDE_SCHEME` | `01095` | Rhino (villain) (core_encounter) | `rhino_stage_ii_when_revealed` |
| **Effect** | `SHUFFLE_DISCARD_INTO_DECK` | `01042` | Ancestral Knowledge (event) (core) | `ancestral_knowledge_action` |
| **Effect** | `SHUFFLE_INTO_DECK` | `01190` | Shadow of the Past (treachery) (core_encounter) | `shadow_of_the_past_when_revealed` |
| **Effect** | `TAKE_THREAT_AS_DAMAGE` | `01061` | Great Responsibility (event) (core) | `great_responsibility_interrupt` |
| **Effect** | `TRANSFER_DAMAGE` | `01049` | Vibranium Suit (upgrade) (core) | `vibranium_suit_special` |
| **Effect** | `VILLAIN_AND_ENGAGED_MINIONS_ATTACK` | `01189` | Gang-Up (treachery) (core_encounter) | `gang_up_when_revealed` |
| **Effect** | `VILLAIN_ATTACKS` | `01187` | Assault (treachery) (core_encounter) | `assault_when_revealed` |
| **Effect** | `VILLAIN_SCHEMES` | `01186` | Advance (treachery) (core_encounter) | `advance_when_revealed` |
| **Effect** | `WHEN_ATTACHED_HOST_DEFEATED` | `01007` | Spider-Tracer (upgrade) (core) | `spider_tracer_defeat_trigger` |
| **Effect** | `WHEN_REVEALED_THREAT_PER_PLAYER` | `01108` | Crowd Control (side_scheme) (core_encounter) | `crowd_control_when_revealed` |
| **Trigger** | `ATTACK` | `01050` | Hulk (ally) (core) | `hulk_after_attack` |
| **Trigger** | `ATTACK_RESOLVED` | `01028` | Superhuman Strength (upgrade) (core) | `superhuman_strength_stun` |
| **Trigger** | `BASIC_ATTACK_PERFORMED` | `01024` | One-Two Punch (event) (core) | `one_two_punch_response` |
| **Trigger** | `BOOST_STAR_RESOLVED` | `01178` | Kree Manipulator (treachery) (core_encounter) | `kree_manipulator_boost` |
| **Trigger** | `DEFEATED` | `01166` | Highway Robbery (side_scheme) (core_encounter) | `highway_robbery_when_defeated` |
| **Trigger** | `ENEMY_DEFEATED_BY_HERO_ATTACK` | `01052` | Chase Them Down (event) (core) | `chase_them_down` |
| **Trigger** | `FORM_CHANGED_TO_HERO` | `01019a` | She-Hulk (hero) (core) | `she_hulk_form_change` |
| **Trigger** | `MINION_ATTACKED` | `01102` | Sandman (minion) (core_encounter) | `sandman_attack_discard` |
| **Trigger** | `MINION_DEFEATED_BY_ATTACK` | `01051` | Tigra (ally) (core) | `tigra_defeat_heal` |
| **Trigger** | `MINION_ENTERS_PLAY` | `01066` | Hawkeye (ally) (core) | `hawkeye_arrow_response` |
| **Trigger** | `ROUND_END` | `01084` | Nick Fury (ally) (core) | `nick_fury_round_end_discard` |
| **Trigger** | `TAKE_DAMAGE` | `01017` | Cosmic Flight (upgrade) (core) | `cosmic_flight_prevent` |
| **Trigger** | `THWART_RESOLVED` | `01058` | Daredevil (ally) (core) | `daredevil_after_thwart` |

---

## ⚠️ 7. Zero-Usage / Unused Primitives (In Specifications but 0 Card Declarations)

These primitives are declared in schema types or specifications but have **0 active card declarations** in supplemental data packs:

| Category | Specified Primitive | Status | Notes |
| :--- | :--- | :--- | :--- |
| **Effect** | `APPLY_STATUS` | 🟡 `0 Cards` | Documented in `docs/specifications/supplemental/` but has 0 card declarations. |
| **Effect** | `CHANGE_FORM_DRAW_TO_HAND_SIZE` | 🟡 `0 Cards` | Documented in `docs/specifications/supplemental/` but has 0 card declarations. |
| **Effect** | `DEAL_DAMAGE_SPLIT` | 🟡 `0 Cards` | Documented in `docs/specifications/supplemental/` but has 0 card declarations. |
| **Effect** | `DOUBLE_RESOURCE` | 🟡 `0 Cards` | Documented in `docs/specifications/supplemental/` but has 0 card declarations. |
| **Effect** | `PLACE_THREAT` | 🟡 `0 Cards` | Documented in `docs/specifications/supplemental/` but has 0 card declarations. |
| **Effect** | `PLAY_FROM_ZONE` | 🟡 `0 Cards` | Documented in `docs/specifications/supplemental/` but has 0 card declarations. |
| **Effect** | `RESOURCE_GENERATION` | 🟡 `0 Cards` | Documented in `docs/specifications/supplemental/` but has 0 card declarations. |
| **Effect** | `RETALIATE` | 🟡 `0 Cards` | Documented in `docs/specifications/supplemental/` but has 0 card declarations. |
| **Effect** | `SCRY_AND_SELECT_TRAIT` | 🟡 `0 Cards` | Documented in `docs/specifications/supplemental/` but has 0 card declarations. |
| **Effect** | `SPAWN_NEMESIS` | 🟡 `0 Cards` | Documented in `docs/specifications/supplemental/` but has 0 card declarations. |
| **Effect** | `TOUGHNESS` | 🟡 `0 Cards` | Documented in `docs/specifications/supplemental/` but has 0 card declarations. |
| **Trigger** | `ATTACHED_ENEMY_ATTACKS` | 🟡 `0 Cards` | Defined in `TriggerTypeSchema` but has 0 card declarations. |
| **Trigger** | `ATTACHED_MINION_DEFEATED` | 🟡 `0 Cards` | Defined in `TriggerTypeSchema` but has 0 card declarations. |
| **Trigger** | `DAMAGE_TAKEN` | 🟡 `0 Cards` | Defined in `TriggerTypeSchema` but has 0 card declarations. |
| **Trigger** | `FORM_CHANGED_TO_ALTER_EGO` | 🟡 `0 Cards` | Defined in `TriggerTypeSchema` but has 0 card declarations. |
| **Trigger** | `HERO_FLIPPED` | 🟡 `0 Cards` | Defined in `TriggerTypeSchema` but has 0 card declarations. |
| **Trigger** | `MAIN_SCHEME_ADVANCED` | 🟡 `0 Cards` | Defined in `TriggerTypeSchema` but has 0 card declarations. |
| **Trigger** | `PHASE_START` | 🟡 `0 Cards` | Defined in `TriggerTypeSchema` but has 0 card declarations. |
| **Trigger** | `PLAYED` | 🟡 `0 Cards` | Defined in `TriggerTypeSchema` but has 0 card declarations. |
| **Trigger** | `PLAYER_PHASE_BEGAN` | 🟡 `0 Cards` | Defined in `TriggerTypeSchema` but has 0 card declarations. |
| **Trigger** | `PLAYER_PHASE_ENDED` | 🟡 `0 Cards` | Defined in `TriggerTypeSchema` but has 0 card declarations. |
| **Trigger** | `RESOURCE_SPENT` | 🟡 `0 Cards` | Defined in `TriggerTypeSchema` but has 0 card declarations. |
| **Trigger** | `ROUND_BEGAN` | 🟡 `0 Cards` | Defined in `TriggerTypeSchema` but has 0 card declarations. |
| **Trigger** | `ROUND_ENDED` | 🟡 `0 Cards` | Defined in `TriggerTypeSchema` but has 0 card declarations. |
| **Trigger** | `THREAT_PLACED` | 🟡 `0 Cards` | Defined in `TriggerTypeSchema` but has 0 card declarations. |
| **Trigger** | `VILLAIN_PHASE_BEGAN` | 🟡 `0 Cards` | Defined in `TriggerTypeSchema` but has 0 card declarations. |
| **Trigger** | `VILLAIN_PHASE_ENDED` | 🟡 `0 Cards` | Defined in `TriggerTypeSchema` but has 0 card declarations. |

---

## 📑 8. Complete Effects Inventory

| Effect Primitive | Occurrences | Declaring Cards |
| :--- | :--- | :--- |
| `DEAL_DAMAGE` | **23** | `01005` (Swinging Web Kick (event)), `01013` (Photonic Blast (event)), `01018` (Energy Channel (upgrade)), `01019a` (She-Hulk (hero)), `01021` (Gamma Slam (event)), `01022` (Ground Stomp (event)), `01030` (War Machine (ally)), `01032` (Supersonic Punch (event)), `01038` (Powered Gauntlets (upgrade)), `01047` (Panther Claws (upgrade)), `01053` (Relentless Assault (event)), `01054` (Uppercut (event)), `01056` (Tac Team (support)), `01058` (Daredevil (ally)), `01066` (Hawkeye (ally)), `01077` (Counter-Punch (event)), `01087` (Haymaker (event)), `01103` (Shocker (minion)), `01159` (Ritual Combat (treachery)), `01164` (Titania's Fury (treachery)), `01168` (Sweeping Swoop (treachery)), `01174` (Electromagnetic Backlash (treachery)), `01179` (Yon-Rogg's Treason (treachery)) |
| `ADD_STATUS` | **16** | `01011` (Spider-Woman (ally)), `01028` (Superhuman Strength (upgrade)), `01076` (Luke Cage (ally)), `01083` (Mockingbird (ally)), `01096` (Rhino (villain)), `01105` ("I'm Tough" (treachery)), `01112` (False Alarm (treachery)), `01157` (Killmonger (minion)), `01162` (Titania (minion)), `01163` (Genetically Enhanced (attachment)), `01168` (Sweeping Swoop (treachery)), `01169` (The Vulture's Plans (treachery)), `01172` (Whiplash (minion)), `01177` (Yon-Rogg (minion)), `01194` (Unknown Card #01194) |
| `REMOVE_THREAT` | **11** | `01012` (Crisis Interdiction (event)), `01019b` (Jennifer Walters (alter_ego)), `01023` (Legal Practice (event)), `01026` (Superhuman Law Division (support)), `01037` (Mark V Helmet (upgrade)), `01048` (Tactical Genius (upgrade)), `01052` (Chase Them Down (event)), `01060` (For Justice! (event)), `01063` (Interrogation Room (support)), `01064` (Surveillance Team (support)), `01085` (Emergency (event)) |
| `MODIFY_STAT` | **11** | `01016` (Captain Marvel's Helmet (upgrade)), `01028` (Superhuman Strength (upgrade)), `01057` (Combat Training (upgrade)), `01059` (Jessica Jones (ally)), `01065` (Heroic Intuition (upgrade)), `01074` (Inspired (upgrade)), `01081` (Armored Vest (upgrade)), `01099` (Charge (attachment)), `01100` (Enhanced Ivory Horn (attachment)), `01173` (Electric Whip Attack (treachery)) |
| `DRAW_CARDS` | **7** | `01001a` (Spider-Man (hero)), `01010b` (Carol Danvers (alter_ego)), `01015` (Alpha Flight Station (support)), `01027` (Focused Rage (upgrade)), `01045` (The Golden City (support)), `01067` (Maria Hill (ally)), `01091` (Avengers Mansion (support)) |
| `HEAL_DAMAGE` | **7** | `01006` (Aunt May (support)), `01010a` (Captain Marvel (hero)), `01051` (Tigra (ally)), `01080` (Med Team (support)), `01086` (First Aid (event)), `01104` (Hard to Keep Down (treachery)), `01158` (Heart-Shaped Herb (treachery)) |
| `DISCARD_SELF` | **7** | `01084` (Nick Fury (ally)), `01155` (Affairs of State (obligation)), `01160` (Legal Work (obligation)), `01165` (Eviction Notice (obligation)), `01170` (Business Problems (obligation)), `01175` (Family Emergency (obligation)), `01195` (Unknown Card #01195) |
| `ATTACH_TO_HOST` | **6** | `01007` (Spider-Tracer (upgrade)), `01009` (Webbed Up (upgrade)), `01074` (Inspired (upgrade)), `01098` (Armored Rhino Suit (attachment)), `01099` (Charge (attachment)), `01100` (Enhanced Ivory Horn (attachment)) |
| `ADD_THREAT_PER_PLAYER` | **5** | `01107` (Breakin' & Takin' (side_scheme)), `01109` (Bomb Scare (side_scheme)), `01161` (Personal Challenge (side_scheme)), `01171` (Imminent Overload (side_scheme)), `01176` (The Psyche-Magnitron (side_scheme)) |
| `GRANT_KEYWORD` | **4** | `01039` (Rocket Boots (upgrade)), `01040a` (Black Panther (hero)), `01099` (Charge (attachment)), `01101` (Hydra Mercenary (minion)) |
| `EXECUTE_WAKANDA_FOREVER` | **4** | `01043a` (Wakanda Forever! (event)), `01043b` (Wakanda Forever! (event)), `01043c` (Wakanda Forever! (event)), `01043d` (Wakanda Forever! (event)) |
| `DOUBLE_RESOURCE_FOR_ASPECT` | **4** | `01055` (The Power of Aggression (resource)), `01062` (The Power of Justice (resource)), `01072` (The Power of Leadership (resource)), `01079` (The Power of Protection (resource)) |
| `TRIGGER_SURGE` | **4** | `01104` (Hard to Keep Down (treachery)), `01105` ("I'm Tough" (treachery)), `01190` (Shadow of the Past (treachery)), `01193` (Under Fire (treachery)) |
| `READY_IDENTITY` | **3** | `01024` (One-Two Punch (event)), `01035` (Arc Reactor (upgrade)), `01093` (Tenacity (upgrade)) |
| `SEARCH_AND_SELECT` | **3** | `01029b` (Tony Stark (alter_ego)), `01040b` (T'Challa (alter_ego)), `01041` (Shuri (ally)) |
| `PLAYER_CHOICE` | **3** | `01084` (Nick Fury (ally)), `01110` (Hydra Bomber (minion)), `01191` (Exhaustion (treachery)) |
| `GENERATE_RESOURCE` | **2** | `01001b` (Peter Parker (alter_ego)), `01008` (Web-Shooter (upgrade)) |
| `PREVENT_DAMAGE` | **2** | `01003` (Backflip (event)), `01017` (Cosmic Flight (upgrade)) |
| `MODIFY_MAX_HEALTH` | **2** | `01036` (Mark V Armor (upgrade)), `01039` (Rocket Boots (upgrade)) |
| `READY_CHARACTER` | **2** | `01069` (Get Ready (event)), `01082` (Indomitable (upgrade)) |
| `ADD_THREAT` | **2** | `01178` (Kree Manipulator (treachery)) |
| `PUT_INTO_PLAY` | **2** | `01190` (Shadow of the Past (treachery)) |
| `DISCARD_TOP_DECK_FILTER` | **1** | `01002` (Black Cat (ally)) |
| `CANCEL_WHEN_REVEALED` | **1** | `01004` (Enhanced Spider-Sense (event)) |
| `WHEN_ATTACHED_HOST_DEFEATED` | **1** | `01007` (Spider-Tracer (upgrade)) |
| `INTERCEPT_ATTACK` | **1** | `01009` (Webbed Up (upgrade)) |
| `ADD_TRAIT` | **1** | `01017` (Cosmic Flight (upgrade)) |
| `ADD_COUNTERS` | **1** | `01018` (Energy Channel (upgrade)) |
| `RETURN_TO_HAND` | **1** | `01020` (Hellcat (ally)) |
| `FLIP_FORM` | **1** | `01025` (Split Personality (event)) |
| `DRAW_UP_TO_HAND_SIZE` | **1** | `01025` (Split Personality (event)) |
| `MODIFY_HAND_SIZE` | **1** | `01029a` (Iron Man (hero)) |
| `REPULSOR_BLAST` | **1** | `01031` (Repulsor Blast (event)) |
| `GENERATE_TOP_DISCARD_RESOURCES` | **1** | `01033` (Pepper Potts (support)) |
| `RETRIEVE_TECH_UPGRADE_FROM_DISCARD` | **1** | `01034` (Stark Tower (support)) |
| `SHUFFLE_DISCARD_INTO_DECK` | **1** | `01042` (Ancestral Knowledge (event)) |
| `DEAL_DAMAGE_ALL_ENEMIES` | **1** | `01046` (Energy Daggers (upgrade)) |
| `TRANSFER_DAMAGE` | **1** | `01049` (Vibranium Suit (upgrade)) |
| `HULK_DISCARD_RESOLUTION` | **1** | `01050` (Hulk (ally)) |
| `TAKE_THREAT_AS_DAMAGE` | **1** | `01061` (Great Responsibility (event)) |
| `BOOST_STAT_CHOICE` | **1** | `01068` (Vision (ally)) |
| `BUFF_ALL_FRIENDLY_CHARACTERS` | **1** | `01070` (Lead from the Front (event)) |
| `PLAY_ALLY_FROM_DISCARD` | **1** | `01071` (Make the Call (event)) |
| `MODIFY_ALLY_LIMIT` | **1** | `01073` (The Triskelion (support)) |
| `CANCEL_WHEN_REVEALED_AND_REVEAL_ANOTHER` | **1** | `01075` (Black Widow (ally)) |
| `CANCEL_WHEN_REVEALED_AND_ATTACK` | **1** | `01078` (Get Behind Me! (event)) |
| `REDUCE_NEXT_CARD_COST` | **1** | `01092` (Helicarrier (support)) |
| `SEARCH_AND_REVEAL_SIDE_SCHEME` | **1** | `01095` (Rhino (villain)) |
| `ATTACHMENT_DAMAGE_SHIELD` | **1** | `01098` (Armored Rhino Suit (attachment)) |
| `DISCARD_ATTACHMENT` | **1** | `01100` (Enhanced Ivory Horn (attachment)) |
| `GIVE_STATUS` | **1** | `01102` (Sandman (minion)) |
| `DISCARD_ENCOUNTER_DECK` | **1** | `01102` (Sandman (minion)) |
| `FORM_BRANCH_VILLAIN_ATTACK_OR_SURGE` | **1** | `01106` (Stampede (treachery)) |
| `WHEN_REVEALED_THREAT_PER_PLAYER` | **1** | `01108` (Crowd Control (side_scheme)) |
| `EXPLOSION` | **1** | `01111` (Explosion (treachery)) |
| `GIVE_ADDITIONAL_BOOST_CARD` | **1** | `01164` (Titania's Fury (treachery)) |
| `ATTACH_FACEDOWN_CARDS_FROM_HAND` | **1** | `01166` (Highway Robbery (side_scheme)) |
| `RETURN_FACEDOWN_CARDS_TO_OWNERS` | **1** | `01166` (Highway Robbery (side_scheme)) |
| `DISCARD_UPGRADE_OR_SUPPORT` | **1** | `01173` (Electric Whip Attack (treachery)) |
| `VILLAIN_SCHEMES` | **1** | `01186` (Advance (treachery)) |
| `VILLAIN_ATTACKS` | **1** | `01187` (Assault (treachery)) |
| `DISCARD_UPGRADE_OR_SUPPORT_OR_SURGE` | **1** | `01188` (Caught Off Guard (treachery)) |
| `VILLAIN_AND_ENGAGED_MINIONS_ATTACK` | **1** | `01189` (Gang-Up (treachery)) |
| `SHUFFLE_INTO_DECK` | **1** | `01190` (Shadow of the Past (treachery)) |
| `PLACE_THREAT_PER_SIDE_SCHEME` | **1** | `01192` (Masterplan (treachery)) |
| `REVEAL_ENCOUNTER_CARD` | **1** | `01193` (Under Fire (treachery)) |

---

## ⏱️ 9. Complete Triggers Inventory

| Trigger Window | Occurrences | Declaring Cards |
| :--- | :--- | :--- |
| `WHEN_REVEALED` | **46** | `01004` (Enhanced Spider-Sense (event)), `01095` (Rhino (villain)), `01096` (Rhino (villain)), `01098` (Armored Rhino Suit (attachment)), `01099` (Charge (attachment)), `01100` (Enhanced Ivory Horn (attachment)), `01103` (Shocker (minion)), `01104` (Hard to Keep Down (treachery)), `01105` ("I'm Tough" (treachery)), `01106` (Stampede (treachery)), `01107` (Breakin' & Takin' (side_scheme)), `01108` (Crowd Control (side_scheme)), `01109` (Bomb Scare (side_scheme)), `01110` (Hydra Bomber (minion)), `01111` (Explosion (treachery)), `01112` (False Alarm (treachery)), `01155` (Affairs of State (obligation)), `01157` (Killmonger (minion)), `01158` (Heart-Shaped Herb (treachery)), `01159` (Ritual Combat (treachery)), `01160` (Legal Work (obligation)), `01161` (Personal Challenge (side_scheme)), `01162` (Titania (minion)), `01164` (Titania's Fury (treachery)), `01165` (Eviction Notice (obligation)), `01168` (Sweeping Swoop (treachery)), `01169` (The Vulture's Plans (treachery)), `01170` (Business Problems (obligation)), `01171` (Imminent Overload (side_scheme)), `01172` (Whiplash (minion)), `01174` (Electromagnetic Backlash (treachery)), `01175` (Family Emergency (obligation)), `01176` (The Psyche-Magnitron (side_scheme)), `01177` (Yon-Rogg (minion)), `01178` (Kree Manipulator (treachery)), `01179` (Yon-Rogg's Treason (treachery)), `01186` (Advance (treachery)), `01187` (Assault (treachery)), `01188` (Caught Off Guard (treachery)), `01189` (Gang-Up (treachery)), `01190` (Shadow of the Past (treachery)), `01191` (Exhaustion (treachery)), `01192` (Masterplan (treachery)), `01193` (Under Fire (treachery)), `01194` (Unknown Card #01194), `01195` (Unknown Card #01195) |
| `CARD_PLAYED` | **6** | `01002` (Black Cat (ally)), `01011` (Spider-Woman (ally)), `01041` (Shuri (ally)), `01067` (Maria Hill (ally)), `01083` (Mockingbird (ally)), `01084` (Nick Fury (ally)) |
| `BOOST` | **3** | `01164` (Titania's Fury (treachery)), `01168` (Sweeping Swoop (treachery)), `01173` (Electric Whip Attack (treachery)) |
| `VILLAIN_INITIATES_ATTACK` | **2** | `01001a` (Spider-Man (hero)), `01009` (Webbed Up (upgrade)) |
| `TAKE_ATTACK_DAMAGE` | **2** | `01003` (Backflip (event)), `01098` (Armored Rhino Suit (attachment)) |
| `MINION_DEFEATED` | **2** | `01007` (Spider-Tracer (upgrade)), `01063` (Interrogation Room (support)) |
| `THREAT_WOULD_BE_PLACED` | **2** | `01061` (Great Responsibility (event)), `01085` (Emergency (event)) |
| `TREACHERY_REVEALED` | **2** | `01075` (Black Widow (ally)), `01078` (Get Behind Me! (event)) |
| `HERO_DEFENDED_ATTACK` | **2** | `01077` (Counter-Punch (event)), `01082` (Indomitable (upgrade)) |
| `TAKE_DAMAGE` | **1** | `01017` (Cosmic Flight (upgrade)) |
| `FORM_CHANGED_TO_HERO` | **1** | `01019a` (She-Hulk (hero)) |
| `BASIC_ATTACK_PERFORMED` | **1** | `01024` (One-Two Punch (event)) |
| `ATTACK_RESOLVED` | **1** | `01028` (Superhuman Strength (upgrade)) |
| `ATTACK` | **1** | `01050` (Hulk (ally)) |
| `MINION_DEFEATED_BY_ATTACK` | **1** | `01051` (Tigra (ally)) |
| `ENEMY_DEFEATED_BY_HERO_ATTACK` | **1** | `01052` (Chase Them Down (event)) |
| `THWART_RESOLVED` | **1** | `01058` (Daredevil (ally)) |
| `MINION_ENTERS_PLAY` | **1** | `01066` (Hawkeye (ally)) |
| `ROUND_END` | **1** | `01084` (Nick Fury (ally)) |
| `MINION_ATTACKED` | **1** | `01102` (Sandman (minion)) |
| `DEFEATED` | **1** | `01166` (Highway Robbery (side_scheme)) |
| `BOOST_STAR_RESOLVED` | **1** | `01178` (Kree Manipulator (treachery)) |

---

## 🎯 10. Timings, Costs & Target Selectors Inventory

### Ability Timings:
| Timing | Occurrences | Cards |
| :--- | :--- | :--- |
| `FORCED_RESPONSE` | **29** | `01002` Black Cat (ally), `01019a` She-Hulk (hero), `01028` Superhuman Strength (upgrade), `01050` Hulk (ally), `01083` Mockingbird (ally) *(+24 more)* |
| `HERO_ACTION` | **25** | `01005` Swinging Web Kick (event), `01008` Web-Shooter (upgrade), `01012` Crisis Interdiction (event), `01013` Photonic Blast (event), `01018` Energy Channel (upgrade) *(+20 more)* |
| `WHEN_REVEALED` | **25** | `01095` Rhino (villain), `01096` Rhino (villain), `01098` Armored Rhino Suit (attachment), `01099` Charge (attachment), `01100` Enhanced Ivory Horn (attachment) *(+20 more)* |
| `CONSTANT` | **20** | `01016` Captain Marvel's Helmet (upgrade), `01017` Cosmic Flight (upgrade), `01028` Superhuman Strength (upgrade), `01029a` Iron Man (hero), `01036` Mark V Armor (upgrade) *(+13 more)* |
| `ACTION` | **14** | `01018` Energy Channel (upgrade), `01020` Hellcat (ally), `01025` Split Personality (event), `01033` Pepper Potts (support), `01056` Tac Team (support) *(+9 more)* |
| `ALTER_EGO_ACTION` | **11** | `01006` Aunt May (support), `01010a` Captain Marvel (hero), `01010b` Carol Danvers (alter_ego), `01015` Alpha Flight Station (support), `01019b` Jennifer Walters (alter_ego) *(+6 more)* |
| `RESPONSE` | **10** | `01011` Spider-Woman (ally), `01024` One-Two Punch (event), `01041` Shuri (ally), `01051` Tigra (ally), `01052` Chase Them Down (event) *(+5 more)* |
| `INTERRUPT` | **6** | `01001a` Spider-Man (hero), `01003` Backflip (event), `01061` Great Responsibility (event), `01075` Black Widow (ally), `01078` Get Behind Me! (event) *(+1 more)* |
| `RESOURCE` | **5** | `01001b` Peter Parker (alter_ego), `01055` The Power of Aggression (resource), `01062` The Power of Justice (resource), `01072` The Power of Leadership (resource), `01079` The Power of Protection (resource) |
| `CARD_PLAYED` | **4** | `01007` Spider-Tracer (upgrade), `01009` Webbed Up (upgrade), `01074` Inspired (upgrade), `01084` Nick Fury (ally) |
| `SETUP` | **4** | `01040b` T'Challa (alter_ego), `01076` Luke Cage (ally), `01096` Rhino (villain), `01102` Sandman (minion) |
| `SPECIAL` | **4** | `01046` Energy Daggers (upgrade), `01047` Panther Claws (upgrade), `01048` Tactical Genius (upgrade), `01049` Vibranium Suit (upgrade) |
| `BOOST` | **4** | `01164` Titania's Fury (treachery), `01168` Sweeping Swoop (treachery), `01173` Electric Whip Attack (treachery), `01178` Kree Manipulator (treachery) |
| `HERO_INTERRUPT` | **3** | `01004` Enhanced Spider-Sense (event), `01017` Cosmic Flight (upgrade), `01082` Indomitable (upgrade) |
| `FORCED_INTERRUPT` | **3** | `01007` Spider-Tracer (upgrade), `01009` Webbed Up (upgrade), `01098` Armored Rhino Suit (attachment) |
| `ALTER_EGO_INTERRUPT` | 🟡 **0** | *Unused in supplemental declarations* |
| `HERO_RESPONSE` | 🟡 **0** | *Unused in supplemental declarations* |
| `ALTER_EGO_RESPONSE` | 🟡 **0** | *Unused in supplemental declarations* |
| `WHEN_PLAYED` | 🟡 **0** | *Unused in supplemental declarations* |

### Cost Primitives:
| Cost Key | Occurrences | Cards |
| :--- | :--- | :--- |
| `exhaustSelf` | **21** | `01006` Aunt May (support), `01008` Web-Shooter (upgrade), `01010a` Captain Marvel (hero), `01015` Alpha Flight Station (support), `01026` Superhuman Law Division (support) *(+16 more)* |
| `discardSelf` | **12** | `01003` Backflip (event), `01004` Enhanced Spider-Sense (event), `01017` Cosmic Flight (upgrade), `01018` Energy Channel (upgrade), `01024` One-Two Punch (event) *(+7 more)* |
| `resourceCost` | **7** | `01018` Energy Channel (upgrade), `01026` Superhuman Law Division (support), `01038` Powered Gauntlets (upgrade), `01068` Vision (ally), `01075` Black Widow (ally) *(+2 more)* |
| `spendCounters` | **5** | `01008` Web-Shooter (upgrade), `01056` Tac Team (support), `01064` Surveillance Team (support), `01066` Hawkeye (ally), `01080` Med Team (support) |
| `costCheck` | **1** | `01010a` Captain Marvel (hero) |
| `discardFromHand` | **1** | `01015` Alpha Flight Station (support) |
| `discardCard` | **1** | `01023` Legal Practice (event) |
| `takeDamage` | **1** | `01027` Focused Rage (upgrade) |
| `damageHero` | **1** | `01030` War Machine (ally) |
| `resources` | **1** | `01039` Rocket Boots (upgrade) |

### Target Selectors:
| Target Selector | Occurrences | Cards |
| :--- | :--- | :--- |
| `SELF` | **18** | `01001a` Spider-Man (hero), `01006` Aunt May (support), `01018` Energy Channel (upgrade), `01020` Hellcat (ally), `01051` Tigra (ally) *(+13 more)* |
| `CHOSEN_ENEMY` | **14** | `01005` Swinging Web Kick (event), `01011` Spider-Woman (ally), `01013` Photonic Blast (event), `01018` Energy Channel (upgrade), `01019a` She-Hulk (hero) *(+9 more)* |
| `CHOSEN_SCHEME` | **8** | `01012` Crisis Interdiction (event), `01019b` Jennifer Walters (alter_ego), `01026` Superhuman Law Division (support), `01037` Mark V Helmet (upgrade), `01048` Tactical Genius (upgrade) *(+3 more)* |
| `VILLAIN` | **7** | `01098` Armored Rhino Suit (attachment), `01099` Charge (attachment), `01100` Enhanced Ivory Horn (attachment), `01104` Hard to Keep Down (treachery), `01105` "I'm Tough" (treachery) *(+1 more)* |
| `MAIN_SCHEME` | **6** | `01007` Spider-Tracer (upgrade), `01023` Legal Practice (event), `01063` Interrogation Room (support), `01178` Kree Manipulator (treachery), `01194` Unknown Card #01194 |
| `HERO` | **6** | `01159` Ritual Combat (treachery), `01164` Titania's Fury (treachery), `01168` Sweeping Swoop (treachery), `01169` The Vulture's Plans (treachery), `01174` Electromagnetic Backlash (treachery) *(+1 more)* |
| `ENEMY` | **3** | `01009` Webbed Up (upgrade), `01021` Gamma Slam (event), `01077` Counter-Punch (event) |
| `SELF_IDENTITY` | **3** | `01010a` Captain Marvel (hero), `01035` Arc Reactor (upgrade), `01073` The Triskelion (support) |
| `CHOSEN_PLAYER` | **3** | `01010b` Carol Danvers (alter_ego), `01091` Avengers Mansion (support), `01092` Helicarrier (support) |
| `CHOSEN_MINION` | **2** | `01007` Spider-Tracer (upgrade), `01053` Relentless Assault (event) |
| `ALL_ENEMIES` | **2** | `01022` Ground Stomp (event), `01030` War Machine (ally) |
| `CHOSEN_ALLY` | **2** | `01069` Get Ready (event), `01074` Inspired (upgrade) |
| `CHOSEN_CHARACTER` | **2** | `01080` Med Team (support), `01086` First Aid (event) |
| `ALL_HEROES` | **2** | `01096` Rhino (villain), `01103` Shocker (minion) |
| `ACTIVE_PLAYER` | **2** | `01106` Stampede (treachery), `01188` Caught Off Guard (treachery) |
| `THIS_SIDE_SCHEME` | **2** | `01107` Breakin' & Takin' (side_scheme), `01109` Bomb Scare (side_scheme) |
| `ATTACK_TARGET` | **1** | `01028` Superhuman Strength (upgrade) |
| `TRIGGERING_MINION` | **1** | `01066` Hawkeye (ally) |
| `ALL_PLAYERS` | **1** | `01067` Maria Hill (ally) |
| `ALLY_IN_DISCARD` | **1** | `01071` Make the Call (event) |
| `ACTIVE_SCHEME` | **1** | `01085` Emergency (event) |
| `ATTACHED_VILLAIN` | **1** | `01098` Armored Rhino Suit (attachment) |
| `ACTIVE_IDENTITY` | **1** | `01112` False Alarm (treachery) |
| `DEFENDING_CHARACTER` | **1** | `01168` Sweeping Swoop (treachery) |
| `DEFENDING_PLAYER` | **1** | `01173` Electric Whip Attack (treachery) |