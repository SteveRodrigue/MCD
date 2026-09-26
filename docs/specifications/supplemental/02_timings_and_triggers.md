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
| `'RESOURCE'`            | Resource Generation | Voluntary resource generation ability during payment window.             | Either Form    |
| `'HERO_RESOURCE'`       | Resource Generation | Resource generation restricted strictly to Hero form.                    | Hero only      |
| `'ALTER_EGO_RESOURCE'`  | Resource Generation | Resource generation restricted strictly to Alter-Ego form.               | Alter-Ego only |
| `'INTERRUPT'`           | Voluntary Reaction  | Optional reaction interrupting an event before resolution.               | Any            |
| `'FORCED_INTERRUPT'`    | Mandatory Reaction  | Mandatory reaction interrupting an event before resolution.              | Any            |
| `'HERO_INTERRUPT'`      | Reaction            | Interrupt restricted to Hero form.                                       | Hero only      |
| `'ALTER_EGO_INTERRUPT'` | Reaction            | Interrupt restricted to Alter-Ego form.                                  | Alter-Ego only |
| `'RESPONSE'`            | Voluntary Reaction  | Optional reaction occurring immediately after event resolution.          | Any            |
| `'FORCED_RESPONSE'`     | Mandatory Reaction  | Mandatory reaction occurring immediately after event resolution.         | Any            |
| `'HERO_RESPONSE'`       | Reaction            | Response restricted to Hero form.                                        | Hero only      |
| `'ALTER_EGO_RESPONSE'`  | Reaction            | Response restricted to Alter-Ego form.                                   | Alter-Ego only |
| `'WHEN_REVEALED'`       | Encounter Mandatory | Triggered when encounter card is revealed in Step 4 or spawned.          | Encounter      |
| `'CONSTANT'`            | Static / Aura       | Continuous passive modifier while card remains face-up in play.          | Any            |
| `'SPECIAL'`             | Composite Trigger   | Triggered specifically by a parent event (e.g. _Wakanda Forever!_).      | Any            |
| `'SETUP'`               | Scenario Setup      | Executed during Step 4/8 of game setup (e.g. _T'Challa_ upgrade search). | Setup Phase    |
| `'BOOST'`               | Boost Resolution    | Triggered when card is flipped as a Villain or Minion boost card.        | Step 2/3 Boost |

---

## 2. Event Trigger Windows (`trigger`)

When an ability is an Interrupt or Response, `trigger` binds it to an engine dispatch signal:

| `trigger` Enum Literal     | Description                                                                                                                                            | Source Pipeline                                      |
| :------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------- |
| `'WHEN_REVEALED'`          | Card is being revealed from encounter deck or dealt cards.                                                                                             | `step4_revealEncounterCards`                         |
| `'BOOST'`                  | Encounter card is turned faceup as a boost card during attack or scheme activation.                                                                     | `villain-phase.ts`                                   |
| `'BOOST_STAR_RESOLVED'`     | Boost ability containing a star icon resolves during villain or minion activation.                                                                     | `combat-pipeline.ts` / `villain-phase.ts`            |
| `'ATTACK'`                 | Target character is declared as the recipient of an attack.                                                                                            | `executeVillainAttackAgainstPlayer`                  |
| `'MINION_ATTACKED'`        | Minion completes an attack activation against a player.                                                                                                | `executeMinionAttackAgainstPlayer`                   |
| `'ENEMY_INITIATES_ATTACK'` | Enemy initiates attack sequence (Spider-Sense window).                                                                                                 | `combat-pipeline.ts`                                 |
| `'ATTACK_DEFENDED'`        | Player or ally declares defense against an incoming attack.                                                                                            | `combat-pipeline.ts`                                 |
| `'ATTACK_RESOLVED'`        | Attack activation completes resolution against target.                                                                                                 | `combat-pipeline.ts`                                 |
| `'BASIC_ATTACK_PERFORMED'` | Hero or ally executes a basic attack action.                                                                                                           | `action-dispatcher.ts`                               |
| `'THWART_RESOLVED'`        | Basic or event thwart action completes threat removal on a scheme.                                                                                     | `action-dispatcher.ts`                               |
| `'DAMAGE_WOULD_BE_TAKEN'`  | Character is about to suffer damage (Backflip window).                                                                                                 | `combat-pipeline.ts`                                 |
| `'DAMAGE_TAKEN'`           | Character suffers damage from any source.                                                                                                              | `effects/index.ts`                                   |
| `'CARD_PLAYED'`            | Card enters play from hand or zone.                                                                                                                    | `action-dispatcher.ts`                               |
| `'ENTERS_PLAY'`            | Card enters play from any zone (e.g. ally, attachment, or upgrade enters play).                                                                        | `action-dispatcher.ts` / `effects/index.ts`          |
| `'MINION_ENTERS_PLAY'`     | Minion enters play and engages a player (e.g. Hawkeye `01066` response).                                                                               | `effects/index.ts` / `combat-pipeline.ts`            |
| `'TREACHERY_REVEALED'`     | Treachery encounter card is revealed during encounter reveal step.                                                                                     | `step4_revealEncounterCards`                         |
| `'CHARACTER_DEFEATED'`     | Any character (minion, ally, hero) is reduced to 0 HP and defeated.                                                                                    | `combat-pipeline.ts` / `effects/index.ts`            |
| `'SCHEME_DEFEATED'`        | Scheme (main or side) is cleared of threat and defeated.                                                                                               | `action-dispatcher.ts`                               |
| `'ATTACHED_ENEMY_ATTACKS'` | Enemy hosting this attachment initiates attack (Webbed Up window).                                                                                     | `villain-phase.ts`                                   |
| `'THREAT_WOULD_BE_PLACED'` | Threat is about to be placed on a scheme (Great Responsibility window).                                                                                | `villain-phase.ts`                                   |
| `'THREAT_PLACED'`          | Threat is placed on a scheme after all modifications and interrupts.                                                                                   | `effects/index.ts` / `villain-phase.ts`              |
| `'MAIN_SCHEME_ADVANCED'`   | Main scheme reaches target threat and advances stage.                                                                                                  | `scenario-helpers.ts`                                |
| `'RESOURCE_SPENT'`         | Player spends a card or resource during cost payment window.                                                                                           | `cost-engine.ts`                                     |
| `'FORM_CHANGED'`           | Player flips identity form (hero or alter-ego).                                                                                                        | `action-dispatcher.ts`                               |
| `'STATUS_REMOVED'`         | Status card (Stunned, Confused, Tough) is discarded.                                                                                                   | `effects/index.ts`                                   |
| `'ROUND_BEGAN'`            | Round counter increments, starting player phase.                                                                                                       | `round-upkeep.ts`                                    |
| `'ROUND_ENDED'`            | Round ends in Step 6b after Step 5 First Player token pass.                                                                                            | `round-upkeep.ts` (`step6_endVillainPhaseAndRound`)  |
| `'PLAYER_PHASE_BEGAN'`     | Player phase begins and basic form change limit resets.                                                                                                | `player-phase.ts`                                    |
| `'PLAYER_PHASE_ENDED'`     | All players have ended their turns.                                                                                                                    | `player-phase.ts`                                    |
| `'VILLAIN_PHASE_BEGAN'`    | Villain phase begins (Step 1 place threat).                                                                                                            | `villain-phase.ts`                                   |
| `'VILLAIN_PHASE_ENDED'`    | Villain phase completes (Step 6b after Step 5 token pass).                                                                                             | `round-upkeep.ts` (`step6_endVillainPhaseAndRound`)  |
| `'PHASE_START'`            | A new game phase begins.                                                                                                                               | `pipeline.ts`                             |
| `'DEFEATED'`               | Side/Player Side Scheme reduced to 0 threat - resolves 'When Defeated' rewards declared on the scheme card (e.g. _Highway Robbery_ `01166`, ADR-0034). | `action-dispatcher.ts` (`BASIC_THWART`)   |

---

## 3. Event Trigger Filters (`TriggerFilter`)

When an ability defines `triggerFilter`, the trigger matcher (`matchesTriggerFilter` in `src/engine/triggers/trigger-dispatcher.ts`) evaluates the triggering event context against these declarative criteria before allowing the ability to trigger or queue prompts.

```json
"triggerFilter": {
  "attackerKind": "VILLAIN",
  "targetPlayerScope": "SELF"
}
```

### Active Field Specifications

| Field                | Type                                                    | Description                                                                                                    | Evaluated In Engine? |
| :------------------- | :------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------- | :------------------- |
| `attackerKind`       | `'VILLAIN' \| 'MINION' \| 'ANY_ENEMY'`                  | Filters by enemy category initiating the attack or activation (e.g. Spider-Sense `01001a` triggers on villain). | ✅ Yes               |
| `attackerCardFilter` | `UniversalCardFilter`                                   | Evaluates criteria matching the attacker card instance.                                                       | ✅ Yes               |
| `sourceCardCode`     | `string`                                                | Scopes the trigger to a specific printed card code (e.g. Hulk `01050`).                                        | ✅ Yes               |
| `sourceInstanceId`   | `string`                                                | Scopes the trigger to a specific runtime card instance identity (ADR-0050).                                    | ✅ Yes               |
| `targetPlayerScope`  | `'SELF' \| 'OTHER' \| 'ANY'`                            | Constrains whether the attacked/affected player is the card controller (`SELF`), another player, or any.       | ✅ Yes               |
| `targetForm`         | `'HERO' \| 'ALTER_EGO'`                                 | Restricts trigger resolution based on the target identity's form.                                              | ✅ Yes               |
| `targetType`         | `'VILLAIN' \| 'MINION' \| 'SCHEME' \| 'CHARACTER'`      | Matches the entity classification being targeted or affected.                                                 | ✅ Yes               |
| `isEngaged`          | `boolean`                                               | Matches whether the target/source enemy is engaged with the triggering player.                                 | ✅ Yes               |

### Purged Speculative Orphan Fields (ADR-0069)

Per [ADR-0069](../../decisions/0069-card-editor-field-binding-completeness-and-trigger-filter-orphan-purge.md), five speculative fields were discovered to have 0 engine evaluation logic and 0 occurrences in supplemental data packs:
- `damageSourceType`
- `damageTargetType`
- `defeatEntityType`
- `defeatByAttack`
- `formChangeDirection`

These 5 fields have been **permanently purged** from `TriggerFilterSchema` and removed from the Card Editor UI. Because `TriggerFilterSchema` enforces `.strict()`, any attempt to declare these properties in supplemental data packs will be rejected at compile and test time.
