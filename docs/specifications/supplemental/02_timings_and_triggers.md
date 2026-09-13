# 02. Ability Timings & Event Triggers

> [!NOTE]
> **Status:** 🟢 `IMPLEMENTED (v1.0)`  
> Validated via [`TimingTypeSchema`](../../../src/data/supplemental/schema.ts#L25) and [`TriggerTypeSchema`](../../../src/data/supplemental/schema.ts#L48).

---

## 1. Ability Timing Types (`timing`)

The `timing` field specifies when an ability can be initiated or how it intercepts engine execution:

| `timing` Enum Literal   | Engine Category     | Description                                                              | Form Gating    |
| :---------------------- | :------------------ | :----------------------------------------------------------------------- | :------------- |
| `'ACTION'`              | Player Action       | Voluntary player action during their turn in Player Phase.               | Either Form    |
| `'HERO_ACTION'`         | Player Action       | Action restricted strictly to Hero form.                                 | Hero only      |
| `'ALTER_EGO_ACTION'`    | Player Action       | Action restricted strictly to Alter-Ego form.                            | Alter-Ego only |
| `'INTERRUPT'`           | Voluntary Reaction  | Optional reaction interrupting an event before resolution.               | Any            |
| `'FORCED_INTERRUPT'`    | Mandatory Reaction  | Mandatory reaction interrupting an event before resolution.              | Any            |
| `'HERO_INTERRUPT'`      | Reaction            | Interrupt restricted to Hero form.                                       | Hero only      |
| `'ALTER_EGO_INTERRUPT'` | Reaction            | Interrupt restricted to Alter-Ego form.                                  | Alter-Ego only |
| `'RESPONSE'`            | Voluntary Reaction  | Optional reaction occurring immediately after event resolution.          | Any            |
| `'FORCED_RESPONSE'`     | Mandatory Reaction  | Mandatory reaction occurring immediately after event resolution.         | Any            |
| `'HERO_RESPONSE'`       | Reaction            | Response restricted to Hero form.                                        | Hero only      |
| `'ALTER_EGO_RESPONSE'`  | Reaction            | Response restricted to Alter-Ego form.                                   | Alter-Ego only |
| `'WHEN_REVEALED'`       | Encounter Mandatory | Triggered when encounter card is revealed in Step 5 or spawned.          | Encounter      |
| `'CONSTANT'`            | Static / Aura       | Continuous passive modifier while card remains face-up in play.          | Any            |
| `'SPECIAL'`             | Composite Trigger   | Triggered specifically by a parent event (e.g. _Wakanda Forever!_).      | Any            |
| `'SETUP'`               | Scenario Setup      | Executed during Step 4/8 of game setup (e.g. _T'Challa_ upgrade search). | Setup Phase    |
| `'BOOST'`               | Boost Resolution    | Triggered when card is flipped as a Villain or Minion boost card.        | Step 2/3 Boost |
| `'CARD_PLAYED'`         | On-Play Attachment  | Triggered when upgrade/attachment is played onto a host.                 | Play window    |

---

## 2. Event Trigger Windows (`trigger`)

When an ability is an Interrupt or Response, `trigger` binds it to an engine dispatch signal:

| `trigger` Enum Literal     | Description                                                                                                                                            | Source Pipeline                           |
| :------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------- |
| `'WHEN_REVEALED'`          | Card is being revealed from encounter deck or dealt cards.                                                                                             | `step5_revealEncounterCards`              |
| `'ATTACK'`                 | Target character is declared as the recipient of an attack.                                                                                            | `executeVillainAttackAgainstPlayer`       |
| `'MINION_ATTACKED'`        | Minion completes an attack activation against a player.                                                                                                | `executeMinionAttackAgainstPlayer`        |
| `'ENEMY_INITIATES_ATTACK'` | Enemy initiates attack sequence (Spider-Sense window).                                                                                                 | `combat-pipeline.ts`                      |
| `'DAMAGE_WOULD_BE_TAKEN'`  | Character is about to suffer damage (Backflip window).                                                                                                 | `combat-pipeline.ts`                      |
| `'DAMAGE_TAKEN'`           | Character suffers damage from any source.                                                                                                              | `effects/index.ts`                        |
| `'CARD_PLAYED'`            | Card enters play from hand or zone.                                                                                                                    | `action-dispatcher.ts`                    |
| `'CHARACTER_DEFEATED'`     | Any character (minion, ally, hero) is reduced to 0 HP and defeated.                                                                                    | `combat-pipeline.ts` / `effects/index.ts` |
| `'SCHEME_DEFEATED'`        | Scheme (main or side) is cleared of threat and defeated.                                                                                               | `action-dispatcher.ts`                    |
| `'ATTACHED_ENEMY_ATTACKS'` | Enemy hosting this attachment initiates attack (Webbed Up window).                                                                                     | `villain-phase.ts`                        |
| `'THREAT_WOULD_BE_PLACED'` | Threat is about to be placed on a scheme (Great Responsibility window).                                                                                | `villain-phase.ts`                        |
| `'MAIN_SCHEME_ADVANCED'`   | Main scheme reaches target threat and advances stage.                                                                                                  | `scenario-helpers.ts`                     |
| `'FORM_CHANGED'`           | Player flips identity form (hero or alter-ego).                                                                                                        | `action-dispatcher.ts`                    |
| `'STATUS_REMOVED'`         | Status card (Stunned, Confused, Tough) is discarded.                                                                                                   | `effects/index.ts`                        |
| `'ROUND_BEGAN'`            | Round counter increments, starting player phase.                                                                                                       | `round-upkeep.ts`                         |
| `'ROUND_ENDED'`            | Round upkeep begins / passes First Player token.                                                                                                       | `round-upkeep.ts`                         |
| `'PLAYER_PHASE_BEGAN'`     | Player phase begins and basic form change limit resets.                                                                                                | `player-phase.ts`                         |
| `'PLAYER_PHASE_ENDED'`     | All players have ended their turns.                                                                                                                    | `player-phase.ts`                         |
| `'VILLAIN_PHASE_BEGAN'`    | Villain phase begins (Step 1 place threat).                                                                                                            | `villain-phase.ts`                        |
| `'VILLAIN_PHASE_ENDED'`    | Villain phase completes (after Step 5 reveals).                                                                                                        | `villain-phase.ts`                        |
| `'PHASE_START'`            | A new game phase begins.                                                                                                                               | `pipeline.ts`                             |
| `'DEFEATED'`               | Side/Player Side Scheme reduced to 0 threat - resolves 'When Defeated' rewards declared on the scheme card (e.g. _Highway Robbery_ `01166`, ADR-0034). | `action-dispatcher.ts` (`BASIC_THWART`)   |
