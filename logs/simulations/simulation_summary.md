# Card-Ability Coverage Gate (Roadmap 1.4)

* **Abilities in scope:** 161
* **Covered:** 161 (100.0%)
* **Uncovered:** 0
* **Variant failures (2-player / choice branches):** 0
* **Rule scenarios (one situation per rule):** 22/22 pass
* **Trigger windows (two abilities, one trigger):** 7/7 clean
* **Gauntlet:** 20/20 matches clean, 81 of 161 abilities seen
* **Rules observed (Rules Reference v1.8 glossary):** 143 of 257 (0 mapped but unseen, 114 declared untested, 0 drift)
* **Card data hash:** `70680974`
* **Statistics baseline:** `96c234eb` (the Gauntlet steers by it; `--no-stats` makes a run independent of the statistics file)
* **Gauntlet scope:** Rhino only, the Gate 1 scenario; trigger windows ordered-checked in 0 of 7 (Core data has no window that mixes forced and optional abilities)

## Coverage by timing

| Timing | Covered | Total |
| :--- | ---: | ---: |
| ACTION | 19 | 19 |
| ALTER_EGO_ACTION | 6 | 6 |
| BOOST | 6 | 6 |
| CONSTANT | 22 | 22 |
| FORCED_INTERRUPT | 3 | 3 |
| FORCED_RESPONSE | 14 | 14 |
| HERO_ACTION | 25 | 25 |
| HERO_INTERRUPT | 4 | 4 |
| HERO_RESOURCE | 1 | 1 |
| INTERRUPT | 5 | 5 |
| RESOURCE | 6 | 6 |
| RESPONSE | 13 | 13 |
| SETUP | 1 | 1 |
| SPECIAL | 4 | 4 |
| WHEN_REVEALED | 32 | 32 |

## Gauntlet findings (errors fail the run; coverage here is only reported)

None.

## Rule scenario findings

None.

## Trigger window findings

None.

## Uncovered abilities

None.

## Rule coverage (glossary entries of the Rules Reference v1.8)

* **Observed:** 143 of 257 (Stage-Setter 143, Gauntlet 0)
* **Mapped, no scenario showed it:** 0
* **Declared untested:** 114

## Rule drift (fails the run)

None.

## Rules no scenario observed

None.

## Rules declared untested

* ACTIVE PLAYER (`active-player`): no-observable, no log key, timing, effect or trigger names it
* “ADDITIONAL ” (`additional`): no-observable, no log key, timing, effect or trigger names it
* ALLIANCE (`alliance`): no-observable, no log key, timing, effect or trigger names it
* “ALREADY” (`already`): definition, wording rule for the word "already"
* ALTERATION EFFECT (`alteration-effect`): no-observable, no log key, timing, effect or trigger names it
* AMPLIFY ICON ( [amplify]) (`amplify-icon`): no-observable, no log key, timing, effect or trigger names it
* “AND” (`and`): definition, wording rule for the word "and"
* ARROW ICON ( →) (`arrow-icon`): definition, printing convention that separates a cost from its effect
* ASPECT CARD (`aspect-card`): no-observable, no log key, timing, effect or trigger names it
* ASSAULT (`assault`): no-observable, no log key, timing, effect or trigger names it
* BASE VALUE (`base-value`): no-observable, no log key, timing, effect or trigger names it
* BASIC CARD (`basic-card`): no-observable, no log key, timing, effect or trigger names it
* BASIC POWER (`basic-power`): no-observable, no log key, timing, effect or trigger names it
* CAMPAIGN MODE (`campaign-mode`): definition, campaign play is outside the engine
* CAMPAIGN-SPECIFIC CARD (`campaign-specific-card`): definition, campaign play is outside the engine
* CARD TYPES (`card-types`): definition, lists the card types
* CHARACTER (`character`): no-observable, no log key, timing, effect or trigger names it
* CLASSIFICATIONS (`classifications`): definition, lists the card classifications
* CONTROL (`control`): no-observable, no log key, timing, effect or trigger names it
* COPY (`copy`): no-observable, no log key, timing, effect or trigger names it
* COST ARROW ICON ( →) (`cost-arrow-icon`): definition, printing convention that separates a cost from its effect
* DASH (VALUE) (`dash-value`): definition, printing convention for a stat with no value
* DECK CUSTOMIZATION (`deck-customization`): definition, deckbuilding is outside the simulation
* DELAYED EFFECT (`delayed-effect`): no-observable, no log key, timing, effect or trigger names it
* DOUBLE-SIDED CARD (`double-sided-card`): no-observable, no log key, timing, effect or trigger names it
* “EACH PLAYER” (`each-player`): no-observable, no log key, timing, effect or trigger names it
* “EACH TIME” (`each-time`): no-observable, no log key, timing, effect or trigger names it
* EFFECT (`effect`): no-observable, no log key, timing, effect or trigger names it
* ENCOUNTER SET (`encounter-set`): definition, card-set membership
* ENERGY RESOURCE ( [energy]) (`energy-resource`): no-observable, no log key, timing, effect or trigger names it
* EVENT (`event`): no-observable, no log key, timing, effect or trigger names it
* EXPERT MODE (`expert-mode`): no-observable, no log key, timing, effect or trigger names it
* EXPERT SET (`expert-set`): no-observable, no log key, timing, effect or trigger names it
* “FOR EACH” (`for-each`): no-observable, no log key, timing, effect or trigger names it
* “FRIENDLY” (`friendly`): no-observable, no log key, timing, effect or trigger names it
* GAME ELEMENT (`game-element`): no-observable, no log key, timing, effect or trigger names it
* HAZARD ICON ( [hazard]) (`hazard-icon`): no-observable, no log key, timing, effect or trigger names it
* HEROIC MODE (`heroic-mode`): no-observable, no log key, timing, effect or trigger names it
* HINDER X (`hinder-x`): no-observable, no log key, timing, effect or trigger names it
* ICONS (`icons`): definition, lists the icons
* IDENTITY-SPECIFIC CARD (`identity-specific-card`): no-observable, no log key, timing, effect or trigger names it
* IGNORE (`ignore`): no-observable, no log key, timing, effect or trigger names it
* IN PLAYER ORDER (`in-player-order`): no-observable, no log key, timing, effect or trigger names it
* INCITE X (`incite-x`): no-observable, no log key, timing, effect or trigger names it
* INDIRECT DAMAGE (`indirect-damage`): no-observable, no log key, timing, effect or trigger names it
* INFINITE HIT POINTS (`infinite-hit-points`): no-observable, no log key, timing, effect or trigger names it
* “INSTEAD” (`instead`): no-observable, no log key, timing, effect or trigger names it
* LABELED ABILITY (`labeled-ability`): no-observable, no log key, timing, effect or trigger names it
* LASTING EFFECTS (`lasting-effects`): no-observable, no log key, timing, effect or trigger names it
* LEADER (`leader`): no-observable, no log key, timing, effect or trigger names it
* LINKED (CARD TITLE) (`linked-card-title`): no-observable, no log key, timing, effect or trigger names it
* LOOK, LOOKED-AT (`look-looked-at`): no-observable, no log key, timing, effect or trigger names it
* “LOSES” (`loses`): no-observable, no log key, timing, effect or trigger names it
* MENTAL RESOURCE ( [mental]) (`mental-resource`): no-observable, no log key, timing, effect or trigger names it
* MODES OF PLAY (`modes-of-play`): definition, lists the modes of play
* MODULAR ENCOUNTER SET (`modular-encounter-set`): no-observable, no log key, timing, effect or trigger names it
* NEMESIS ENCOUNTER SET (`nemesis-encounter-set`): no-observable, no log key, timing, effect or trigger names it
* NON-NUMERICAL VARIABLE (`non-numerical-variable`): no-observable, no log key, timing, effect or trigger names it
* “OTHERWISE” (`otherwise`): no-observable, no log key, timing, effect or trigger names it
* “OVERPAY” (`overpay`): no-observable, no log key, timing, effect or trigger names it
* OWNERSHIP AND CONTROL (`ownership-and-control`): no-observable, no log key, timing, effect or trigger names it
* PER PLAYER ICON ( [per-player]) (`per-player-icon`): no-observable, no log key, timing, effect or trigger names it
* PERIL (`peril`): no-observable, no log key, timing, effect or trigger names it
* PHYSICAL RESOURCE ( [physical]) (`physical-resource`): no-observable, no log key, timing, effect or trigger names it
* PLAY AREA (`play-area`): no-observable, no log key, timing, effect or trigger names it
* PLAY RESTRICTIONS AND PERMISSIONS (`play-restrictions-and-permissions`): no-observable, no log key, timing, effect or trigger names it
* PLAYER (`player`): no-observable, no log key, timing, effect or trigger names it
* PLAYER CARD (`player-card`): no-observable, no log key, timing, effect or trigger names it
* PLAYER SIDE SCHEME (`player-side-scheme`): no-observable, no log key, timing, effect or trigger names it
* PLAYER SIDE SCHEME LIMIT (`player-side-scheme-limit`): no-observable, no log key, timing, effect or trigger names it
* PLAYER’S PLAY AREA (`player’s-play-area`): no-observable, no log key, timing, effect or trigger names it
* PRINTED (`printed`): no-observable, no log key, timing, effect or trigger names it
* QUALIFIERS (`qualifiers`): no-observable, no log key, timing, effect or trigger names it
* RANGED (`ranged`): no-observable, no log key, timing, effect or trigger names it
* REFERENTIAL ABILITY (`referential-ability`): no-observable, no log key, timing, effect or trigger names it
* REMAINING HIT POINTS (`remaining-hit-points`): no-observable, no log key, timing, effect or trigger names it
* REMINDER TEXT (`reminder-text`): definition, text printed in italics with no rules weight
* REPLACEMENT EFFECT (`replacement-effect`): no-observable, no log key, timing, effect or trigger names it
* REQUIREMENT (RESOURCES) (`requirement-resources`): no-observable, no log key, timing, effect or trigger names it
* RESOURCE TYPE (`resource-type`): no-observable, no log key, timing, effect or trigger names it
* ROOKIE MODE (`rookie-mode`): no-observable, no log key, timing, effect or trigger names it
* SCENARIO-SPECIFIC CARD (`scenario-specific-card`): no-observable, no log key, timing, effect or trigger names it
* SELF-REFERENTIAL (`self-referential`): no-observable, no log key, timing, effect or trigger names it
* SET ASIDE, SET-ASIDE (`set-aside-set-aside`): no-observable, no log key, timing, effect or trigger names it
* SET ICON (`set-icon`): definition, printing convention that names the card set
* SKIRMISH MODE (`skirmish-mode`): definition, a mode of play outside the engine
* STALWART (`stalwart`): no-observable, no log key, timing, effect or trigger names it
* STANDARD MODE (`standard-mode`): no-observable, no log key, timing, effect or trigger names it
* STANDARD SET (`standard-set`): no-observable, no log key, timing, effect or trigger names it
* STEADY (`steady`): no-observable, no log key, timing, effect or trigger names it
* SUBTITLE (`subtitle`): definition, printed card subtitle
* SUPPORT (`support`): no-observable, no log key, timing, effect or trigger names it
* SUSTAINED DAMAGE (`sustained-damage`): no-observable, no log key, timing, effect or trigger names it
* “SWAP” (`swap`): no-observable, no log key, timing, effect or trigger names it
* TABLE TALK (`table-talk`): definition, table etiquette for players
* TARGET THREAT (`target-threat`): no-observable, no log key, timing, effect or trigger names it
* TEAM-UP (`team-up`): no-observable, no log key, timing, effect or trigger names it
* TEAMWORK ( TRAIT ) (`teamwork-trait`): no-observable, no log key, timing, effect or trigger names it
* TEMPORARY (`temporary`): no-observable, no log key, timing, effect or trigger names it
* TEXT BOX (`text-box`): definition, layout of a card
* “THAT” (`that`): definition, wording rule for the word "that"
* “THEN” (`then`): no-observable, no log key, timing, effect or trigger names it
* “THIS” (`this`): definition, wording rule for the word "this"
* UNIQUE ICON ( [unique]) (`unique-icon`): no-observable, no log key, timing, effect or trigger names it
* UPGRADE (`upgrade`): no-observable, no log key, timing, effect or trigger names it
* VICTORY DISPLAY (`victory-display`): no-observable, no log key, timing, effect or trigger names it
* VICTORY X (`victory-x`): no-observable, no log key, timing, effect or trigger names it
* VILLAINOUS (`villainous`): no-observable, no log key, timing, effect or trigger names it
* VILLAIN’S PLAY AREA (`villain’s-play-area`): no-observable, no log key, timing, effect or trigger names it
* VULNERABLE (`vulnerable`): no-observable, no log key, timing, effect or trigger names it
* WHEN COMPLETED ABILITIES (`when-completed-abilities`): no-observable, no log key, timing, effect or trigger names it
* WILD RESOURCE ( [wild]) (`wild-resource`): no-observable, no log key, timing, effect or trigger names it
* “X” (VALUE) (`x-value`): no-observable, no log key, timing, effect or trigger names it
* YOU, YOUR (`you-your`): definition, wording rule for the words "you" and "your"
