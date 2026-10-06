# Supplemental Card Declarations Usage & Impact Report

> **Generated:** `2026-10-06T18:51:43.497Z`  
> **Source Packs Scanned:** `core, core_encounter, cw_encounter`

---

## 📊 1. Executive Summary

| Metric | Count | Description |
| :--- | :--- | :--- |
| **Total Cards Registered** | **158** | Total cards present in `src/data/supplemental/` |
| **Active Declared Cards** | **145** | Cards with executable `abilities: [...]` |
| **No Supplemental Needed** | **11** | Vanilla / passive cards explicitly verified as requiring no supplemental hooks |
| **Open Ambiguity Reports** | **2** | Blocked cards isolated in `docs/ambiguities/` (Inbox Zero Queue) |
| **False-Vanilla Violations** | **0** | 🚨 Cards marked `noSupplementalNeeded` that have printed rules text |
| **Total Abilities Declared** | **165** | Total individual ability definitions declared |
| **Single-Step Abilities (1 Step)** | **135** | Abilities with exactly 1 atomic execution step |
| **Multi-Step Abilities (2+ Steps)** | **30** | Abilities decomposed into sequenced execution pipelines |
| **Cards with Multi-Step Sequences** | **30** | Cards containing at least 1 ability with 2+ steps |
| **Cards with Multiple Abilities (2+)** | **19** | Cards declaring more than 1 distinct ability header |
| **Unique Effects In Use** | **44** | Distinct effect primitive types actively declared |
| **Unique Target Selectors In Use** | **29** | Distinct target selectors actively declared |
| **Unique Triggers In Use** | **20** | Distinct trigger window types actively declared |
| **Unique Timings In Use** | **17** | Distinct timing categories actively declared |
| **Unique Condition Gates In Use** | **11** | Distinct condition gate types actively declared |
| **Unique Step Conditions In Use** | **4** | Distinct step condition types actively declared |
| **Unique Cost Keys In Use** | **9** | Distinct ability cost types actively declared |
| **Unique Effect Param Keys In Use** | **56** | Distinct parameter keys passed into effect steps |
| **Unique Dynamic Value Sources In Use** | **12** | Distinct dynamic value resolver shapes actively declared |
| **Unique Filter Criteria Keys In Use** | **5** | Distinct UniversalCardFilter criteria properties actively declared |

---

## 🔴 2. Active Ambiguity & Blocker Queue (Inbox Zero Queue — 2 Cards)

These **2 cards** are currently isolated in [`docs/ambiguities/`](../ambiguities/README.md) pending rules engine primitives, targeting extensions, or nested resolution stack implementations. As each card is integrated and reaches $\ge 95\%$ confidence, its file is deleted to achieve **Inbox Zero**:

| Card Code | Card Name | Pack | Confidence | Blocker Category | Ambiguity Report File |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `01163` | **Genetically Enhanced** | `core_encounter` | `70%` | `MISSING_ENGINE_PRIMITIVE` | [`core_encounter_01163_genetically-enhanced.md`](../ambiguities/core_encounter_01163_genetically-enhanced.md) |
| `56128b` | **Now It** | `cw_encounter` | `50%` | `MISSING_ENGINE_PRIMITIVE` | [`cw_56128b_now-its-personal.md`](../ambiguities/cw_56128b_now-its-personal.md) |

---

## 🃏 3. Card-Level Declarations Inventory (`CardEnrichmentSchema`)

### 🟢 Vanilla / Passive Cards (`"noSupplementalNeeded": true` — 11 Cards)

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

### Play Requirements (`PlayRequirementsSchema`):
| Requirement Property | Occurrences | Cards |
| :--- | :--- | :--- |
| `controlFilter` | **4** | `01043a` Wakanda Forever! (event), `01043b` Wakanda Forever! (event), `01043c` Wakanda Forever! (event), `01043d` Wakanda Forever! (event) |
| `identityForm` | **1** | `01009` Webbed Up (upgrade) |

### Card Uses & Counters (`CardUsesSchema`):
| Uses Descriptor | Occurrences | Cards |
| :--- | :--- | :--- |
| `uses (web)` | **1** | `01008` Web-Shooter (upgrade) |
| `uses (energy)` | **1** | `01018` Energy Channel (upgrade) |
| `uses (attack)` | **1** | `01056` Tac Team (support) |
| `uses (snoop)` | **1** | `01064` Surveillance Team (support) |
| `uses (arrow)` | **1** | `01066` Hawkeye (ally) |
| `uses (medical)` | **1** | `01080` Med Team (support) |

### Card Keywords (`KeywordEntrySchema`):
| Keyword | Occurrences | Cards |
| :--- | :--- | :--- |
| `Guard` | 🟡 **0** | *Unused in supplemental declarations* |
| `Overkill` | 🟡 **0** | *Unused in supplemental declarations* |
| `Quickstrike` | 🟡 **0** | *Unused in supplemental declarations* |
| `Ranged` | 🟡 **0** | *Unused in supplemental declarations* |
| `Retaliate` | 🟡 **0** | *Unused in supplemental declarations* |
| `Toughness` | 🟡 **0** | *Unused in supplemental declarations* |
| `Crisis` | 🟡 **0** | *Unused in supplemental declarations* |
| `Hazard` | 🟡 **0** | *Unused in supplemental declarations* |
| `Acceleration` | 🟡 **0** | *Unused in supplemental declarations* |

### Player Recipient Overrides (`PlayerRecipientSchema`):
| Recipient Type | Occurrences | Cards |
| :--- | :--- | :--- |
| `FIRST_PLAYER` | **1** | `56128b` Now It's Personal (obligation) |

### Stat & Rule Overrides:
| Override Key | Occurrences | Cards |
| :--- | :--- | :--- |
| `maxPerPlayer` | **7** | `01018` Energy Channel (upgrade), `01057` Combat Training (upgrade), `01063` Interrogation Room (support), `01065` Heroic Intuition (upgrade), `01081` Armored Vest (upgrade) *(+2 more)* |
| `playUnderAnyPlayerControl` | **3** | `01057` Combat Training (upgrade), `01065` Heroic Intuition (upgrade), `01081` Armored Vest (upgrade) |
| `attackCost` | **1** | `01002` Black Cat (ally) |

---

## ⚡ 4. Ability Headers & Trigger Windows (`CardAbilitySchema`)

### Ability Timings (`TimingTypeSchema`):
| Timing | Occurrences | Cards |
| :--- | :--- | :--- |
| `WHEN_REVEALED` | **31** | `01095` Rhino (villain), `01096` Rhino (villain), `01103` Shocker (minion), `01104` Hard to Keep Down (treachery), `01105` "I'm Tough" (treachery) *(+26 more)* |
| `HERO_ACTION` | **26** | `01005` Swinging Web Kick (event), `01009` Webbed Up (upgrade), `01010a` Captain Marvel (hero), `01012` Crisis Interdiction (event), `01013` Photonic Blast (event) *(+21 more)* |
| `CONSTANT` | **20** | `01016` Captain Marvel's Helmet (upgrade), `01017` Cosmic Flight (upgrade), `01028` Superhuman Strength (upgrade), `01029a` Iron Man (hero), `01036` Mark V Armor (upgrade) *(+13 more)* |
| `FORCED_RESPONSE` | **18** | `01002` Black Cat (ally), `01028` Superhuman Strength (upgrade), `01050` Hulk (ally), `01084` Nick Fury (ally), `01102` Sandman (minion) *(+12 more)* |
| `ACTION` | **16** | `01007` Spider-Tracer (upgrade), `01015` Alpha Flight Station (support), `01018` Energy Channel (upgrade), `01020` Hellcat (ally), `01025` Split Personality (event) *(+11 more)* |
| `RESPONSE` | **11** | `01011` Spider-Woman (ally), `01024` One-Two Punch (event), `01041` Shuri (ally), `01051` Tigra (ally), `01052` Chase Them Down (event) *(+6 more)* |
| `ALTER_EGO_ACTION` | **8** | `01006` Aunt May (support), `01010b` Carol Danvers (alter_ego), `01023` Legal Practice (event), `01026` Superhuman Law Division (support), `01029b` Tony Stark (alter_ego) *(+3 more)* |
| `RESOURCE` | **6** | `01001b` Peter Parker (alter_ego), `01033` Pepper Potts (support), `01055` The Power of Aggression (resource), `01062` The Power of Justice (resource), `01072` The Power of Leadership (resource) *(+1 more)* |
| `BOOST` | **6** | `01121` Weapons Runner (minion), `01158` Heart-Shaped Herb (treachery), `01164` Titania's Fury (treachery), `01168` Sweeping Swoop (treachery), `01173` Electric Whip Attack (treachery) *(+1 more)* |
| `HERO_INTERRUPT` | **5** | `01004` Enhanced Spider-Sense (event), `01017` Cosmic Flight (upgrade), `01061` Great Responsibility (event), `01078` Get Behind Me! (event), `01082` Indomitable (upgrade) |
| `INTERRUPT` | **4** | `01001a` Spider-Man (hero), `01003` Backflip (event), `01075` Black Widow (ally), `01085` Emergency (event) |
| `SETUP` | **4** | `01040b` T'Challa (alter_ego), `01076` Luke Cage (ally), `01096` Rhino (villain), `01102` Sandman (minion) |
| `SPECIAL` | **4** | `01046` Energy Daggers (upgrade), `01047` Panther Claws (upgrade), `01048` Tactical Genius (upgrade), `01049` Vibranium Suit (upgrade) |
| `FORCED_INTERRUPT` | **3** | `01007` Spider-Tracer (upgrade), `01009` Webbed Up (upgrade), `01098` Armored Rhino Suit (attachment) |
| `HERO_RESOURCE` | **1** | `01008` Web-Shooter (upgrade) |
| `HERO_RESPONSE` | **1** | `01019a` She-Hulk (hero) |
| `ALTER_EGO_INTERRUPT` | **1** | `01019b` Jennifer Walters (alter_ego) |
| `ALTER_EGO_RESOURCE` | 🟡 **0** | *Unused in supplemental declarations* |
| `ALTER_EGO_RESPONSE` | 🟡 **0** | *Unused in supplemental declarations* |

### Trigger Windows (`TriggerTypeSchema`):
| Trigger Window | Occurrences | Cards |
| :--- | :--- | :--- |
| `WHEN_REVEALED` | **35** | `01095` Rhino (villain), `01096` Rhino (villain), `01103` Shocker (minion), `01104` Hard to Keep Down (treachery), `01105` "I'm Tough" (treachery) *(+30 more)* |
| `ENTERS_PLAY` | **10** | `01011` Spider-Woman (ally), `01041` Shuri (ally), `01067` Maria Hill (ally), `01083` Mockingbird (ally), `01084` Nick Fury (ally) *(+5 more)* |
| `BOOST` | **5** | `01121` Weapons Runner (minion), `01158` Heart-Shaped Herb (treachery), `01164` Titania's Fury (treachery), `01168` Sweeping Swoop (treachery), `01173` Electric Whip Attack (treachery) |
| `DAMAGE_WOULD_BE_TAKEN` | **3** | `01003` Backflip (event), `01017` Cosmic Flight (upgrade), `01098` Armored Rhino Suit (attachment) |
| `TREACHERY_REVEALED` | **3** | `01004` Enhanced Spider-Sense (event), `01075` Black Widow (ally), `01078` Get Behind Me! (event) |
| `CHARACTER_DEFEATED` | **3** | `01007` Spider-Tracer (upgrade), `01051` Tigra (ally), `01063` Interrogation Room (support) |
| `THREAT_WOULD_BE_PLACED` | **3** | `01019b` Jennifer Walters (alter_ego), `01061` Great Responsibility (event), `01085` Emergency (event) |
| `ATTACK_RESOLVED` | **2** | `01028` Superhuman Strength (upgrade), `01050` Hulk (ally) |
| `DEFEATED` | **2** | `01052` Chase Them Down (event), `01166` Highway Robbery (side_scheme) |
| `ATTACK_DEFENDED` | **2** | `01077` Counter-Punch (event), `01082` Indomitable (upgrade) |
| `MINION_ATTACKED` | **2** | `01102` Sandman (minion), `01177` Yon-Rogg (minion) |
| `ENEMY_INITIATES_ATTACK` | **1** | `01001a` Spider-Man (hero) |
| `CARD_PLAYED` | **1** | `01002` Black Cat (ally) |
| `HOST_WOULD_ATTACK` | **1** | `01009` Webbed Up (upgrade) |
| `FORM_CHANGED` | **1** | `01019a` She-Hulk (hero) |
| `BASIC_ATTACK_PERFORMED` | **1** | `01024` One-Two Punch (event) |
| `THWART_RESOLVED` | **1** | `01058` Daredevil (ally) |
| `MINION_ENTERS_PLAY` | **1** | `01066` Hawkeye (ally) |
| `ROUND_ENDED` | **1** | `01084` Nick Fury (ally) |
| `BOOST_STAR_RESOLVED` | **1** | `01178` Kree Manipulator (treachery) |
| `SCHEME_DEFEATED` | 🟡 **0** | *Unused in supplemental declarations* |
| `MAIN_SCHEME_ADVANCED` | 🟡 **0** | *Unused in supplemental declarations* |
| `RESOURCE_SPENT` | 🟡 **0** | *Unused in supplemental declarations* |
| `ATTACK` | 🟡 **0** | *Unused in supplemental declarations* |
| `ROUND_BEGAN` | 🟡 **0** | *Unused in supplemental declarations* |
| `PLAYER_PHASE_BEGAN` | 🟡 **0** | *Unused in supplemental declarations* |
| `PLAYER_PHASE_ENDED` | 🟡 **0** | *Unused in supplemental declarations* |
| `VILLAIN_PHASE_BEGAN` | 🟡 **0** | *Unused in supplemental declarations* |
| `VILLAIN_PHASE_ENDED` | 🟡 **0** | *Unused in supplemental declarations* |
| `DAMAGE_TAKEN` | 🟡 **0** | *Unused in supplemental declarations* |
| `THREAT_PLACED` | 🟡 **0** | *Unused in supplemental declarations* |
| `STATUS_REMOVED` | 🟡 **0** | *Unused in supplemental declarations* |

### Trigger Filters (`TriggerFilterSchema`):
| Filter Property | Occurrences | Cards |
| :--- | :--- | :--- |
| `targetPlayerScope` | **3** | `01001a` Spider-Man (hero), `01063` Interrogation Room (support), `01077` Counter-Punch (event) |
| `targetType` | **3** | `01051` Tigra (ally), `01052` Chase Them Down (event), `01063` Interrogation Room (support) |
| `defeatedByAttackOf` | **2** | `01051` Tigra (ally), `01052` Chase Them Down (event) |
| `attackerKind` | **1** | `01001a` Spider-Man (hero) |
| `targetScope` | **1** | `01007` Spider-Tracer (upgrade) |
| `sourceCardCode` | **1** | `01050` Hulk (ally) |
| `defenderType` | **1** | `01077` Counter-Punch (event) |
| `threatSource` | **1** | `01085` Emergency (event) |

### Cost Primitives (`AbilityCostSchema`):
| Cost Key | Occurrences | Cards |
| :--- | :--- | :--- |
| `exhaustSelf` | **20** | `01006` Aunt May (support), `01008` Web-Shooter (upgrade), `01015` Alpha Flight Station (support), `01026` Superhuman Law Division (support), `01027` Focused Rage (upgrade) *(+15 more)* |
| `discardSelf` | **13** | `01003` Backflip (event), `01004` Enhanced Spider-Sense (event), `01017` Cosmic Flight (upgrade), `01018` Energy Channel (upgrade), `01024` One-Two Punch (event) *(+8 more)* |
| `resourceCost` | **9** | `01004` Enhanced Spider-Sense (event), `01018` Energy Channel (upgrade), `01024` One-Two Punch (event), `01026` Superhuman Law Division (support), `01068` Vision (ally) *(+4 more)* |
| `spendCounters` | **5** | `01008` Web-Shooter (upgrade), `01056` Tac Team (support), `01064` Surveillance Team (support), `01066` Hawkeye (ally), `01080` Med Team (support) |
| `resources` | **2** | `01010a` Captain Marvel (hero), `01039` Rocket Boots (upgrade) |
| `discardCard` | **2** | `01015` Alpha Flight Station (support), `01023` Legal Practice (event) |
| `heal` | **1** | `01010a` Captain Marvel (hero) |
| `damageHero` | **1** | `01027` Focused Rage (upgrade) |
| `damageSelf` | **1** | `01030` War Machine (ally) |

### Ability Limits & Zones:
| Limit / Zone | Occurrences | Cards |
| :--- | :--- | :--- |
| Limit: `ONCE_PER_ROUND` | **6** | `01001b` Peter Parker (alter_ego), `01010a` Captain Marvel (hero), `01010b` Carol Danvers (alter_ego), `01019b` Jennifer Walters (alter_ego), `01029b` Tony Stark (alter_ego) *(+1 more)* |
| Zone: `HAND` | **8** | `01003` Backflip (event), `01004` Enhanced Spider-Sense (event), `01024` One-Two Punch (event), `01052` Chase Them Down (event), `01061` Great Responsibility (event) *(+3 more)* |

### 📋 Cards with Multiple Abilities (2+ Abilities Declared — 19 Cards)

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
| `01158` | **Heart-Shaped Herb** | `treachery` | `core_encounter` | **2** | • `heart_shaped_herb_when_revealed` (`WHEN_REVEALED` / `WHEN_REVEALED`, **1 step**)<br/>• `heart_shaped_herb_boost` (`BOOST` / `BOOST`, **1 step**) |
| `01164` | **Titania's Fury** | `treachery` | `core_encounter` | **2** | • `titanias_fury_when_revealed` (`FORCED_RESPONSE` / `WHEN_REVEALED`, **3 steps**)<br/>• `titanias_fury_boost` (`BOOST` / `BOOST`, **1 step**) |
| `01166` | **Highway Robbery** | `side_scheme` | `core_encounter` | **2** | • `highway_robbery_when_revealed` (`WHEN_REVEALED`, **1 step**)<br/>• `highway_robbery_when_defeated` (`FORCED_RESPONSE` / `DEFEATED`, **1 step**) |
| `01168` | **Sweeping Swoop** | `treachery` | `core_encounter` | **2** | • `sweeping_swoop_when_revealed` (`WHEN_REVEALED` / `WHEN_REVEALED`, **2 steps**)<br/>• `sweeping_swoop_boost` (`BOOST` / `BOOST`, **1 step**) |
| `01172` | **Whiplash** | `minion` | `core_encounter` | **2** | • `whiplash_response` (`FORCED_RESPONSE` / `WHEN_REVEALED`, **1 step**)<br/>• `whiplash_retaliate` (`CONSTANT`, **1 step**) |
| `01173` | **Electric Whip Attack** | `treachery` | `core_encounter` | **2** | • `electric_whip_attack_when_revealed` (`WHEN_REVEALED` / `WHEN_REVEALED`, **1 step**)<br/>• `electric_whip_attack_boost` (`BOOST` / `BOOST`, **1 step**) |
| `01178` | **Kree Manipulator** | `treachery` | `core_encounter` | **2** | • `kree_manipulator_when_revealed` (`WHEN_REVEALED` / `WHEN_REVEALED`, **1 step**)<br/>• `kree_manipulator_boost` (`BOOST` / `BOOST_STAR_RESOLVED`, **1 step**) |

---

## 🎯 5. Target Selectors Inventory (`TargetSelectorSchema`)

This inventory tracks all target selectors declared on ability steps (`step.target` or `step.effectParams.target`):

| Target Selector | Occurrences | Cards |
| :--- | :--- | :--- |
| `CHOSEN_ENEMY` | **16** | `01005` Swinging Web Kick (event), `01009` Webbed Up (upgrade), `01013` Photonic Blast (event), `01018` Energy Channel (upgrade), `01019a` She-Hulk (hero) *(+11 more)* |
| `SELF` | **15** | `01001a` Spider-Man (hero), `01003` Backflip (event), `01018` Energy Channel (upgrade), `01020` Hellcat (ally), `01042` Ancestral Knowledge (event) *(+10 more)* |
| `SELF_IDENTITY` | **14** | `01006` Aunt May (support), `01010a` Captain Marvel (hero), `01024` One-Two Punch (event), `01035` Arc Reactor (upgrade), `01039` Rocket Boots (upgrade) *(+9 more)* |
| `CHOSEN_SCHEME` | **11** | `01007` Spider-Tracer (upgrade), `01012` Crisis Interdiction (event), `01023` Legal Practice (event), `01026` Superhuman Law Division (support), `01037` Mark V Helmet (upgrade) *(+5 more)* |
| `CHOSEN_PLAYER` | **4** | `01010b` Carol Danvers (alter_ego), `01034` Stark Tower (support), `01091` Avengers Mansion (support), `01092` Helicarrier (support) |
| `VILLAIN` | **4** | `01011` Spider-Woman (ally), `01104` Hard to Keep Down (treachery), `01105` "I'm Tough" (treachery), `01158` Heart-Shaped Herb (treachery) |
| `MAIN_SCHEME` | **4** | `01169` The Vulture's Plans (treachery), `01178` Kree Manipulator (treachery), `01194` Unknown Card #01194 |
| `CHOSEN_MINION` | **2** | `01007` Spider-Tracer (upgrade), `01053` Relentless Assault (event) |
| `ALL_ENEMIES` | **2** | `01022` Ground Stomp (event), `01030` War Machine (ally) |
| `TRIGGERING_ENEMY` | **2** | `01028` Superhuman Strength (upgrade), `01077` Counter-Punch (event) |
| `ENGAGED_ENEMIES` | **2** | `01046` Energy Daggers (upgrade), `01158` Heart-Shaped Herb (treachery) |
| `ALL_PLAYERS` | **2** | `01067` Maria Hill (ally), `01169` The Vulture's Plans (treachery) |
| `CHOSEN_ALLY` | **2** | `01069` Get Ready (event), `01074` Inspired (upgrade) |
| `ALL_HEROES` | **2** | `01096` Rhino (villain), `01103` Shocker (minion) |
| `THIS_SIDE_SCHEME` | **2** | `01107` Breakin' & Takin' (side_scheme), `01109` Bomb Scare (side_scheme) |
| `SELF_HERO` | **2** | `01164` Titania's Fury (treachery), `01168` Sweeping Swoop (treachery) |
| `HOST_ENEMY` | **1** | `01009` Webbed Up (upgrade) |
| `ALL_SCHEMES` | **1** | `01037` Mark V Helmet (upgrade) |
| `ALL_CHARACTERS` | **1** | `01050` Hulk (ally) |
| `TRIGGERING_MINION` | **1** | `01066` Hawkeye (ally) |
| `ALL_CONTROLLED_CHARACTERS` | **1** | `01070` Lead from the Front (event) |
| `CHOSEN_FRIENDLY_CHARACTER` | **1** | `01080` Med Team (support) |
| `CHOSEN_CHARACTER` | **1** | `01086` First Aid (event) |
| `ALL_HEROES_AND_ALLIES` | **1** | `01111` Explosion (treachery) |
| `PREVIOUS_TARGET` | **1** | `01164` Titania's Fury (treachery) |
| `DAMAGED_CHARACTER` | **1** | `01168` Sweeping Swoop (treachery) |
| `DEFENDING_PLAYER` | **1** | `01173` Electric Whip Attack (treachery) |
| `ACTIVE_PLAYER` | **1** | `01188` Caught Off Guard (treachery) |
| `ALL_SIDE_SCHEMES` | **1** | `01192` Masterplan (treachery) |
| `TRIGGERING_HERO` | 🟡 **0** | *Unused in supplemental declarations* |
| `ENGAGED_MINIONS` | 🟡 **0** | *Unused in supplemental declarations* |
| `CHOSEN_ENGAGED_MINION` | 🟡 **0** | *Unused in supplemental declarations* |
| `ALL_MINIONS` | 🟡 **0** | *Unused in supplemental declarations* |
| `CHOSEN_CONTROLLED_ALLY` | 🟡 **0** | *Unused in supplemental declarations* |
| `ALL_CONTROLLED_ALLIES` | 🟡 **0** | *Unused in supplemental declarations* |
| `ALL_CONTROLLED_TABLEAU` | 🟡 **0** | *Unused in supplemental declarations* |
| `ALL_ALLIES` | 🟡 **0** | *Unused in supplemental declarations* |
| `CHOSEN_CONTROLLED_CHARACTER` | 🟡 **0** | *Unused in supplemental declarations* |
| `ALL_FRIENDLY_CHARACTERS` | 🟡 **0** | *Unused in supplemental declarations* |
| `CHOSEN_SIDE_SCHEME` | 🟡 **0** | *Unused in supplemental declarations* |
| `TRIGGERING_SCHEME` | 🟡 **0** | *Unused in supplemental declarations* |
| `PREVIOUS_SELECTED_CARD` | 🟡 **0** | *Unused in supplemental declarations* |
| `HOST` | 🟡 **0** | *Unused in supplemental declarations* |

---

## 🚦 6. Condition Gates & Step Conditions (`ConditionGateSchema`, `StepConditionSchema`)

### Condition Gates (`ConditionGateSchema`):
| Condition Gate | Occurrences | Cards |
| :--- | :--- | :--- |
| `IF_FORM` | **7** | `01017` Cosmic Flight (upgrade), `01106` Stampede (treachery), `01187` Assault (treachery), `01189` Gang-Up (treachery) |
| `IF_CONDITION_MET` | **6** | `01012` Crisis Interdiction (event), `01016` Captain Marvel's Helmet (upgrade), `01037` Mark V Helmet (upgrade), `01173` Electric Whip Attack (treachery), `01178` Kree Manipulator (treachery) *(+1 more)* |
| `IF_RESOURCE_MATCH` | **4** | `01013` Photonic Blast (event), `01050` Hulk (ally) |
| `IF_FAILED` | **3** | `01164` Titania's Fury (treachery), `01190` Shadow of the Past (treachery) |
| `IF_AMOUNT_ZERO` | **2** | `01104` Hard to Keep Down (treachery), `01179` Yon-Rogg's Treason (treachery) |
| `IF_ALREADY_HAS_STATUS` | **2** | `01105` "I'm Tough" (treachery), `01112` False Alarm (treachery) |
| `IF_CARD_IN_PLAY` | **2** | `01111` Explosion (treachery), `01168` Sweeping Swoop (treachery) |
| `THEN` | **1** | `01025` Split Personality (event) |
| `IF_CONDITION_NOT_MET` | **1** | `01037` Mark V Helmet (upgrade) |
| `IF_CARD_NOT_IN_PLAY` | **1** | `01111` Explosion (treachery) |
| `IF_ACTIVATION_DEALT_DAMAGE` | **1** | `01168` Sweeping Swoop (treachery) |
| `ALWAYS` | 🟡 **0** | *Unused in supplemental declarations* |
| `IF_PREVIOUS_SUCCESS` | 🟡 **0** | *Unused in supplemental declarations* |
| `IF_ZERO_HEALED` | 🟡 **0** | *Unused in supplemental declarations* |

### Gate Parameters (`gateParams`):
| Parameter Key | Occurrences | Cards |
| :--- | :--- | :--- |
| `form` | **7** | `01017` Cosmic Flight (upgrade), `01106` Stampede (treachery), `01187` Assault (treachery), `01189` Gang-Up (treachery) |
| `trait` | **4** | `01012` Crisis Interdiction (event), `01016` Captain Marvel's Helmet (upgrade), `01037` Mark V Helmet (upgrade) |
| `resource` | **4** | `01013` Photonic Blast (event), `01050` Hulk (ally) |
| `cardCode` | **3** | `01111` Explosion (treachery), `01168` Sweeping Swoop (treachery) |
| `targetStepId` | **3** | `01164` Titania's Fury (treachery), `01190` Shadow of the Past (treachery) |
| `status` | **2** | `01105` "I'm Tough" (treachery), `01112` False Alarm (treachery) |
| `target` | **2** | `01105` "I'm Tough" (treachery), `01112` False Alarm (treachery) |
| `attackerKind` | **2** | `01173` Electric Whip Attack (treachery), `01178` Kree Manipulator (treachery) |
| `count` | **1** | `01013` Photonic Blast (event) |
| `zone` | **1** | `01192` Masterplan (treachery) |

### Declarative Step Conditions (`StepConditionSchema`):
| Step Condition | Occurrences | Cards |
| :--- | :--- | :--- |
| `TARGET_TRAIT_MATCH` | **4** | `01012` Crisis Interdiction (event), `01016` Captain Marvel's Helmet (upgrade), `01037` Mark V Helmet (upgrade) |
| `UNDEFENDED_ATTACK` | **2** | `01173` Electric Whip Attack (treachery), `01178` Kree Manipulator (treachery) |
| `RESOURCE_KICKER_MET` | **1** | `01053` Relentless Assault (event) |
| `ZONE_EMPTY` | **1** | `01192` Masterplan (treachery) |
| `SCHEME_EMPTY` | 🟡 **0** | *Unused in supplemental declarations* |
| `TARGET_DEFEATED` | 🟡 **0** | *Unused in supplemental declarations* |
| `FULLY_HEALED` | 🟡 **0** | *Unused in supplemental declarations* |
| `STATUS_APPLIED` | 🟡 **0** | *Unused in supplemental declarations* |
| `EXCESS_DAMAGE_DEALT` | 🟡 **0** | *Unused in supplemental declarations* |
| `ALREADY_HAS_STATUS` | 🟡 **0** | *Unused in supplemental declarations* |
| `TARGET_ALREADY_EXHAUSTED` | 🟡 **0** | *Unused in supplemental declarations* |
| `TARGET_FORM_MATCH` | 🟡 **0** | *Unused in supplemental declarations* |
| `COUNTER_THRESHOLD_MET` | 🟡 **0** | *Unused in supplemental declarations* |

---

## 💥 7. Effect Primitives Inventory (`EffectTypeSchema`)

### High-Impact Effects (Blast-Radius $\ge 5$ Cards):
| Effect Primitive | Card Count | Example Cards |
| :--- | :--- | :--- |
| `DEAL_DAMAGE` | **25** | `01005` Swinging Web Kick (event), `01013` Photonic Blast (event), `01018` Energy Channel (upgrade) *(+21 more)* |
| `ADD_STATUS` | **17** | `01009` Webbed Up (upgrade), `01011` Spider-Woman (ally), `01028` Superhuman Strength (upgrade) *(+11 more)* |
| `DISCARD` | **16** | `01002` Black Cat (ally), `01009` Webbed Up (upgrade), `01031` Repulsor Blast (event) *(+12 more)* |
| `MODIFY_STAT` | **13** | `01016` Captain Marvel's Helmet (upgrade), `01028` Superhuman Strength (upgrade), `01057` Combat Training (upgrade) *(+8 more)* |
| `REMOVE_THREAT` | **12** | `01007` Spider-Tracer (upgrade), `01012` Crisis Interdiction (event), `01023` Legal Practice (event) *(+7 more)* |
| `SURGE` | **11** | `01104` Hard to Keep Down (treachery), `01105` "I'm Tough" (treachery), `01106` Stampede (treachery) *(+8 more)* |
| `DRAW` | **10** | `01001a` Spider-Man (hero), `01010a` Captain Marvel (hero), `01010b` Carol Danvers (alter_ego) *(+7 more)* |
| `PLAYER_CHOICE` | **10** | `01068` Vision (ally), `01084` Nick Fury (ally), `01110` Hydra Bomber (minion) *(+7 more)* |
| `ADD_THREAT` | **10** | `01107` Breakin' & Takin' (side_scheme), `01109` Bomb Scare (side_scheme), `01161` Personal Challenge (side_scheme) *(+6 more)* |
| `HEAL_DAMAGE` | **6** | `01006` Aunt May (support), `01051` Tigra (ally), `01080` Med Team (support) *(+3 more)* |
| `SEARCH` | **6** | `01029b` Tony Stark (alter_ego), `01034` Stark Tower (support), `01040b` T'Challa (alter_ego) *(+3 more)* |
| `READY` | **5** | `01024` One-Two Punch (event), `01035` Arc Reactor (upgrade), `01069` Get Ready (event) *(+2 more)* |
| `CHANGE_FORM` | **5** | `01155` Affairs of State (obligation), `01160` Legal Work (obligation), `01165` Eviction Notice (obligation) *(+2 more)* |

### Single-Use Effects (Card Count = 1):
| Effect Primitive | Card Code | Card Name & Pack | Ability ID |
| :--- | :--- | :--- | :--- |
| `ADD_COUNTERS` | `01018` | Energy Channel (upgrade) (core) | `energy_channel_add` |
| `ATTACH_FACEDOWN_CARDS_FROM_HAND` | `01166` | Highway Robbery (side_scheme) (core_encounter) | `highway_robbery_when_revealed` |
| `ATTACHMENT_DAMAGE_SHIELD` | `01098` | Armored Rhino Suit (attachment) (core_encounter) | `armored_rhino_suit_shield` |
| `CANCEL_ATTACK` | `01009` | Webbed Up (upgrade) (core) | `webbed_up_interrupt` |
| `CANCEL_WHEN_REVEALED_AND_REVEAL_ANOTHER` | `01075` | Black Widow (ally) (core) | `black_widow_cancel` |
| `ENEMY_ATTACKS` | `01164` | Titania's Fury (treachery) (core_encounter) | `titanias_fury_when_revealed` |
| `EXHAUST` | `01191` | Exhaustion (treachery) (core_encounter) | `exhaustion_when_revealed` |
| `FLIP_FORM` | `01025` | Split Personality (event) (core) | `split_personality` |
| `GIVE_ADDITIONAL_BOOST_CARD` | `01164` | Titania's Fury (treachery) (core_encounter) | `titanias_fury_boost` |
| `MODIFY_ALLY_LIMIT` | `01073` | The Triskelion (support) (core) | `triskelion_ally_limit` |
| `MODIFY_HAND_SIZE` | `01029a` | Iron Man (hero) (core) | `iron_man_hand_size` |
| `PLAY_FROM_ZONE` | `01071` | Make the Call (event) (core) | `make_the_call` |
| `REDUCE_NEXT_CARD_COST` | `01092` | Helicarrier (support) (core) | `helicarrier_action` |
| `REVEAL_ENCOUNTER_CARD` | `01193` | Under Fire (treachery) (core_encounter) | `under_fire_when_revealed` |
| `SHUFFLE_INTO_DECK` | `01190` | Shadow of the Past (treachery) (core_encounter) | `shadow_of_the_past_when_revealed` |
| `TRANSFER_DAMAGE` | `01049` | Vibranium Suit (upgrade) (core) | `vibranium_suit_special` |
| `VILLAIN_AND_ENGAGED_MINIONS_ATTACK` | `01189` | Gang-Up (treachery) (core_encounter) | `gang_up_when_revealed` |
| `VILLAIN_SCHEMES` | `01186` | Advance (treachery) (core_encounter) | `advance_when_revealed` |

### Complete Effects Inventory:
| Effect Primitive | Occurrences | Declaring Cards |
| :--- | :--- | :--- |
| `DEAL_DAMAGE` | **25** | `01005` (Swinging Web Kick (event)), `01013` (Photonic Blast (event)), `01018` (Energy Channel (upgrade)), `01019a` (She-Hulk (hero)), `01021` (Gamma Slam (event)), `01022` (Ground Stomp (event)), `01030` (War Machine (ally)), `01031` (Repulsor Blast (event)), `01032` (Supersonic Punch (event)), `01038` (Powered Gauntlets (upgrade)), `01046` (Energy Daggers (upgrade)), `01047` (Panther Claws (upgrade)), `01050` (Hulk (ally)), `01053` (Relentless Assault (event)), `01054` (Uppercut (event)), `01056` (Tac Team (support)), `01058` (Daredevil (ally)), `01061` (Great Responsibility (event)), `01066` (Hawkeye (ally)), `01077` (Counter-Punch (event)), `01087` (Haymaker (event)), `01103` (Shocker (minion)), `01111` (Explosion (treachery)), `01174` (Electromagnetic Backlash (treachery)) |
| `ADD_STATUS` | **17** | `01009` (Webbed Up (upgrade)), `01011` (Spider-Woman (ally)), `01028` (Superhuman Strength (upgrade)), `01076` (Luke Cage (ally)), `01083` (Mockingbird (ally)), `01096` (Rhino (villain)), `01102` (Sandman (minion)), `01105` ("I'm Tough" (treachery)), `01112` (False Alarm (treachery)), `01157` (Killmonger (minion)), `01158` (Heart-Shaped Herb (treachery)), `01168` (Sweeping Swoop (treachery)), `01172` (Whiplash (minion)), `01194` (Unknown Card #01194) |
| `DISCARD` | **16** | `01002` (Black Cat (ally)), `01009` (Webbed Up (upgrade)), `01031` (Repulsor Blast (event)), `01050` (Hulk (ally)), `01084` (Nick Fury (ally)), `01100` (Enhanced Ivory Horn (attachment)), `01102` (Sandman (minion)), `01159` (Ritual Combat (treachery)), `01169` (The Vulture's Plans (treachery)), `01173` (Electric Whip Attack (treachery)), `01174` (Electromagnetic Backlash (treachery)), `01179` (Yon-Rogg's Treason (treachery)), `01188` (Caught Off Guard (treachery)), `01192` (Masterplan (treachery)), `01195` (Unknown Card #01195) |
| `MODIFY_STAT` | **13** | `01016` (Captain Marvel's Helmet (upgrade)), `01028` (Superhuman Strength (upgrade)), `01057` (Combat Training (upgrade)), `01059` (Jessica Jones (ally)), `01065` (Heroic Intuition (upgrade)), `01070` (Lead from the Front (event)), `01074` (Inspired (upgrade)), `01081` (Armored Vest (upgrade)), `01099` (Charge (attachment)), `01100` (Enhanced Ivory Horn (attachment)), `01162` (Titania (minion)) |
| `REMOVE_THREAT` | **12** | `01007` (Spider-Tracer (upgrade)), `01012` (Crisis Interdiction (event)), `01023` (Legal Practice (event)), `01026` (Superhuman Law Division (support)), `01037` (Mark V Helmet (upgrade)), `01048` (Tactical Genius (upgrade)), `01052` (Chase Them Down (event)), `01060` (For Justice! (event)), `01063` (Interrogation Room (support)), `01064` (Surveillance Team (support)) |
| `SURGE` | **11** | `01104` (Hard to Keep Down (treachery)), `01105` ("I'm Tough" (treachery)), `01106` (Stampede (treachery)), `01111` (Explosion (treachery)), `01112` (False Alarm (treachery)), `01164` (Titania's Fury (treachery)), `01168` (Sweeping Swoop (treachery)), `01179` (Yon-Rogg's Treason (treachery)), `01187` (Assault (treachery)), `01189` (Gang-Up (treachery)), `01190` (Shadow of the Past (treachery)) |
| `DRAW` | **10** | `01001a` (Spider-Man (hero)), `01010a` (Captain Marvel (hero)), `01010b` (Carol Danvers (alter_ego)), `01013` (Photonic Blast (event)), `01015` (Alpha Flight Station (support)), `01025` (Split Personality (event)), `01027` (Focused Rage (upgrade)), `01045` (The Golden City (support)), `01067` (Maria Hill (ally)), `01091` (Avengers Mansion (support)) |
| `PLAYER_CHOICE` | **10** | `01068` (Vision (ally)), `01084` (Nick Fury (ally)), `01110` (Hydra Bomber (minion)), `01155` (Affairs of State (obligation)), `01159` (Ritual Combat (treachery)), `01160` (Legal Work (obligation)), `01165` (Eviction Notice (obligation)), `01170` (Business Problems (obligation)), `01173` (Electric Whip Attack (treachery)), `01175` (Family Emergency (obligation)) |
| `ADD_THREAT` | **10** | `01107` (Breakin' & Takin' (side_scheme)), `01109` (Bomb Scare (side_scheme)), `01161` (Personal Challenge (side_scheme)), `01169` (The Vulture's Plans (treachery)), `01171` (Imminent Overload (side_scheme)), `01176` (The Psyche-Magnitron (side_scheme)), `01177` (Yon-Rogg (minion)), `01178` (Kree Manipulator (treachery)), `01192` (Masterplan (treachery)) |
| `HEAL_DAMAGE` | **6** | `01006` (Aunt May (support)), `01051` (Tigra (ally)), `01080` (Med Team (support)), `01086` (First Aid (event)), `01104` (Hard to Keep Down (treachery)), `01164` (Titania's Fury (treachery)) |
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
| `PUT_INTO_PLAY` | **3** | `01121` (Weapons Runner (minion)), `01190` (Shadow of the Past (treachery)) |
| `PREVENT_DAMAGE` | **2** | `01003` (Backflip (event)), `01017` (Cosmic Flight (upgrade)) |
| `CANCEL_WHEN_REVEALED` | **2** | `01004` (Enhanced Spider-Sense (event)), `01078` (Get Behind Me! (event)) |
| `ADD_TRAIT` | **2** | `01017` (Cosmic Flight (upgrade)), `01039` (Rocket Boots (upgrade)) |
| `RETURN_TO_HAND` | **2** | `01020` (Hellcat (ally)), `01166` (Highway Robbery (side_scheme)) |
| `MODIFY_MAX_HEALTH` | **2** | `01036` (Mark V Armor (upgrade)), `01039` (Rocket Boots (upgrade)) |
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
| `ENEMY_ATTACKS` | **1** | `01164` (Titania's Fury (treachery)) |
| `GIVE_ADDITIONAL_BOOST_CARD` | **1** | `01164` (Titania's Fury (treachery)) |
| `ATTACH_FACEDOWN_CARDS_FROM_HAND` | **1** | `01166` (Highway Robbery (side_scheme)) |
| `VILLAIN_SCHEMES` | **1** | `01186` (Advance (treachery)) |
| `VILLAIN_AND_ENGAGED_MINIONS_ATTACK` | **1** | `01189` (Gang-Up (treachery)) |
| `SHUFFLE_INTO_DECK` | **1** | `01190` (Shadow of the Past (treachery)) |
| `EXHAUST` | **1** | `01191` (Exhaustion (treachery)) |
| `REVEAL_ENCOUNTER_CARD` | **1** | `01193` (Under Fire (treachery)) |
| `ADD_ACCELERATION` | 🟡 **0** | *Unused in supplemental declarations* |
| `ALLY_LIMIT_BONUS` | 🟡 **0** | *Unused in supplemental declarations* |
| `CANCEL_TREACHERY_AND_VILLAIN_ATTACKS` | 🟡 **0** | *Unused in supplemental declarations* |
| `CANCEL_WHEN_REVEALED_AND_ATTACK` | 🟡 **0** | *Unused in supplemental declarations* |
| `COST_REDUCER` | 🟡 **0** | *Unused in supplemental declarations* |
| `DEAL_ADDITIONAL_BOOST_CARD` | 🟡 **0** | *Unused in supplemental declarations* |
| `DECLARE_DEFENDER` | 🟡 **0** | *Unused in supplemental declarations* |
| `DISTRIBUTE_AMOUNT` | 🟡 **0** | *Unused in supplemental declarations* |
| `EXECUTE_SPECIAL` | 🟡 **0** | *Unused in supplemental declarations* |
| `MODIFY_RESTRICTED_LIMIT` | 🟡 **0** | *Unused in supplemental declarations* |
| `MODIFY_COUNTER` | 🟡 **0** | *Unused in supplemental declarations* |
| `PLACE_CARD_UNDER_HOST` | 🟡 **0** | *Unused in supplemental declarations* |
| `REMOVE_COUNTERS` | 🟡 **0** | *Unused in supplemental declarations* |
| `REMOVE_COUNTERS_MATCHING_FILTER` | 🟡 **0** | *Unused in supplemental declarations* |
| `REMOVE_FROM_GAME` | 🟡 **0** | *Unused in supplemental declarations* |
| `RESTRICTED_LIMIT_BONUS` | 🟡 **0** | *Unused in supplemental declarations* |
| `SEARCH_AND_PLAY_UPGRADE` | 🟡 **0** | *Unused in supplemental declarations* |
| `SPEND_COUNTERS` | 🟡 **0** | *Unused in supplemental declarations* |
| `TRIGGER_WAKANDA_UPGRADES` | 🟡 **0** | *Unused in supplemental declarations* |
| `REMOVE_STATUS` | 🟡 **0** | *Unused in supplemental declarations* |

---

## 🔧 8. Effect Parameters & Dynamic Values (`effectParams`, `DynamicValueSourceSchema`)

### Effect Parameter Keys (`effectParams`):
| Parameter Key | Occurrences | Cards |
| :--- | :--- | :--- |
| `target` | **99** | `01001a` Spider-Man (hero), `01003` Backflip (event), `01005` Swinging Web Kick (event), `01006` Aunt May (support), `01007` Spider-Tracer (upgrade) *(+82 more)* |
| `amount` | **77** | `01001b` Peter Parker (alter_ego), `01005` Swinging Web Kick (event), `01006` Aunt May (support), `01007` Spider-Tracer (upgrade), `01008` Web-Shooter (upgrade) *(+65 more)* |
| `source` | **23** | `01002` Black Cat (ally), `01009` Webbed Up (upgrade), `01029b` Tony Stark (alter_ego), `01031` Repulsor Blast (event), `01034` Stark Tower (support) *(+17 more)* |
| `count` | **17** | `01001a` Spider-Man (hero), `01002` Black Cat (ally), `01010a` Captain Marvel (hero), `01010b` Carol Danvers (alter_ego), `01013` Photonic Blast (event) *(+12 more)* |
| `status` | **16** | `01009` Webbed Up (upgrade), `01011` Spider-Woman (ally), `01028` Superhuman Strength (upgrade), `01076` Luke Cage (ally), `01083` Mockingbird (ally) *(+8 more)* |
| `filter` | **12** | `01002` Black Cat (ally), `01034` Stark Tower (support), `01040b` T'Challa (alter_ego), `01041` Shuri (ally), `01071` Make the Call (event) *(+5 more)* |
| `stat` | **12** | `01016` Captain Marvel's Helmet (upgrade), `01028` Superhuman Strength (upgrade), `01057` Combat Training (upgrade), `01059` Jessica Jones (ally), `01065` Heroic Intuition (upgrade) *(+5 more)* |
| `title` | **10** | `01068` Vision (ally), `01084` Nick Fury (ally), `01110` Hydra Bomber (minion), `01155` Affairs of State (obligation), `01159` Ritual Combat (treachery) *(+5 more)* |
| `description` | **10** | `01068` Vision (ally), `01084` Nick Fury (ally), `01110` Hydra Bomber (minion), `01155` Affairs of State (obligation), `01159` Ritual Combat (treachery) *(+5 more)* |
| `options` | **10** | `01068` Vision (ally), `01084` Nick Fury (ally), `01110` Hydra Bomber (minion), `01155` Affairs of State (obligation), `01159` Ritual Combat (treachery) *(+5 more)* |
| `takeCount` | **6** | `01029b` Tony Stark (alter_ego), `01034` Stark Tower (support), `01040b` T'Challa (alter_ego), `01041` Shuri (ally), `01042` Ancestral Knowledge (event) *(+1 more)* |
| `selectedDestination` | **6** | `01029b` Tony Stark (alter_ego), `01034` Stark Tower (support), `01040b` T'Challa (alter_ego), `01041` Shuri (ally), `01042` Ancestral Knowledge (event) *(+1 more)* |
| `autoSelectIfUnambiguous` | **6** | `01029b` Tony Stark (alter_ego), `01034` Stark Tower (support), `01040b` T'Challa (alter_ego), `01041` Shuri (ally), `01042` Ancestral Knowledge (event) *(+1 more)* |
| `dynamicBonus` | **5** | `01015` Alpha Flight Station (support), `01031` Repulsor Blast (event), `01032` Supersonic Punch (event), `01038` Powered Gauntlets (upgrade), `01060` For Justice! (event) |
| `mode` | **5** | `01098` Armored Rhino Suit (attachment), `01159` Ritual Combat (treachery), `01169` The Vulture's Plans (treachery), `01174` Electromagnetic Backlash (treachery), `01192` Masterplan (treachery) |
| `perPlayer` | **5** | `01107` Breakin' & Takin' (side_scheme), `01109` Bomb Scare (side_scheme), `01161` Personal Challenge (side_scheme), `01171` Imminent Overload (side_scheme), `01176` The Psyche-Magnitron (side_scheme) |
| `form` | **5** | `01155` Affairs of State (obligation), `01160` Legal Work (obligation), `01165` Eviction Notice (obligation), `01170` Business Problems (obligation), `01175` Family Emergency (obligation) |
| `optional` | **5** | `01155` Affairs of State (obligation), `01160` Legal Work (obligation), `01165` Eviction Notice (obligation), `01170` Business Problems (obligation), `01175` Family Emergency (obligation) |
| `unselectedDestination` | **4** | `01029b` Tony Stark (alter_ego), `01040b` T'Challa (alter_ego), `01041` Shuri (ally), `01042` Ancestral Knowledge (event) |
| `shuffleAfter` | **4** | `01029b` Tony Stark (alter_ego), `01040b` T'Challa (alter_ego), `01041` Shuri (ally), `01095` Rhino (villain) |
| `keyword` | **4** | `01040a` Black Panther (hero), `01099` Charge (attachment), `01101` Hydra Mercenary (minion), `01172` Whiplash (minion) |
| `finisherBonus` | **4** | `01046` Energy Daggers (upgrade), `01047` Panther Claws (upgrade), `01048` Tactical Genius (upgrade), `01049` Vibranium Suit (upgrade) |
| `from` | **4** | `01049` Vibranium Suit (upgrade), `01190` Shadow of the Past (treachery) |
| `to` | **4** | `01049` Vibranium Suit (upgrade), `01121` Weapons Runner (minion), `01190` Shadow of the Past (treachery) |
| `aspect` | **4** | `01055` The Power of Aggression (resource), `01062` The Power of Justice (resource), `01072` The Power of Leadership (resource), `01079` The Power of Protection (resource) |
| `scaling` | **3** | `01018` Energy Channel (upgrade), `01023` Legal Practice (event), `01059` Jessica Jones (ally) |
| `multiplier` | **3** | `01018` Energy Channel (upgrade), `01023` Legal Practice (event), `01059` Jessica Jones (ally) |
| `promptTitle` | **3** | `01029b` Tony Stark (alter_ego), `01040b` T'Challa (alter_ego), `01041` Shuri (ally) |
| `duration` | **3** | `01039` Rocket Boots (upgrade), `01070` Lead from the Front (event), `01092` Helicarrier (support) |
| `resource` | **2** | `01001b` Peter Parker (alter_ego), `01008` Web-Shooter (upgrade) |
| `matchingDestination` | **2** | `01002` Black Cat (ally), `01192` Masterplan (treachery) |
| `maxPerHost` | **2** | `01009` Webbed Up (upgrade), `01074` Inspired (upgrade) |
| `trait` | **2** | `01017` Cosmic Flight (upgrade), `01039` Rocket Boots (upgrade) |
| `lookCount` | **2** | `01029b` Tony Stark (alter_ego), `01042` Ancestral Knowledge (event) |
| `fromTop` | **2** | `01034` Stark Tower (support), `01042` Ancestral Knowledge (event) |
| `targetPlayer` | **2** | `01046` Energy Daggers (upgrade), `01070` Lead from the Front (event) |
| `reveal` | **2** | `01190` Shadow of the Past (treachery) |
| `distinctFrom` | **1** | `01012` Crisis Interdiction (event) |
| `counterType` | **1** | `01018` Energy Channel (upgrade) |
| `limit` | **1** | `01025` Split Personality (event) |
| `isVoluntary` | **1** | `01029b` Tony Stark (alter_ego) |
| `fromCard` | **1** | `01033` Pepper Potts (support) |
| `kickerResource` | **1** | `01053` Relentless Assault (event) |
| `overkillOnCondition` | **1** | `01053` Relentless Assault (event) |
| `overkillOnPhysical` | **1** | `01053` Relentless Assault (event) |
| `atkBonus` | **1** | `01070` Lead from the Front (event) |
| `thwBonus` | **1** | `01070` Lead from the Front (event) |
| `costMode` | **1** | `01071` Make the Call (event) |
| `destination` | **1** | `01071` Make the Call (event) |
| `control` | **1** | `01071` Make the Call (event) |
| `maxAbsorb` | **1** | `01098` Armored Rhino Suit (attachment) |
| `enemy` | **1** | `01164` Titania's Fury (treachery) |
| `cardCode` | **1** | `01177` Yon-Rogg (minion) |
| `fallback` | **1** | `01188` Caught Off Guard (treachery) |
| `toDeck` | **1** | `01190` Shadow of the Past (treachery) |
| `untilFilter` | **1** | `01192` Masterplan (treachery) |

### Dynamic Value Sources (`DynamicValueSourceSchema`):
| Dynamic Value Resolver | Occurrences | Cards |
| :--- | :--- | :--- |
| `DISCARDED_CARDS (attr: RESOURCE_ICONS)` | **3** | `01031` Repulsor Blast (event), `01174` Electromagnetic Backlash (treachery) |
| `COUNTERS (counter: energy)` | **2** | `01018` Energy Channel (upgrade) |
| `STAT_VALUE (stat: SUFFERED_DAMAGE)` | **2** | `01021` Gamma Slam (event) |
| `ENTITY_COUNT` | **2** | `01029a` Iron Man (hero) |
| `HAS_TRAIT` | **2** | `01032` Supersonic Punch (event), `01038` Powered Gauntlets (upgrade) |
| `INTERCEPTED_VALUE` | **2** | `01061` Great Responsibility (event) |
| `STAT_VALUE (stat: ATTACK)` | **2** | `01077` Counter-Punch (event) |
| `CARD_ATTRIBUTE (attr: THREAT)` | **2** | `01111` Explosion (treachery) |
| `CARD_ATTRIBUTE (attr: REMAINING_HIT_POINTS)` | **2** | `01162` Titania (minion) |
| `DISCARDED_CARDS (attr: DIFFERENT_RESOURCES)` | **2** | `01169` The Vulture's Plans (treachery) |
| `HAS_IDENTITY` | **1** | `01015` Alpha Flight Station (support) |
| `PAID_WITH_RESOURCE` | **1** | `01060` For Justice! (event) |

---

## 🔍 9. Universal Card Filters & Compositions (`UniversalCardFilterSchema`)

### Filter Predicate Criteria:
| Filter Criterion Key | Occurrences | Cards |
| :--- | :--- | :--- |
| `types` | **15** | `01029a` Iron Man (hero), `01034` Stark Tower (support), `01040b` T'Challa (alter_ego), `01041` Shuri (ally), `01043a` Wakanda Forever! (event) *(+8 more)* |
| `traits` | **10** | `01029a` Iron Man (hero), `01032` Supersonic Punch (event), `01034` Stark Tower (support), `01038` Powered Gauntlets (upgrade), `01040b` T'Challa (alter_ego) *(+4 more)* |
| `sets` | **3** | `01190` Shadow of the Past (treachery) |
| `resourceIcons` | **2** | `01002` Black Cat (ally), `01179` Yon-Rogg's Treason (treachery) |
| `codes` | **2** | `01015` Alpha Flight Station (support), `01095` Rhino (villain) |

### Filter Logical Compositions:
| Composition Branch | Occurrences | Cards |
| :--- | :--- | :--- |

---

## ⚠️ 10. Global Zero-Usage & Schema Gap Detection

The following schema enums are defined in `src/data/supplemental/schema.ts` but currently have **0 card declarations** across the active supplemental data packs:

| Schema / Enum | Unused Enum Value | Status | Notes |
| :--- | :--- | :--- | :--- |
| `EffectTypeSchema` | `ADD_ACCELERATION` | 🟡 `0 Cards` | Defined in schema; no card currently declares this effect. |
| `EffectTypeSchema` | `ALLY_LIMIT_BONUS` | 🟡 `0 Cards` | Defined in schema; no card currently declares this effect. |
| `EffectTypeSchema` | `CANCEL_TREACHERY_AND_VILLAIN_ATTACKS` | 🟡 `0 Cards` | Defined in schema; no card currently declares this effect. |
| `EffectTypeSchema` | `CANCEL_WHEN_REVEALED_AND_ATTACK` | 🟡 `0 Cards` | Defined in schema; no card currently declares this effect. |
| `EffectTypeSchema` | `COST_REDUCER` | 🟡 `0 Cards` | Defined in schema; no card currently declares this effect. |
| `EffectTypeSchema` | `DEAL_ADDITIONAL_BOOST_CARD` | 🟡 `0 Cards` | Defined in schema; no card currently declares this effect. |
| `EffectTypeSchema` | `DECLARE_DEFENDER` | 🟡 `0 Cards` | Defined in schema; no card currently declares this effect. |
| `EffectTypeSchema` | `DISTRIBUTE_AMOUNT` | 🟡 `0 Cards` | Defined in schema; no card currently declares this effect. |
| `EffectTypeSchema` | `EXECUTE_SPECIAL` | 🟡 `0 Cards` | Defined in schema; no card currently declares this effect. |
| `EffectTypeSchema` | `MODIFY_RESTRICTED_LIMIT` | 🟡 `0 Cards` | Defined in schema; no card currently declares this effect. |
| `EffectTypeSchema` | `MODIFY_COUNTER` | 🟡 `0 Cards` | Defined in schema; no card currently declares this effect. |
| `EffectTypeSchema` | `PLACE_CARD_UNDER_HOST` | 🟡 `0 Cards` | Defined in schema; no card currently declares this effect. |
| `EffectTypeSchema` | `REMOVE_COUNTERS` | 🟡 `0 Cards` | Defined in schema; no card currently declares this effect. |
| `EffectTypeSchema` | `REMOVE_COUNTERS_MATCHING_FILTER` | 🟡 `0 Cards` | Defined in schema; no card currently declares this effect. |
| `EffectTypeSchema` | `REMOVE_FROM_GAME` | 🟡 `0 Cards` | Defined in schema; no card currently declares this effect. |
| `EffectTypeSchema` | `RESTRICTED_LIMIT_BONUS` | 🟡 `0 Cards` | Defined in schema; no card currently declares this effect. |
| `EffectTypeSchema` | `SEARCH_AND_PLAY_UPGRADE` | 🟡 `0 Cards` | Defined in schema; no card currently declares this effect. |
| `EffectTypeSchema` | `SPEND_COUNTERS` | 🟡 `0 Cards` | Defined in schema; no card currently declares this effect. |
| `EffectTypeSchema` | `TRIGGER_WAKANDA_UPGRADES` | 🟡 `0 Cards` | Defined in schema; no card currently declares this effect. |
| `EffectTypeSchema` | `REMOVE_STATUS` | 🟡 `0 Cards` | Defined in schema; no card currently declares this effect. |
| `TriggerTypeSchema` | `SCHEME_DEFEATED` | 🟡 `0 Cards` | Defined in schema; no card currently declares this trigger window. |
| `TriggerTypeSchema` | `MAIN_SCHEME_ADVANCED` | 🟡 `0 Cards` | Defined in schema; no card currently declares this trigger window. |
| `TriggerTypeSchema` | `RESOURCE_SPENT` | 🟡 `0 Cards` | Defined in schema; no card currently declares this trigger window. |
| `TriggerTypeSchema` | `ATTACK` | 🟡 `0 Cards` | Defined in schema; no card currently declares this trigger window. |
| `TriggerTypeSchema` | `ROUND_BEGAN` | 🟡 `0 Cards` | Defined in schema; no card currently declares this trigger window. |
| `TriggerTypeSchema` | `PLAYER_PHASE_BEGAN` | 🟡 `0 Cards` | Defined in schema; no card currently declares this trigger window. |
| `TriggerTypeSchema` | `PLAYER_PHASE_ENDED` | 🟡 `0 Cards` | Defined in schema; no card currently declares this trigger window. |
| `TriggerTypeSchema` | `VILLAIN_PHASE_BEGAN` | 🟡 `0 Cards` | Defined in schema; no card currently declares this trigger window. |
| `TriggerTypeSchema` | `VILLAIN_PHASE_ENDED` | 🟡 `0 Cards` | Defined in schema; no card currently declares this trigger window. |
| `TriggerTypeSchema` | `DAMAGE_TAKEN` | 🟡 `0 Cards` | Defined in schema; no card currently declares this trigger window. |
| `TriggerTypeSchema` | `THREAT_PLACED` | 🟡 `0 Cards` | Defined in schema; no card currently declares this trigger window. |
| `TriggerTypeSchema` | `STATUS_REMOVED` | 🟡 `0 Cards` | Defined in schema; no card currently declares this trigger window. |
| `TimingTypeSchema` | `ALTER_EGO_RESOURCE` | 🟡 `0 Cards` | Defined in schema; no card currently declares this timing category. |
| `TimingTypeSchema` | `ALTER_EGO_RESPONSE` | 🟡 `0 Cards` | Defined in schema; no card currently declares this timing category. |
| `TargetSelectorSchema` | `TRIGGERING_HERO` | 🟡 `0 Cards` | Defined in schema; no card currently declares this target selector. |
| `TargetSelectorSchema` | `ENGAGED_MINIONS` | 🟡 `0 Cards` | Defined in schema; no card currently declares this target selector. |
| `TargetSelectorSchema` | `CHOSEN_ENGAGED_MINION` | 🟡 `0 Cards` | Defined in schema; no card currently declares this target selector. |
| `TargetSelectorSchema` | `ALL_MINIONS` | 🟡 `0 Cards` | Defined in schema; no card currently declares this target selector. |
| `TargetSelectorSchema` | `CHOSEN_CONTROLLED_ALLY` | 🟡 `0 Cards` | Defined in schema; no card currently declares this target selector. |
| `TargetSelectorSchema` | `ALL_CONTROLLED_ALLIES` | 🟡 `0 Cards` | Defined in schema; no card currently declares this target selector. |
| `TargetSelectorSchema` | `ALL_CONTROLLED_TABLEAU` | 🟡 `0 Cards` | Defined in schema; no card currently declares this target selector. |
| `TargetSelectorSchema` | `ALL_ALLIES` | 🟡 `0 Cards` | Defined in schema; no card currently declares this target selector. |
| `TargetSelectorSchema` | `CHOSEN_CONTROLLED_CHARACTER` | 🟡 `0 Cards` | Defined in schema; no card currently declares this target selector. |
| `TargetSelectorSchema` | `ALL_FRIENDLY_CHARACTERS` | 🟡 `0 Cards` | Defined in schema; no card currently declares this target selector. |
| `TargetSelectorSchema` | `CHOSEN_SIDE_SCHEME` | 🟡 `0 Cards` | Defined in schema; no card currently declares this target selector. |
| `TargetSelectorSchema` | `TRIGGERING_SCHEME` | 🟡 `0 Cards` | Defined in schema; no card currently declares this target selector. |
| `TargetSelectorSchema` | `PREVIOUS_SELECTED_CARD` | 🟡 `0 Cards` | Defined in schema; no card currently declares this target selector. |
| `TargetSelectorSchema` | `HOST` | 🟡 `0 Cards` | Defined in schema; no card currently declares this target selector. |
| `ConditionGateSchema` | `ALWAYS` | 🟡 `0 Cards` | Defined in schema; no card currently declares this condition gate. |
| `ConditionGateSchema` | `IF_PREVIOUS_SUCCESS` | 🟡 `0 Cards` | Defined in schema; no card currently declares this condition gate. |
| `ConditionGateSchema` | `IF_ZERO_HEALED` | 🟡 `0 Cards` | Defined in schema; no card currently declares this condition gate. |
| `StepConditionSchema` | `SCHEME_EMPTY` | 🟡 `0 Cards` | Defined in schema; no card currently declares this step condition. |
| `StepConditionSchema` | `TARGET_DEFEATED` | 🟡 `0 Cards` | Defined in schema; no card currently declares this step condition. |
| `StepConditionSchema` | `FULLY_HEALED` | 🟡 `0 Cards` | Defined in schema; no card currently declares this step condition. |
| `StepConditionSchema` | `STATUS_APPLIED` | 🟡 `0 Cards` | Defined in schema; no card currently declares this step condition. |
| `StepConditionSchema` | `EXCESS_DAMAGE_DEALT` | 🟡 `0 Cards` | Defined in schema; no card currently declares this step condition. |
| `StepConditionSchema` | `ALREADY_HAS_STATUS` | 🟡 `0 Cards` | Defined in schema; no card currently declares this step condition. |
| `StepConditionSchema` | `TARGET_ALREADY_EXHAUSTED` | 🟡 `0 Cards` | Defined in schema; no card currently declares this step condition. |
| `StepConditionSchema` | `TARGET_FORM_MATCH` | 🟡 `0 Cards` | Defined in schema; no card currently declares this step condition. |
| `StepConditionSchema` | `COUNTER_THRESHOLD_MET` | 🟡 `0 Cards` | Defined in schema; no card currently declares this step condition. |
| `KeywordSchema` | `Guard` | 🟡 `0 Cards` | Defined in schema; no card currently declares this keyword directly in supplemental data. |
| `KeywordSchema` | `Overkill` | 🟡 `0 Cards` | Defined in schema; no card currently declares this keyword directly in supplemental data. |
| `KeywordSchema` | `Quickstrike` | 🟡 `0 Cards` | Defined in schema; no card currently declares this keyword directly in supplemental data. |
| `KeywordSchema` | `Ranged` | 🟡 `0 Cards` | Defined in schema; no card currently declares this keyword directly in supplemental data. |
| `KeywordSchema` | `Retaliate` | 🟡 `0 Cards` | Defined in schema; no card currently declares this keyword directly in supplemental data. |
| `KeywordSchema` | `Toughness` | 🟡 `0 Cards` | Defined in schema; no card currently declares this keyword directly in supplemental data. |
| `KeywordSchema` | `Crisis` | 🟡 `0 Cards` | Defined in schema; no card currently declares this keyword directly in supplemental data. |
| `KeywordSchema` | `Hazard` | 🟡 `0 Cards` | Defined in schema; no card currently declares this keyword directly in supplemental data. |
| `KeywordSchema` | `Acceleration` | 🟡 `0 Cards` | Defined in schema; no card currently declares this keyword directly in supplemental data. |