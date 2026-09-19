# 03. Ability Costs, Targeting & FilterSchema

> [!NOTE]
> **Status:** 🟢 `IMPLEMENTED (v1.0)`  
> Validated via [`AbilityCostSchema`](../../../src/data/supplemental/schema.ts#L154), [`TargetSelectorSchema`](../../../src/data/supplemental/schema.ts#L80), and [`FilterSchema`](../../../src/data/supplemental/schema.ts#L101).

---

## 1. Ability Costs (`AbilityCost`)

The optional `cost` object defines mandatory prerequisites that must be satisfied and paid before an ability can resolve:

```json
"cost": {
  "exhaustSelf": true,
  "resources": ["energy", "physical"],
  "damageHero": 1,
  "spendCounters": {
    "amount": 1,
    "counterType": "web",
    "target": "SELF"
  }
}
```

### Complete Field Matrix: `AbilityCost`

| Field           | Type                               | Example                                                 | Description                                                                                |
| :-------------- | :--------------------------------- | :------------------------------------------------------ | :----------------------------------------------------------------------------------------- |
| `exhaustSelf`   | `boolean`                          | `true`                                                  | Card must be currently ready and exhausts upon activation.                                 |
| `exhaustCard`   | `TargetSelector`                   | `"SELF_IDENTITY"`                                       | A specific target card must exhaust (e.g. exhaust your hero).                              |
| `discardSelf`   | `boolean`                          | `true`                                                  | Card instance is discarded to owner's discard pile as a cost.                              |
| `damageHero`    | `number`                           | `1`                                                     | Direct damage the hero identity must suffer as a cost (e.g. _War Machine_).                |
| `damageSelf`    | `number`                           | `1`                                                     | Direct damage the card instance itself must suffer as a cost.                              |
| `resources`     | `ResourceType[]`                   | `["energy", "mental"]`                                  | Specific printed resource types required (`'physical'`, `'energy'`, `'mental'`, `'wild'`). |
| `resourceCost`  | `number \| Record<string, number>` | `2` or `{"physical": 1}`                                | Generic untyped resource cost ($N$) or typed resource map. Evaluated in `cost-engine.ts`.  |
| `requirePrinted`| `boolean`                          | `true`                                                  | When true, resources paid must match printed icons on cards (RR v1.8 p. 15).                |
| `discardCard`   | `object`                           | `{"count": 1, "from": "HAND", "filter": { ... }}`       | Card(s) discarded from `"HAND"`, `"DECK"`, or `"PLAY"`. Supports `maxCount` and `filter`.  |
| `spendCounters` | `object`                           | `{"amount": 1, "counterType": "web", "target": "SELF"}` | Decrements counters from the card instance or player identity.                             |
| `heal`          | `object`                           | `{"amount": 1, "target": "SELF"}`                       | Damage must be healed as an atomic prerequisite cost (RR v1.8 p. 11, 16).                  |

---

## 2. Target Selectors (`TargetSelector`)

Defines which game entity is chosen or affected by the ability:

| Target Literal                  | Target Entity                                                                                                         | Multi-Hero Behavior                                     |
| :------------------------------ | :-------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------ |
| `'SELF'`                        | The host card instance executing the ability (in tableau), or the player identity if executed from an identity event. | Bound to card instance or player.                       |
| `'SELF_IDENTITY'`               | The player identity controlling the card.                                                                             | Resolves controlling player.                            |
| `'ACTIVE_PLAYER'`               | The player currently taking a turn in Player Phase.                                                                   | `state.players[state.activePlayerIndex]`                |
| `'ALL_PLAYERS'`                 | Every player currently in the game session.                                                                           | Iterates all players.                                   |
| `'ALL_HEROES'`                  | Every hero identity currently in play.                                                                                | Iterates all heroes.                                    |
| `'ALL_HEROES_AND_ALLIES'`       | All identities strictly in Hero form plus all allies across all players.                                              | Batch hero and ally target.                             |
| `'TRIGGERING_HERO'`             | Hero identity that initiated or suffered the trigger event.                                                           | Context hero reference.                                 |
| `'CHOSEN_PLAYER'`               | Prompt user to choose 1 player.                                                                                       | Decision prompt modal.                                  |
| `'VILLAIN'`                     | The active Villain stage (`getActiveVillain(state)`).                                                                 | Direct villain reference.                               |
| `'MAIN_SCHEME'`                 | The active Main Scheme stage (`getActiveMainScheme(state)`).                                                          | Direct main scheme reference.                           |
| `'CHOSEN_SCHEME'`               | Player chooses between Main Scheme and any Side Scheme.                                                               | Interactive selector.                                   |
| `'CHOSEN_SIDE_SCHEME'`          | Player chooses 1 side scheme currently in play.                                                                       | Interactive selector.                                   |
| `'ALL_SCHEMES'`                 | Main scheme plus all active side schemes in play.                                                                     | Batch scheme target.                                    |
| `'TRIGGERING_SCHEME'`           | Scheme that triggered the event.                                                                                      | Direct scheme reference.                                |
| `'CHOSEN_ENEMY'`                | Player chooses between the Villain and any Minion in play.                                                            | Interactive selector.                                   |
| `'ALL_ENEMIES'`                 | The active Villain and all minions across all player play areas.                                                      | Batch combat target.                                    |
| `'ENGAGED_ENEMIES'`             | The active Villain and each minion engaged specifically with the resolving player.                                    | Batch local target.                                     |
| `'ENGAGED_MINIONS'`             | All minions engaged specifically with the resolving player (excludes Villain).                                        | Player minion zone.                                     |
| `'CHOSEN_MINION'`               | Player chooses 1 minion card currently in play across any player.                                                     | Interactive selector.                                   |
| `'CHOSEN_ENGAGED_MINION'`       | Player chooses 1 minion engaged specifically with the resolving player.                                               | Interactive selector.                                   |
| `'ALL_MINIONS'`                 | All minions currently in play across all player play areas (excludes Villain).                                        | Batch minion target.                                    |
| `'CHOSEN_CONTROLLED_ALLY'`      | Player chooses 1 ally specifically under their control.                                                               | Controlled ally selector.                               |
| `'ALL_CONTROLLED_ALLIES'`       | All allies under the resolving player's control.                                                                      | Batch controlled ally target.                           |
| `'CHOSEN_CONTROLLED_CHARACTER'` | Player chooses 1 character (hero identity or controlled ally) under their control.                                    | Controlled character selector.                          |
| `'ALL_CONTROLLED_CHARACTERS'`   | Hero identity plus all controlled allies.                                                                             | Batch controlled character target.                      |
| `'CHOSEN_ALLY'`                 | Player chooses 1 ally card currently in play across the table.                                                        | Tablewide ally selector.                                |
| `'ALL_ALLIES'`                  | All allies in play across all players.                                                                                | Tablewide ally target.                                  |
| `'CHOSEN_FRIENDLY_CHARACTER'`   | Player chooses 1 hero identity or ally in play across any player.                                                     | Tablewide friendly selector.                            |
| `'ALL_FRIENDLY_CHARACTERS'`     | All hero identities and allies in play across all players.                                                            | Tablewide friendly target.                              |
| `'CHOSEN_CHARACTER'`            | Player chooses 1 character (friend or foe) in play.                                                                   | Universal character selector.                           |
| `'ALL_CHARACTERS'`              | All heroes, allies, villain, and minions in play.                                                                     | Universal character target.                             |
| `'PREVIOUS_TARGET'`             | Re-uses target from previous ability step or the triggering combat context.                                           | Step result or event entity.                            |
| `'PREVIOUS_SELECTED_CARD'`      | Re-uses card instance selected in immediate preceding search step.                                                    | Search result card.                                     |
| `'TRIGGERING_MINION'`           | The specific minion that triggered the event (e.g. minion entering play for Hawkeye `01066`).                         | Direct minion reference via `context.targetInstanceId`. |
| `'TRIGGERING_ENEMY'`            | The specific enemy that triggered the event.                                                                          | Direct enemy reference via `context.targetInstanceId`.  |

### Orthogonal Collective Target Scopes (Rules Authority & Form Invariants)

Per RR v1.8 p. 11 ("Damage"), p. 13 ("Identity"), p. 14 ("Indirect Damage"), p. 19 ("Player"), and p. 20 ("Status"):

| Target Selector               | Affects Heroes? | Affects Alter-Egos? |  Affects Allies?   | Canonical Meaning & Card Text Equivalent                                            |
| :---------------------------- | :-------------: | :-----------------: | :----------------: | :---------------------------------------------------------------------------------- |
| **`ALL_HEROES`**              |     ✅ Yes      |      ❌ **No**      |       ❌ No        | Identities strictly in **Hero** form (_"each hero"_, _"heroes"_).                   |
| **`ALL_PLAYERS`**             |     ✅ Yes      |     ✅ **Yes**      |       ❌ No        | Every player / identity regardless of form (_"each player"_, _"players"_).          |
| **`ALL_HEROES_AND_ALLIES`**   |     ✅ Yes      |      ❌ **No**      |       ✅ Yes       | Identities strictly in **Hero** form + all allies (_"heroes and allies"_).          |
| **`ALL_FRIENDLY_CHARACTERS`** |     ✅ Yes      |     ✅ **Yes**      |       ✅ Yes       | All player identities (any form) + all allies (_"characters you/players control"_). |
| **`ALL_ALLIES`**              |      ❌ No      |        ❌ No        |       ✅ Yes       | All allies in play (_"each ally"_, _"all allies"_).                                 |
| **`ALL_ENEMIES`**             |      ❌ No      |        ❌ No        |       ❌ No        | The villain + all minions in play (_"all enemies"_).                                |
| **`ALL_CHARACTERS`**          |     ✅ Yes      |     ✅ **Yes**      | ✅ Yes (+ Enemies) | Every character on the board (_"all characters"_).                                  |

#### Rules Evidence & Operational Invariants

1. **Zero Duplicate Invariant:** `ALL_IDENTITIES` is completely excluded from the schema. `ALL_PLAYERS` is the sole canonical selector for targeting every player at the table.
2. **Dual-Domain Execution for `ALL_PLAYERS` (RR v1.8 p. 11 & p. 20):**
   - For player-state effects (`DRAW`, `DISCARD`, `ALLY_LIMIT_BONUS`, `MODIFY_HAND_SIZE`): Operates on player hands, decks, or board counters.
   - For physical character effects (`DEAL_DAMAGE`, `HEAL_DAMAGE`, `ADD_STATUS`): Operates directly on each player's identity (in whichever form they currently are).
3. **Strict Form Gating on `HERO` and `ALL_HEROES`:**
   - Any ability targeting `HERO` or `ALL_HEROES` strictly filters `player.currentForm === 'hero'`. Alter-Egos are immune.
4. **Consistency in Collective Naming:**
   - All collective/plural selectors strictly carry the **`ALL_`** prefix (e.g. `ALL_HEROES_AND_ALLIES`).

---

## 3. The Orthogonal Target Taxonomy Model

Target selection in Marvel Champions Digital is modeled as an orthogonal product space between **Scope / Quantifier** and **Entity Type** ($\text{Scope} \times \text{Entity Type}$), standardizing all 36 canonical members of `TargetSelectorSchema` ([ADR-0058](../../decisions/0058-declarative-schema-taxonomy-and-primitive-consolidation.md), [ADR-0064](../../decisions/0064-canonical-target-scopes-and-interactive-distribution-modal.md)).

### 1. The Orthogonal Target Taxonomy Matrix

| Scope / Quantifier      | IDENTITY (Hero / Alter-Ego) | PLAYER (Participant) | ALLY                     | CHARACTER (Hero + Ally + Enemy)                                        | ENEMY (Villain + Minion) | MINION                                      | VILLAIN           | SCHEME (Main + Side)                               |
| :---------------------- | :-------------------------- | :------------------- | :----------------------- | :--------------------------------------------------------------------- | :----------------------- | :------------------------------------------ | :---------------- | :------------------------------------------------- |
| **SELF**                | `SELF_IDENTITY`             | `ACTIVE_PLAYER`      | `SELF` _(if ally)_       | `SELF` _(if host card)_                                                | —                        | —                                           | —                 | `SELF` _(if scheme)_                               |
| **CHOSEN (Controlled)** | —                           | —                    | `CHOSEN_CONTROLLED_ALLY` | `CHOSEN_CONTROLLED_CHARACTER`                                          | —                        | —                                           | —                 | —                                                  |
| **CHOSEN (Table-Wide)** | —                           | `CHOSEN_PLAYER`      | `CHOSEN_ALLY`            | `CHOSEN_FRIENDLY_CHARACTER` / `CHOSEN_CHARACTER`                       | `CHOSEN_ENEMY`           | `CHOSEN_MINION`                             | `VILLAIN`         | `CHOSEN_SCHEME` / `CHOSEN_SIDE_SCHEME`             |
| **ENGAGED**             | —                           | —                    | —                        | —                                                                      | `ENGAGED_ENEMIES`        | `CHOSEN_ENGAGED_MINION` / `ENGAGED_MINIONS` | —                 | —                                                  |
| **ALL (Controlled)**    | —                           | —                    | `ALL_CONTROLLED_ALLIES`  | `ALL_CONTROLLED_CHARACTERS`                                            | —                        | —                                           | —                 | —                                                  |
| **ALL (Table-Wide)**    | `ALL_HEROES`                | `ALL_PLAYERS`        | `ALL_ALLIES`             | `ALL_FRIENDLY_CHARACTERS` / `ALL_CHARACTERS` / `ALL_HEROES_AND_ALLIES` | `ALL_ENEMIES`            | `ALL_MINIONS`                               | `VILLAIN`         | `ALL_SCHEMES` / `ALL_SIDE_SCHEMES` / `MAIN_SCHEME` |
| **TRIGGERING**          | `TRIGGERING_HERO`           | —                    | —                        | —                                                                      | `TRIGGERING_ENEMY`       | `TRIGGERING_MINION`                         | —                 | `TRIGGERING_SCHEME`                                |
| **PREVIOUS**            | —                           | —                    | —                        | `PREVIOUS_TARGET`                                                      | `PREVIOUS_TARGET`        | `PREVIOUS_TARGET`                           | `PREVIOUS_TARGET` | `PREVIOUS_TARGET` / `PREVIOUS_SELECTED_CARD`       |

### 2. Entity Type Dimension Definitions

- **`IDENTITY`**: A player's physical hero or alter-ego persona (`PlayerState.currentForm`). Governed by form-gating rules (RR v1.8 p. 11, 13).
- **`PLAYER`**: The participant entity controlling decks, hands, and tableaus. Immune to form restrictions; affects player-state (hand size, draw, discard).
- **`ALLY`**: Ally card instances deployed into a player's board area (`player.allies`).
- **`CHARACTER`**: Universal union of Identities, Allies, Villains, and Minions (RR v1.8 p. 6).
- **`ENEMY`**: Villain + all engaged minions in play.
- **`MINION`**: Minions engaged with players (`player.engagedMinions`).
- **`VILLAIN`**: The primary scenario villain (`state.villain`).
- **`SCHEME`**: Main scheme (`state.mainScheme`) and side schemes (`state.sideSchemes`).

### 3. Scope & Quantifier Dimension Definitions

- **`SELF`**: The source card instance itself or its immediate controller identity.
- **`CHOSEN`**: Prompt-driven single entity selection (via `PendingDecisionPrompt` or explicit `targetInstanceId`).
- **`ALL`**: Tablewide iteration over every entity matching the type constraint.
- **`ENGAGED`**: Scoped strictly to the active/triggering player's engaged threat area.
- **`TRIGGERING`**: Context-bound entity that caused or suffered the triggering event.
- **`PREVIOUS`**: Pipeline-continuity passing the target from an immediately preceding ability step.

### 4. Resolution Domain & Invariant Mapping Contract

The headless engine grounds target evaluation to [`src/engine/effects/target-resolver.ts`](../../../src/engine/effects/target-resolver.ts):

- **Single-Source Resolution**: `resolveTargets(state, selector, context)` returns `ResolvedTarget[]` discriminated by entity kind (`character`, `scheme`, `player`, `card`).
- **Typed Extractors**: Primitives delegate to domain-specific extractors:
  - `resolveCharacterTargets`: Character entities (Heroes, Allies, Villain, Minions) for status, damage, healing.
  - `resolveSchemeTargets`: Scheme entities (Main Scheme, Side Schemes) for threat modification.
  - `resolvePlayerTargets`: Player participants for draw, hand discard, resource limits.
  - `resolveCardTargets`: Card instances for attachment, exhaustion, readiness.
- **Liveness & Spatial Conservation**: Only active entities in live zones are returned. Defeated minions, discarded allies, or cleared schemes in discard piles or the victory display are strictly excluded (RR v1.8 p. 28).

---

## 4. Universal Card Filter (`UniversalCardFilterSchema`)

Card filtering across searching, targeting, discarding, and dynamic counters is strictly unified under the **Universal Card Filter Architecture** (ADR-0046).

> [!IMPORTANT]
> **Authoritative Specification:**  
> For complete reference documentation, criteria breakdown (`traits`, `types`, `aspects`, `codes`, `cost`, `resourceIcons`), and boolean combinators (`all`, `any`, `none`), consult the dedicated specification:  
> 👉 [**04. Universal Card Filter Specification**](./04_universal_card_filter.md)
