# 02. Ability Timings & Event Triggers

> [!NOTE]
> **Status:** 🟢 `IMPLEMENTED (v1.0)`  
> Validated via [`TimingTypeSchema`](../../../src/data/supplemental/schema.ts#L25) and [`TriggerTypeSchema`](../../../src/data/supplemental/schema.ts#L48).

---

## 1. Ability Timing Types (`timing`)

The `timing` field specifies when an ability can be initiated or how it intercepts engine execution:

| `timing` Enum Literal   | Engine Category     | Description                                                                                                                                                                                                             | Form Gating    |
| :---------------------- | :------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------- |
| `'ACTION'`              | Player Action       | Voluntary player action during their turn in Player Phase.                                                                                                                                                              | Either Form    |
| `'HERO_ACTION'`         | Player Action       | Action restricted strictly to Hero form.                                                                                                                                                                                | Hero only      |
| `'ALTER_EGO_ACTION'`    | Player Action       | Action restricted strictly to Alter-Ego form.                                                                                                                                                                           | Alter-Ego only |
| `'RESOURCE'`            | Resource Generation | Voluntary resource generation ability during payment window.                                                                                                                                                            | Either Form    |
| `'HERO_RESOURCE'`       | Resource Generation | Resource generation restricted strictly to Hero form.                                                                                                                                                                   | Hero only      |
| `'ALTER_EGO_RESOURCE'`  | Resource Generation | Resource generation restricted strictly to Alter-Ego form.                                                                                                                                                              | Alter-Ego only |
| `'INTERRUPT'`           | Voluntary Reaction  | Optional reaction interrupting an event before resolution.                                                                                                                                                              | Any            |
| `'FORCED_INTERRUPT'`    | Mandatory Reaction  | Mandatory reaction interrupting an event before resolution.                                                                                                                                                             | Any            |
| `'HERO_INTERRUPT'`      | Reaction            | Interrupt restricted to Hero form.                                                                                                                                                                                      | Hero only      |
| `'ALTER_EGO_INTERRUPT'` | Reaction            | Interrupt restricted to Alter-Ego form.                                                                                                                                                                                 | Alter-Ego only |
| `'RESPONSE'`            | Voluntary Reaction  | Optional reaction occurring immediately after event resolution.                                                                                                                                                         | Any            |
| `'FORCED_RESPONSE'`     | Mandatory Reaction  | Mandatory reaction occurring immediately after event resolution.                                                                                                                                                        | Any            |
| `'HERO_RESPONSE'`       | Reaction            | Response restricted to Hero form.                                                                                                                                                                                       | Hero only      |
| `'ALTER_EGO_RESPONSE'`  | Reaction            | Response restricted to Alter-Ego form.                                                                                                                                                                                  | Alter-Ego only |
| `'WHEN_REVEALED'`       | Encounter Mandatory | Triggered when encounter card is revealed in Step 4 or spawned.                                                                                                                                                         | Encounter      |
| `'CONSTANT'`            | Static / Aura       | Continuous passive modifier while card remains face-up in play.                                                                                                                                                         | Any            |
| `'SPECIAL'`             | Composite Trigger   | Triggered specifically by a parent event (e.g. _Wakanda Forever!_). Steps run in order; any sequence step that opens a decision prompt pauses subsequent steps (`pendingSequences`, #248) until the prompt is answered. | Any            |
| `'SETUP'`               | Scenario Setup      | Executed during Step 4/8 of game setup (e.g. _T'Challa_ upgrade search).                                                                                                                                                | Setup Phase    |
| `'BOOST'`               | Boost Resolution    | Triggered when card is flipped as a Villain or Minion boost card.                                                                                                                                                       | Step 2/3 Boost |

---

## 2. Event Trigger Windows (`trigger`)

When an ability is an Interrupt or Response, `trigger` binds it to an engine dispatch signal:

| `trigger` Enum Literal     | Description                                                                                                                                                                                                                                                   | Source Pipeline                                     |
| :------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :-------------------------------------------------- |
| `'WHEN_REVEALED'`          | Card is being revealed from encounter deck or dealt cards.                                                                                                                                                                                                    | `step4_revealEncounterCards`                        |
| `'BOOST'`                  | Encounter card is turned faceup as a boost card during attack or scheme activation.                                                                                                                                                                           | `villain-phase.ts`                                  |
| `'ATTACK'`                 | Target character is declared as the recipient of an attack.                                                                                                                                                                                                   | `executeVillainAttackAgainstPlayer`                 |
| `'MINION_ATTACKED'`        | Minion completes an attack activation against a player.                                                                                                                                                                                                       | `executeMinionAttackAgainstPlayer`                  |
| `'ENEMY_INITIATES_ATTACK'` | Enemy initiates attack sequence (Spider-Sense window).                                                                                                                                                                                                        | `combat-pipeline.ts`                                |
| `'ATTACK_DEFENDED'`        | A hero or ally defended an incoming attack (after damage, step 7). Context carries `defenderType` (`HERO`/`ALLY`) and `targetInstanceId` (the attacking enemy). Fires for tableau abilities and for `zone: 'HAND'` reactions (e.g. Counter-Punch `01077`).    | `combat-pipeline.ts`                                |
| `'ATTACK_RESOLVED'`        | Attack activation completes resolution against target.                                                                                                                                                                                                        | `combat-pipeline.ts`                                |
| `'BASIC_ATTACK_PERFORMED'` | Hero or ally executes a basic attack action.                                                                                                                                                                                                                  | `action-dispatcher.ts`                              |
| `'THWART_RESOLVED'`        | Basic or event thwart action completes threat removal on a scheme.                                                                                                                                                                                            | `action-dispatcher.ts`                              |
| `'DAMAGE_WOULD_BE_TAKEN'`  | Character is about to suffer damage (Backflip window).                                                                                                                                                                                                        | `combat-pipeline.ts`                                |
| `'DAMAGE_TAKEN'`           | Character suffers damage from any source.                                                                                                                                                                                                                     | `effects/index.ts`                                  |
| `'CARD_PLAYED'`            | Card enters play from hand or zone.                                                                                                                                                                                                                           | `action-dispatcher.ts`                              |
| `'ENTERS_PLAY'`            | Card enters play from any zone (e.g. ally, attachment, or upgrade enters play).                                                                                                                                                                               | `action-dispatcher.ts` / `effects/index.ts`         |
| `'MINION_ENTERS_PLAY'`     | Minion enters play and engages a player (e.g. Hawkeye `01066` response).                                                                                                                                                                                      | `effects/index.ts` / `combat-pipeline.ts`           |
| `'TREACHERY_REVEALED'`     | Treachery encounter card is revealed during encounter reveal step.                                                                                                                                                                                            | `step4_revealEncounterCards`                        |
| `'CHARACTER_DEFEATED'`     | Any character (minion, ally, hero) is reduced to 0 HP and defeated.                                                                                                                                                                                           | `combat-pipeline.ts` / `effects/index.ts`           |
| `'SCHEME_DEFEATED'`        | Scheme (main or side) is cleared of threat and defeated.                                                                                                                                                                                                      | `action-dispatcher.ts`                              |
| `'HOST_WOULD_ATTACK'`      | Host enemy would attack (Webbed Up replacement interrupt window).                                                                                                                                                                                             | `combat-pipeline.ts`                                |
| `'THREAT_WOULD_BE_PLACED'` | Threat is about to be placed on a scheme (Great Responsibility window). The context carries `threatSource` (the placement source). The placement waits for every prompt opened in its window; an accepted interrupt reads and changes the live amount (#266). | `villain-phase.ts`                                  |
| `'THREAT_PLACED'`          | Threat is placed on a scheme after all modifications and interrupts.                                                                                                                                                                                          | `effects/index.ts` / `villain-phase.ts`             |
| `'FORM_CHANGED'`           | Player flips identity form (hero or alter-ego).                                                                                                                                                                                                               | `action-dispatcher.ts`                              |
| `'STATUS_REMOVED'`         | Status card (Stunned, Confused, Tough) is discarded.                                                                                                                                                                                                          | `effects/index.ts`                                  |
| `'ROUND_BEGAN'`            | Round counter increments, starting player phase.                                                                                                                                                                                                              | `round-upkeep.ts`                                   |
| `'ROUND_ENDED'`            | Round ends in Step 6b after Step 5 First Player token pass.                                                                                                                                                                                                   | `round-upkeep.ts` (`step6_endVillainPhaseAndRound`) |
| `'PLAYER_PHASE_BEGAN'`     | Player phase begins and basic form change limit resets.                                                                                                                                                                                                       | `player-phase.ts`                                   |
| `'PLAYER_PHASE_ENDED'`     | All players have ended their turns.                                                                                                                                                                                                                           | `player-phase.ts`                                   |
| `'VILLAIN_PHASE_BEGAN'`    | Villain phase begins (Step 1 place threat).                                                                                                                                                                                                                   | `villain-phase.ts`                                  |
| `'VILLAIN_PHASE_ENDED'`    | Villain phase completes (Step 6b after Step 5 token pass).                                                                                                                                                                                                    | `round-upkeep.ts` (`step6_endVillainPhaseAndRound`) |
| `'DEFEATED'`               | Side/Player Side Scheme reduced to 0 threat - resolves 'When Defeated' rewards declared on the scheme card (e.g. _Highway Robbery_ `01166`, ADR-0034).                                                                                                        | `action-dispatcher.ts` (`BASIC_THWART`)             |

### Trigger context: event target vs. chosen target (#234, ADR-0077)

The event payload (`TriggerContext`) names the event's own target in `targetInstanceId` / `targetType` (the thwarted scheme, the defeated minion, the attacking enemy). When a trigger path runs an ability, it copies them into the effect context as **`eventTargetInstanceId` / `eventTargetType`**, never as the chosen target:

| Effect context field                         | Meaning                                                                                  | Read by                                                                                  |
| :------------------------------------------- | :--------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------- |
| `eventTargetInstanceId`, `eventTargetType`   | the target of the event that triggered the ability                                       | `TRIGGERING_MINION`, `TRIGGERING_ENEMY`, `TRIGGERING_SCHEME`, the `HOST` fallback        |
| `chosenTargetInstanceId`, `chosenTargetType` | the target the player chose (UI selection of a player action, or a target-prompt answer) | every `CHOSEN_*` selector, `PREVIOUS_TARGET`, `PREVIOUS_SELECTED_CARD`, dynamic formulas |

So "deal 1 damage to **an enemy**" after a thwart (Daredevil `01058`) lets the player choose (spec 03, Layer 3), and "stun **the attacked enemy**" (Superhuman Strength `01028`) uses `TRIGGERING_ENEMY`.

### Defeat context: `defeatSource` (#247, ADR-0078)

Every character defeat (villain, minion, ally, hero) is announced by one engine function, `dispatchDefeat` (`damage-pipeline.ts`). It dispatches `DEFEATED`, then `CHARACTER_DEFEATED`, with the same `TriggerContext`, which carries the defeat source:

```ts
defeatSource?: {
  kind: 'HERO' | 'ALLY' | 'ENEMY' | 'EFFECT';
  playerId?: string;   // the player whose hero, ally or effect dealt the damage
  instanceId?: string; // the ally, enemy or effect source card
  byAttack: boolean;   // the damage was dealt as part of an attack
}
```

The damage pipeline fills it from the `DamageRequest`: `sourceType` `HERO` gives `HERO`, `ALLY` gives `ALLY`, `VILLAIN` and `MINION` give `ENEMY`, `CARD_EFFECT`, `RETALIATE` and `OVERKILL` give `EFFECT`; `byAttack` is the request's `isAttack`. Ability damage (`DEAL_DAMAGE`) is `EFFECT` unless the ability is labelled `ATTACK` (see below), in which case it is `HERO` with `byAttack: true`. The `TriggerFilter` field `defeatedByAttackOf` reads it (section 3).

**Hand Responses to a defeat.** `dispatchDefeat` fires `DEFEATED` and `CHARACTER_DEFEATED` for one defeat, so the hand scan runs **once per defeat**, on the `DEFEATED` dispatch only (character defeats only, not scheme defeats). It matches hand abilities (`zone: "HAND"`) whose trigger is `DEFEATED` or `CHARACTER_DEFEATED`, offers **every** eligible card (copies included), player by player starting with the first player (RR v1.8 First Player). It is a Response: the event has already happened, so no window has to be closed. Each card's `triggerFilter` decides who qualifies (e.g. *Chase Them Down* `01052`: `targetType: "ENEMY"`, `defeatedByAttackOf: "YOUR_HERO"`).

### Ability labels: `CardAbility.labels` (#247, ADR-0078)

Cards print some abilities with a label in parentheses: "(attack)", "(thwart)", "(defense)" (RR v1.8 glossary L). A `CardAbility` declares them with `labels`:

```json
{ "id": "uppercut", "timing": "HERO_ACTION", "labels": ["ATTACK"], "steps": [ ... ] }
```

| Label     | Engine behaviour                                                                                                                                                                                                                                                                                                                                       |
| :-------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ATTACK`  | The ability is an attack made by the resolving player's identity. Its `DEAL_DAMAGE` steps send `isAttack: true` and `sourceType: 'HERO'` to the damage pipeline (so Retaliate, attack-only damage shields and `defeatSource: { kind: 'HERO', byAttack: true }` apply). It is **one attack** however many damage instances it has: after the ability has fully resolved, `ATTACK_RESOLVED` is dispatched once for the first enemy it damaged (`targetPlayerId`, `targetType`, `targetInstanceId`), as for a basic attack. A target chosen from a prompt stays part of the same attack. |
| `THWART`  | Declared for completeness. **Not yet read by the engine.**                                                                                                                                                                                                                                                                                              |
| `DEFENSE` | Declared for completeness. **Not yet read by the engine.**                                                                                                                                                                                                                                                                                              |

The 13 core cards that print "(attack)" are labelled: Swinging Web Kick `01005`, Photonic Blast `01013`, Energy Channel `01018`, Gamma Slam `01021`, Repulsor Blast `01031`, Supersonic Punch `01032`, Powered Gauntlets `01038`, Panther Claws `01047`, Vibranium Suit `01049`, Relentless Assault `01053`, Uppercut `01054`, Counter-Punch `01077`, Haymaker `01087`. `01049` damages through `TRANSFER_DAMAGE`, which also goes through the damage pipeline, so it is an attack like the others.

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

| Field                | Type                                                                                                     | Description                                                                                                                                                              | Evaluated In Engine? |
| :------------------- | :------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------- |
| `attackerKind`       | `'VILLAIN' \| 'MINION' \| 'ANY_ENEMY'`                                                                   | Filters by enemy category initiating the attack or activation (e.g. Spider-Sense `01001a` triggers on villain).                                                          | ✅ Yes               |
| `attackerCardFilter` | `UniversalCardFilter`                                                                                    | Evaluates criteria matching the attacker card instance.                                                                                                                  | ✅ Yes               |
| `sourceCardCode`     | `string`                                                                                                 | Scopes the trigger to a specific printed card code (e.g. Hulk `01050`).                                                                                                  | ✅ Yes               |
| `sourceInstanceId`   | `string`                                                                                                 | Scopes the trigger to a specific runtime card instance identity (ADR-0050).                                                                                              | ✅ Yes               |
| `targetPlayerScope`  | `'SELF' \| 'OTHER' \| 'ANY'`                                                                             | Constrains whether the attacked/affected player is the card controller (`SELF`), another player, or any.                                                                 | ✅ Yes               |
| `targetForm`         | `'HERO' \| 'ALTER_EGO'`                                                                                  | Restricts trigger resolution based on the target identity's form.                                                                                                        | ✅ Yes               |
| `targetType`         | `'VILLAIN' \| 'MINION' \| 'ENEMY' \| 'SCHEME' \| 'CHARACTER' \| 'ALLY'`                                         | Matches the entity classification being targeted or affected. `ENEMY` is the villain or a minion (RR v1.8 glossary E).                                                       | ✅ Yes               |
| `defeatedByAttackOf` | `'YOUR_HERO' \| 'THIS_CARD'`                                                                                        | On `DEFEATED` / `CHARACTER_DEFEATED`, reads `context.defeatSource`. `YOUR_HERO`: `kind` is `HERO`, `byAttack`, and `playerId` is the responding player (an ally's attack does not match, RR glossary Y; e.g. *Chase Them Down* `01052`). `THIS_CARD`: `byAttack` and `instanceId` is the ability's own card (e.g. *Tigra* `01051`). | ✅ Yes               |
| `isEngaged`          | `boolean`                                                                                                | Matches whether the target/source enemy is engaged with the triggering player.                                                                                           | ✅ Yes               |
| `defenderType`       | `'HERO' \| 'ALLY'`                                                                                       | Matches who defended on `ATTACK_DEFENDED`: `HERO` for "your hero defends" (pair with `targetPlayerScope: 'SELF'`), `ALLY` for an ally defender.                          | ✅ Yes               |
| `threatSource`       | `'VILLAIN_PHASE_STEP_1' \| 'VILLAIN_SCHEME' \| 'MINION_SCHEME' \| 'CARD_EFFECT' \| 'INCITE' \| 'HAZARD'` | Matches what placed the threat on `THREAT_WOULD_BE_PLACED`. Emergency `01085` uses `VILLAIN_SCHEME` ("when the villain schemes"). Absent from the context never matches. | ✅ Yes               |

### Purged Speculative Orphan Fields (ADR-0069)

Per [ADR-0069](../../decisions/0069-card-editor-field-binding-completeness-and-trigger-filter-orphan-purge.md), five speculative fields were discovered to have 0 engine evaluation logic and 0 occurrences in supplemental data packs:

- `damageSourceType`
- `damageTargetType`
- `defeatEntityType`
- `defeatByAttack`
- `formChangeDirection`

These 5 fields have been **permanently purged** from `TriggerFilterSchema` and removed from the Card Editor UI. Because `TriggerFilterSchema` enforces `.strict()`, any attempt to declare these properties in supplemental data packs will be rejected at compile and test time.

> **Removed in #276:** the triggers `BOOST_STAR_RESOLVED` (boost abilities use `BOOST`), `MAIN_SCHEME_ADVANCED` and `RESOURCE_SPENT` were never fired by the engine. Re-add them together with a dispatcher when a card needs them (for example _Kang_ `11001`, _Pym Particles_ `12006`).
