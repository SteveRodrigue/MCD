# Supplemental Card Declarations Usage & Impact Report

> **Generated:** `2026-08-31T12:33:57.501Z`  
> **Source Packs Scanned:** `core, core_encounter`

---

## 📊 1. Executive Summary

| Metric | Count | Description |
| :--- | :--- | :--- |
| **Total Cards Registered** | **156** | Total cards present in `src/data/supplemental/` |
| **Active Declared Cards** | **115** | Cards with executable `abilities: [...]` |
| **No Supplemental Needed** | **9** | Vanilla / passive cards explicitly verified as requiring no supplemental hooks |
| **Open Ambiguity Reports** | **32** | Blocked cards isolated in `docs/ambiguities/` (Inbox Zero Queue) |
| **False-Vanilla Violations** | **0** | 🚨 Cards marked `noSupplementalNeeded` that have printed rules text |
| **Total Abilities Declared** | **128** | Total individual ability definitions declared |
| **Single-Step Abilities (1 Step)** | **123** | Abilities with exactly 1 atomic execution step |
| **Multi-Step Abilities (2+ Steps)** | **5** | Abilities decomposed into sequenced execution pipelines |
| **Cards with Multi-Step Sequences** | **5** | Cards containing at least 1 ability with 2+ steps |
| **Cards with Multiple Abilities (2+)** | **10** | Cards declaring more than 1 distinct ability header |
| **Unique Effects In Use** | **45** | Distinct effect primitive types actively declared |
| **Unique Triggers In Use** | **13** | Distinct trigger window types actively declared |
| **Unique Timings In Use** | **15** | Distinct timing categories actively declared |
| **Unique Cost Keys In Use** | **12** | Distinct ability cost types actively declared |

---

## 🔴 2. Active Ambiguity & Blocker Queue (Inbox Zero Queue — 32 Cards)

These **32 cards** are currently isolated in [`docs/ambiguities/`](../ambiguities/README.md) pending rules engine primitives, targeting extensions, or nested resolution stack implementations. As each card is integrated and reaches $\ge 95\%$ confidence, its file is deleted to achieve **Inbox Zero**:

| Card Code | Card Name | Pack | Confidence | Blocker Category | Ambiguity Report File |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `01004` | **Enhanced Spider-Sense** | `core` | `80%` | `PESSIMISTIC_CODE_AUDIT_GAP` | [`core_01004_enhanced_spider_sense.md`](../ambiguities/core_01004_enhanced_spider_sense.md) |
| `01016` | **Captain Marvel** | `core` | `80%` | `PESSIMISTIC_CODE_AUDIT_GAP` | [`core_01016_captain_marvel_s_helmet.md`](../ambiguities/core_01016_captain_marvel_s_helmet.md) |
| `01017` | **Cosmic Flight** | `core` | `80%` | `PESSIMISTIC_CODE_AUDIT_GAP` | [`core_01017_cosmic_flight.md`](../ambiguities/core_01017_cosmic_flight.md) |
| `01018` | **Energy Channel** | `core` | `80%` | `PESSIMISTIC_CODE_AUDIT_GAP` | [`core_01018_energy_channel.md`](../ambiguities/core_01018_energy_channel.md) |
| `01020` | **Hellcat (Patsy Walker)** | `core` | `80%` | `PESSIMISTIC_CODE_AUDIT_GAP` | [`core_01020_hellcat_patsy_walker.md`](../ambiguities/core_01020_hellcat_patsy_walker.md) |
| `01021` | **Gamma Slam** | `core` | `80%` | `PESSIMISTIC_CODE_AUDIT_GAP` | [`core_01021_gamma_slam.md`](../ambiguities/core_01021_gamma_slam.md) |
| `01024` | **One-Two Punch** | `core` | `80%` | `PESSIMISTIC_CODE_AUDIT_GAP` | [`core_01024_one_two_punch.md`](../ambiguities/core_01024_one_two_punch.md) |
| `01028` | **Superhuman Strength** | `core` | `80%` | `PESSIMISTIC_CODE_AUDIT_GAP` | [`core_01028_superhuman_strength.md`](../ambiguities/core_01028_superhuman_strength.md) |
| `01031` | **Repulsor Blast** | `core` | `80%` | `PESSIMISTIC_CODE_AUDIT_GAP` | [`core_01031_repulsor_blast.md`](../ambiguities/core_01031_repulsor_blast.md) |
| `01033` | **Pepper Potts** | `core` | `80%` | `PESSIMISTIC_CODE_AUDIT_GAP` | [`core_01033_pepper_potts.md`](../ambiguities/core_01033_pepper_potts.md) |
| `01034` | **Stark Tower** | `core` | `80%` | `PESSIMISTIC_CODE_AUDIT_GAP` | [`core_01034_stark_tower.md`](../ambiguities/core_01034_stark_tower.md) |
| `01040a` | **Black Panther** | `core` | `80%` | `PESSIMISTIC_CODE_AUDIT_GAP` | [`core_01040a_black_panther.md`](../ambiguities/core_01040a_black_panther.md) |
| `01040b` | **T** | `core` | `80%` | `PESSIMISTIC_CODE_AUDIT_GAP` | [`core_01040b_t_challa.md`](../ambiguities/core_01040b_t_challa.md) |
| `01041` | **Shuri** | `core` | `80%` | `PESSIMISTIC_CODE_AUDIT_GAP` | [`core_01041_shuri.md`](../ambiguities/core_01041_shuri.md) |
| `01042` | **Ancestral Knowledge** | `core` | `80%` | `PESSIMISTIC_CODE_AUDIT_GAP` | [`core_01042_ancestral_knowledge.md`](../ambiguities/core_01042_ancestral_knowledge.md) |
| `01043a` | **Wakanda Forever!** | `core` | `80%` | `PESSIMISTIC_CODE_AUDIT_GAP` | [`core_01043a_wakanda_forever.md`](../ambiguities/core_01043a_wakanda_forever.md) |
| `01043b` | **Wakanda Forever!** | `core` | `80%` | `PESSIMISTIC_CODE_AUDIT_GAP` | [`core_01043b_wakanda_forever.md`](../ambiguities/core_01043b_wakanda_forever.md) |
| `01043c` | **Wakanda Forever!** | `core` | `80%` | `PESSIMISTIC_CODE_AUDIT_GAP` | [`core_01043c_wakanda_forever.md`](../ambiguities/core_01043c_wakanda_forever.md) |
| `01043d` | **Wakanda Forever!** | `core` | `80%` | `PESSIMISTIC_CODE_AUDIT_GAP` | [`core_01043d_wakanda_forever.md`](../ambiguities/core_01043d_wakanda_forever.md) |
| `01046` | **Energy Daggers** | `core` | `80%` | `PESSIMISTIC_CODE_AUDIT_GAP` | [`core_01046_energy_daggers.md`](../ambiguities/core_01046_energy_daggers.md) |
| `01049` | **Vibranium Suit** | `core` | `80%` | `PESSIMISTIC_CODE_AUDIT_GAP` | [`core_01049_vibranium_suit.md`](../ambiguities/core_01049_vibranium_suit.md) |
| `01050` | **Hulk (Bruce Banner)** | `core` | `80%` | `PESSIMISTIC_CODE_AUDIT_GAP` | [`core_01050_hulk_bruce_banner.md`](../ambiguities/core_01050_hulk_bruce_banner.md) |
| `01061` | **Great Responsibility** | `core` | `80%` | `PESSIMISTIC_CODE_AUDIT_GAP` | [`core_01061_great_responsibility.md`](../ambiguities/core_01061_great_responsibility.md) |
| `01068` | **Vision** | `core` | `80%` | `PESSIMISTIC_CODE_AUDIT_GAP` | [`core_01068_vision.md`](../ambiguities/core_01068_vision.md) |
| `01069` | **Get Ready** | `core` | `80%` | `PESSIMISTIC_CODE_AUDIT_GAP` | [`core_01069_get_ready.md`](../ambiguities/core_01069_get_ready.md) |
| `01070` | **Lead from the Front** | `core` | `80%` | `PESSIMISTIC_CODE_AUDIT_GAP` | [`core_01070_lead_from_the_front.md`](../ambiguities/core_01070_lead_from_the_front.md) |
| `01075` | **Black Widow (Natasha Romanoff)** | `core` | `80%` | `PESSIMISTIC_CODE_AUDIT_GAP` | [`core_01075_black_widow_natasha_romanoff.md`](../ambiguities/core_01075_black_widow_natasha_romanoff.md) |
| `01077` | **Counter-Punch** | `core` | `80%` | `PESSIMISTIC_CODE_AUDIT_GAP` | [`core_01077_counter_punch.md`](../ambiguities/core_01077_counter_punch.md) |
| `01078` | **Get Behind Me!** | `core` | `80%` | `PESSIMISTIC_CODE_AUDIT_GAP` | [`core_01078_get_behind_me.md`](../ambiguities/core_01078_get_behind_me.md) |
| `01085` | **Emergency** | `core` | `80%` | `PESSIMISTIC_CODE_AUDIT_GAP` | [`core_01085_emergency.md`](../ambiguities/core_01085_emergency.md) |
| `01093` | **Tenacity** | `core` | `80%` | `PESSIMISTIC_CODE_AUDIT_GAP` | [`core_01093_tenacity.md`](../ambiguities/core_01093_tenacity.md) |
| `01166` | **Highway Robbery** | `core_encounter` | `80%` | `FACEDOWN_ATTACHMENT_TO_SCHEME_GAP` | [`core_encounter_01166_highway_robbery.md`](../ambiguities/core_encounter_01166_highway_robbery.md) |

---

## 🟢 3. Cards Explicitly Requiring No Supplemental Data (Vanilla / Passive — 9 Cards)

These **9 cards** have been audited and explicitly verified as `"noSupplementalNeeded": true` (standard double resource generators, vanilla baseline minions, basic identity cards, or schemes with no custom trigger hooks):

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

---

## 📋 4. Cards with Multiple Abilities (2+ Abilities Declared — 10 Cards)

These **10 cards** declare multiple distinct ability headers (e.g. dual Hero/Alter-Ego actions, combined Constant modifiers with triggered Actions, or multiple Response triggers):

| Card Code | Card Name | Type | Pack | Ability Count | Declared Abilities Summary |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `01007` | **Spider-Tracer** | `upgrade` | `core` | **2** | • `spider_tracer_attach` (`CARD_PLAYED`, **1 step**)<br/>• `spider_tracer_defeat_trigger` (`FORCED_INTERRUPT` / `MINION_DEFEATED`, **1 step**) |
| `01009` | **Webbed Up** | `upgrade` | `core` | **2** | • `webbed_up_attach` (`CARD_PLAYED`, **1 step**)<br/>• `webbed_up_intercept` (`FORCED_INTERRUPT` / `VILLAIN_INITIATES_ATTACK`, **1 step**) |
| `01039` | **Rocket Boots** | `upgrade` | `core` | **2** | • `rocket_boots_hp` (`CONSTANT`, **1 step**)<br/>• `rocket_boots_aerial` (`HERO_ACTION`, **1 step**) |
| `01074` | **Inspired** | `upgrade` | `core` | **3** | • `inspired_attach` (`CARD_PLAYED`, **1 step**)<br/>• `inspired_thw_bonus` (`CONSTANT`, **1 step**)<br/>• `inspired_atk_bonus` (`CONSTANT`, **1 step**) |
| `01096` | **Rhino** | `villain` | `core_encounter` | **2** | • `rhino_stage_iii_when_revealed` (`WHEN_REVEALED` / `WHEN_REVEALED`, **1 step**)<br/>• `rhino_stage_iii_tough` (`SETUP`, **1 step**) |
| `01098` | **Armored Rhino Suit** | `attachment` | `core_encounter` | **2** | • `armored_rhino_suit_attach` (`WHEN_REVEALED` / `WHEN_REVEALED`, **1 step**)<br/>• `armored_rhino_suit_shield` (`FORCED_INTERRUPT` / `TAKE_ATTACK_DAMAGE`, **1 step**) |
| `01099` | **Charge** | `attachment` | `core_encounter` | **3** | • `charge_attach` (`WHEN_REVEALED` / `WHEN_REVEALED`, **1 step**)<br/>• `charge_atk_bonus` (`CONSTANT`, **1 step**)<br/>• `charge_overkill` (`CONSTANT`, **1 step**) |
| `01100` | **Enhanced Ivory Horn** | `attachment` | `core_encounter` | **3** | • `ivory_horn_attach` (`WHEN_REVEALED` / `WHEN_REVEALED`, **1 step**)<br/>• `ivory_horn_atk_bonus` (`CONSTANT`, **1 step**)<br/>• `ivory_horn_discard_action` (`ACTION`, **1 step**) |
| `01102` | **Sandman** | `minion` | `core_encounter` | **2** | • `sandman_toughness` (`SETUP`, **1 step**)<br/>• `sandman_attack_discard` (`FORCED_RESPONSE` / `MINION_ATTACKED`, **1 step**) |
| `01178` | **Kree Manipulator** | `treachery` | `core_encounter` | **2** | • `kree_manipulator_when_revealed` (`WHEN_REVEALED` / `WHEN_REVEALED`, **1 step**)<br/>• `kree_manipulator_boost` (`BOOST` / `BOOST_STAR_RESOLVED`, **1 step**) |

---

## 💥 5. High-Impact Primitives (Blast-Radius $\ge 5$ Cards)

Changing these primitives will affect many cards across the entire game engine:

| Category | Primitive Name | Card Count | Example Cards |
| :--- | :--- | :--- | :--- |
| **Effect** | `DEAL_DAMAGE` | **21** | `01005` Swinging Web Kick (event), `01013` Photonic Blast (event), `01019a` She-Hulk (hero) *(+18 more)* |
| **Effect** | `ADD_STATUS` | **15** | `01011` Spider-Woman (ally), `01076` Luke Cage (ally), `01083` Mockingbird (ally) *(+11 more)* |
| **Effect** | `REMOVE_THREAT` | **10** | `01012` Crisis Interdiction (event), `01019b` Jennifer Walters (alter_ego), `01023` Legal Practice (event) *(+7 more)* |
| **Effect** | `MODIFY_STAT` | **8** | `01057` Combat Training (upgrade), `01059` Jessica Jones (ally), `01065` Heroic Intuition (upgrade) *(+4 more)* |
| **Effect** | `DRAW_CARDS` | **7** | `01001a` Spider-Man (hero), `01010b` Carol Danvers (alter_ego), `01015` Alpha Flight Station (support) *(+4 more)* |
| **Effect** | `HEAL_DAMAGE` | **7** | `01006` Aunt May (support), `01010a` Captain Marvel (hero), `01051` Tigra (ally) *(+4 more)* |
| **Effect** | `ATTACH_TO_HOST` | **6** | `01007` Spider-Tracer (upgrade), `01009` Webbed Up (upgrade), `01074` Inspired (upgrade) *(+3 more)* |
| **Effect** | `DISCARD_SELF` | **6** | `01155` Affairs of State (obligation), `01160` Legal Work (obligation), `01165` Eviction Notice (obligation) *(+3 more)* |
| **Effect** | `ADD_THREAT_PER_PLAYER` | **5** | `01107` Breakin' & Takin' (side_scheme), `01109` Bomb Scare (side_scheme), `01161` Personal Challenge (side_scheme) *(+2 more)* |
| **Trigger** | `WHEN_REVEALED` | **46** | `01095` Rhino (villain), `01096` Rhino (villain), `01098` Armored Rhino Suit (attachment) *(+43 more)* |
| **Trigger** | `CARD_PLAYED` | **5** | `01002` Black Cat (ally), `01011` Spider-Woman (ally), `01067` Maria Hill (ally) *(+2 more)* |

---

## 🔍 6. Single-Use & Unique Primitives (Card Count = 1)

These primitives are only declared on a single card. They represent high specialization and are prime candidates for decomposition into composable generic primitives:

| Category | Primitive Name | Card Code | Card Name & Pack | Ability ID |
| :--- | :--- | :--- | :--- | :--- |
| **Effect** | `ATTACHMENT_DAMAGE_SHIELD` | `01098` | Armored Rhino Suit (attachment) (core_encounter) | `armored_rhino_suit_shield` |
| **Effect** | `DISCARD_ATTACHMENT` | `01100` | Enhanced Ivory Horn (attachment) (core_encounter) | `ivory_horn_discard_action` |
| **Effect** | `DISCARD_ENCOUNTER_DECK` | `01102` | Sandman (minion) (core_encounter) | `sandman_attack_discard` |
| **Effect** | `DISCARD_TOP_DECK_FILTER` | `01002` | Black Cat (ally) (core) | `black_cat_when_played` |
| **Effect** | `DISCARD_UPGRADE_OR_SUPPORT_OR_SURGE` | `01188` | Caught Off Guard (treachery) (core_encounter) | `caught_off_guard_when_revealed` |
| **Effect** | `DRAW_UP_TO_HAND_SIZE` | `01025` | Split Personality (event) (core) | `split_personality` |
| **Effect** | `EXPLOSION` | `01111` | Explosion (treachery) (core_encounter) | `explosion_when_revealed` |
| **Effect** | `FLIP_FORM` | `01025` | Split Personality (event) (core) | `split_personality` |
| **Effect** | `FORM_BRANCH_VILLAIN_ATTACK_OR_SURGE` | `01106` | Stampede (treachery) (core_encounter) | `stampede_attack` |
| **Effect** | `GIVE_STATUS` | `01102` | Sandman (minion) (core_encounter) | `sandman_toughness` |
| **Effect** | `INTERCEPT_ATTACK` | `01009` | Webbed Up (upgrade) (core) | `webbed_up_intercept` |
| **Effect** | `MODIFY_ALLY_LIMIT` | `01073` | The Triskelion (support) (core) | `triskelion_ally_limit` |
| **Effect** | `MODIFY_HAND_SIZE` | `01029a` | Iron Man (hero) (core) | `iron_man_hand_size` |
| **Effect** | `PLACE_THREAT_PER_SIDE_SCHEME` | `01192` | Masterplan (treachery) (core_encounter) | `masterplan_when_revealed` |
| **Effect** | `PLAY_ALLY_FROM_DISCARD` | `01071` | Make the Call (event) (core) | `make_the_call` |
| **Effect** | `PREVENT_DAMAGE` | `01003` | Backflip (event) (core) | `backflip` |
| **Effect** | `READY_CHARACTER` | `01082` | Indomitable (upgrade) (core) | `indomitable_ready` |
| **Effect** | `READY_IDENTITY` | `01035` | Arc Reactor (upgrade) (core) | `arc_reactor_ready` |
| **Effect** | `REDUCE_NEXT_CARD_COST` | `01092` | Helicarrier (support) (core) | `helicarrier_action` |
| **Effect** | `REVEAL_ENCOUNTER_CARD` | `01193` | Under Fire (treachery) (core_encounter) | `under_fire_when_revealed` |
| **Effect** | `SCRY_AND_SELECT_TRAIT` | `01029b` | Tony Stark (alter_ego) (core) | `futurist` |
| **Effect** | `SEARCH_AND_REVEAL_SIDE_SCHEME` | `01095` | Rhino (villain) (core_encounter) | `rhino_stage_ii_when_revealed` |
| **Effect** | `SHUFFLE_INTO_DECK` | `01190` | Shadow of the Past (treachery) (core_encounter) | `shadow_of_the_past_when_revealed` |
| **Effect** | `VILLAIN_AND_ENGAGED_MINIONS_ATTACK` | `01189` | Gang-Up (treachery) (core_encounter) | `gang_up_when_revealed` |
| **Effect** | `VILLAIN_ATTACKS` | `01187` | Assault (treachery) (core_encounter) | `assault_when_revealed` |
| **Effect** | `VILLAIN_SCHEMES` | `01186` | Advance (treachery) (core_encounter) | `advance_when_revealed` |
| **Effect** | `WHEN_ATTACHED_HOST_DEFEATED` | `01007` | Spider-Tracer (upgrade) (core) | `spider_tracer_defeat_trigger` |
| **Effect** | `WHEN_REVEALED_THREAT_PER_PLAYER` | `01108` | Crowd Control (side_scheme) (core_encounter) | `crowd_control_when_revealed` |
| **Trigger** | `BOOST_STAR_RESOLVED` | `01178` | Kree Manipulator (treachery) (core_encounter) | `kree_manipulator_boost` |
| **Trigger** | `ENEMY_DEFEATED_BY_HERO_ATTACK` | `01052` | Chase Them Down (event) (core) | `chase_them_down` |
| **Trigger** | `FORM_CHANGED_TO_HERO` | `01019a` | She-Hulk (hero) (core) | `she_hulk_form_change` |
| **Trigger** | `HERO_DEFENDED_ATTACK` | `01082` | Indomitable (upgrade) (core) | `indomitable_ready` |
| **Trigger** | `MINION_ATTACKED` | `01102` | Sandman (minion) (core_encounter) | `sandman_attack_discard` |
| **Trigger** | `MINION_DEFEATED_BY_ATTACK` | `01051` | Tigra (ally) (core) | `tigra_defeat_heal` |
| **Trigger** | `MINION_ENTERS_PLAY` | `01066` | Hawkeye (ally) (core) | `hawkeye_arrow_response` |
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
| **Effect** | `SPAWN_NEMESIS` | 🟡 `0 Cards` | Documented in `docs/specifications/supplemental/` but has 0 card declarations. |
| **Effect** | `TOUGHNESS` | 🟡 `0 Cards` | Documented in `docs/specifications/supplemental/` but has 0 card declarations. |
| **Trigger** | `ATTACHED_ENEMY_ATTACKS` | 🟡 `0 Cards` | Defined in `TriggerTypeSchema` but has 0 card declarations. |
| **Trigger** | `ATTACHED_MINION_DEFEATED` | 🟡 `0 Cards` | Defined in `TriggerTypeSchema` but has 0 card declarations. |
| **Trigger** | `ATTACK` | 🟡 `0 Cards` | Defined in `TriggerTypeSchema` but has 0 card declarations. |
| **Trigger** | `ATTACK_RESOLVED` | 🟡 `0 Cards` | Defined in `TriggerTypeSchema` but has 0 card declarations. |
| **Trigger** | `BASIC_ATTACK_PERFORMED` | 🟡 `0 Cards` | Defined in `TriggerTypeSchema` but has 0 card declarations. |
| **Trigger** | `BOOST` | 🟡 `0 Cards` | Defined in `TriggerTypeSchema` but has 0 card declarations. |
| **Trigger** | `DAMAGE_TAKEN` | 🟡 `0 Cards` | Defined in `TriggerTypeSchema` but has 0 card declarations. |
| **Trigger** | `DEFEATED` | 🟡 `0 Cards` | Defined in `TriggerTypeSchema` but has 0 card declarations. |
| **Trigger** | `FORM_CHANGED_TO_ALTER_EGO` | 🟡 `0 Cards` | Defined in `TriggerTypeSchema` but has 0 card declarations. |
| **Trigger** | `HERO_FLIPPED` | 🟡 `0 Cards` | Defined in `TriggerTypeSchema` but has 0 card declarations. |
| **Trigger** | `MAIN_SCHEME_ADVANCED` | 🟡 `0 Cards` | Defined in `TriggerTypeSchema` but has 0 card declarations. |
| **Trigger** | `PHASE_START` | 🟡 `0 Cards` | Defined in `TriggerTypeSchema` but has 0 card declarations. |
| **Trigger** | `PLAYED` | 🟡 `0 Cards` | Defined in `TriggerTypeSchema` but has 0 card declarations. |
| **Trigger** | `PLAYER_PHASE_BEGAN` | 🟡 `0 Cards` | Defined in `TriggerTypeSchema` but has 0 card declarations. |
| **Trigger** | `PLAYER_PHASE_ENDED` | 🟡 `0 Cards` | Defined in `TriggerTypeSchema` but has 0 card declarations. |
| **Trigger** | `RESOURCE_SPENT` | 🟡 `0 Cards` | Defined in `TriggerTypeSchema` but has 0 card declarations. |
| **Trigger** | `ROUND_BEGAN` | 🟡 `0 Cards` | Defined in `TriggerTypeSchema` but has 0 card declarations. |
| **Trigger** | `ROUND_END` | 🟡 `0 Cards` | Defined in `TriggerTypeSchema` but has 0 card declarations. |
| **Trigger** | `ROUND_ENDED` | 🟡 `0 Cards` | Defined in `TriggerTypeSchema` but has 0 card declarations. |
| **Trigger** | `TAKE_DAMAGE` | 🟡 `0 Cards` | Defined in `TriggerTypeSchema` but has 0 card declarations. |
| **Trigger** | `THREAT_PLACED` | 🟡 `0 Cards` | Defined in `TriggerTypeSchema` but has 0 card declarations. |
| **Trigger** | `THREAT_WOULD_BE_PLACED` | 🟡 `0 Cards` | Defined in `TriggerTypeSchema` but has 0 card declarations. |
| **Trigger** | `TREACHERY_REVEALED` | 🟡 `0 Cards` | Defined in `TriggerTypeSchema` but has 0 card declarations. |
| **Trigger** | `VILLAIN_PHASE_BEGAN` | 🟡 `0 Cards` | Defined in `TriggerTypeSchema` but has 0 card declarations. |
| **Trigger** | `VILLAIN_PHASE_ENDED` | 🟡 `0 Cards` | Defined in `TriggerTypeSchema` but has 0 card declarations. |

---

## 📑 8. Complete Effects Inventory

| Effect Primitive | Occurrences | Declaring Cards |
| :--- | :--- | :--- |
| `DEAL_DAMAGE` | **21** | `01005` (Swinging Web Kick (event)), `01013` (Photonic Blast (event)), `01019a` (She-Hulk (hero)), `01022` (Ground Stomp (event)), `01030` (War Machine (ally)), `01032` (Supersonic Punch (event)), `01038` (Powered Gauntlets (upgrade)), `01047` (Panther Claws (upgrade)), `01053` (Relentless Assault (event)), `01054` (Uppercut (event)), `01056` (Tac Team (support)), `01058` (Daredevil (ally)), `01066` (Hawkeye (ally)), `01087` (Haymaker (event)), `01103` (Shocker (minion)), `01159` (Ritual Combat (treachery)), `01164` (Titania's Fury (treachery)), `01167` (Vulture (minion)), `01168` (Sweeping Swoop (treachery)), `01174` (Electromagnetic Backlash (treachery)), `01179` (Yon-Rogg's Treason (treachery)) |
| `ADD_STATUS` | **15** | `01011` (Spider-Woman (ally)), `01076` (Luke Cage (ally)), `01083` (Mockingbird (ally)), `01096` (Rhino (villain)), `01105` ("I'm Tough" (treachery)), `01112` (False Alarm (treachery)), `01157` (Killmonger (minion)), `01162` (Titania (minion)), `01163` (Genetically Enhanced (attachment)), `01169` (The Vulture's Plans (treachery)), `01172` (Whiplash (minion)), `01173` (Electric Whip Attack (treachery)), `01177` (Yon-Rogg (minion)), `01194` (Unknown Card #01194) |
| `REMOVE_THREAT` | **10** | `01012` (Crisis Interdiction (event)), `01019b` (Jennifer Walters (alter_ego)), `01023` (Legal Practice (event)), `01026` (Superhuman Law Division (support)), `01037` (Mark V Helmet (upgrade)), `01048` (Tactical Genius (upgrade)), `01052` (Chase Them Down (event)), `01060` (For Justice! (event)), `01063` (Interrogation Room (support)), `01064` (Surveillance Team (support)) |
| `MODIFY_STAT` | **8** | `01057` (Combat Training (upgrade)), `01059` (Jessica Jones (ally)), `01065` (Heroic Intuition (upgrade)), `01074` (Inspired (upgrade)), `01081` (Armored Vest (upgrade)), `01099` (Charge (attachment)), `01100` (Enhanced Ivory Horn (attachment)) |
| `DRAW_CARDS` | **7** | `01001a` (Spider-Man (hero)), `01010b` (Carol Danvers (alter_ego)), `01015` (Alpha Flight Station (support)), `01027` (Focused Rage (upgrade)), `01045` (The Golden City (support)), `01067` (Maria Hill (ally)), `01091` (Avengers Mansion (support)) |
| `HEAL_DAMAGE` | **7** | `01006` (Aunt May (support)), `01010a` (Captain Marvel (hero)), `01051` (Tigra (ally)), `01080` (Med Team (support)), `01086` (First Aid (event)), `01104` (Hard to Keep Down (treachery)), `01158` (Heart-Shaped Herb (treachery)) |
| `ATTACH_TO_HOST` | **6** | `01007` (Spider-Tracer (upgrade)), `01009` (Webbed Up (upgrade)), `01074` (Inspired (upgrade)), `01098` (Armored Rhino Suit (attachment)), `01099` (Charge (attachment)), `01100` (Enhanced Ivory Horn (attachment)) |
| `DISCARD_SELF` | **6** | `01155` (Affairs of State (obligation)), `01160` (Legal Work (obligation)), `01165` (Eviction Notice (obligation)), `01170` (Business Problems (obligation)), `01175` (Family Emergency (obligation)), `01195` (Unknown Card #01195) |
| `ADD_THREAT_PER_PLAYER` | **5** | `01107` (Breakin' & Takin' (side_scheme)), `01109` (Bomb Scare (side_scheme)), `01161` (Personal Challenge (side_scheme)), `01171` (Imminent Overload (side_scheme)), `01176` (The Psyche-Magnitron (side_scheme)) |
| `DOUBLE_RESOURCE_FOR_ASPECT` | **4** | `01055` (The Power of Aggression (resource)), `01062` (The Power of Justice (resource)), `01072` (The Power of Leadership (resource)), `01079` (The Power of Protection (resource)) |
| `TRIGGER_SURGE` | **4** | `01104` (Hard to Keep Down (treachery)), `01105` ("I'm Tough" (treachery)), `01190` (Shadow of the Past (treachery)), `01193` (Under Fire (treachery)) |
| `GRANT_KEYWORD` | **3** | `01039` (Rocket Boots (upgrade)), `01099` (Charge (attachment)), `01101` (Hydra Mercenary (minion)) |
| `PLAYER_CHOICE` | **3** | `01084` (Nick Fury (ally)), `01110` (Hydra Bomber (minion)), `01191` (Exhaustion (treachery)) |
| `GENERATE_RESOURCE` | **2** | `01001b` (Peter Parker (alter_ego)), `01008` (Web-Shooter (upgrade)) |
| `MODIFY_MAX_HEALTH` | **2** | `01036` (Mark V Armor (upgrade)), `01039` (Rocket Boots (upgrade)) |
| `ADD_THREAT` | **2** | `01178` (Kree Manipulator (treachery)) |
| `PUT_INTO_PLAY` | **2** | `01190` (Shadow of the Past (treachery)) |
| `DISCARD_TOP_DECK_FILTER` | **1** | `01002` (Black Cat (ally)) |
| `PREVENT_DAMAGE` | **1** | `01003` (Backflip (event)) |
| `WHEN_ATTACHED_HOST_DEFEATED` | **1** | `01007` (Spider-Tracer (upgrade)) |
| `INTERCEPT_ATTACK` | **1** | `01009` (Webbed Up (upgrade)) |
| `FLIP_FORM` | **1** | `01025` (Split Personality (event)) |
| `DRAW_UP_TO_HAND_SIZE` | **1** | `01025` (Split Personality (event)) |
| `MODIFY_HAND_SIZE` | **1** | `01029a` (Iron Man (hero)) |
| `SCRY_AND_SELECT_TRAIT` | **1** | `01029b` (Tony Stark (alter_ego)) |
| `READY_IDENTITY` | **1** | `01035` (Arc Reactor (upgrade)) |
| `PLAY_ALLY_FROM_DISCARD` | **1** | `01071` (Make the Call (event)) |
| `MODIFY_ALLY_LIMIT` | **1** | `01073` (The Triskelion (support)) |
| `READY_CHARACTER` | **1** | `01082` (Indomitable (upgrade)) |
| `REDUCE_NEXT_CARD_COST` | **1** | `01092` (Helicarrier (support)) |
| `SEARCH_AND_REVEAL_SIDE_SCHEME` | **1** | `01095` (Rhino (villain)) |
| `ATTACHMENT_DAMAGE_SHIELD` | **1** | `01098` (Armored Rhino Suit (attachment)) |
| `DISCARD_ATTACHMENT` | **1** | `01100` (Enhanced Ivory Horn (attachment)) |
| `GIVE_STATUS` | **1** | `01102` (Sandman (minion)) |
| `DISCARD_ENCOUNTER_DECK` | **1** | `01102` (Sandman (minion)) |
| `FORM_BRANCH_VILLAIN_ATTACK_OR_SURGE` | **1** | `01106` (Stampede (treachery)) |
| `WHEN_REVEALED_THREAT_PER_PLAYER` | **1** | `01108` (Crowd Control (side_scheme)) |
| `EXPLOSION` | **1** | `01111` (Explosion (treachery)) |
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
| `WHEN_REVEALED` | **46** | `01095` (Rhino (villain)), `01096` (Rhino (villain)), `01098` (Armored Rhino Suit (attachment)), `01099` (Charge (attachment)), `01100` (Enhanced Ivory Horn (attachment)), `01103` (Shocker (minion)), `01104` (Hard to Keep Down (treachery)), `01105` ("I'm Tough" (treachery)), `01106` (Stampede (treachery)), `01107` (Breakin' & Takin' (side_scheme)), `01108` (Crowd Control (side_scheme)), `01109` (Bomb Scare (side_scheme)), `01110` (Hydra Bomber (minion)), `01111` (Explosion (treachery)), `01112` (False Alarm (treachery)), `01155` (Affairs of State (obligation)), `01157` (Killmonger (minion)), `01158` (Heart-Shaped Herb (treachery)), `01159` (Ritual Combat (treachery)), `01160` (Legal Work (obligation)), `01161` (Personal Challenge (side_scheme)), `01162` (Titania (minion)), `01164` (Titania's Fury (treachery)), `01165` (Eviction Notice (obligation)), `01167` (Vulture (minion)), `01168` (Sweeping Swoop (treachery)), `01169` (The Vulture's Plans (treachery)), `01170` (Business Problems (obligation)), `01171` (Imminent Overload (side_scheme)), `01172` (Whiplash (minion)), `01174` (Electromagnetic Backlash (treachery)), `01175` (Family Emergency (obligation)), `01176` (The Psyche-Magnitron (side_scheme)), `01177` (Yon-Rogg (minion)), `01178` (Kree Manipulator (treachery)), `01179` (Yon-Rogg's Treason (treachery)), `01186` (Advance (treachery)), `01187` (Assault (treachery)), `01188` (Caught Off Guard (treachery)), `01189` (Gang-Up (treachery)), `01190` (Shadow of the Past (treachery)), `01191` (Exhaustion (treachery)), `01192` (Masterplan (treachery)), `01193` (Under Fire (treachery)), `01194` (Unknown Card #01194), `01195` (Unknown Card #01195) |
| `CARD_PLAYED` | **5** | `01002` (Black Cat (ally)), `01011` (Spider-Woman (ally)), `01067` (Maria Hill (ally)), `01083` (Mockingbird (ally)), `01084` (Nick Fury (ally)) |
| `VILLAIN_INITIATES_ATTACK` | **2** | `01001a` (Spider-Man (hero)), `01009` (Webbed Up (upgrade)) |
| `TAKE_ATTACK_DAMAGE` | **2** | `01003` (Backflip (event)), `01098` (Armored Rhino Suit (attachment)) |
| `MINION_DEFEATED` | **2** | `01007` (Spider-Tracer (upgrade)), `01063` (Interrogation Room (support)) |
| `FORM_CHANGED_TO_HERO` | **1** | `01019a` (She-Hulk (hero)) |
| `MINION_DEFEATED_BY_ATTACK` | **1** | `01051` (Tigra (ally)) |
| `ENEMY_DEFEATED_BY_HERO_ATTACK` | **1** | `01052` (Chase Them Down (event)) |
| `THWART_RESOLVED` | **1** | `01058` (Daredevil (ally)) |
| `MINION_ENTERS_PLAY` | **1** | `01066` (Hawkeye (ally)) |
| `HERO_DEFENDED_ATTACK` | **1** | `01082` (Indomitable (upgrade)) |
| `MINION_ATTACKED` | **1** | `01102` (Sandman (minion)) |
| `BOOST_STAR_RESOLVED` | **1** | `01178` (Kree Manipulator (treachery)) |

---

## 🎯 10. Timings, Costs & Target Selectors Inventory

### Ability Timings:
| Timing | Occurrences | Cards |
| :--- | :--- | :--- |
| `FORCED_RESPONSE` | **26** | `01002` Black Cat (ally), `01019a` She-Hulk (hero), `01083` Mockingbird (ally), `01102` Sandman (minion), `01106` Stampede (treachery) *(+21 more)* |
| `WHEN_REVEALED` | **24** | `01095` Rhino (villain), `01096` Rhino (villain), `01098` Armored Rhino Suit (attachment), `01099` Charge (attachment), `01100` Enhanced Ivory Horn (attachment) *(+19 more)* |
| `CONSTANT` | **16** | `01029a` Iron Man (hero), `01036` Mark V Armor (upgrade), `01039` Rocket Boots (upgrade), `01057` Combat Training (upgrade), `01059` Jessica Jones (ally) *(+9 more)* |
| `HERO_ACTION` | **15** | `01005` Swinging Web Kick (event), `01012` Crisis Interdiction (event), `01013` Photonic Blast (event), `01022` Ground Stomp (event), `01027` Focused Rage (upgrade) *(+10 more)* |
| `ALTER_EGO_ACTION` | **9** | `01006` Aunt May (support), `01010a` Captain Marvel (hero), `01010b` Carol Danvers (alter_ego), `01015` Alpha Flight Station (support), `01019b` Jennifer Walters (alter_ego) *(+4 more)* |
| `ACTION` | **9** | `01025` Split Personality (event), `01056` Tac Team (support), `01064` Surveillance Team (support), `01071` Make the Call (event), `01080` Med Team (support) *(+4 more)* |
| `RESPONSE` | **7** | `01011` Spider-Woman (ally), `01051` Tigra (ally), `01052` Chase Them Down (event), `01058` Daredevil (ally), `01063` Interrogation Room (support) *(+2 more)* |
| `RESOURCE` | **6** | `01001b` Peter Parker (alter_ego), `01008` Web-Shooter (upgrade), `01055` The Power of Aggression (resource), `01062` The Power of Justice (resource), `01072` The Power of Leadership (resource) *(+1 more)* |
| `CARD_PLAYED` | **4** | `01007` Spider-Tracer (upgrade), `01009` Webbed Up (upgrade), `01074` Inspired (upgrade), `01084` Nick Fury (ally) |
| `FORCED_INTERRUPT` | **3** | `01007` Spider-Tracer (upgrade), `01009` Webbed Up (upgrade), `01098` Armored Rhino Suit (attachment) |
| `SETUP` | **3** | `01076` Luke Cage (ally), `01096` Rhino (villain), `01102` Sandman (minion) |
| `INTERRUPT` | **2** | `01001a` Spider-Man (hero), `01003` Backflip (event) |
| `SPECIAL` | **2** | `01047` Panther Claws (upgrade), `01048` Tactical Genius (upgrade) |
| `HERO_INTERRUPT` | **1** | `01082` Indomitable (upgrade) |
| `BOOST` | **1** | `01178` Kree Manipulator (treachery) |
| `ALTER_EGO_INTERRUPT` | 🟡 **0** | *Unused in supplemental declarations* |
| `HERO_RESPONSE` | 🟡 **0** | *Unused in supplemental declarations* |
| `ALTER_EGO_RESPONSE` | 🟡 **0** | *Unused in supplemental declarations* |
| `WHEN_PLAYED` | 🟡 **0** | *Unused in supplemental declarations* |

### Cost Primitives:
| Cost Key | Occurrences | Cards |
| :--- | :--- | :--- |
| `exhaustSelf` | **17** | `01006` Aunt May (support), `01010a` Captain Marvel (hero), `01015` Alpha Flight Station (support), `01026` Superhuman Law Division (support), `01027` Focused Rage (upgrade) *(+12 more)* |
| `removeCounter` | **4** | `01056` Tac Team (support), `01064` Surveillance Team (support), `01066` Hawkeye (ally), `01080` Med Team (support) |
| `resourceCost` | **3** | `01026` Superhuman Law Division (support), `01038` Powered Gauntlets (upgrade), `01100` Enhanced Ivory Horn (attachment) |
| `discardSelf` | **2** | `01003` Backflip (event), `01082` Indomitable (upgrade) |
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
| `SELF` | **15** | `01001a` Spider-Man (hero), `01006` Aunt May (support), `01051` Tigra (ally), `01076` Luke Cage (ally), `01082` Indomitable (upgrade) *(+10 more)* |
| `CHOSEN_ENEMY` | **12** | `01005` Swinging Web Kick (event), `01011` Spider-Woman (ally), `01013` Photonic Blast (event), `01019a` She-Hulk (hero), `01032` Supersonic Punch (event) *(+7 more)* |
| `CHOSEN_SCHEME` | **8** | `01012` Crisis Interdiction (event), `01019b` Jennifer Walters (alter_ego), `01026` Superhuman Law Division (support), `01037` Mark V Helmet (upgrade), `01048` Tactical Genius (upgrade) *(+3 more)* |
| `VILLAIN` | **7** | `01098` Armored Rhino Suit (attachment), `01099` Charge (attachment), `01100` Enhanced Ivory Horn (attachment), `01104` Hard to Keep Down (treachery), `01105` "I'm Tough" (treachery) *(+1 more)* |
| `HERO` | **7** | `01159` Ritual Combat (treachery), `01164` Titania's Fury (treachery), `01167` Vulture (minion), `01168` Sweeping Swoop (treachery), `01169` The Vulture's Plans (treachery) *(+2 more)* |
| `MAIN_SCHEME` | **6** | `01007` Spider-Tracer (upgrade), `01023` Legal Practice (event), `01063` Interrogation Room (support), `01178` Kree Manipulator (treachery), `01194` Unknown Card #01194 |
| `SELF_IDENTITY` | **3** | `01010a` Captain Marvel (hero), `01035` Arc Reactor (upgrade), `01073` The Triskelion (support) |
| `CHOSEN_PLAYER` | **3** | `01010b` Carol Danvers (alter_ego), `01091` Avengers Mansion (support), `01092` Helicarrier (support) |
| `CHOSEN_MINION` | **2** | `01007` Spider-Tracer (upgrade), `01053` Relentless Assault (event) |
| `ALL_ENEMIES` | **2** | `01022` Ground Stomp (event), `01030` War Machine (ally) |
| `CHOSEN_CHARACTER` | **2** | `01080` Med Team (support), `01086` First Aid (event) |
| `ALL_HEROES` | **2** | `01096` Rhino (villain), `01103` Shocker (minion) |
| `ACTIVE_PLAYER` | **2** | `01106` Stampede (treachery), `01188` Caught Off Guard (treachery) |
| `THIS_SIDE_SCHEME` | **2** | `01107` Breakin' & Takin' (side_scheme), `01109` Bomb Scare (side_scheme) |
| `ENEMY` | **1** | `01009` Webbed Up (upgrade) |
| `TRIGGERING_MINION` | **1** | `01066` Hawkeye (ally) |
| `ALL_PLAYERS` | **1** | `01067` Maria Hill (ally) |
| `ALLY_IN_DISCARD` | **1** | `01071` Make the Call (event) |
| `CHOSEN_ALLY` | **1** | `01074` Inspired (upgrade) |
| `ATTACHED_VILLAIN` | **1** | `01098` Armored Rhino Suit (attachment) |
| `ACTIVE_IDENTITY` | **1** | `01112` False Alarm (treachery) |