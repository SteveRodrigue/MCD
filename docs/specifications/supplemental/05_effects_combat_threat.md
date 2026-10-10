# 05. Combat, Damage & Threat Effect Primitives

---

## 1. Combat & Damage Primitives

### `DEAL_DAMAGE`

- **References:** [`effects/index.ts:L43`](../../../src/engine/effects/index.ts#L43)
- **Description:** Deals flat or dynamically calculated damage to target enemy or character. Handles Tough status removal, overkill, and character defeat.
- **Always through the damage pipeline (#247, ADR-0078):** every target kind (chosen minion, villain, `ENGAGED_ENEMIES`, `ALL_ENEMIES`, `ALL_CHARACTERS`, the identity selectors, `ALL_HEROES`, `ALL_HEROES_AND_ALLIES`) builds its target list and calls `applyDamageToTarget` once per target. So Tough, damage shields ("would be dealt" / "would be taken"), defeat triggers, Overkill, excess damage and the hero-defeat loss are applied the same way for every target, and `isAttack` (from `effectParams.isAttack` or the context) decides Retaliate and attack-only shields. The step's "choose a player" prompt is unchanged.
- **Overkill:** when the step has Overkill (granted by `GRANT_ATTACK_KEYWORD` earlier in the same ability, or the printed Overkill keyword) and the target is a minion that is defeated, the damage beyond the minion's remaining hit points is dealt to the active villain through the pipeline (so the villain's Tough and shields apply).
- **Excess and defeat:** the pipeline result carries `excessDamage` and `targetDefeated`; a chosen-minion step with `condition: "EXCESS_DAMAGE_DEALT"` reads the first, `condition: "TARGET_DEFEATED"` the second.
- **Hero defeat:** a hero reduced to 0 hit points is eliminated (`eliminatePlayer`, ADR-0079), in the pipeline only. The remaining heroes keep playing; the game is lost when the last hero is eliminated.

```json
{
  "effect": "DEAL_DAMAGE",
  "effectParams": {
    "amount": 8,
    "target": "CHOSEN_ENEMY",
    "piercing": false,
    "ranged": false
  }
}
```

| Parameter       | Type                           | Required | Default          | Description                                                                                                                                                                           |
| :-------------- | :----------------------------- | :------- | :--------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `amount`        | `number \| DynamicValueSource` | Yes      | -                | Base damage value (flat integer or dynamic formula).                                                                                                                                  |
| `target`        | `TargetSelector`               | Yes      | `"CHOSEN_ENEMY"` | Target recipient.                                                                                                                                                                     |
| `targetPlayer`  | `'SELF' \| 'CHOSEN_PLAYER'`    | No       | `"SELF"`         | With `target: "ENGAGED_ENEMIES"`: whose engaged minions (plus the Villain) are hit. `CHOSEN_PLAYER` prompts in multiplayer and auto-resolves in solo (e.g. _Energy Daggers_ `01046`). |
| `piercing`      | `boolean`                      | No       | `false`          | Discards Tough status card before dealing damage.                                                                                                                                     |
| `ranged`        | `boolean`                      | No       | `false`          | Ignores Retaliate keywords on the target.                                                                                                                                             |
| `finisherBonus` | `number`                       | No       | -                | Bonus damage when ability resolves as final step in a sequence (e.g. _Wakanda Forever!_).                                                                                             |
| `dynamicBonus`  | `number \| DynamicValueSource` | No       | -                | Dynamic bonus damage added to amount (e.g. _Supersonic Punch_ `01032`).                                                                                                               |

- **`ALL_HEROES_AND_ALLIES` means "each" (#296):** `DEAL_DAMAGE` with this target deals the amount to every hero (alter-ego players are not heroes) and every ally. It never splits the amount; to assign an amount among them use `DISTRIBUTE_AMOUNT`.

---

### `DISTRIBUTE_AMOUNT`

- **Description:** Assigns a budget (damage, threat removal, heal, counters, exhaust) among the legal targets of `targetScope` (ADR-0064). Used by _Explosion_ `01111`.
- **Who assigns:** an encounter card that names no player leaves the choice to the first player (RR v1.8 First Player); any other source is assigned by the player who resolves it.
- **No prompt when there is nothing to choose:** no legal target ignores the budget; one legal target takes as much of the budget as it can; two or more queue a `DISTRIBUTE_POINTS` prompt.
- **Cap:** derived from `allocationDomain` (`DAMAGE`: a character takes at most its remaining hit points). There is no `capRule` parameter. The submitted assignment is validated: the total equals the budget (limited by the capacity of the legal targets), each target is legal and each portion is within its cap; otherwise it is rejected and the prompt stays.
- **Damage goes through the damage pipeline:** every portion is applied with `applyDamageToTarget` (Tough, shields, DAMAGE_TAKEN, defeat and its triggers), the source card being the defeat source.

```json
{
  "effect": "DISTRIBUTE_AMOUNT",
  "effectParams": {
    "allocationDomain": "DAMAGE",
    "budget": {
      "from": "CARD_ATTRIBUTE",
      "fromCard": { "zone": "IN_PLAY", "cardCode": "01109" },
      "attribute": "THREAT"
    },
    "targetScope": "ALL_HEROES_AND_ALLIES"
  }
}
```

| Parameter          | Type             | Required            | Default                   | Description                                 |
| :----------------- | :--------------- | :------------------ | :------------------------ | :------------------------------------------ |
| `allocationDomain` | `"DAMAGE"        | "THREAT_REMOVAL"    | "HEAL"                    | "COUNTERS"                                  | "EXHAUST"`       | No  | `"DAMAGE"` | What is distributed. |
| `budget`           | `number          | DynamicValueSource` | Yes                       | -                                           | Total to assign. |
| `targetScope`      | `TargetSelector` | No                  | `"ALL_HEROES_AND_ALLIES"` | Set of targets eligible for the assignment. |

---

### `CANNOT_TAKE_DAMAGE`

- **References:** [`damage-immunity.ts`](../../../src/engine/pipeline/damage-immunity.ts), [`damage-pipeline.ts`](../../../src/engine/pipeline/damage-pipeline.ts) (step 0), [`target-choice.ts`](../../../src/engine/effects/target-choice.ts), ADR-0078 addendum, #297
- **Description:** CONSTANT restriction on the host (`target: SELF`): the host cannot take damage. With `sourceCardType` and/or `sourceTrait`, only damage from a card of that type and trait is ignored; damage with no source card (a basic attack) never matches a filter. The damage pipeline checks it before step 1, so no Tough, shield or Retaliate is used and the host is not defeated by it. RR v1.8 Targets: such a character is not a valid target of an ability whose only effect is damage (`DEAL_DAMAGE`, `TRANSFER_DAMAGE`), so the target prompt does not offer it and a transfer to it fails. A board condition (Madame Hydra `01181`, Ultron `01136`) is not supported yet.

```json
{
  "effect": "CANNOT_TAKE_DAMAGE",
  "effectParams": { "target": "SELF", "sourceCardType": "UPGRADE", "sourceTrait": "Black Panther" }
}
```

| Parameter        | Type     | Required | Default | Description                                                     |
| :--------------- | :------- | :------- | :------ | :-------------------------------------------------------------- |
| `target`         | `"SELF"` | Yes      | -       | The host.                                                       |
| `sourceCardType` | `string` | No       | any     | Card type of the damage source (`UPGRADE`, `ALLY`, `EVENT`...). |
| `sourceTrait`    | `string` | No       | any     | Trait of the damage source card.                                |

Example: _Killmonger_ `01157`.

---

### `GRANT_ATTACK_KEYWORD`

- **References:** [`effects/index.ts`](../../../src/engine/effects/index.ts) (`context.grantedAttackKeywords`), #259
- **Description:** "This attack gains <keyword>." Records the keyword on the running ability's context, so the `DEAL_DAMAGE` steps after it in the same ability use it (today: `Overkill`). It lives on that context only: it ends with the ability and never reaches a card, a player or the game state, so the next attack, by any card, starts from printed keywords. It survives a prompt that pauses the ability. Put it **before** the damage step and gate it with an existing gate (e.g. `IF_RESOURCE_MATCH` for "if you paid for this card using a [physical] resource").

```json
{
  "effect": "GRANT_ATTACK_KEYWORD",
  "gate": "IF_RESOURCE_MATCH",
  "gateParams": { "resource": "physical", "count": 1 },
  "effectParams": { "keyword": "Overkill" }
}
```

| Parameter | Type     | Required | Default | Description                                   |
| :-------- | :------- | :------- | :------ | :-------------------------------------------- |
| `keyword` | `string` | Yes      | -       | Keyword the attack gains (e.g. `"Overkill"`). |

Example: _Relentless Assault_ `01053` (this step, then `DEAL_DAMAGE` 5 to `CHOSEN_MINION`).

---

### `GRANT_KEYWORD`

- **References:** [`effects/index.ts`](../../../src/engine/effects/index.ts), ADR-0054
- **Description:** Dynamically grants a keyword (such as Retaliate, Overkill, Piercing, Ranged) to a target character (identity, ally, minion). Under ADR-0054, parameterized keywords like Retaliate stack additively across multiple active instances and temporary grants.

```json
{
  "effect": "GRANT_KEYWORD",
  "effectParams": {
    "keyword": "Retaliate",
    "amount": 1,
    "duration": "PHASE",
    "target": "SELF"
  }
}
```

| Parameter  | Type                 | Required | Default   | Description                                                                                    |
| :--------- | :------------------- | :------- | :-------- | :--------------------------------------------------------------------------------------------- |
| `keyword`  | `string`             | Yes      | -         | The keyword name being granted (e.g. `"Retaliate"`, `"Overkill"`, `"Piercing"`).               |
| `amount`   | `number`             | No       | -         | Numeric magnitude for parameterized keywords (e.g. `1` for Retaliate 1). Stacked per ADR-0054. |
| `duration` | `"PHASE" \| "ROUND"` | No       | `"PHASE"` | Lifecycle window for temporary keyword grant.                                                  |
| `target`   | `TargetSelector`     | No       | `"SELF"`  | Target character receiving the keyword.                                                        |

---

### `TRANSFER_DAMAGE`

- **References:** [`effects/index.ts`](../../../src/engine/effects/index.ts)
- **Description:** Moves / transfers damage from one character (e.g. hero) to an enemy (Villain or engaged minion). Heals the source and deals the damage to the target through the damage pipeline like `DEAL_DAMAGE` (#247, ADR-0078): Tough, damage shields, defeat triggers and villain defeat apply, and in an ability labelled `ATTACK` it is an attack by the player's identity (Retaliate applies).

```json
{
  "effect": "TRANSFER_DAMAGE",
  "effectParams": {
    "amount": 1,
    "finisherBonus": 1
  }
}
```

| Parameter       | Type                           | Required | Default | Description                                                                                           |
| :-------------- | :----------------------------- | :------- | :------ | :---------------------------------------------------------------------------------------------------- |
| `amount`        | `number \| DynamicValueSource` | Yes      | `1`     | Base damage amount moved.                                                                             |
| `finisherBonus` | `number`                       | No       | -       | Bonus damage transferred when ability resolves as final step in a sequence (e.g. _Wakanda Forever!_). |
| `dynamicBonus`  | `number \| DynamicValueSource` | No       | -       | Dynamic bonus damage added to amount.                                                                 |

The destination is the chosen enemy of the ability and the source is the acting identity; there are no `from` / `to` parameters (removed in #232).

---

## 2. Threat & Scheme Primitives

### `REMOVE_THREAT`

- **References:** [`effects/index.ts:L120`](../../../src/engine/effects/index.ts#L120)
- **Description:** Removes threat from Main Scheme, Side Scheme, or chosen scheme. Enforces Crisis icon restrictions and Patrol: when the resolving player is engaged with a Patrol minion, the main scheme is never a target of a player card effect (same filter as Crisis, for every scheme selector including `ALL_SCHEMES`).
- **"From each scheme instead if you have Aerial"** (Mark V Helmet `01037`): there is no `aerialAllSchemes` parameter. Use two steps, `target: "CHOSEN_SCHEME"` gated `IF_PLAYER_HAS_TRAIT` with `gateParams: { trait: "Aerial", negate: true }` and `target: "ALL_SCHEMES"` gated `IF_PLAYER_HAS_TRAIT` with `gateParams: { trait: "Aerial" }` (see [10. Sequences & Modals](10_sequences_and_prompts.md#gating-patterns-then-if_result-and-if_player_has_trait)).

```json
{
  "effect": "REMOVE_THREAT",
  "effectParams": {
    "amount": 3,
    "target": "MAIN_SCHEME"
  }
}
```

| Parameter       | Type                           | Required | Default         | Description                                                                                                                                                                                  |
| :-------------- | :----------------------------- | :------- | :-------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `amount`        | `number \| DynamicValueSource` | Yes      | `1`             | Base threat amount removed.                                                                                                                                                                  |
| `target`        | `TargetSelector`               | No       | `"MAIN_SCHEME"` | Target scheme (`MAIN_SCHEME`, `CHOSEN_SCHEME`, `THIS_SIDE_SCHEME`).                                                                                                                          |
| `finisherBonus` | `number`                       | No       | -               | Bonus threat removed when ability resolves as final step in a sequence (e.g. _Wakanda Forever!_).                                                                                            |
| `dynamicBonus`  | `number \| DynamicValueSource` | No       | -               | Dynamic bonus threat added to amount.                                                                                                                                                        |
| `ignoresCrisis` | `boolean`                      | No       | `false`         | Removes threat from the Main Scheme even if a Crisis icon is in play.                                                                                                                        |
| `distinctFrom`  | `"PREVIOUS_TARGET"`            | No       | -               | With a chosen scheme: the scheme chosen by the previous step is excluded, so the player must pick a different one ("from a different scheme"). Also readable as a step-level `distinctFrom`. |

---

### `ADD_THREAT`

- **References:** [`effects/index.ts:L2880`](../../../src/engine/effects/index.ts#L2880)
- **Description:** Adds threat to the main scheme or a specific side scheme.

> [!NOTE]
> The engine supports targeting specific schemes by `cardCode` (e.g. `'01176'`), `targetInstanceId`, or `target` (`'MAIN_SCHEME'`, `'THIS_SIDE_SCHEME'`). Per RR v1.8 p. 29 ("Targeting"), if a targeted scheme is not in play, the effect logs `scheme.threat.target_missing` and gracefully fizzles without modifying the main scheme.

```json
{
  "effect": "ADD_THREAT",
  "effectParams": {
    "amount": 1,
    "cardCode": "01176"
  }
}
```

> **Conditional threat:** to place threat only in some situations (for example the undefended-attack boost of _Kree Manipulator_ `01178`), gate the step with `IF_UNDEFENDED_ATTACK` and `gateParams: { attackerKind: "VILLAIN" }`; `effectParams` has no `condition` key (see [10. Sequences & Modals](10_sequences_and_prompts.md)).

---

### `ADD_THREAT` (with `perPlayer: true`)

- **References:** [`effects/index.ts`](../../../src/engine/effects/index.ts)
- **Description:** Adds `amount` (or `amountPerPlayer`) × (number of players) threat when `perPlayer: true`. Supports targeting by `cardCode`, `target` (`THIS_SIDE_SCHEME`, `MAIN_SCHEME`, `SELF`), or defaulting to the source side scheme. Fizzles per RR v1.8 p. 29 if the targeted card is not in play.

```json
{
  "effect": "ADD_THREAT",
  "effectParams": {
    "amount": 1,
    "perPlayer": true,
    "target": "THIS_SIDE_SCHEME"
  }
}
```

---

### `PREVENT_DAMAGE` (Damage Interception & Prevention)

- **References:** [`effects/index.ts`](../../../src/engine/effects/index.ts)
- **Description:** Consumes / prevents incoming attack or effect damage within an `INTERRUPT` window (e.g. `DAMAGE_WOULD_BE_TAKEN`). Prevents `amount` or all incoming damage if `amount` is omitted. Decrements `remainingInterceptedValue` and `damageAmount`. Threat interception is deconflated under `PREVENT_THREAT` per [ADR-0063](../../decisions/0063-deconflate-damage-and-threat-interception-primitives.md).

```json
{
  "effect": "PREVENT_DAMAGE",
  "effectParams": {
    "amount": 3
  }
}
```

| Parameter | Type                                    | Required | Default | Description                                                                                 |
| :-------- | :-------------------------------------- | :------- | :------ | :------------------------------------------------------------------------------------------ |
| `amount`  | `number \| 'ALL' \| DynamicValueSource` | No       | `ALL`   | Amount of incoming damage to consume. If omitted or `'ALL'`, consumes all remaining damage. |

The protected character is always the one the interrupt is about (the damage in the window); there is no `target` parameter (removed in #232).

---

### `PREVENT_THREAT` (Threat Interception & Prevention)

- **References:** [`effects/index.ts`](../../../src/engine/effects/index.ts), [ADR-0063](../../decisions/0063-deconflate-damage-and-threat-interception-primitives.md)
- **Description:** Consumes / reduces impending threat that would be placed on a scheme within an `INTERRUPT` window (`THREAT_WOULD_BE_PLACED`). Prevents `amount` or all impending threat if `amount` is omitted. Decrements `remainingInterceptedValue` and `threatAmount`. Supports dynamic scalar binding (e.g. _Great Responsibility_ `01061`), turn limits (e.g. _Jennifer Walters_ `01019b`), and partial reduction (e.g. _Emergency_ `01085`).

```json
{
  "effect": "PREVENT_THREAT",
  "effectParams": {
    "amount": 1,
    "target": "MAIN_SCHEME"
  }
}
```

| Parameter | Type                                    | Required | Default         | Description                                                                                  |
| :-------- | :-------------------------------------- | :------- | :-------------- | :------------------------------------------------------------------------------------------- |
| `amount`  | `number \| 'ALL' \| DynamicValueSource` | No       | `ALL`           | Amount of impending threat to prevent. If omitted or `'ALL'`, prevents all impending threat. |
| `target`  | `TargetSelector`                        | No       | `"MAIN_SCHEME"` | Target scheme where threat would be placed.                                                  |

---

## 3. Dynamic Value Sources & Numeric Amount Resolution

The engine supports dynamic numeric resolution via `resolveNumericAmount` for parameters such as `amount` in `DEAL_DAMAGE`, `REMOVE_THREAT`, `HEAL_DAMAGE`, `PREVENT_DAMAGE`, `ADD_COUNTERS` and `MODIFY_STAT`. For an activated ability, the results of its cost are part of the formula context: `DISCARDED_CARDS` reads the cards discarded as the cost (_Legal Practice_ `01023`: one threat removed per card discarded) and `RESOURCES_SPENT` the resources paid (_Energy Channel_ `01018`: one counter per energy spent):

```json
{
  "effect": "DEAL_DAMAGE",
  "effectParams": {
    "amount": {
      "from": "INTERCEPTED_VALUE",
      "multiplier": 1,
      "offset": 0
    },
    "target": "SELF_IDENTITY"
  }
}
```

- **`from: "INTERCEPTED_VALUE"`**: Binds the scalar quantity captured from the trigger interception context (`threatAmount`, `damageAmount`, or `interceptedValue`).
- **`multiplier`**: Optional scalar multiplier (defaults to `1`).
- **`offset`**: Optional integer offset (e.g., `-1`, `+2`) to support modifier formulas (defaults to `0`).

---

### `EXECUTE_SPECIAL` (Special Ability Handler)

Delegates to a registered handler of `src/engine/specials/` (ADR-0038).

| Key             | Required | Meaning                                                                     |
| :-------------- | :------- | :-------------------------------------------------------------------------- |
| `specialId`     | yes      | Handler id, e.g. `WAKANDA_FOREVER`. A missing or unknown id fails the step. |
| `sequenceOrder` | no       | Instance ids in the order to resolve, skipping the ordering prompt.         |

## 4. Temporary Stat Modifier Auras (`MODIFY_STAT`)

- **References:** ADR-0062 / _Vision_ `01068` / _Lead from the Front_ `01070`
- **Description:** Pushes a typed `ActiveStatModifier` entry onto `CardInstance.activeStatModifiers` (ally-targeted) or `PlayerState.activeStatModifiers` (hero / all controlled characters). The modifier is aggregated at stat-calculation time by `getEffectiveAllyStats` and `getEffectiveHeroStats`, and is automatically expired at the relevant phase or round transition.

### Targets

| `target` value                | Effect                                                                                                                                            |
| :---------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------ |
| `"SELF"`                      | Applies to the triggering card instance (typically the ally that activated the ability).                                                          |
| `"ALL_CONTROLLED_CHARACTERS"` | With `atkBonus` / `thwBonus`: applies to the identity AND all allies of one player (the resolving player, or the one chosen with `targetPlayer`). |
| `"TRIGGERING_HERO"`           | Applies to the triggering player's hero identity.                                                                                                 |
| `"CHOSEN_ALLY"`               | Applies to a player-chosen ally (currently routes via `SELF` resolution).                                                                         |

### Parameters

| Parameter      | Type                                              | Required | Default    | Description                                                                                                                                                          |
| :------------- | :------------------------------------------------ | :------- | :--------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `stat`         | `"ATTACK" \| "THWART" \| "DEFENSE" \| "RECOVERY"` | Yes      | `"ATTACK"` | The stat to modify.                                                                                                                                                  |
| `amount`       | `number \| DynamicValueSource`                    | Yes      | `1`        | The additive bonus amount, flat or a formula (`CONSTANT` abilities re-evaluate it on every stat read, e.g. _Jessica Jones_ `01059`: `ENTITY_COUNT` of side schemes). |
| `duration`     | `"PHASE" \| "ROUND"`                              | Yes      | `"PHASE"`  | Expiry window per RR v1.8 timing boundaries.                                                                                                                         |
| `target`       | `TargetSelector`                                  | Yes      | `"SELF"`   | Who receives the modifier.                                                                                                                                           |
| `atkBonus`     | `number`                                          | No       | -          | Shorthand for `stat: "ATTACK"` when used with `ALL_CONTROLLED_CHARACTERS`.                                                                                           |
| `thwBonus`     | `number`                                          | No       | -          | Shorthand for `stat: "THWART"` when used with `ALL_CONTROLLED_CHARACTERS`.                                                                                           |
| `targetPlayer` | `"SELF" \| "CHOSEN_PLAYER"`                       | No       | `"SELF"`   | `CHOSEN_PLAYER` opens a "Choose a Player" prompt in multiplayer (the chosen player's characters get the bonus) and auto-resolves on the resolving player in solo.    |

### Expiry Pipeline

| Duration  | Expiry Trigger                                                                                                     |
| :-------- | :----------------------------------------------------------------------------------------------------------------- |
| `"PHASE"` | Cleared at the start of each new player phase (`player-phase.ts`) and at villain phase start (`villain-phase.ts`). |
| `"ROUND"` | Cleared at round upkeep (`round-upkeep.ts`).                                                                       |

### Example: Vision `01068` — PLAYER_CHOICE → MODIFY_STAT

```json
{
  "effect": "PLAYER_CHOICE",
  "effectParams": {
    "title": "Vision: Density Manipulation",
    "description": "Choose THW or ATK to boost by +2 until the end of the phase:",
    "options": [
      {
        "id": "boost_thw",
        "label": "+2 THW",
        "description": "Vision gets +2 THW until the end of the phase.",
        "effect": "MODIFY_STAT",
        "params": { "stat": "THWART", "amount": 2, "duration": "PHASE", "target": "SELF" }
      },
      {
        "id": "boost_atk",
        "label": "+2 ATK",
        "description": "Vision gets +2 ATK until the end of the phase.",
        "effect": "MODIFY_STAT",
        "params": { "stat": "ATTACK", "amount": 2, "duration": "PHASE", "target": "SELF" }
      }
    ]
  }
}
```

### Example: Lead from the Front `01070` — chosen player's characters

```json
{
  "effect": "MODIFY_STAT",
  "effectParams": {
    "target": "ALL_CONTROLLED_CHARACTERS",
    "targetPlayer": "CHOSEN_PLAYER",
    "atkBonus": 1,
    "thwBonus": 1,
    "duration": "PHASE"
  }
}
```
