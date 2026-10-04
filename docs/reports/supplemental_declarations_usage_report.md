# Supplemental Card Declarations Usage & Impact Report

> **Generated:** `2026-10-04T20:28:50.758Z`  
> **Source Packs Scanned:** `core, core_encounter, cw_encounter`

---

## 📊 1. Executive Summary

| Metric | Count | Description |
| :--- | :--- | :--- |
| **Total Cards Registered** | **157** | Total cards present in `src/data/supplemental/` |
| **Active Declared Cards** | **140** | Cards with executable `abilities: [...]` |
| **No Supplemental Needed** | **11** | Vanilla / passive cards explicitly verified as requiring no supplemental hooks |
| **Open Ambiguity Reports** | **8** | Blocked cards isolated in `docs/ambiguities/` (Inbox Zero Queue) |
| **False-Vanilla Violations** | **0** | 🚨 Cards marked `noSupplementalNeeded` that have printed rules text |
| **Total Abilities Declared** | **157** | Total individual ability definitions declared |
| **Single-Step Abilities (1 Step)** | **135** | Abilities with exactly 1 atomic execution step |
| **Multi-Step Abilities (2+ Steps)** | **22** | Abilities decomposed into sequenced execution pipelines |
| **Cards with Multi-Step Sequences** | **22** | Cards containing at least 1 ability with 2+ steps |
| **Cards with Multiple Abilities (2+)** | **16** | Cards declaring more than 1 distinct ability header |
| **Unique Effects In Use** | **43** | Distinct effect primitive types actively declared |
| **Unique Triggers In Use** | **20** | Distinct trigger window types actively declared |
| **Unique Timings In Use** | **17** | Distinct timing categories actively declared |
| **Unique Cost Keys In Use** | **9** | Distinct ability cost types actively declared |

---

## 🔴 2. Active Ambiguity & Blocker Queue (Inbox Zero Queue — 8 Cards)

These **8 cards** are currently isolated in [`docs/ambiguities/`](../ambiguities/README.md) pending rules engine primitives, targeting extensions, or nested resolution stack implementations. As each card is integrated and reaches $\ge 95\%$ confidence, its file is deleted to achieve **Inbox Zero**:

| Card Code | Card Name | Pack | Confidence | Blocker Category | Ambiguity Report File |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `01159` | **Ritual Combat** | `core_encounter` | `70%` | `MISSING_ENGINE_PRIMITIVE` | [`core_encounter_01159_ritual-combat.md`](../ambiguities/core_encounter_01159_ritual-combat.md) |
| `01164` | **Titania** | `core_encounter` | `80%` | `MISSING_ENGINE_PRIMITIVE` | [`core_encounter_01164_titanias-fury.md`](../ambiguities/core_encounter_01164_titanias-fury.md) |
| `01168` | **Sweeping Swoop** | `core_encounter` | `70%` | `MISSING_ENGINE_PRIMITIVE` | [`core_encounter_01168_sweeping-swoop.md`](../ambiguities/core_encounter_01168_sweeping-swoop.md) |
| `01169` | **The Vulture** | `core_encounter` | `70%` | `MISSING_ENGINE_PRIMITIVE` | [`core_encounter_01169_vultures-plans.md`](../ambiguities/core_encounter_01169_vultures-plans.md) |
| `01174` | **Electromagnetic Backlash** | `core_encounter` | `70%` | `MISSING_ENGINE_PRIMITIVE` | [`core_encounter_01174_electromagnetic-backlash.md`](../ambiguities/core_encounter_01174_electromagnetic-backlash.md) |
| `01179` | **Yon-Rogg** | `core_encounter` | `70%` | `MISSING_ENGINE_PRIMITIVE` | [`core_encounter_01179_yon-roggs-treason.md`](../ambiguities/core_encounter_01179_yon-roggs-treason.md) |
| `01191` | **Exhaustion** | `core_encounter` | `90%` | `MISSING_ENGINE_PRIMITIVE` | [`core_encounter_surge-keyword.md`](../ambiguities/core_encounter_surge-keyword.md) |
| `56128b` | **Now It** | `cw_encounter` | `50%` | `MISSING_ENGINE_PRIMITIVE` | [`cw_56128b_now-its-personal.md`](../ambiguities/cw_56128b_now-its-personal.md) |

---

## 🟢 3. Cards Explicitly Requiring No Supplemental Data (Vanilla / Passive — 11 Cards)

These **11 cards** have been audited and explicitly verified as `"noSupplementalNeeded": true` (standard double resource generators, vanilla baseline minions, basic identity cards, or schemes with no custom trigger hooks):

| Card Code | Card Name | Type | Faction / Aspect | Pack | Description / Comment |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `01014` | **Energy Absorption** | `resource` | `hero` | `core` | No abilities required (Vanilla / Base Stats / Standard Resource) |
| `01044` | **Vibranium** | `resource` | `hero` | `core` | No abilities required (Vanilla / Base Stats / Standard Resource) |
| `01088` | **Energy** | `resource` | `basic` | `core` | No abilities required (Vanilla / Base Stats / Standard Resource) |
| `01089` | **Genius** | `resource` | `basic` | `core` | No abilities required (Vanilla / Base Stats / Standard Resource) |
| `01090` | **Strength** | `resource` | `basic` | `core` | No abilities required (Vanilla / Base Stats / Standard Resource) |
| `01094` | **Rhino** | `villain` | `encounter` | `core_encounter` | No abilities required (Vanilla / Base Stats / Standard Resource) |
| `01097a` | **The Break-In!** | `main_scheme` | `encounter` | `core_encounter` | No abilities required (Vanilla / Base Stats / Standard Resource) |
| `01097b` | **The Break-In!** | `main_scheme` | `encounter` | `core_encounter` | No abilities required (Vanilla / Base Stats / Standard Resource) |
| `01108` | **Crowd Control** | `side_scheme` | `encounter` | `core_encounter` | No abilities required (Vanilla / Base Stats / Standard Resource) |
| `01156` | **Usurp The Throne** | `side_scheme` | `encounter` | `core_encounter` | No abilities required (Vanilla / Base Stats / Standard Resource) |
| `01167` | **Vulture** | `minion` | `encounter` | `core_encounter` | No abilities required (Vanilla / Base Stats / Standard Resource) |

---

## 📋 4. Cards with Multiple Abilities (2+ Abilities Declared — 16 Cards)

These **16 cards** declare multiple distinct ability headers (e.g. dual Hero/Alter-Ego actions, combined Constant modifiers with triggered Actions, or multiple Response triggers):

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
| `01096` | **Rhino** | `villain` | `core_encounter` | **2** | • `rhino_stage_iii_when_revealed` (`WHEN_REVEALED` / `WHEN_REVEALED`, **1 step**)<br/>• `rhino_stage_iii_tough` (`SETUP`, **1 step**) |
| `01099` | **Charge** | `attachment` | `core_encounter` | **2** | • `charge_atk_bonus` (`CONSTANT`, **1 step**)<br/>• `charge_overkill` (`CONSTANT`, **1 step**) |
| `01100` | **Enhanced Ivory Horn** | `attachment` | `core_encounter` | **2** | • `ivory_horn_atk_bonus` (`CONSTANT`, **1 step**)<br/>• `ivory_horn_discard_action` (`HERO_ACTION`, **1 step**) |
| `01102` | **Sandman** | `minion` | `core_encounter` | **2** | • `sandman_toughness` (`SETUP`, **1 step**)<br/>• `sandman_attack_discard` (`FORCED_RESPONSE` / `MINION_ATTACKED`, **1 step**) |
| `01166` | **Highway Robbery** | `side_scheme` | `core_encounter` | **2** | • `highway_robbery_when_revealed` (`WHEN_REVEALED`, **1 step**)<br/>• `highway_robbery_when_defeated` (`FORCED_RESPONSE` / `DEFEATED`, **1 step**) |
| `01172` | **Whiplash** | `minion` | `core_encounter` | **2** | • `whiplash_response` (`FORCED_RESPONSE` / `WHEN_REVEALED`, **1 step**)<br/>• `whiplash_retaliate` (`CONSTANT`, **1 step**) |
| `01173` | **Electric Whip Attack** | `treachery` | `core_encounter` | **2** | • `electric_whip_attack` (`CONSTANT`, **1 step**)<br/>• `electric_whip_attack_boost` (`BOOST` / `BOOST`, **1 step**) |
| `01178` | **Kree Manipulator** | `treachery` | `core_encounter` | **2** | • `kree_manipulator_when_revealed` (`WHEN_REVEALED` / `WHEN_REVEALED`, **1 step**)<br/>• `kree_manipulator_boost` (`BOOST` / `BOOST_STAR_RESOLVED`, **1 step**) |

---

## 💥 5. High-Impact Primitives (Blast-Radius $\ge 5$ Cards)

Changing these primitives will affect many cards across the entire game engine:

| Category | Primitive Name | Card Count | Example Cards |
| :--- | :--- | :--- | :--- |
| **Effect** | `DEAL_DAMAGE` | **24** | `01005` Swinging Web Kick (event), `01013` Photonic Blast (event), `01018` Energy Channel (upgrade) *(+20 more)* |
| **Effect** | `ADD_STATUS` | **15** | `01009` Webbed Up (upgrade), `01011` Spider-Woman (ally), `01028` Superhuman Strength (upgrade) *(+11 more)* |
| **Effect** | `MODIFY_STAT` | **13** | `01016` Captain Marvel's Helmet (upgrade), `01028` Superhuman Strength (upgrade), `01057` Combat Training (upgrade) *(+8 more)* |
| **Effect** | `DISCARD` | **11** | `01002` Black Cat (ally), `01009` Webbed Up (upgrade), `01031` Repulsor Blast (event) *(+7 more)* |
| **Effect** | `REMOVE_THREAT` | **11** | `01007` Spider-Tracer (upgrade), `01012` Crisis Interdiction (event), `01023` Legal Practice (event) *(+7 more)* |
| **Effect** | `DRAW` | **10** | `01001a` Spider-Man (hero), `01010a` Captain Marvel (hero), `01010b` Carol Danvers (alter_ego) *(+7 more)* |
| **Effect** | `ADD_THREAT` | **9** | `01107` Breakin' & Takin' (side_scheme), `01109` Bomb Scare (side_scheme), `01161` Personal Challenge (side_scheme) *(+5 more)* |
| **Effect** | `PLAYER_CHOICE` | **8** | `01068` Vision (ally), `01084` Nick Fury (ally), `01110` Hydra Bomber (minion) *(+5 more)* |
| **Effect** | `SURGE` | **8** | `01104` Hard to Keep Down (treachery), `01105` "I'm Tough" (treachery), `01106` Stampede (treachery) *(+5 more)* |
| **Effect** | `HEAL_DAMAGE` | **6** | `01006` Aunt May (support), `01051` Tigra (ally), `01080` Med Team (support) *(+3 more)* |
| **Effect** | `SEARCH` | **6** | `01029b` Tony Stark (alter_ego), `01034` Stark Tower (support), `01040b` T'Challa (alter_ego) *(+3 more)* |
| **Effect** | `READY` | **5** | `01024` One-Two Punch (event), `01035` Arc Reactor (upgrade), `01069` Get Ready (event) *(+2 more)* |
| **Effect** | `CHANGE_FORM` | **5** | `01155` Affairs of State (obligation), `01160` Legal Work (obligation), `01165` Eviction Notice (obligation) *(+2 more)* |
| **Trigger** | `WHEN_REVEALED` | **29** | `01095` Rhino (villain), `01096` Rhino (villain), `01103` Shocker (minion) *(+26 more)* |
| **Trigger** | `ENTERS_PLAY` | **10** | `01011` Spider-Woman (ally), `01041` Shuri (ally), `01067` Maria Hill (ally) *(+7 more)* |

---

## 🔍 6. Single-Use & Unique Primitives (Card Count = 1)

These primitives are only declared on a single card. They represent high specialization and are prime candidates for decomposition into composable generic primitives:

| Category | Primitive Name | Card Code | Card Name & Pack | Ability ID |
| :--- | :--- | :--- | :--- | :--- |
| **Effect** | `ADD_COUNTERS` | `01018` | Energy Channel (upgrade) (core) | `energy_channel_add` |
| **Effect** | `ATTACH_FACEDOWN_CARDS_FROM_HAND` | `01166` | Highway Robbery (side_scheme) (core_encounter) | `highway_robbery_when_revealed` |
| **Effect** | `ATTACHMENT_DAMAGE_SHIELD` | `01098` | Armored Rhino Suit (attachment) (core_encounter) | `armored_rhino_suit_shield` |
| **Effect** | `CANCEL_ATTACK` | `01009` | Webbed Up (upgrade) (core) | `webbed_up_interrupt` |
| **Effect** | `CANCEL_WHEN_REVEALED_AND_REVEAL_ANOTHER` | `01075` | Black Widow (ally) (core) | `black_widow_cancel` |
| **Effect** | `EXHAUST` | `01191` | Exhaustion (treachery) (core_encounter) | `exhaustion_when_revealed` |
| **Effect** | `FLIP_FORM` | `01025` | Split Personality (event) (core) | `split_personality` |
| **Effect** | `GIVE_ADDITIONAL_BOOST_CARD` | `01164` | Titania's Fury (treachery) (core_encounter) | `titanias_fury_boost` |
| **Effect** | `MODIFY_ALLY_LIMIT` | `01073` | The Triskelion (support) (core) | `triskelion_ally_limit` |
| **Effect** | `MODIFY_HAND_SIZE` | `01029a` | Iron Man (hero) (core) | `iron_man_hand_size` |
| **Effect** | `PLAY_FROM_ZONE` | `01071` | Make the Call (event) (core) | `make_the_call` |
| **Effect** | `REDUCE_NEXT_CARD_COST` | `01092` | Helicarrier (support) (core) | `helicarrier_action` |
| **Effect** | `REVEAL_ENCOUNTER_CARD` | `01193` | Under Fire (treachery) (core_encounter) | `under_fire_when_revealed` |
| **Effect** | `SHUFFLE_INTO_DECK` | `01190` | Shadow of the Past (treachery) (core_encounter) | `shadow_of_the_past_when_revealed` |
| **Effect** | `TRANSFER_DAMAGE` | `01049` | Vibranium Suit (upgrade) (core) | `vibranium_suit_special` |
| **Effect** | `VILLAIN_AND_ENGAGED_MINIONS_ATTACK` | `01189` | Gang-Up (treachery) (core_encounter) | `gang_up_when_revealed` |
| **Effect** | `VILLAIN_SCHEMES` | `01186` | Advance (treachery) (core_encounter) | `advance_when_revealed` |
| **Trigger** | `BASIC_ATTACK_PERFORMED` | `01024` | One-Two Punch (event) (core) | `one_two_punch_response` |
| **Trigger** | `BOOST_STAR_RESOLVED` | `01178` | Kree Manipulator (treachery) (core_encounter) | `kree_manipulator_boost` |
| **Trigger** | `CARD_PLAYED` | `01002` | Black Cat (ally) (core) | `black_cat_when_played` |
| **Trigger** | `ENEMY_INITIATES_ATTACK` | `01001a` | Spider-Man (hero) (core) | `spider_sense` |
| **Trigger** | `FORM_CHANGED` | `01019a` | She-Hulk (hero) (core) | `she_hulk_form_change` |
| **Trigger** | `HOST_WOULD_ATTACK` | `01009` | Webbed Up (upgrade) (core) | `webbed_up_interrupt` |
| **Trigger** | `MINION_ENTERS_PLAY` | `01066` | Hawkeye (ally) (core) | `hawkeye_arrow_response` |
| **Trigger** | `ROUND_ENDED` | `01084` | Nick Fury (ally) (core) | `nick_fury_round_end_discard` |
| **Trigger** | `THWART_RESOLVED` | `01058` | Daredevil (ally) (core) | `daredevil_after_thwart` |

---

## ⚠️ 7. Zero-Usage / Unused Primitives (In Specifications but 0 Card Declarations)

These primitives are declared in schema types or specifications but have **0 active card declarations** in supplemental data packs:

| Category | Specified Primitive | Status | Notes |
| :--- | :--- | :--- | :--- |
| **Effect** | `ADD_ACCELERATION` | 🟡 `0 Cards` | Documented in `docs/specifications/supplemental/` but has 0 card declarations. |
| **Effect** | `REMOVE_COUNTERS` | 🟡 `0 Cards` | Documented in `docs/specifications/supplemental/` but has 0 card declarations. |
| **Effect** | `REMOVE_FROM_GAME` | 🟡 `0 Cards` | Documented in `docs/specifications/supplemental/` but has 0 card declarations. |
| **Effect** | `SPEND_COUNTERS` | 🟡 `0 Cards` | Documented in `docs/specifications/supplemental/` but has 0 card declarations. |
| **Trigger** | `ATTACK` | 🟡 `0 Cards` | Defined in `TriggerTypeSchema` but has 0 card declarations. |
| **Trigger** | `DAMAGE_TAKEN` | 🟡 `0 Cards` | Defined in `TriggerTypeSchema` but has 0 card declarations. |
| **Trigger** | `MAIN_SCHEME_ADVANCED` | 🟡 `0 Cards` | Defined in `TriggerTypeSchema` but has 0 card declarations. |
| **Trigger** | `PLAYER_PHASE_BEGAN` | 🟡 `0 Cards` | Defined in `TriggerTypeSchema` but has 0 card declarations. |
| **Trigger** | `PLAYER_PHASE_ENDED` | 🟡 `0 Cards` | Defined in `TriggerTypeSchema` but has 0 card declarations. |
| **Trigger** | `RESOURCE_SPENT` | 🟡 `0 Cards` | Defined in `TriggerTypeSchema` but has 0 card declarations. |
| **Trigger** | `ROUND_BEGAN` | 🟡 `0 Cards` | Defined in `TriggerTypeSchema` but has 0 card declarations. |
| **Trigger** | `SCHEME_DEFEATED` | 🟡 `0 Cards` | Defined in `TriggerTypeSchema` but has 0 card declarations. |
| **Trigger** | `STATUS_REMOVED` | 🟡 `0 Cards` | Defined in `TriggerTypeSchema` but has 0 card declarations. |
| **Trigger** | `THREAT_PLACED` | 🟡 `0 Cards` | Defined in `TriggerTypeSchema` but has 0 card declarations. |
| **Trigger** | `VILLAIN_PHASE_BEGAN` | 🟡 `0 Cards` | Defined in `TriggerTypeSchema` but has 0 card declarations. |
| **Trigger** | `VILLAIN_PHASE_ENDED` | 🟡 `0 Cards` | Defined in `TriggerTypeSchema` but has 0 card declarations. |

---

## 📑 8. Complete Effects Inventory

| Effect Primitive | Occurrences | Declaring Cards |
| :--- | :--- | :--- |
| `DEAL_DAMAGE` | **24** | `01005` (Swinging Web Kick (event)), `01013` (Photonic Blast (event)), `01018` (Energy Channel (upgrade)), `01019a` (She-Hulk (hero)), `01021` (Gamma Slam (event)), `01022` (Ground Stomp (event)), `01030` (War Machine (ally)), `01031` (Repulsor Blast (event)), `01032` (Supersonic Punch (event)), `01038` (Powered Gauntlets (upgrade)), `01046` (Energy Daggers (upgrade)), `01047` (Panther Claws (upgrade)), `01050` (Hulk (ally)), `01053` (Relentless Assault (event)), `01054` (Uppercut (event)), `01056` (Tac Team (support)), `01058` (Daredevil (ally)), `01061` (Great Responsibility (event)), `01066` (Hawkeye (ally)), `01077` (Counter-Punch (event)), `01087` (Haymaker (event)), `01103` (Shocker (minion)), `01111` (Explosion (treachery)) |
| `ADD_STATUS` | **15** | `01009` (Webbed Up (upgrade)), `01011` (Spider-Woman (ally)), `01028` (Superhuman Strength (upgrade)), `01076` (Luke Cage (ally)), `01083` (Mockingbird (ally)), `01096` (Rhino (villain)), `01102` (Sandman (minion)), `01105` ("I'm Tough" (treachery)), `01112` (False Alarm (treachery)), `01157` (Killmonger (minion)), `01162` (Titania (minion)), `01163` (Genetically Enhanced (attachment)), `01172` (Whiplash (minion)), `01194` (Unknown Card #01194) |
| `MODIFY_STAT` | **13** | `01016` (Captain Marvel's Helmet (upgrade)), `01028` (Superhuman Strength (upgrade)), `01057` (Combat Training (upgrade)), `01059` (Jessica Jones (ally)), `01065` (Heroic Intuition (upgrade)), `01070` (Lead from the Front (event)), `01074` (Inspired (upgrade)), `01081` (Armored Vest (upgrade)), `01099` (Charge (attachment)), `01100` (Enhanced Ivory Horn (attachment)), `01173` (Electric Whip Attack (treachery)) |
| `DISCARD` | **11** | `01002` (Black Cat (ally)), `01009` (Webbed Up (upgrade)), `01031` (Repulsor Blast (event)), `01050` (Hulk (ally)), `01084` (Nick Fury (ally)), `01100` (Enhanced Ivory Horn (attachment)), `01102` (Sandman (minion)), `01173` (Electric Whip Attack (treachery)), `01188` (Caught Off Guard (treachery)), `01195` (Unknown Card #01195) |
| `REMOVE_THREAT` | **11** | `01007` (Spider-Tracer (upgrade)), `01012` (Crisis Interdiction (event)), `01023` (Legal Practice (event)), `01026` (Superhuman Law Division (support)), `01037` (Mark V Helmet (upgrade)), `01048` (Tactical Genius (upgrade)), `01052` (Chase Them Down (event)), `01060` (For Justice! (event)), `01063` (Interrogation Room (support)), `01064` (Surveillance Team (support)) |
| `DRAW` | **10** | `01001a` (Spider-Man (hero)), `01010a` (Captain Marvel (hero)), `01010b` (Carol Danvers (alter_ego)), `01013` (Photonic Blast (event)), `01015` (Alpha Flight Station (support)), `01025` (Split Personality (event)), `01027` (Focused Rage (upgrade)), `01045` (The Golden City (support)), `01067` (Maria Hill (ally)), `01091` (Avengers Mansion (support)) |
| `ADD_THREAT` | **9** | `01107` (Breakin' & Takin' (side_scheme)), `01109` (Bomb Scare (side_scheme)), `01161` (Personal Challenge (side_scheme)), `01171` (Imminent Overload (side_scheme)), `01176` (The Psyche-Magnitron (side_scheme)), `01177` (Yon-Rogg (minion)), `01178` (Kree Manipulator (treachery)), `01192` (Masterplan (treachery)) |
| `PLAYER_CHOICE` | **8** | `01068` (Vision (ally)), `01084` (Nick Fury (ally)), `01110` (Hydra Bomber (minion)), `01155` (Affairs of State (obligation)), `01160` (Legal Work (obligation)), `01165` (Eviction Notice (obligation)), `01170` (Business Problems (obligation)), `01175` (Family Emergency (obligation)) |
| `SURGE` | **8** | `01104` (Hard to Keep Down (treachery)), `01105` ("I'm Tough" (treachery)), `01106` (Stampede (treachery)), `01111` (Explosion (treachery)), `01187` (Assault (treachery)), `01189` (Gang-Up (treachery)), `01190` (Shadow of the Past (treachery)), `01193` (Under Fire (treachery)) |
| `HEAL_DAMAGE` | **6** | `01006` (Aunt May (support)), `01051` (Tigra (ally)), `01080` (Med Team (support)), `01086` (First Aid (event)), `01104` (Hard to Keep Down (treachery)), `01158` (Heart-Shaped Herb (treachery)) |
| `SEARCH` | **6** | `01029b` (Tony Stark (alter_ego)), `01034` (Stark Tower (support)), `01040b` (T'Challa (alter_ego)), `01041` (Shuri (ally)), `01042` (Ancestral Knowledge (event)), `01095` (Rhino (villain)) |
| `READY` | **5** | `01024` (One-Two Punch (event)), `01035` (Arc Reactor (upgrade)), `01069` (Get Ready (event)), `01082` (Indomitable (upgrade)), `01093` (Tenacity (upgrade)) |
| `CHANGE_FORM` | **5** | `01155` (Affairs of State (obligation)), `01160` (Legal Work (obligation)), `01165` (Eviction Notice (obligation)), `01170` (Business Problems (obligation)), `01175` (Family Emergency (obligation)) |
| `GRANT_KEYWORD` | **4** | `01040a` (Black Panther (hero)), `01099` (Charge (attachment)), `01101` (Hydra Mercenary (minion)), `01172` (Whiplash (minion)) |
| `EXECUTE_WAKANDA_FOREVER` | **4** | `01043a` (Wakanda Forever! (event)), `01043b` (Wakanda Forever! (event)), `01043c` (Wakanda Forever! (event)), `01043d` (Wakanda Forever! (event)) |
| `DOUBLE_RESOURCE_FOR_ASPECT` | **4** | `01055` (The Power of Aggression (resource)), `01062` (The Power of Justice (resource)), `01072` (The Power of Leadership (resource)), `01079` (The Power of Protection (resource)) |
| `GENERATE_RESOURCE` | **3** | `01001b` (Peter Parker (alter_ego)), `01008` (Web-Shooter (upgrade)), `01033` (Pepper Potts (support)) |
| `ATTACH_TO_HOST` | **3** | `01007` (Spider-Tracer (upgrade)), `01009` (Webbed Up (upgrade)), `01074` (Inspired (upgrade)) |
| `PREVENT_THREAT` | **3** | `01019b` (Jennifer Walters (alter_ego)), `01061` (Great Responsibility (event)), `01085` (Emergency (event)) |
| `VILLAIN_ATTACKS` | **3** | `01078` (Get Behind Me! (event)), `01106` (Stampede (treachery)), `01187` (Assault (treachery)) |
| `PREVENT_DAMAGE` | **2** | `01003` (Backflip (event)), `01017` (Cosmic Flight (upgrade)) |
| `CANCEL_WHEN_REVEALED` | **2** | `01004` (Enhanced Spider-Sense (event)), `01078` (Get Behind Me! (event)) |
| `ADD_TRAIT` | **2** | `01017` (Cosmic Flight (upgrade)), `01039` (Rocket Boots (upgrade)) |
| `RETURN_TO_HAND` | **2** | `01020` (Hellcat (ally)), `01166` (Highway Robbery (side_scheme)) |
| `MODIFY_MAX_HEALTH` | **2** | `01036` (Mark V Armor (upgrade)), `01039` (Rocket Boots (upgrade)) |
| `PUT_INTO_PLAY` | **2** | `01190` (Shadow of the Past (treachery)) |
| `CANCEL_ATTACK` | **1** | `01009` (Webbed Up (upgrade)) |
| `ADD_COUNTERS` | **1** | `01018` (Energy Channel (upgrade)) |
| `FLIP_FORM` | **1** | `01025` (Split Personality (event)) |
| `MODIFY_HAND_SIZE` | **1** | `01029a` (Iron Man (hero)) |
| `TRANSFER_DAMAGE` | **1** | `01049` (Vibranium Suit (upgrade)) |
| `PLAY_FROM_ZONE` | **1** | `01071` (Make the Call (event)) |
| `MODIFY_ALLY_LIMIT` | **1** | `01073` (The Triskelion (support)) |
| `CANCEL_WHEN_REVEALED_AND_REVEAL_ANOTHER` | **1** | `01075` (Black Widow (ally)) |
| `REDUCE_NEXT_CARD_COST` | **1** | `01092` (Helicarrier (support)) |
| `ATTACHMENT_DAMAGE_SHIELD` | **1** | `01098` (Armored Rhino Suit (attachment)) |
| `GIVE_ADDITIONAL_BOOST_CARD` | **1** | `01164` (Titania's Fury (treachery)) |
| `ATTACH_FACEDOWN_CARDS_FROM_HAND` | **1** | `01166` (Highway Robbery (side_scheme)) |
| `VILLAIN_SCHEMES` | **1** | `01186` (Advance (treachery)) |
| `VILLAIN_AND_ENGAGED_MINIONS_ATTACK` | **1** | `01189` (Gang-Up (treachery)) |
| `SHUFFLE_INTO_DECK` | **1** | `01190` (Shadow of the Past (treachery)) |
| `EXHAUST` | **1** | `01191` (Exhaustion (treachery)) |
| `REVEAL_ENCOUNTER_CARD` | **1** | `01193` (Under Fire (treachery)) |

---

## ⏱️ 9. Complete Triggers Inventory

| Trigger Window | Occurrences | Declaring Cards |
| :--- | :--- | :--- |
| `WHEN_REVEALED` | **29** | `01095` (Rhino (villain)), `01096` (Rhino (villain)), `01103` (Shocker (minion)), `01104` (Hard to Keep Down (treachery)), `01105` ("I'm Tough" (treachery)), `01106` (Stampede (treachery)), `01107` (Breakin' & Takin' (side_scheme)), `01109` (Bomb Scare (side_scheme)), `01110` (Hydra Bomber (minion)), `01111` (Explosion (treachery)), `01112` (False Alarm (treachery)), `01157` (Killmonger (minion)), `01158` (Heart-Shaped Herb (treachery)), `01161` (Personal Challenge (side_scheme)), `01162` (Titania (minion)), `01171` (Imminent Overload (side_scheme)), `01172` (Whiplash (minion)), `01176` (The Psyche-Magnitron (side_scheme)), `01178` (Kree Manipulator (treachery)), `01186` (Advance (treachery)), `01187` (Assault (treachery)), `01188` (Caught Off Guard (treachery)), `01189` (Gang-Up (treachery)), `01190` (Shadow of the Past (treachery)), `01191` (Exhaustion (treachery)), `01192` (Masterplan (treachery)), `01193` (Under Fire (treachery)), `01194` (Unknown Card #01194), `01195` (Unknown Card #01195) |
| `ENTERS_PLAY` | **10** | `01011` (Spider-Woman (ally)), `01041` (Shuri (ally)), `01067` (Maria Hill (ally)), `01083` (Mockingbird (ally)), `01084` (Nick Fury (ally)), `01155` (Affairs of State (obligation)), `01160` (Legal Work (obligation)), `01165` (Eviction Notice (obligation)), `01170` (Business Problems (obligation)), `01175` (Family Emergency (obligation)) |
| `DAMAGE_WOULD_BE_TAKEN` | **3** | `01003` (Backflip (event)), `01017` (Cosmic Flight (upgrade)), `01098` (Armored Rhino Suit (attachment)) |
| `TREACHERY_REVEALED` | **3** | `01004` (Enhanced Spider-Sense (event)), `01075` (Black Widow (ally)), `01078` (Get Behind Me! (event)) |
| `CHARACTER_DEFEATED` | **3** | `01007` (Spider-Tracer (upgrade)), `01051` (Tigra (ally)), `01063` (Interrogation Room (support)) |
| `THREAT_WOULD_BE_PLACED` | **3** | `01019b` (Jennifer Walters (alter_ego)), `01061` (Great Responsibility (event)), `01085` (Emergency (event)) |
| `ATTACK_RESOLVED` | **2** | `01028` (Superhuman Strength (upgrade)), `01050` (Hulk (ally)) |
| `DEFEATED` | **2** | `01052` (Chase Them Down (event)), `01166` (Highway Robbery (side_scheme)) |
| `ATTACK_DEFENDED` | **2** | `01077` (Counter-Punch (event)), `01082` (Indomitable (upgrade)) |
| `MINION_ATTACKED` | **2** | `01102` (Sandman (minion)), `01177` (Yon-Rogg (minion)) |
| `BOOST` | **2** | `01164` (Titania's Fury (treachery)), `01173` (Electric Whip Attack (treachery)) |
| `ENEMY_INITIATES_ATTACK` | **1** | `01001a` (Spider-Man (hero)) |
| `CARD_PLAYED` | **1** | `01002` (Black Cat (ally)) |
| `HOST_WOULD_ATTACK` | **1** | `01009` (Webbed Up (upgrade)) |
| `FORM_CHANGED` | **1** | `01019a` (She-Hulk (hero)) |
| `BASIC_ATTACK_PERFORMED` | **1** | `01024` (One-Two Punch (event)) |
| `THWART_RESOLVED` | **1** | `01058` (Daredevil (ally)) |
| `MINION_ENTERS_PLAY` | **1** | `01066` (Hawkeye (ally)) |
| `ROUND_ENDED` | **1** | `01084` (Nick Fury (ally)) |
| `BOOST_STAR_RESOLVED` | **1** | `01178` (Kree Manipulator (treachery)) |

---

## 🎯 10. Timings, Costs & Target Selectors Inventory

### Ability Timings:
| Timing | Occurrences | Cards |
| :--- | :--- | :--- |
| `HERO_ACTION` | **26** | `01005` Swinging Web Kick (event), `01009` Webbed Up (upgrade), `01010a` Captain Marvel (hero), `01012` Crisis Interdiction (event), `01013` Photonic Blast (event) *(+21 more)* |
| `WHEN_REVEALED` | **23** | `01095` Rhino (villain), `01096` Rhino (villain), `01103` Shocker (minion), `01104` Hard to Keep Down (treachery), `01105` "I'm Tough" (treachery) *(+18 more)* |
| `CONSTANT` | **21** | `01016` Captain Marvel's Helmet (upgrade), `01017` Cosmic Flight (upgrade), `01028` Superhuman Strength (upgrade), `01029a` Iron Man (hero), `01036` Mark V Armor (upgrade) *(+14 more)* |
| `FORCED_RESPONSE` | **20** | `01002` Black Cat (ally), `01028` Superhuman Strength (upgrade), `01050` Hulk (ally), `01084` Nick Fury (ally), `01102` Sandman (minion) *(+14 more)* |
| `ACTION` | **16** | `01007` Spider-Tracer (upgrade), `01015` Alpha Flight Station (support), `01018` Energy Channel (upgrade), `01020` Hellcat (ally), `01025` Split Personality (event) *(+11 more)* |
| `RESPONSE` | **11** | `01011` Spider-Woman (ally), `01024` One-Two Punch (event), `01041` Shuri (ally), `01051` Tigra (ally), `01052` Chase Them Down (event) *(+6 more)* |
| `ALTER_EGO_ACTION` | **8** | `01006` Aunt May (support), `01010b` Carol Danvers (alter_ego), `01023` Legal Practice (event), `01026` Superhuman Law Division (support), `01029b` Tony Stark (alter_ego) *(+3 more)* |
| `RESOURCE` | **6** | `01001b` Peter Parker (alter_ego), `01033` Pepper Potts (support), `01055` The Power of Aggression (resource), `01062` The Power of Justice (resource), `01072` The Power of Leadership (resource) *(+1 more)* |
| `HERO_INTERRUPT` | **5** | `01004` Enhanced Spider-Sense (event), `01017` Cosmic Flight (upgrade), `01061` Great Responsibility (event), `01078` Get Behind Me! (event), `01082` Indomitable (upgrade) |
| `INTERRUPT` | **4** | `01001a` Spider-Man (hero), `01003` Backflip (event), `01075` Black Widow (ally), `01085` Emergency (event) |
| `SETUP` | **4** | `01040b` T'Challa (alter_ego), `01076` Luke Cage (ally), `01096` Rhino (villain), `01102` Sandman (minion) |
| `SPECIAL` | **4** | `01046` Energy Daggers (upgrade), `01047` Panther Claws (upgrade), `01048` Tactical Genius (upgrade), `01049` Vibranium Suit (upgrade) |
| `FORCED_INTERRUPT` | **3** | `01007` Spider-Tracer (upgrade), `01009` Webbed Up (upgrade), `01098` Armored Rhino Suit (attachment) |
| `BOOST` | **3** | `01164` Titania's Fury (treachery), `01173` Electric Whip Attack (treachery), `01178` Kree Manipulator (treachery) |
| `HERO_RESOURCE` | **1** | `01008` Web-Shooter (upgrade) |
| `HERO_RESPONSE` | **1** | `01019a` She-Hulk (hero) |
| `ALTER_EGO_INTERRUPT` | **1** | `01019b` Jennifer Walters (alter_ego) |
| `ALTER_EGO_RESOURCE` | 🟡 **0** | *Unused in supplemental declarations* |
| `ALTER_EGO_RESPONSE` | 🟡 **0** | *Unused in supplemental declarations* |

### Cost Primitives:
| Cost Key | Occurrences | Cards |
| :--- | :--- | :--- |
| `exhaustSelf` | **20** | `01006` Aunt May (support), `01008` Web-Shooter (upgrade), `01015` Alpha Flight Station (support), `01026` Superhuman Law Division (support), `01027` Focused Rage (upgrade) *(+15 more)* |
| `discardSelf` | **12** | `01003` Backflip (event), `01004` Enhanced Spider-Sense (event), `01017` Cosmic Flight (upgrade), `01018` Energy Channel (upgrade), `01024` One-Two Punch (event) *(+7 more)* |
| `resourceCost` | **9** | `01004` Enhanced Spider-Sense (event), `01018` Energy Channel (upgrade), `01024` One-Two Punch (event), `01026` Superhuman Law Division (support), `01068` Vision (ally) *(+4 more)* |
| `spendCounters` | **5** | `01008` Web-Shooter (upgrade), `01056` Tac Team (support), `01064` Surveillance Team (support), `01066` Hawkeye (ally), `01080` Med Team (support) |
| `resources` | **2** | `01010a` Captain Marvel (hero), `01039` Rocket Boots (upgrade) |
| `discardCard` | **2** | `01015` Alpha Flight Station (support), `01023` Legal Practice (event) |
| `heal` | **1** | `01010a` Captain Marvel (hero) |
| `damageHero` | **1** | `01027` Focused Rage (upgrade) |
| `damageSelf` | **1** | `01030` War Machine (ally) |

### Target Selectors:
| Target Selector | Occurrences | Cards |
| :--- | :--- | :--- |