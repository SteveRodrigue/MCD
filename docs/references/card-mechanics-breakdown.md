# Card Mechanics Algorithmic Breakdown & Developer Reference Guide

**Purpose:**  
This document translates the natural language of Marvel Champions card text into precise, unambiguous, step-by-step algorithmic operations for the rules engine. It serves as the definitive reference for developers and rules designers when authoring or reviewing supplemental data (`src/data/supplemental/`).

---

## 1. Specification Template

For each card, mechanics are broken down using the following standard schema:

```markdown
### [Card Name] (`#{card_code}`) — [Type]
* **MarvelCDB Link:** [https://marvelcdb.com/card/{card_code}](https://marvelcdb.com/card/{card_code})
* **Official Printed Text:** `"<Printed card text>"`
* **Ability Timing & Trigger:** `<TIMING>` @ `<TRIGGER>`
* **Step-by-Step Resolution:**
  1. **[Step 1]** ...
  2. **[Step 2]** ...
* **Cost & State Changes:** ...
* **Edge Cases & Official Rulings (FAQ):** ...
```

---

## 2. Core Set Player Cards Breakdown

### Spider-Man (`#01001a`) — Hero Identity
* **MarvelCDB Link:** [https://marvelcdb.com/card/01001a](https://marvelcdb.com/card/01001a)
* **Official Printed Text:** *"Spider-Sense — **Interrupt**: When the villain initiates an attack against you, draw 1 card."*
* **Ability Timing & Trigger:** `INTERRUPT` @ `VILLAIN_INITIATES_ATTACK`
* **Step-by-Step Resolution:**
  1. **Trigger Window:** Fires immediately when the Villain targets this Hero for an attack (Step 2 of Villain Phase or via encounter cards like *Assault*).
  2. **Timing Precedence:** Resolves **BEFORE** defenders are declared, before boost cards are dealt, and before damage is calculated (RR v1.8 p. 12).
  3. **Effect Execution:** Draw 1 card from controller's deck into hand.
* **Edge Cases & Official Rulings:**
  * If a minion attacks Spider-Man, Spider-Sense does **NOT** trigger (only the Villain).
  * If the villain attacks another hero and Spider-Man defends, Spider-Sense does **NOT** trigger (Spider-Man was not the initiated target).

---

### Peter Parker (`#01001b`) — Alter-Ego Identity
* **MarvelCDB Link:** [https://marvelcdb.com/card/01001b](https://marvelcdb.com/card/01001b)
* **Official Printed Text:** *"Scientist — **Resource**: Generate a [mental] resource. (Limit once per round.)"*
* **Ability Timing & Trigger:** `RESOURCE` (Limit: `ONCE_PER_ROUND`)
* **Step-by-Step Resolution:**
  1. **Action Window:** Can be used while paying for a card, an ability cost, or during an open resource window while in Alter-Ego form.
  2. **Limit Check:** Verify `usedAbilitiesThisRound['01001b_scientist'] < 1`.
  3. **Effect Execution:** Generate $1$ [mental] resource to satisfy cost.
  4. **State Tracking:** Record ability usage for the round.

---

### Black Cat _(Felicia Hardy)_ (`#01002`) — Ally
* **MarvelCDB Link:** [https://marvelcdb.com/card/01002](https://marvelcdb.com/card/01002)
* **Official Printed Text:** *"**Forced Response**: After you play Black Cat, discard the top 2 cards of your deck. Add each card with a printed [mental] resource discarded this way to your hand."*
* **Ability Timing & Trigger:** `FORCED_RESPONSE` @ `CARD_PLAYED`
* **Step-by-Step Resolution:**
  1. **Trigger:** Controller plays Black Cat from hand and places her into play.
  2. **Step 1 (Inspect/Draw Top 2):** Look at the top 2 cards of controller's draw deck.
  3. **Step 2 (Filter):** Inspect the printed resource icons of each of the 2 cards.
  4. **Step 3 (Discard Non-Mental):** Move any card that does not have at least 1 printed [mental] resource to the discard pile.
  5. **Step 4 (Add Mental to Hand):** Place any card with a printed [mental] resource directly into controller's hand.
  6. **Passive Consequential:** Black Cat has `attackCost: 0` (takes 0 consequential damage when performing a basic attack).
* **Edge Cases & Official Rulings:**
  * **Wild Resources:** Wild resources count as matching [mental] if printed with wild or explicitly designated by card text.
  * **Empty Deck:** If only 1 card is left in deck, discard that 1 card, resolve mental filter, and immediately trigger deck reshuffle + 1 encounter card deal (RR v1.8 p. 11).

---

### Backflip (`#01003`) — Event (Defense)
* **MarvelCDB Link:** [https://marvelcdb.com/card/01003](https://marvelcdb.com/card/01003)
* **Official Printed Text:** *"**Interrupt** (defense): When you would take any amount of damage from an attack, prevent all of that damage."*
* **Ability Timing & Trigger:** `INTERRUPT` @ `TAKE_ATTACK_DAMAGE`
* **Step-by-Step Resolution:**
  1. **Trigger Window:** Fires during Step 4 of enemy attack resolution when attack damage has been calculated and is about to be dealt to this hero.
  2. **Cost:** Discard *Backflip* from hand to player discard pile.
  3. **Effect Execution:** Set final incoming damage to $0$.

---

### Web-Shooter (`#01008`) — Upgrade
* **MarvelCDB Link:** [https://marvelcdb.com/card/01008](https://marvelcdb.com/card/01008)
* **Official Printed Text:** *"Uses (3 web counters). **Hero Resource**: Exhaust Web-Shooter and remove 1 web counter from it → generate a [wild] resource."*
* **Ability Timing & Trigger:** `RESOURCE`
* **Step-by-Step Resolution:**
  1. **Setup on Enter:** Card enters play with `tokens.counters = 3`.
  2. **Cost Check:** Card must be unexhausted (`exhausted === false`) and have `tokens.counters >= 1`.
  3. **Activation:** Exhaust card, decrement `tokens.counters` by 1.
  4. **Effect:** Generate 1 [wild] resource.
  5. **Discard on Empty:** If `tokens.counters === 0`, immediately discard *Web-Shooter* to player discard pile.

---

### Emergency (`#01085`) — Event (Thwart)
* **MarvelCDB Link:** [https://marvelcdb.com/card/01085](https://marvelcdb.com/card/01085)
* **Official Printed Text:** *"**Interrupt** (thwart): When the villain schemes, reduce the amount of threat placed on the scheme by 1."*
* **Ability Timing & Trigger:** `INTERRUPT` @ `VILLAIN_SCHEMES`
* **Step-by-Step Resolution:**
  1. **Trigger Window:** When the **Villain** (not minions) executes a Scheme activation (Step 2 of Villain Phase or via encounter cards like *Advance*).
  2. **Player Prompt:** The controller is prompted: *"Play Emergency to reduce scheme threat by 1?"*
  3. **Decision - Accept:** Discard *Emergency* from hand, subtract 1 from total scheme threat before it is placed on the scheme.
  4. **Decision - Decline:** *Emergency* remains in hand; full scheme threat is placed.
* **Form Invariance:** Because *Emergency* has neutral `INTERRUPT` timing, it can be played while the controller is in **Hero form** or **Alter-Ego form**.

---

### Tenacity (`#01093`) — Upgrade
* **MarvelCDB Link:** [https://marvelcdb.com/card/01093](https://marvelcdb.com/card/01093)
* **Official Printed Text:** *"Attach to your hero. Max 1 per hero. **Hero Action**: Spend a [physical] resource and discard this card → ready your hero."*
* **Ability Timing & Trigger:** `HERO_ACTION`
* **Step-by-Step Resolution:**
  1. **Play Condition:** Must be played in Hero form (attaches to your hero).
  2. **In-Play Activation:** While in Hero form, spend 1 [physical] resource and discard *Tenacity*.
  3. **Effect Execution:** Set `hero.exhausted = false` (readies the hero).

---

### The Triskelion (`#01073`) — Support
* **MarvelCDB Link:** [https://marvelcdb.com/card/01073](https://marvelcdb.com/card/01073)
* **Official Printed Text:** *"Play only if your identity has the [[Avenger]] trait. Max 1 per player. You get +1 ally limit."*
* **Ability Timing & Trigger:** `CONSTANT` ➔ `ALLY_LIMIT_BONUS` (+1)
* **Step-by-Step Resolution:**
  1. **Play Requirement:** Controller must possess the `Avenger` trait.
  2. **Active State:** While in play, dynamically increases controller's ally limit from 3 to 4 (`getPlayerAllyLimit`).
  3. **Leaves Play:** When *The Triskelion* is discarded, ally limit reverts to 3. If controller controls 4 allies, they must immediately choose and discard 1 ally to satisfy board limit (RR v1.8 p. 3).

---

### Nick Fury (`#01084`) — Ally
* **MarvelCDB Link:** [https://marvelcdb.com/card/01084](https://marvelcdb.com/card/01084)
* **Official Printed Text:** *"**Forced Response**: After Nick Fury enters play, choose one: remove 2 threat from a scheme; or draw 3 cards; or deal 4 damage to an enemy. At the end of the round, if Nick Fury is still in play, discard him."*
* **Ability Timing & Trigger:**
  * Ability 1: `FORCED_RESPONSE` @ `CARD_PLAYED` ➔ `NICK_FURY_CHOICE`
  * Ability 2: `FORCED_RESPONSE` @ `ROUND_END` ➔ `DISCARD_SELF`
* **Step-by-Step Resolution:**
  1. **When Played:** Controller chooses 1 of 3 options:
     - Option A: Remove 2 threat from chosen scheme.
     - Option B: Draw 3 cards from player deck.
     - Option C: Deal 4 damage to chosen enemy.
  2. **Round End:** During Upkeep (Step 4 of Player Phase / Round reset), if Nick Fury is in play, automatically move him to discard pile.

---

## 3. Rhino Scenario & Encounter Cards Breakdown

### Rhino (Stage I & II) (`#01094`, `#01095`) — Villain
* **MarvelCDB Link:** [https://marvelcdb.com/card/01094](https://marvelcdb.com/card/01094)
* **Stage II When Revealed:** *"Search the encounter deck and discard pile for the Breakin' & Takin' side scheme and reveal it. Shuffle the encounter deck."*
* **Step-by-Step Resolution:**
  1. When Rhino Stage I is defeated, transition to Stage II.
  2. Search encounter deck and discard for side scheme `01107` (*Breakin' & Takin'*).
  3. Put `01107` into play and place starting threat ($2 + 1 \times \text{players}$).
  4. Shuffle the encounter deck.

---

### Armored Rhino Suit (`#01098`) — Attachment
* **MarvelCDB Link:** [https://marvelcdb.com/card/01098](https://marvelcdb.com/card/01098)
* **Official Printed Text:** *"Attach to Rhino. **Forced Interrupt**: When any amount of damage would be dealt to Rhino, place it here instead. Then, if there is at least 5 damage here, discard Armored Rhino Suit."*
* **Ability Timing & Trigger:** `FORCED_INTERRUPT` @ `TAKE_ATTACK_DAMAGE`
* **Step-by-Step Resolution:**
  1. When damage is dealt to Rhino, redirect damage onto *Armored Rhino Suit* tokens (`tokens.damage += amount`).
  2. Rhino takes $0$ damage.
  3. Check condition: If `tokens.damage >= 5`, discard *Armored Rhino Suit* to encounter discard.

---

### Charge (`#01099`) — Attachment
* **MarvelCDB Link:** [https://marvelcdb.com/card/01099](https://marvelcdb.com/card/01099)
* **Official Printed Text:** *"Attach to Rhino. [star] **Forced Interrupt**: When Rhino attacks, the attack gains overkill. At the end of this attack, discard Charge."*
* **Step-by-Step Resolution:**
  1. Attaches to Rhino (+3 ATK).
  2. When Rhino initiates an attack, set `attack.hasOverkill = true`.
  3. After the attack finishes resolving, move *Charge* to encounter discard.
