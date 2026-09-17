# 08. Villain Extra Activations, Nemesis & Attachments

---

## 1. Villain Extra Activations

### `VILLAIN_SCHEMES`
* **Status:** 🟢 `IMPLEMENTED (v1.0)` (*Advance* `01186`)
* **Description:** Forces the active villain to immediately execute a scheme activation against the player, drawing boost cards and placing threat.

```json
{
  "effect": "VILLAIN_SCHEMES",
  "effectParams": {}
}
```

---

### `VILLAIN_ATTACKS`
* **Status:** 🟢 `IMPLEMENTED (v1.0)` (*Assault* `01187`)
* **Description:** In Hero form, causes villain to attack player; in Alter-Ego form, card gains Surge.

```json
{
  "effect": "VILLAIN_ATTACKS",
  "effectParams": {
    "alterEgoSurge": true
  }
}
```

---

### `VILLAIN_AND_ENGAGED_MINIONS_ATTACK`
* **Status:** 🟢 `IMPLEMENTED (v1.0)` (*Gang-Up* `01189`)
* **Description:** In Hero form, causes villain and every minion engaged with player to attack in sequence; in Alter-Ego, card gains Surge.

---

## 2. Nemesis Spawning Pipeline

Per ADR-0029, monolithic `SPAWN_NEMESIS` has been fully decomposed into a composable 4-step pipeline using canonical zone manipulation primitives.

### Canonical Nemesis Pipeline (*Shadow of the Past* `01190`)

1. **Step 1 (`PUT_INTO_PLAY`):** Transfers the player's set-aside nemesis minion into play engaged with the hero.
2. **Step 2 (`PUT_INTO_PLAY`):** Transfers the player's set-aside nemesis side scheme into play in the side schemes area.
3. **Step 3 (`SHUFFLE_INTO_DECK`):** Shuffles all remaining set-aside cards matching the player's nemesis set into the encounter deck.
4. **Step 4 (`SURGE`):** If Step 1 failed to put a nemesis minion into play (e.g. minion is already in play or defeated), the card surges via `gate: "IF_FAILED"`.

```json
{
  "steps": [
    {
      "id": "step_1_spawn_nemesis_minion",
      "effect": "PUT_INTO_PLAY",
      "effectParams": {
        "from": "SET_ASIDE",
        "to": "ENGAGED_WITH_PLAYER",
        "filter": {
          "types": ["minion"],
          "sets": ["PLAYER_NEMESIS"]
        }
      }
    },
    {
      "id": "step_2_spawn_nemesis_scheme",
      "effect": "PUT_INTO_PLAY",
      "effectParams": {
        "from": "SET_ASIDE",
        "to": "SIDE_SCHEMES",
        "filter": {
          "types": ["side_scheme"],
          "sets": ["PLAYER_NEMESIS"]
        }
      }
    },
    {
      "id": "step_3_shuffle_remaining_cards",
      "effect": "SHUFFLE_INTO_DECK",
      "effectParams": {
        "from": "SET_ASIDE",
        "toDeck": "ENCOUNTER_DECK",
        "filter": {
          "sets": ["PLAYER_NEMESIS"]
        }
      }
    },
    {
      "id": "step_4_fallback_surge",
      "effect": "SURGE",
      "gate": "IF_FAILED",
      "gateParams": {
        "targetStepId": "step_1_spawn_nemesis_minion"
      }
    }
  ]
}
```

---

## 3. Host Attachments

### `ATTACH_TO_HOST`
* **Status:** 🟢 `IMPLEMENTED (v1.0)` (*Webbed Up* `01009`, *Spider-Tracer* `01007`, *Inspired* `01074`)
* **Description:** Attaches an upgrade/attachment to a character host with interception hooks.

```json
{
  "effect": "ATTACH_TO_HOST",
  "effectParams": {
    "target": "VILLAIN",
    "intercept": "ATTACK",
    "onIntercept": "DISCARD_AND_STUN"
  }
}
```

---

## 4. Encounter Cancellation & Interrupts

### `CANCEL_WHEN_REVEALED`
* **Status:** 🟢 `IMPLEMENTED (v1.0)` (*Enhanced Spider-Sense* `01004`)
* **Description:** Interrupts and cancels the "When Revealed" effect of an encounter card revealed from the encounter deck (RR v1.8 p. 7, 16, 31). Treachery cards have their When Revealed effects cancelled and are discarded to the encounter discard pile with onomatopoeia `'CANCELLED!'`. Minions, attachments, and side schemes have their When Revealed effects suppressed, but still enter play normally.

```json
{
  "effect": "CANCEL_WHEN_REVEALED",
  "effectParams": {}
}
```

