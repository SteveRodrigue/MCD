# 07. Villain Extra Activations, Nemesis & Attachments

---

## 1. Villain Extra Activations

### `VILLAIN_SCHEMES`
* **Status:** 🟢 `IMPLEMENTED (v1.0)` (*Advance* `01186`)
* **Description:** Forces the active villain to immediately execute a scheme activation against the player, drawing boost cards and placing threat.

```json
{
  "effect": "VILLAIN_SCHEMES",
  "params": {}
}
```

---

### `VILLAIN_ATTACKS`
* **Status:** 🟢 `IMPLEMENTED (v1.0)` (*Assault* `01187`)
* **Description:** In Hero form, causes villain to attack player; in Alter-Ego form, card gains Surge.

```json
{
  "effect": "VILLAIN_ATTACKS",
  "params": {
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

### `SPAWN_NEMESIS`
* **Status:** 🟢 `IMPLEMENTED (v1.0)` ([`effects/index.ts:L792`](file:///c:/Users/steve/OneDrive/Documents/Coding/MCD/src/engine/effects/index.ts#L792) / *Shadow of the Past* `01190`)
* **Description:**
  1. Identifies the resolving hero's canonical nemesis set code (`heroSetCode_nemesis`).
  2. Extracts all matching cards from `player.setAsideCards`.
  3. Puts all nemesis minions into play engaged with the hero (triggering Quickstrike/Toughness).
  4. Puts the nemesis side scheme into play with scaled base threat.
  5. Shuffles remaining nemesis cards into `state.encounterDeck`.
  6. If no nemesis minion is in set-aside pool, gains Surge.

```json
{
  "effect": "SPAWN_NEMESIS",
  "params": {}
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
  "params": {
    "target": "VILLAIN",
    "intercept": "ATTACK",
    "onIntercept": "DISCARD_AND_STUN"
  }
}
```
