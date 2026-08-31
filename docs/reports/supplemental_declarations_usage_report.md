# Supplemental Card Declarations Usage & Impact Report

> **Generated:** `2026-08-31T03:35:40.728Z`  
> **Source Packs Scanned:** `core, core_encounter`

---

## 📊 1. Executive Summary

| Metric | Count | Description |
| :--- | :--- | :--- |
| **Total Cards Registered** | **156** | Total cards present in `src/data/supplemental/` |
| **Active Declared Cards** | **140** | Cards with executable `abilities: [...]` |
| **Blocked / Ambiguity Cards** | **2** | Cards isolated in `docs/ambiguities/` |
| **Total Abilities Declared** | **156** | Total individual ability definitions declared |
| **Unique Effects In Use** | **66** | Distinct effect primitive types actively declared |
| **Unique Triggers In Use** | **18** | Distinct trigger window types actively declared |
| **Unique Timings In Use** | **14** | Distinct timing categories actively declared |
| **Unique Cost Keys In Use** | **12** | Distinct ability cost types actively declared |

---

## 💥 2. High-Impact Primitives (Blast-Radius $\ge 5$ Cards)

Changing these primitives will affect many cards across the entire game engine:

| Category | Primitive Name | Card Count | Example Cards |
| :--- | :--- | :--- | :--- |
| **Effect** | `DEAL_DAMAGE` | **21** | `01005` Swinging Web Kick (event), `01013` Photonic Blast (event), `01019a` She-Hulk (hero) *(+18 more)* |
| **Effect** | `ADD_STATUS` | **15** | `01011` Spider-Woman (ally), `01028` Superhuman Strength (upgrade), `01076` Luke Cage (ally) *(+11 more)* |
| **Effect** | `REMOVE_THREAT` | **10** | `01012` Crisis Interdiction (event), `01019b` Jennifer Walters (alter_ego), `01023` Legal Practice (event) *(+7 more)* |
| **Effect** | `DRAW_CARDS` | **7** | `01001a` Spider-Man (hero), `01010b` Carol Danvers (alter_ego), `01015` Alpha Flight Station (support) *(+4 more)* |
| **Effect** | `HEAL_DAMAGE` | **7** | `01006` Aunt May (support), `01010a` Captain Marvel (hero), `01016` Captain Marvel's Helmet (upgrade) *(+4 more)* |
| **Effect** | `MODIFY_STAT` | **7** | `01057` Combat Training (upgrade), `01059` Jessica Jones (ally), `01065` Heroic Intuition (upgrade) *(+3 more)* |
| **Effect** | `ATTACH_TO_HOST` | **6** | `01007` Spider-Tracer (upgrade), `01009` Webbed Up (upgrade), `01074` Inspired (upgrade) *(+3 more)* |
| **Effect** | `DISCARD_SELF` | **6** | `01155` Affairs of State (obligation), `01160` Legal Work (obligation), `01165` Eviction Notice (obligation) *(+3 more)* |
| **Trigger** | `WHEN_REVEALED` | **42** | `01095` Rhino (villain), `01096` Rhino (villain), `01098` Armored Rhino Suit (attachment) *(+39 more)* |
| **Trigger** | `CARD_PLAYED` | **6** | `01002` Black Cat (ally), `01011` Spider-Woman (ally), `01041` Shuri (ally) *(+3 more)* |

---

## 🔍 3. Single-Use & Unique Primitives (Card Count = 1)

These primitives are only declared on a single card. They represent high specialization and are prime candidates for decomposition into composable generic primitives:

| Category | Primitive Name | Card Code | Card Name & Pack | Ability ID |
| :--- | :--- | :--- | :--- | :--- |
| **Effect** | `ADD_COUNTER` | `01018` | Energy Channel (upgrade) (core) | `energy_channel_charge` |
| **Effect** | `ADD_STATUS_WITH_SURGE` | `01105` | "I'm Tough" (treachery) (core_encounter) | `im_tough_status` |
| **Effect** | `ADD_TRAIT` | `01017` | Cosmic Flight (upgrade) (core) | `cosmic_flight_aerial` |
| **Effect** | `ATK_BONUS` | `01028` | Superhuman Strength (upgrade) (core) | `superhuman_strength_atk` |
| **Effect** | `ATTACHMENT_DAMAGE_SHIELD` | `01098` | Armored Rhino Suit (attachment) (core_encounter) | `armored_rhino_suit_shield` |
| **Effect** | `BOOST_STAT_CHOICE` | `01068` | Vision (ally) (core) | `vision_boost` |
| **Effect** | `BUFF_ALL_FRIENDLY_CHARACTERS` | `01070` | Lead from the Front (event) (core) | `lead_from_the_front` |
| **Effect** | `CANCEL_TREACHERY_AND_FORCE_VILLAIN_ATTACK` | `01078` | Get Behind Me! (event) (core) | `get_behind_me` |
| **Effect** | `CANCEL_WHEN_REVEALED` | `01075` | Black Widow (ally) (core) | `black_widow_treachery_cancel` |
| **Effect** | `CHANGE_FORM_DRAW_TO_HAND_SIZE` | `01025` | Split Personality (event) (core) | `split_personality` |
| **Effect** | `CONVERT_THREAT_TO_DAMAGE` | `01061` | Great Responsibility (event) (core) | `great_responsibility` |
| **Effect** | `DEAL_DAMAGE_ALL_ENEMIES` | `01046` | Energy Daggers (upgrade) (core) | `energy_daggers_special` |
| **Effect** | `DEAL_DAMAGE_EQUAL_TO_HERO_ATK` | `01077` | Counter-Punch (event) (core) | `counter_punch` |
| **Effect** | `DEAL_DAMAGE_EQUAL_TO_SUFFERED_DAMAGE` | `01021` | Gamma Slam (event) (core) | `gamma_slam` |
| **Effect** | `DEAL_DAMAGE_PER_COUNTER` | `01018` | Energy Channel (upgrade) (core) | `energy_channel_blast` |
| **Effect** | `DISCARD_ATTACHMENT` | `01100` | Enhanced Ivory Horn (attachment) (core_encounter) | `ivory_horn_discard_action` |
| **Effect** | `DISCARD_ENCOUNTER_DECK` | `01102` | Sandman (minion) (core_encounter) | `sandman_attack_discard` |
| **Effect** | `DISCARD_TOP_DECK_FILTER` | `01002` | Black Cat (ally) (core) | `black_cat_when_played` |
| **Effect** | `DISCARD_UPGRADE_OR_SUPPORT_OR_SURGE` | `01188` | Caught Off Guard (treachery) (core_encounter) | `caught_off_guard_when_revealed` |
| **Effect** | `EXPLOSION` | `01111` | Explosion (treachery) (core_encounter) | `explosion_when_revealed` |
| **Effect** | `FORM_BRANCH_VILLAIN_ATTACK_OR_SURGE` | `01106` | Stampede (treachery) (core_encounter) | `stampede_attack` |
| **Effect** | `GENERATE_TOP_DISCARD_RESOURCES` | `01033` | Pepper Potts (support) (core) | `pepper_potts_resource` |
| **Effect** | `GIVE_STATUS` | `01102` | Sandman (minion) (core_encounter) | `sandman_toughness` |
| **Effect** | `HEAL_DAMAGE_WITH_SURGE` | `01104` | Hard to Keep Down (treachery) (core_encounter) | `hard_to_keep_down_heal` |
| **Effect** | `HULK_DISCARD_RESOLUTION` | `01050` | Hulk (ally) (core) | `hulk_after_attack` |
| **Effect** | `INTERCEPT_ATTACK` | `01009` | Webbed Up (upgrade) (core) | `webbed_up_intercept` |
| **Effect** | `MODIFY_ALLY_LIMIT` | `01073` | The Triskelion (support) (core) | `triskelion_ally_limit` |
| **Effect** | `MODIFY_HAND_SIZE` | `01029a` | Iron Man (hero) (core) | `iron_man_hand_size` |
| **Effect** | `PLACE_THREAT_PER_SIDE_SCHEME` | `01192` | Masterplan (treachery) (core_encounter) | `masterplan_when_revealed` |
| **Effect** | `PLAY_ALLY_FROM_DISCARD` | `01071` | Make the Call (event) (core) | `make_the_call` |
| **Effect** | `READY_IDENTITY` | `01035` | Arc Reactor (upgrade) (core) | `arc_reactor_ready` |
| **Effect** | `REDUCE_NEXT_CARD_COST` | `01092` | Helicarrier (support) (core) | `helicarrier_action` |
| **Effect** | `REPULSOR_BLAST_DAMAGE` | `01031` | Repulsor Blast (event) (core) | `repulsor_blast` |
| **Effect** | `RETRIEVE_CARD_FROM_DISCARD` | `01034` | Stark Tower (support) (core) | `stark_tower` |
| **Effect** | `RETURN_TO_HAND` | `01020` | Hellcat (ally) (core) | `hellcat_return_hand` |
| **Effect** | `REVEAL_ENCOUNTER_CARD_WITH_SURGE` | `01193` | Under Fire (treachery) (core_encounter) | `under_fire_when_revealed` |
| **Effect** | `SCRY_AND_SELECT_TRAIT` | `01029b` | Tony Stark (alter_ego) (core) | `futurist` |
| **Effect** | `SEARCH_AND_REVEAL_SIDE_SCHEME` | `01095` | Rhino (villain) (core_encounter) | `rhino_stage_ii_when_revealed` |
| **Effect** | `SEARCH_DECK_FOR_CARD` | `01041` | Shuri (ally) (core) | `shuri_search_upgrade` |
| **Effect** | `SHUFFLE_DISCARD_INTO_DECK` | `01042` | Ancestral Knowledge (event) (core) | `ancestral_knowledge` |
| **Effect** | `SPAWN_NEMESIS` | `01190` | Shadow of the Past (treachery) (core_encounter) | `shadow_of_the_past_when_revealed` |
| **Effect** | `TRANSFER_DAMAGE` | `01049` | Vibranium Suit (upgrade) (core) | `vibranium_suit_special` |
| **Effect** | `VILLAIN_AND_ENGAGED_MINIONS_ATTACK` | `01189` | Gang-Up (treachery) (core_encounter) | `gang_up_when_revealed` |
| **Effect** | `VILLAIN_ATTACKS` | `01187` | Assault (treachery) (core_encounter) | `assault_when_revealed` |
| **Effect** | `VILLAIN_SCHEMES` | `01186` | Advance (treachery) (core_encounter) | `advance_when_revealed` |
| **Effect** | `WHEN_ATTACHED_HOST_DEFEATED` | `01007` | Spider-Tracer (upgrade) (core) | `spider_tracer_defeat_trigger` |
| **Effect** | `WHEN_REVEALED_THREAT_PER_PLAYER` | `01108` | Crowd Control (side_scheme) (core_encounter) | `crowd_control_when_revealed` |
| **Trigger** | `BASIC_ATTACK_PERFORMED` | `01024` | One-Two Punch (event) (core) | `one_two_punch` |
| **Trigger** | `ENEMY_DEFEATED_BY_HERO_ATTACK` | `01052` | Chase Them Down (event) (core) | `chase_them_down` |
| **Trigger** | `FORM_CHANGED_TO_HERO` | `01019a` | She-Hulk (hero) (core) | `she_hulk_form_change` |
| **Trigger** | `MINION_ATTACKED` | `01102` | Sandman (minion) (core_encounter) | `sandman_attack_discard` |
| **Trigger** | `MINION_DEFEATED_BY_ATTACK` | `01051` | Tigra (ally) (core) | `tigra_defeat_heal` |
| **Trigger** | `MINION_ENTERS_PLAY` | `01066` | Hawkeye (ally) (core) | `hawkeye_arrow_response` |
| **Trigger** | `RESOURCE_SPENT` | `01016` | Captain Marvel's Helmet (upgrade) (core) | `helmet_energy_heal` |
| **Trigger** | `TAKE_DAMAGE` | `01017` | Cosmic Flight (upgrade) (core) | `cosmic_flight_prevent` |
| **Trigger** | `THREAT_WOULD_BE_PLACED` | `01061` | Great Responsibility (event) (core) | `great_responsibility` |
| **Trigger** | `THWART_RESOLVED` | `01058` | Daredevil (ally) (core) | `daredevil_after_thwart` |

---

## ⚠️ 4. Zero-Usage / Unused Primitives (In Specifications but 0 Card Declarations)

These primitives are declared in schema types or specifications but have **0 active card declarations** in supplemental data packs:

| Category | Specified Primitive | Status | Notes |
| :--- | :--- | :--- | :--- |
| **Effect** | `APPLY_STATUS` | 🟡 `0 Cards` | Documented in `docs/specifications/supplemental/` but has 0 card declarations. |
| **Effect** | `DEAL_DAMAGE_SPLIT` | 🟡 `0 Cards` | Documented in `docs/specifications/supplemental/` but has 0 card declarations. |
| **Effect** | `DOUBLE_RESOURCE` | 🟡 `0 Cards` | Documented in `docs/specifications/supplemental/` but has 0 card declarations. |
| **Effect** | `PLACE_THREAT` | 🟡 `0 Cards` | Documented in `docs/specifications/supplemental/` but has 0 card declarations. |
| **Effect** | `PLAY_FROM_ZONE` | 🟡 `0 Cards` | Documented in `docs/specifications/supplemental/` but has 0 card declarations. |
| **Effect** | `RESOURCE_GENERATION` | 🟡 `0 Cards` | Documented in `docs/specifications/supplemental/` but has 0 card declarations. |
| **Effect** | `RETALIATE` | 🟡 `0 Cards` | Documented in `docs/specifications/supplemental/` but has 0 card declarations. |
| **Effect** | `TOUGHNESS` | 🟡 `0 Cards` | Documented in `docs/specifications/supplemental/` but has 0 card declarations. |
| **Trigger** | `ATTACHED_ENEMY_ATTACKS` | 🟡 `0 Cards` | Defined in `TriggerTypeSchema` but has 0 card declarations. |
| **Trigger** | `ATTACHED_MINION_DEFEATED` | 🟡 `0 Cards` | Defined in `TriggerTypeSchema` but has 0 card declarations. |
| **Trigger** | `ATTACK` | 🟡 `0 Cards` | Defined in `TriggerTypeSchema` but has 0 card declarations. |
| **Trigger** | `BOOST` | 🟡 `0 Cards` | Defined in `TriggerTypeSchema` but has 0 card declarations. |
| **Trigger** | `BOOST_STAR_RESOLVED` | 🟡 `0 Cards` | Defined in `TriggerTypeSchema` but has 0 card declarations. |
| **Trigger** | `DAMAGE_TAKEN` | 🟡 `0 Cards` | Defined in `TriggerTypeSchema` but has 0 card declarations. |
| **Trigger** | `DEFEATED` | 🟡 `0 Cards` | Defined in `TriggerTypeSchema` but has 0 card declarations. |
| **Trigger** | `FORM_CHANGED_TO_ALTER_EGO` | 🟡 `0 Cards` | Defined in `TriggerTypeSchema` but has 0 card declarations. |
| **Trigger** | `HERO_FLIPPED` | 🟡 `0 Cards` | Defined in `TriggerTypeSchema` but has 0 card declarations. |
| **Trigger** | `MAIN_SCHEME_ADVANCED` | 🟡 `0 Cards` | Defined in `TriggerTypeSchema` but has 0 card declarations. |
| **Trigger** | `PHASE_START` | 🟡 `0 Cards` | Defined in `TriggerTypeSchema` but has 0 card declarations. |
| **Trigger** | `PLAYED` | 🟡 `0 Cards` | Defined in `TriggerTypeSchema` but has 0 card declarations. |
| **Trigger** | `PLAYER_PHASE_BEGAN` | 🟡 `0 Cards` | Defined in `TriggerTypeSchema` but has 0 card declarations. |
| **Trigger** | `PLAYER_PHASE_ENDED` | 🟡 `0 Cards` | Defined in `TriggerTypeSchema` but has 0 card declarations. |
| **Trigger** | `ROUND_BEGAN` | 🟡 `0 Cards` | Defined in `TriggerTypeSchema` but has 0 card declarations. |
| **Trigger** | `ROUND_END` | 🟡 `0 Cards` | Defined in `TriggerTypeSchema` but has 0 card declarations. |
| **Trigger** | `ROUND_ENDED` | 🟡 `0 Cards` | Defined in `TriggerTypeSchema` but has 0 card declarations. |
| **Trigger** | `THREAT_PLACED` | 🟡 `0 Cards` | Defined in `TriggerTypeSchema` but has 0 card declarations. |
| **Trigger** | `VILLAIN_PHASE_BEGAN` | 🟡 `0 Cards` | Defined in `TriggerTypeSchema` but has 0 card declarations. |
| **Trigger** | `VILLAIN_PHASE_ENDED` | 🟡 `0 Cards` | Defined in `TriggerTypeSchema` but has 0 card declarations. |

---

## 📑 5. Complete Effects Inventory

| Effect Primitive | Occurrences | Declaring Cards |
| :--- | :--- | :--- |
| `DEAL_DAMAGE` | **21** | `01005` (Swinging Web Kick (event)), `01013` (Photonic Blast (event)), `01019a` (She-Hulk (hero)), `01022` (Ground Stomp (event)), `01030` (War Machine (ally)), `01032` (Supersonic Punch (event)), `01038` (Powered Gauntlets (upgrade)), `01047` (Panther Claws (upgrade)), `01053` (Relentless Assault (event)), `01054` (Uppercut (event)), `01056` (Tac Team (support)), `01058` (Daredevil (ally)), `01066` (Hawkeye (ally)), `01087` (Haymaker (event)), `01103` (Shocker (minion)), `01159` (Ritual Combat (treachery)), `01164` (Titania's Fury (treachery)), `01167` (Vulture (minion)), `01168` (Sweeping Swoop (treachery)), `01174` (Electromagnetic Backlash (treachery)), `01179` (Yon-Rogg's Treason (treachery)) |
| `ADD_STATUS` | **15** | `01011` (Spider-Woman (ally)), `01028` (Superhuman Strength (upgrade)), `01076` (Luke Cage (ally)), `01083` (Mockingbird (ally)), `01096` (Rhino (villain)), `01112` (False Alarm (treachery)), `01157` (Killmonger (minion)), `01162` (Titania (minion)), `01163` (Genetically Enhanced (attachment)), `01169` (The Vulture's Plans (treachery)), `01172` (Whiplash (minion)), `01173` (Electric Whip Attack (treachery)), `01177` (Yon-Rogg (minion)), `01194` (Unknown Card #01194) |
| `REMOVE_THREAT` | **10** | `01012` (Crisis Interdiction (event)), `01019b` (Jennifer Walters (alter_ego)), `01023` (Legal Practice (event)), `01026` (Superhuman Law Division (support)), `01037` (Mark V Helmet (upgrade)), `01048` (Tactical Genius (upgrade)), `01052` (Chase Them Down (event)), `01060` (For Justice! (event)), `01063` (Interrogation Room (support)), `01064` (Surveillance Team (support)) |
| `DRAW_CARDS` | **7** | `01001a` (Spider-Man (hero)), `01010b` (Carol Danvers (alter_ego)), `01015` (Alpha Flight Station (support)), `01027` (Focused Rage (upgrade)), `01045` (The Golden City (support)), `01067` (Maria Hill (ally)), `01091` (Avengers Mansion (support)) |
| `HEAL_DAMAGE` | **7** | `01006` (Aunt May (support)), `01010a` (Captain Marvel (hero)), `01016` (Captain Marvel's Helmet (upgrade)), `01051` (Tigra (ally)), `01080` (Med Team (support)), `01086` (First Aid (event)), `01158` (Heart-Shaped Herb (treachery)) |
| `MODIFY_STAT` | **7** | `01057` (Combat Training (upgrade)), `01059` (Jessica Jones (ally)), `01065` (Heroic Intuition (upgrade)), `01074` (Inspired (upgrade)), `01099` (Charge (attachment)), `01100` (Enhanced Ivory Horn (attachment)) |
| `ATTACH_TO_HOST` | **6** | `01007` (Spider-Tracer (upgrade)), `01009` (Webbed Up (upgrade)), `01074` (Inspired (upgrade)), `01098` (Armored Rhino Suit (attachment)), `01099` (Charge (attachment)), `01100` (Enhanced Ivory Horn (attachment)) |
| `DISCARD_SELF` | **6** | `01155` (Affairs of State (obligation)), `01160` (Legal Work (obligation)), `01165` (Eviction Notice (obligation)), `01170` (Business Problems (obligation)), `01175` (Family Emergency (obligation)), `01195` (Unknown Card #01195) |
| `READY_CHARACTER` | **4** | `01024` (One-Two Punch (event)), `01069` (Get Ready (event)), `01082` (Indomitable (upgrade)), `01093` (Tenacity (upgrade)) |
| `TRIGGER_WAKANDA_UPGRADES` | **4** | `01043a` (Wakanda Forever! (event)), `01043b` (Wakanda Forever! (event)), `01043c` (Wakanda Forever! (event)), `01043d` (Wakanda Forever! (event)) |
| `DOUBLE_RESOURCE_FOR_ASPECT` | **4** | `01055` (The Power of Aggression (resource)), `01062` (The Power of Justice (resource)), `01072` (The Power of Leadership (resource)), `01079` (The Power of Protection (resource)) |
| `GRANT_KEYWORD` | **3** | `01039` (Rocket Boots (upgrade)), `01099` (Charge (attachment)), `01101` (Hydra Mercenary (minion)) |
| `PLAYER_CHOICE` | **3** | `01084` (Nick Fury (ally)), `01110` (Hydra Bomber (minion)), `01191` (Exhaustion (treachery)) |
| `GENERATE_RESOURCE` | **2** | `01001b` (Peter Parker (alter_ego)), `01008` (Web-Shooter (upgrade)) |
| `PREVENT_DAMAGE` | **2** | `01003` (Backflip (event)), `01017` (Cosmic Flight (upgrade)) |
| `DEF_BONUS` | **2** | `01016` (Captain Marvel's Helmet (upgrade)), `01081` (Armored Vest (upgrade)) |
| `MODIFY_MAX_HEALTH` | **2** | `01036` (Mark V Armor (upgrade)), `01039` (Rocket Boots (upgrade)) |
| `SEARCH_AND_PLAY_UPGRADE` | **2** | `01040a` (Black Panther (hero)), `01040b` (T'Challa (alter_ego)) |
| `ADD_THREAT_PER_PLAYER` | **2** | `01107` (Breakin' & Takin' (side_scheme)), `01109` (Bomb Scare (side_scheme)) |
| `DISCARD_TOP_DECK_FILTER` | **1** | `01002` (Black Cat (ally)) |
| `WHEN_ATTACHED_HOST_DEFEATED` | **1** | `01007` (Spider-Tracer (upgrade)) |
| `INTERCEPT_ATTACK` | **1** | `01009` (Webbed Up (upgrade)) |
| `ADD_TRAIT` | **1** | `01017` (Cosmic Flight (upgrade)) |
| `ADD_COUNTER` | **1** | `01018` (Energy Channel (upgrade)) |
| `DEAL_DAMAGE_PER_COUNTER` | **1** | `01018` (Energy Channel (upgrade)) |
| `RETURN_TO_HAND` | **1** | `01020` (Hellcat (ally)) |
| `DEAL_DAMAGE_EQUAL_TO_SUFFERED_DAMAGE` | **1** | `01021` (Gamma Slam (event)) |
| `CHANGE_FORM_DRAW_TO_HAND_SIZE` | **1** | `01025` (Split Personality (event)) |
| `ATK_BONUS` | **1** | `01028` (Superhuman Strength (upgrade)) |
| `MODIFY_HAND_SIZE` | **1** | `01029a` (Iron Man (hero)) |
| `SCRY_AND_SELECT_TRAIT` | **1** | `01029b` (Tony Stark (alter_ego)) |
| `REPULSOR_BLAST_DAMAGE` | **1** | `01031` (Repulsor Blast (event)) |
| `GENERATE_TOP_DISCARD_RESOURCES` | **1** | `01033` (Pepper Potts (support)) |
| `RETRIEVE_CARD_FROM_DISCARD` | **1** | `01034` (Stark Tower (support)) |
| `READY_IDENTITY` | **1** | `01035` (Arc Reactor (upgrade)) |
| `SEARCH_DECK_FOR_CARD` | **1** | `01041` (Shuri (ally)) |
| `SHUFFLE_DISCARD_INTO_DECK` | **1** | `01042` (Ancestral Knowledge (event)) |
| `DEAL_DAMAGE_ALL_ENEMIES` | **1** | `01046` (Energy Daggers (upgrade)) |
| `TRANSFER_DAMAGE` | **1** | `01049` (Vibranium Suit (upgrade)) |
| `HULK_DISCARD_RESOLUTION` | **1** | `01050` (Hulk (ally)) |
| `CONVERT_THREAT_TO_DAMAGE` | **1** | `01061` (Great Responsibility (event)) |
| `BOOST_STAT_CHOICE` | **1** | `01068` (Vision (ally)) |
| `BUFF_ALL_FRIENDLY_CHARACTERS` | **1** | `01070` (Lead from the Front (event)) |
| `PLAY_ALLY_FROM_DISCARD` | **1** | `01071` (Make the Call (event)) |
| `MODIFY_ALLY_LIMIT` | **1** | `01073` (The Triskelion (support)) |
| `CANCEL_WHEN_REVEALED` | **1** | `01075` (Black Widow (ally)) |
| `DEAL_DAMAGE_EQUAL_TO_HERO_ATK` | **1** | `01077` (Counter-Punch (event)) |
| `CANCEL_TREACHERY_AND_FORCE_VILLAIN_ATTACK` | **1** | `01078` (Get Behind Me! (event)) |
| `REDUCE_NEXT_CARD_COST` | **1** | `01092` (Helicarrier (support)) |
| `SEARCH_AND_REVEAL_SIDE_SCHEME` | **1** | `01095` (Rhino (villain)) |
| `ATTACHMENT_DAMAGE_SHIELD` | **1** | `01098` (Armored Rhino Suit (attachment)) |
| `DISCARD_ATTACHMENT` | **1** | `01100` (Enhanced Ivory Horn (attachment)) |
| `GIVE_STATUS` | **1** | `01102` (Sandman (minion)) |
| `DISCARD_ENCOUNTER_DECK` | **1** | `01102` (Sandman (minion)) |
| `HEAL_DAMAGE_WITH_SURGE` | **1** | `01104` (Hard to Keep Down (treachery)) |
| `ADD_STATUS_WITH_SURGE` | **1** | `01105` ("I'm Tough" (treachery)) |
| `FORM_BRANCH_VILLAIN_ATTACK_OR_SURGE` | **1** | `01106` (Stampede (treachery)) |
| `WHEN_REVEALED_THREAT_PER_PLAYER` | **1** | `01108` (Crowd Control (side_scheme)) |
| `EXPLOSION` | **1** | `01111` (Explosion (treachery)) |
| `VILLAIN_SCHEMES` | **1** | `01186` (Advance (treachery)) |
| `VILLAIN_ATTACKS` | **1** | `01187` (Assault (treachery)) |
| `DISCARD_UPGRADE_OR_SUPPORT_OR_SURGE` | **1** | `01188` (Caught Off Guard (treachery)) |
| `VILLAIN_AND_ENGAGED_MINIONS_ATTACK` | **1** | `01189` (Gang-Up (treachery)) |
| `SPAWN_NEMESIS` | **1** | `01190` (Shadow of the Past (treachery)) |
| `PLACE_THREAT_PER_SIDE_SCHEME` | **1** | `01192` (Masterplan (treachery)) |
| `REVEAL_ENCOUNTER_CARD_WITH_SURGE` | **1** | `01193` (Under Fire (treachery)) |

---

## ⏱️ 6. Complete Triggers Inventory

| Trigger Window | Occurrences | Declaring Cards |
| :--- | :--- | :--- |
| `WHEN_REVEALED` | **42** | `01095` (Rhino (villain)), `01096` (Rhino (villain)), `01098` (Armored Rhino Suit (attachment)), `01099` (Charge (attachment)), `01100` (Enhanced Ivory Horn (attachment)), `01103` (Shocker (minion)), `01104` (Hard to Keep Down (treachery)), `01105` ("I'm Tough" (treachery)), `01106` (Stampede (treachery)), `01107` (Breakin' & Takin' (side_scheme)), `01108` (Crowd Control (side_scheme)), `01109` (Bomb Scare (side_scheme)), `01110` (Hydra Bomber (minion)), `01111` (Explosion (treachery)), `01112` (False Alarm (treachery)), `01155` (Affairs of State (obligation)), `01157` (Killmonger (minion)), `01158` (Heart-Shaped Herb (treachery)), `01159` (Ritual Combat (treachery)), `01160` (Legal Work (obligation)), `01162` (Titania (minion)), `01164` (Titania's Fury (treachery)), `01165` (Eviction Notice (obligation)), `01167` (Vulture (minion)), `01168` (Sweeping Swoop (treachery)), `01169` (The Vulture's Plans (treachery)), `01170` (Business Problems (obligation)), `01172` (Whiplash (minion)), `01174` (Electromagnetic Backlash (treachery)), `01175` (Family Emergency (obligation)), `01177` (Yon-Rogg (minion)), `01179` (Yon-Rogg's Treason (treachery)), `01186` (Advance (treachery)), `01187` (Assault (treachery)), `01188` (Caught Off Guard (treachery)), `01189` (Gang-Up (treachery)), `01190` (Shadow of the Past (treachery)), `01191` (Exhaustion (treachery)), `01192` (Masterplan (treachery)), `01193` (Under Fire (treachery)), `01194` (Unknown Card #01194), `01195` (Unknown Card #01195) |
| `CARD_PLAYED` | **6** | `01002` (Black Cat (ally)), `01011` (Spider-Woman (ally)), `01041` (Shuri (ally)), `01067` (Maria Hill (ally)), `01083` (Mockingbird (ally)), `01084` (Nick Fury (ally)) |
| `VILLAIN_INITIATES_ATTACK` | **2** | `01001a` (Spider-Man (hero)), `01009` (Webbed Up (upgrade)) |
| `TAKE_ATTACK_DAMAGE` | **2** | `01003` (Backflip (event)), `01098` (Armored Rhino Suit (attachment)) |
| `MINION_DEFEATED` | **2** | `01007` (Spider-Tracer (upgrade)), `01063` (Interrogation Room (support)) |
| `ATTACK_RESOLVED` | **2** | `01028` (Superhuman Strength (upgrade)), `01050` (Hulk (ally)) |
| `TREACHERY_REVEALED` | **2** | `01075` (Black Widow (ally)), `01078` (Get Behind Me! (event)) |
| `HERO_DEFENDED_ATTACK` | **2** | `01077` (Counter-Punch (event)), `01082` (Indomitable (upgrade)) |
| `RESOURCE_SPENT` | **1** | `01016` (Captain Marvel's Helmet (upgrade)) |
| `TAKE_DAMAGE` | **1** | `01017` (Cosmic Flight (upgrade)) |
| `FORM_CHANGED_TO_HERO` | **1** | `01019a` (She-Hulk (hero)) |
| `BASIC_ATTACK_PERFORMED` | **1** | `01024` (One-Two Punch (event)) |
| `MINION_DEFEATED_BY_ATTACK` | **1** | `01051` (Tigra (ally)) |
| `ENEMY_DEFEATED_BY_HERO_ATTACK` | **1** | `01052` (Chase Them Down (event)) |
| `THWART_RESOLVED` | **1** | `01058` (Daredevil (ally)) |
| `THREAT_WOULD_BE_PLACED` | **1** | `01061` (Great Responsibility (event)) |
| `MINION_ENTERS_PLAY` | **1** | `01066` (Hawkeye (ally)) |
| `MINION_ATTACKED` | **1** | `01102` (Sandman (minion)) |

---

## 🎯 7. Timings, Costs & Target Selectors Inventory

### Ability Timings:
| Timing | Occurrences | Cards |
| :--- | :--- | :--- |
| `FORCED_RESPONSE` | **30** | `01002` Black Cat (ally), `01019a` She-Hulk (hero), `01028` Superhuman Strength (upgrade), `01050` Hulk (ally), `01083` Mockingbird (ally) *(+25 more)* |
| `HERO_ACTION` | **25** | `01005` Swinging Web Kick (event), `01012` Crisis Interdiction (event), `01013` Photonic Blast (event), `01018` Energy Channel (upgrade), `01021` Gamma Slam (event) *(+19 more)* |
| `CONSTANT` | **19** | `01016` Captain Marvel's Helmet (upgrade), `01017` Cosmic Flight (upgrade), `01028` Superhuman Strength (upgrade), `01029a` Iron Man (hero), `01036` Mark V Armor (upgrade) *(+12 more)* |
| `WHEN_REVEALED` | **18** | `01095` Rhino (villain), `01096` Rhino (villain), `01098` Armored Rhino Suit (attachment), `01099` Charge (attachment), `01100` Enhanced Ivory Horn (attachment) *(+13 more)* |
| `ACTION` | **12** | `01020` Hellcat (ally), `01025` Split Personality (event), `01056` Tac Team (support), `01064` Surveillance Team (support), `01068` Vision (ally) *(+7 more)* |
| `ALTER_EGO_ACTION` | **11** | `01006` Aunt May (support), `01010a` Captain Marvel (hero), `01010b` Carol Danvers (alter_ego), `01015` Alpha Flight Station (support), `01019b` Jennifer Walters (alter_ego) *(+6 more)* |
| `RESPONSE` | **11** | `01011` Spider-Woman (ally), `01016` Captain Marvel's Helmet (upgrade), `01024` One-Two Punch (event), `01041` Shuri (ally), `01051` Tigra (ally) *(+6 more)* |
| `RESOURCE` | **7** | `01001b` Peter Parker (alter_ego), `01008` Web-Shooter (upgrade), `01033` Pepper Potts (support), `01055` The Power of Aggression (resource), `01062` The Power of Justice (resource) *(+2 more)* |
| `SETUP` | **5** | `01040a` Black Panther (hero), `01040b` T'Challa (alter_ego), `01076` Luke Cage (ally), `01096` Rhino (villain), `01102` Sandman (minion) |
| `CARD_PLAYED` | **4** | `01007` Spider-Tracer (upgrade), `01009` Webbed Up (upgrade), `01074` Inspired (upgrade), `01084` Nick Fury (ally) |
| `SPECIAL` | **4** | `01046` Energy Daggers (upgrade), `01047` Panther Claws (upgrade), `01048` Tactical Genius (upgrade), `01049` Vibranium Suit (upgrade) |
| `HERO_INTERRUPT` | **4** | `01061` Great Responsibility (event), `01075` Black Widow (ally), `01078` Get Behind Me! (event), `01082` Indomitable (upgrade) |
| `INTERRUPT` | **3** | `01001a` Spider-Man (hero), `01003` Backflip (event), `01017` Cosmic Flight (upgrade) |
| `FORCED_INTERRUPT` | **3** | `01007` Spider-Tracer (upgrade), `01009` Webbed Up (upgrade), `01098` Armored Rhino Suit (attachment) |
| `ALTER_EGO_INTERRUPT` | 🟡 **0** | *Unused in supplemental declarations* |
| `HERO_RESPONSE` | 🟡 **0** | *Unused in supplemental declarations* |
| `ALTER_EGO_RESPONSE` | 🟡 **0** | *Unused in supplemental declarations* |
| `BOOST` | 🟡 **0** | *Unused in supplemental declarations* |
| `WHEN_PLAYED` | 🟡 **0** | *Unused in supplemental declarations* |

### Cost Primitives:
| Cost Key | Occurrences | Cards |
| :--- | :--- | :--- |
| `exhaustSelf` | **20** | `01006` Aunt May (support), `01010a` Captain Marvel (hero), `01015` Alpha Flight Station (support), `01026` Superhuman Law Division (support), `01027` Focused Rage (upgrade) *(+15 more)* |
| `discardSelf` | **7** | `01003` Backflip (event), `01017` Cosmic Flight (upgrade), `01018` Energy Channel (upgrade), `01028` Superhuman Strength (upgrade), `01061` Great Responsibility (event) *(+2 more)* |
| `resourceCost` | **7** | `01018` Energy Channel (upgrade), `01026` Superhuman Law Division (support), `01038` Powered Gauntlets (upgrade), `01068` Vision (ally), `01075` Black Widow (ally) *(+2 more)* |
| `removeCounter` | **4** | `01056` Tac Team (support), `01064` Surveillance Team (support), `01066` Hawkeye (ally), `01080` Med Team (support) |
| `exhaust` | **1** | `01008` Web-Shooter (upgrade) |
| `spendCounter` | **1** | `01008` Web-Shooter (upgrade) |
| `costCheck` | **1** | `01010a` Captain Marvel (hero) |
| `discardFromHand` | **1** | `01015` Alpha Flight Station (support) |
| `discardCard` | **1** | `01023` Legal Practice (event) |
| `takeDamage` | **1** | `01027` Focused Rage (upgrade) |
| `damageHero` | **1** | `01030` War Machine (ally) |
| `resources` | **1** | `01039` Rocket Boots (upgrade) |

### Target Selectors:
| Target Selector | Occurrences | Cards |
| :--- | :--- | :--- |
| `SELF` | **16** | `01001a` Spider-Man (hero), `01006` Aunt May (support), `01016` Captain Marvel's Helmet (upgrade), `01020` Hellcat (ally), `01024` One-Two Punch (event) *(+11 more)* |
| `CHOSEN_ENEMY` | **15** | `01005` Swinging Web Kick (event), `01011` Spider-Woman (ally), `01013` Photonic Blast (event), `01018` Energy Channel (upgrade), `01019a` She-Hulk (hero) *(+10 more)* |
| `CHOSEN_SCHEME` | **8** | `01012` Crisis Interdiction (event), `01019b` Jennifer Walters (alter_ego), `01026` Superhuman Law Division (support), `01037` Mark V Helmet (upgrade), `01048` Tactical Genius (upgrade) *(+3 more)* |
| `HERO` | **7** | `01159` Ritual Combat (treachery), `01164` Titania's Fury (treachery), `01167` Vulture (minion), `01168` Sweeping Swoop (treachery), `01169` The Vulture's Plans (treachery) *(+2 more)* |
| `VILLAIN` | **6** | `01098` Armored Rhino Suit (attachment), `01099` Charge (attachment), `01100` Enhanced Ivory Horn (attachment), `01104` Hard to Keep Down (treachery), `01105` "I'm Tough" (treachery) *(+1 more)* |
| `MAIN_SCHEME` | **4** | `01007` Spider-Tracer (upgrade), `01023` Legal Practice (event), `01063` Interrogation Room (support), `01194` Unknown Card #01194 |
| `CHOSEN_PLAYER` | **4** | `01010b` Carol Danvers (alter_ego), `01034` Stark Tower (support), `01091` Avengers Mansion (support), `01092` Helicarrier (support) |
| `SELF_IDENTITY` | **3** | `01010a` Captain Marvel (hero), `01035` Arc Reactor (upgrade), `01073` The Triskelion (support) |
| `CHOSEN_MINION` | **2** | `01007` Spider-Tracer (upgrade), `01053` Relentless Assault (event) |
| `ALL_ENEMIES` | **2** | `01022` Ground Stomp (event), `01030` War Machine (ally) |
| `CHOSEN_ALLY` | **2** | `01069` Get Ready (event), `01074` Inspired (upgrade) |
| `CHOSEN_CHARACTER` | **2** | `01080` Med Team (support), `01086` First Aid (event) |
| `ALL_HEROES` | **2** | `01096` Rhino (villain), `01103` Shocker (minion) |
| `ACTIVE_PLAYER` | **2** | `01106` Stampede (treachery), `01188` Caught Off Guard (treachery) |
| `THIS_SIDE_SCHEME` | **2** | `01107` Breakin' & Takin' (side_scheme), `01109` Bomb Scare (side_scheme) |
| `ENEMY` | **1** | `01009` Webbed Up (upgrade) |
| `ATTACK_TARGET` | **1** | `01028` Superhuman Strength (upgrade) |
| `TRIGGERING_MINION` | **1** | `01066` Hawkeye (ally) |
| `ALL_PLAYERS` | **1** | `01067` Maria Hill (ally) |
| `ATTACKING_ENEMY` | **1** | `01077` Counter-Punch (event) |
| `ATTACHED_VILLAIN` | **1** | `01098` Armored Rhino Suit (attachment) |
| `ACTIVE_IDENTITY` | **1** | `01112` False Alarm (treachery) |