# 08. Villain Extra Activations, Nemesis & Attachments

---

## 1. Villain Extra Activations

### `VILLAIN_SCHEMES`

- **References:** _Advance_ `01186`
- **Description:** Forces the active villain to immediately execute a scheme activation against the player, drawing boost cards and placing threat.

```json
{
  "effect": "VILLAIN_SCHEMES",
  "effectParams": {}
}
```

---

### `VILLAIN_ATTACKS`

- **References:** _Assault_ `01187`
- **Description:** The villain currently in play (scenario-dependent, so no card code) attacks the resolving player, with boost cards. In Hero form it attacks.
- **Use it when** the printed text says "the villain attacks you". Use `ENEMY_ATTACKS` when a _specific_ enemy must attack.

```json
{
  "effect": "VILLAIN_ATTACKS",
  "effectParams": {}
}
```

No parameters. (The Surge of _Assault_ is its printed keyword.)

---

### `ENEMY_ATTACKS`

- **References:** [Issue #223](https://github.com/SteveRodrigue/MCD/issues/223), _Titania's Fury_ `01164`, _Whirlwind_ `01130`, _Masters of Mayhem_ `01133`
- **Description:** Initiates an attack from an enemy against a character: a specific enemy (`enemy`), secondary attacks against each other hero (`target: "ALL_OTHER_HEROES"`), or trait-filtered minions attacking their engaged heroes across all players (`filter` + `target: "ENGAGED_HERO"`). It runs the standard combat pipeline (Stun check, interrupts, defender declaration, boost cards).
- **Parameters:** `enemy` (card code or `SELF`), `filter` (optional UniversalCardFilter), and `target`: `SELF_HERO` (default), `SELF_IDENTITY`, `ALL_OTHER_HEROES`, or `ENGAGED_HERO`.
- **Result:** `value` records the number of attacks made (`attacksMadeCount`). When 0 attacks occurred (no matching minions, engaged players in alter-ego, or cancelled by Stun), `amountZero: true` is emitted so subsequent steps can gate with `IF_RESULT: { result: "AMOUNT_ZERO" }`. Single-enemy attacks set `success` and `mutatedState` to `true` only if the attack happened. Gate "if X did not attack" steps with `THEN`, `gateParams.step`, and `negate: true` or `IF_RESULT: "AMOUNT_ZERO"`.

_Titania's Fury_ `01164`: "Titania attacks your hero. If Titania did not attack, heal all damage from Titania and this card gains surge."

```json
{
  "steps": [
    {
      "id": "titania_attacks",
      "effect": "ENEMY_ATTACKS",
      "effectParams": { "enemy": "01162", "target": "SELF_HERO" }
    },
    {
      "id": "titania_heals",
      "effect": "HEAL_DAMAGE",
      "gate": "THEN",
      "gateParams": { "step": "titania_attacks", "negate": true },
      "effectParams": { "amount": "ALL", "target": "PREVIOUS_TARGET" }
    },
    {
      "id": "titania_surges",
      "effect": "SURGE",
      "gate": "THEN",
      "gateParams": { "step": "titania_attacks", "negate": true }
    }
  ]
}
```

`HEAL_DAMAGE` accepts `amount: "ALL"` (heal every damage). A step with no resolved target heals nothing; it never falls back to the player.

---

### `VILLAIN_AND_ENGAGED_MINIONS_ATTACK`

- **References:** _Gang-Up_ `01189`
- **Description:** In Hero form, causes villain and every minion engaged with player to attack in sequence; in Alter-Ego, card gains Surge.

---

## 2. Nemesis Spawning Pipeline

Nemesis spawning is a composable 4-step pipeline of canonical zone manipulation primitives (ADR-0029).

### Canonical Nemesis Pipeline (_Shadow of the Past_ `01190`)

1. **Step 1 (`PUT_INTO_PLAY`):** Transfers the player's set-aside nemesis minion into play engaged with the hero.
2. **Step 2 (`PUT_INTO_PLAY`):** Transfers the player's set-aside nemesis side scheme into play in the side schemes area.
3. **Step 3 (`SHUFFLE_INTO_DECK`):** Shuffles all remaining set-aside cards matching the player's nemesis set into the encounter deck.
4. **Step 4 (`SURGE`):** If Step 1 failed to put a nemesis minion into play (e.g. minion is already in play or defeated), the card surges via `gate: "THEN", gateParams: { "step": "step_1_spawn_nemesis_minion", "negate": true }`.

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
      "gate": "THEN",
      "gateParams": {
        "step": "step_1_spawn_nemesis_minion",
        "negate": true
      }
    }
  ]
}
```

---

## 3. Host Attachments

### `ATTACH_TO_HOST`

- **References:** _Webbed Up_ `01009`, _Spider-Tracer_ `01007`, _Inspired_ `01074`
- **Description:** Attaches an upgrade/attachment to a character host with interception hooks.

```json
{
  "effect": "ATTACH_TO_HOST",
  "effectParams": {
    "target": "VILLAIN"
  }
}
```

| Parameter    | Type             | Required | Default  | Description                                                                                                                                          |
| :----------- | :--------------- | :------- | :------- | :--------------------------------------------------------------------------------------------------------------------------------------------------- |
| `target`     | `TargetSelector` | No       | -        | Host the card attaches to (`VILLAIN`, `CHOSEN_ENEMY`, `CHOSEN_ALLY`, ...).                                                                           |
| `maxPerHost` | `number`         | No       | no limit | Maximum copies (same code or name) of this card on one host; hosts at the limit are not offered as a choice (e.g. _Inspired_ `01074`, one per ally). |

> **Timing of the attach ability (#259):** the card attaches when it is played from hand. The ability's `timing` (`ACTION`, `HERO_ACTION`, ...) only names the identity form the card needs to be played (`HERO_` needs Hero form). Once the card is in play it offers no action: `canInitiateAbility` refuses an ability with an `ATTACH_TO_HOST` step on a card already in play, so `USE_CARD_ABILITY` and the tableau buttons cannot attach it again.

> **Encounter attachments (`CardType.ATTACHMENT`):** "Attach to Rhino." is intrinsic to the card type. The engine attaches a revealed encounter attachment to the villain unconditionally (`villain-phase.ts`), so do **not** declare it as a `WHEN_REVEALED` ability: that would create a cancellable window that RR v1.8 does not grant (_Armored Rhino Suit_ `01098`, _Charge_ `01099`, _Enhanced Ivory Horn_ `01100`; Issue #175). Declare only the card's own abilities.

---

### `ATTACHMENT_DAMAGE_SHIELD`

- **References:** _Armored Rhino Suit_ `01098`, [`damage-pipeline.ts`](../../../src/engine/pipeline/damage-pipeline.ts)
- **Description:** Declares a damage shield on an attachment. The step itself does nothing when executed: the damage pipeline finds it on the host's attachments ("would be dealt" / "would be taken" windows), puts the absorbed damage on the attachment as damage tokens and discards the attachment once its damage reaches `maxAbsorb`.

```json
{
  "effect": "ATTACHMENT_DAMAGE_SHIELD",
  "effectParams": { "maxAbsorb": 5 }
}
```

| Parameter   | Type     | Required | Default | Description                                                                                                                      |
| :---------- | :------- | :------- | :------ | :------------------------------------------------------------------------------------------------------------------------------- |
| `maxAbsorb` | `number` | **Yes**  | -       | Damage the attachment absorbs before it is discarded. No default: a shield without it throws, and a data test checks every pack. |

---

## 4. Encounter Cancellation & Interrupts

### `CANCEL_WHEN_REVEALED`

- **References:** _Enhanced Spider-Sense_ `01004`
- **Description:** Interrupts and cancels the "When Revealed" effect of an encounter card revealed from the encounter deck (RR v1.8 p. 7, 16, 31). Treachery cards have their When Revealed effects cancelled and are discarded to the encounter discard pile with onomatopoeia `'CANCELLED!'`. Minions, attachments, and side schemes have their When Revealed effects suppressed, but still enter play normally.
- **Mechanics:** the effect marks the reveal in progress as cancelled (`activeEncounterContext.cancelled`); `resolveActiveEncounterCardAfterInterrupt` then skips every When Revealed step except those declared `cannotBeCanceled` (see below). The interrupt that holds this effect is on `ENCOUNTER_CARD_REVEALED` ("When a card is revealed from the encounter deck", any encounter card) or `TREACHERY_REVEALED` (treacheries only). Neither is the card's own `WHEN_REVEALED` ability.

```json
{
  "effect": "CANCEL_WHEN_REVEALED",
  "effectParams": {}
}
```

---

### `CANCEL_WHEN_REVEALED_AND_REVEAL_ANOTHER`

- **References:** _Black Widow_ `01075` (#255)
- **Description:** "Cancel the effects of that card and discard it. Then, reveal another card from the encounter deck." Same cancel as `CANCEL_WHEN_REVEALED`, plus `activeEncounterContext.discardCard`: a cancelled minion, side scheme, attachment, obligation or environment does **not** enter play and goes to the encounter discard pile; a treachery is discarded as usual. The replacement card is dealt to the revealing player and revealed after the cancelled card has resolved. Trigger it from `ENCOUNTER_CARD_REVEALED`: the interrupt window opens for every encounter card, whether or not the card prints a When Revealed ability.

```json
{
  "effect": "CANCEL_WHEN_REVEALED_AND_REVEAL_ANOTHER",
  "effectParams": {}
}
```

---

### Effects that cannot be canceled: `cannotBeCanceled`

- **References:** _Eternity_ `21054` (proof card, partial model, ambiguity report `mts_21054_eternity.md`); #255; card-level flag: #286
- **Rule (RR v1.8 Cancel, Villain, When Revealed):** an effect printed "This effect cannot be canceled" still resolves when the card's reveal is cancelled; When Revealed abilities on villain and main scheme cards, and the reveal of a villain, cannot be canceled at all.
- **Declaration:** a step-level boolean `cannotBeCanceled: true` (next to `gate`, `condition`). When the reveal is cancelled, `getResolvingRevealAbilities` keeps only the flagged steps of the card's When Revealed abilities.
- **One rule:** `canCancelEncounterReveal(cardInstance)` (`src/engine/pipeline/encounter-cancel.ts`) is false for villain and main scheme cards and for a card whose When Revealed steps are all flagged. A cancel ability that cannot cancel is **not offered** (no cost paid for nothing) and, if executed anyway, fails with an error.

```json
{
  "effect": "REMOVE_FROM_GAME",
  "cannotBeCanceled": true,
  "effectParams": {}
}
```

Not covered yet: a whole card that cannot be canceled (#286) and the global "Treacheries cannot be canceled" of _Dark Scepter_ `55036`.

---

### `SURGE` and the Surge keyword

- **References:** #218; [`pipeline/surge.ts`](../../../src/engine/pipeline/surge.ts), [`resolveActiveEncounterCardAfterInterrupt`](../../../src/engine/pipeline/villain-phase.ts)
- **Rule (RR v1.8 "Surge"):** Surge is equivalent to _When Revealed: deal yourself 1 facedown encounter card_. The player resolving the card is dealt the top card of the encounter deck (deck exhaustion applies: reshuffle and acceleration). The extra card is revealed only after the original card, including any pending choice, has fully resolved.
- **Printed Surge** is detected by the importer, not declared in supplemental data: a card prints the keyword when a whole sentence of a text line is `Surge` (`Surge.`, `Surge <i>(reminder)</i>`, `Surge .`, bare `Surge`). Text that only mentions the word ("this card gains surge.") does not (`hasPrintedKeyword`, `card-loader.ts`). Do **not** add a `SURGE` step to a card that prints the keyword: the engine already surges it.
- **Conditional surge** ("If ..., this card gains surge") is the `SURGE` effect (or `DISCARD` with `fallback: "SURGE"`), usually behind a gate (`THEN` with `negate: true`, `IF_RESULT` with `amountZero`, `IF_CARD_IN_PLAY`):

```json
{ "effect": "SURGE", "gate": "IF_CARD_IN_PLAY", "gateParams": { "cardId": "01167" } }
```

- **A cancel does not remove the keyword:** cancelling the "When Revealed" effects (`CANCEL_WHEN_REVEALED`, Enhanced Spider-Sense `01004`) cancels the printed text, not a standalone Surge keyword, which still deals the extra card (RR Cancel: only effects are cancelled; FAQ Spider-Man Noir: a keyword resolved on reveal like surge still resolves). "This card gains surge" written inside the When Revealed text is an effect and is cancelled with it. A card cancelled **and discarded** (`CANCEL_WHEN_REVEALED_AND_REVEAL_ANOTHER`, Black Widow `01075`) does not surge.
- **At most once per reveal:** the keyword and the effect share one helper that sets a flag on the active encounter context, so a card that prints Surge and also gains it by effect surges once.
- **Cancelled When Revealed:** Surge is a When Revealed ability, so cancelling the card's When Revealed effects (Enhanced Spider-Sense `01004`, Get Behind Me! `01078`) cancels the surge too.
- A conditional surge is the ordinary effect followed by a gated `SURGE` step; card-named composites are banned by ADR-0021.
