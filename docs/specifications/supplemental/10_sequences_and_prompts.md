# 10. Action Sequencing & Interactive Prompts

---

## 1. Unified Action Step Sequencing (`steps: []`) & Conditional Gates

- **References:** ADR-0028, ADR-0030, ADR-0060 / _Split Personality_ `01025`, _Hard to Keep Down_ `01104`, _I'm Tough_ `01105`, _Photonic Blast_ `01013`, _Hulk_ `01050`, _Under Fire_ `01193`
- **Description:** Decomposes all card abilities into an ordered execution pipeline of discrete, reusable atomic `AbilityStep` primitives, with optional conditional gating (`gate: ...`), separated gate parameters (`gateParams: { ... }`), effect execution parameters (`effectParams: { ... }`), and contextual data-flow passing (`target: "PREVIOUS_TARGET"`).

### Parameter Separation (`gateParams` vs `effectParams`, ADR-0060)

Under **ADR-0060**, parameters configuring conditional step gates and parameters configuring effect execution are decoupled on every `AbilityStep`:
- `gateParams`: Key-value map configuring the conditional gate check (e.g. required kicker resource, card code check, status check).
- `effectParams`: Key-value map configuring the effect primitive execution (e.g. damage amount, target selector, draw count).
- Step-level `params` is obsolete and has been completely purged from `AbilityStepSchema`. All step parameters must reside in `effectParams` or `gateParams`. (Note: in interactive `PLAYER_CHOICE` prompts, individual option items in `options: []` use `params: { ... }` per `DecisionPromptOptionSchema`).

### Allowed `effectParams` Keys (Issue #230)

`AbilityStepSchema.effectParams` is a free-form record, so the schema itself accepts any key. The allowed keys per effect live in one table, `EFFECT_PARAM_KEYS` in `src/data/supplemental/effect-params.ts` (typed over `EffectType`, so a new effect without an entry fails typecheck).

- `tests/data/effect-params-keys.test.ts` walks every supplemental pack (including nested `PLAYER_CHOICE` option steps) and fails on a key that is not in the table for its effect, naming the card, effect, and key.
- The Card Editor registry (`effect-parameter-registry.ts`) exposes exactly the table's keys per effect; `tests/ui/effect-parameter-registry.test.ts` enforces equality.
- The decorative keys `ATTACHMENT_DAMAGE_SHIELD.mode` / `.target`, `TRANSFER_DAMAGE.from` / `.to`, and `target` on `PREVENT_DAMAGE`, `RETURN_TO_HAND`, `VILLAIN_ATTACKS` were removed in #232 (the engine never read them). `scaling`, `multiplier` and `maxBonus` were retired in #231: scaled amounts are dynamic formulas (`09_dynamic_formulas.md`).
- `tests/data/schema-member-coverage.test.ts` fails on any table key that nothing reads in `src/engine/` or `src/ui/` (#276; it replaced the report-only `effect-params-read-check.ts`).

### Conditional Gates:

- `"ALWAYS"` _(Default)_: Executes unconditionally per RR v1.8 p. 2 "Do as much as you can".
- `"THEN"` / `"IF_PREVIOUS_SUCCESS"`: Executes Step $N$ only if Step $N-1$ mutated the game state (RR v1.8 p. 24 "Then").
- `"IF_AMOUNT_ZERO"` / `"IF_ZERO_HEALED"`: Executes Step $N$ (e.g. `SURGE`) if Step $N-1$ caused 0 state mutation (e.g. at full health).
- `"IF_ALREADY_HAS_STATUS"`: Executes Step $N$ if the target already has the status card before applying (`gateParams: { status, target }`).
- `"IF_CARD_IN_PLAY"`: Executes Step $N$ if the specified card is in play (`gateParams: { cardCode }`).
- `"IF_CARD_NOT_IN_PLAY"`: Executes Step $N$ if the specified card is not in play (`gateParams: { cardCode }`).
- `"IF_ACTIVATION_DEALT_DAMAGE"` ([Issue #221](https://github.com/SteveRodrigue/MCD/issues/221), ADR-0019 addendum): true when the enemy activation being resolved dealt final damage greater than 0 to the character it hit (after DEF, Tough and prevention; RR v1.8 Boost, Tough, "This Activation"). It takes no `gateParams`. Closed (the step is skipped) everywhere except a **deferred boost** ability, and for scheme activations (villain and minion attacks only). A boost resolves in step 5, before damage (step 6), so the engine does not run a boost ability that contains a step with this gate at reveal time: it queues it in `AttackExecutionContext.deferredBoostAbilities` and resolves it at the end of `applyCalculatedAttackDamage`, with `activationDamage` set to the final damage and `damagedCharacter` set to the hero or ally that took it. That single call site covers the direct step 6 path and the damage-prevention prompt resume path. Pair it with the `DAMAGED_CHARACTER` target (the hero or ally that took the damage; nothing when that ally was defeated or the hero reached 0 HP, so the step does nothing). Example (_Sweeping Swoop_ `01168`): `{ "effect": "ADD_STATUS", "gate": "IF_ACTIVATION_DEALT_DAMAGE", "effectParams": { "status": "STUNNED", "target": "DAMAGED_CHARACTER" } }`.
- `"IF_FAILED"`: Executes Step $N$ if Step $N-1$ (or `gateParams.targetStepId`) could not resolve.
- `"IF_RESOURCE_MATCH"`: Evaluates whether resources spent during action payment (`context.resourcesSpent`) or discarded cards (`context.discardedCards`) match required criteria:
  - `resource`: Required resource type (`"energy" | "physical" | "mental" | "wild"`). Wild resources always count toward the match.
  - `count` (or `requiredCount`): Number of matching resources required (default: `1`).
  - `aspect` (or `reqAspect`): Required aspect if checking aspect resources.
  - `printedResource` (or `requirePrinted`): When `true`, inspects printed resources on discarded cards (e.g. Hulk `01050`) rather than generated payment resources.
  - `only` (or `requireOnly`): When `true`, requires 100% of spent resources to match the specified resource type.
- `"IF_CONDITION_MET"` ([ADR-0049](../../decisions/0049-composable-value-transformers-and-event-interception.md)): Executes Step $N$ only if the explicitly monitored condition (`condition` in Step $N-1$ or targeted by `targetStepId`) evaluated to `true`.
- `"IF_CONDITION_NOT_MET"`: the exact negation of `IF_CONDITION_MET` for the same `condition` / `gateParams`. Executes Step $N$ only if the condition did **not** hold. Use it for the "otherwise / instead" branch of a printed "if X ... instead" ability (see the comparison below).

> **Shared evaluator (Issue #122):** every gate is evaluated by `evaluateStepGate` in `src/engine/pipeline/step-gate-evaluator.ts`, used by both the effect pipeline (`shouldExecuteStep`) and the `CONSTANT` stat-calculator loop. State/player gates (`IF_FORM`, `IF_CARD_IN_PLAY`, `IF_CARD_NOT_IN_PLAY`, `IF_ALREADY_HAS_STATUS`, `IF_RESOURCE_MATCH`, `IF_CONDITION_MET` / `IF_CONDITION_NOT_MET` + `TARGET_TRAIT_MATCH`) therefore work on `CONSTANT` steps. Result-based gates (`THEN`, `IF_PREVIOUS_SUCCESS`, `IF_AMOUNT_ZERO`, `IF_ZERO_HEALED`, `IF_FAILED`) need a preceding step, so they never apply to `CONSTANT` steps.
> Gates on `CONSTANT` `ADD_TRAIT` steps are honored by the trait calculators too (e.g. *Cosmic Flight* `01017` uses `"gate": "IF_FORM", "gateParams": { "form": "hero" }`); state gates (other than `IF_FORM`) need the optional `state` argument and are skipped without it (Issue #154).

### Choosing between `IF_CONDITION_MET`, `IF_CONDITION_NOT_MET` and `IF_FAILED`

All three skip a step when their test is false, but they test different things.

| Gate | Tests | Printed wording | Typical shape |
| :-- | :-- | :-- | :-- |
| `IF_CONDITION_MET` | A **condition** holds: a state check (`TARGET_TRAIT_MATCH` with `gateParams.trait`) or a milestone reported by an earlier step (`SCHEME_EMPTY`, `TARGET_DEFEATED`, ...). | "Then, **if** you have the Aerial trait, ..." (adds an extra effect) | Step 1 runs always; step 2 is gated `IF_CONDITION_MET`. |
| `IF_CONDITION_NOT_MET` | The **same** condition does **not** hold. | "... **if** X, do A **instead**", "**otherwise**, ..." (replaces the normal effect) | Two steps carrying the **same** `condition` and `gateParams`: the normal one gated `IF_CONDITION_NOT_MET`, the upgraded one gated `IF_CONDITION_MET`. Exactly one runs. |
| `IF_FAILED` | The **previous step (or `targetStepId`) could not do anything** (`!success` or `!mutatedState`). | "If you **cannot** ..., ", "If no cards were discarded this way, ..." (fallback for a failed effect) | Step 1 is the attempt; step 2 is the fallback, gated `IF_FAILED`. |

Rule of thumb: ask what the printed text depends on. A fact about the board or the player (traits, form, a milestone) uses `IF_CONDITION_MET` or `IF_CONDITION_NOT_MET`. Whether the previous effect actually did something uses `IF_FAILED` (or `THEN` for the positive case). Do not use `IF_FAILED` to model an "instead" branch: "nothing was removed" also happens when the upgraded branch resolves with nothing to do, which would wrongly fire the fallback.

**Additive example, `IF_CONDITION_MET`: Crisis Interdiction `01012`** ("Remove 2 threat from a scheme. Then, if you have the Aerial trait, remove 2 threat from a different scheme."):

```json
"steps": [
  { "effect": "REMOVE_THREAT", "effectParams": { "amount": 2, "target": "CHOSEN_SCHEME" } },
  { "effect": "REMOVE_THREAT",
    "gate": "IF_CONDITION_MET",
    "condition": "TARGET_TRAIT_MATCH",
    "gateParams": { "trait": "Aerial" },
    "effectParams": { "amount": 2, "target": "CHOSEN_SCHEME", "distinctFrom": "PREVIOUS_TARGET" } }
]
```

**Exclusive example, `IF_CONDITION_NOT_MET` + `IF_CONDITION_MET`: Mark V Helmet `01037`** ("Remove 1 threat from a scheme (from each scheme instead if you have the Aerial trait)."). Without Aerial only the first step runs; with Aerial only the second one does:

```json
"steps": [
  { "id": "helmet_chosen_scheme", "effect": "REMOVE_THREAT",
    "gate": "IF_CONDITION_NOT_MET", "condition": "TARGET_TRAIT_MATCH", "gateParams": { "trait": "Aerial" },
    "effectParams": { "amount": 1, "target": "CHOSEN_SCHEME" } },
  { "id": "helmet_all_schemes", "effect": "REMOVE_THREAT",
    "gate": "IF_CONDITION_MET", "condition": "TARGET_TRAIT_MATCH", "gateParams": { "trait": "Aerial" },
    "effectParams": { "amount": 1, "target": "ALL_SCHEMES" } }
]
```

Writing it the Crisis Interdiction way (step 1 always, step 2 gated on Aerial) would be wrong here: an Aerial player would remove threat from the chosen scheme and then again from every scheme.

**Fallback example, `IF_FAILED`:** "Discard an upgrade or support you control. If no cards were discarded this way, this card gains surge." The discard is the attempt; the surge step is gated on that attempt having done nothing. The gate looks at the *result of an effect*, not at the board.

> **Chosen-target pre-selection:** before an ability runs, the dispatcher looks ahead for the first `CHOSEN_*` target to ask the player once. Steps whose gate is a state-only gate and is closed right now (`IF_FORM`, `IF_CARD_IN_PLAY`, `IF_CARD_NOT_IN_PLAY`, `IF_CONDITION_MET` / `IF_CONDITION_NOT_MET` with `TARGET_TRAIT_MATCH`) are ignored by that look-ahead (`isStepGateClosedByState`), so a closed branch never asks for a target. Result-based gates cannot be known in advance and are not skipped.

### Explicit Condition Contracts (`StepConditionSchema`)

Under **ADR-0049**, rather than relying on implicit side-effects, an ability step explicitly specifies what condition milestone it evaluates via `condition`:

| Category           | Condition Contract         | Evaluated Milestone                                                    | Context / Primitive                                        |
| :----------------- | :------------------------- | :--------------------------------------------------------------------- | :--------------------------------------------------------- |
| **Core Milestone** | `SCHEME_EMPTY`             | Targeted scheme has `remainingThreat === 0` after threat removal.      | `REMOVE_THREAT` (_Clear the Area_ `04049`)                 |
| **Core Milestone** | `TARGET_DEFEATED`          | Targeted enemy/character reached 0 HP from damage.                     | `DEAL_DAMAGE` (_Relentless Assault_ `01053`)               |
| **Core Milestone** | `FULLY_HEALED`             | Targeted character's damage reduced to 0 (`health === maxHealth`).     | `HEAL_DAMAGE` (_First Aid_ `01086`)                        |
| **Core Milestone** | `STATUS_APPLIED`           | Status was placed (target did not already possess it & wasn't immune). | `ADD_STATUS` (_Mockingbird_ `01083`)                       |
| **Core Milestone** | `EXCESS_DAMAGE_DEALT`      | Damage dealt exceeded remaining HP (Overkill damage).                  | `DEAL_DAMAGE` (_Hand Cannon_)                              |
| **Entity State**   | `ALREADY_HAS_STATUS`       | Target character already possessed status card prior to application.   | `ADD_STATUS` (_I'm Tough_ `01105`)                         |
| **Entity State**   | `TARGET_TRAIT_MATCH`       | Targeted entity possesses specified trait (e.g. `[[AERIAL]]`).         | Card filter                                                |
| **Combat Context** | `UNDEFENDED_ATTACK`        | The attack being resolved has no defender (no hero or ally declared). `gateParams.attackerKind` (`VILLAIN` / `MINION` / `ANY_ENEMY`) optionally restricts who is attacking. False outside an attack. | Boost resolution (_Kree Manipulator_ `01178`, _Electric Whip Attack_ `01173`) |
| **Threshold**      | `ZONE_EMPTY`               | `gateParams.zone` is empty: `SIDE_SCHEMES`, `ENCOUNTER_DECK`, `ENCOUNTER_DISCARD`, or the player zones `HAND`, `DECK`, `DISCARD` (of the player resolving the ability). State-only. | _Masterplan_ `01192` ("If there are no side schemes in play") |

> **Removed in #276 (no reader in the engine, a schema member needs a reader and a test):** `TARGET_ALREADY_EXHAUSTED`, `TARGET_FORM_MATCH` (use the gate `IF_FORM`), `RESOURCE_KICKER_MET` (the kicker is `effectParams.kickerResource`) and `COUNTER_THRESHOLD_MET`. Printed cards that would need an exhausted-result or a counter/hit-point threshold (_Earthquake_ `45143`, _Jolt_ `50133`, the three Chief Officers, Absorbing Man's locations `04080` to `04085`, _Giant-Man_ `12012`) wait for the generic comparison condition in [#278](https://github.com/SteveRodrigue/MCD/issues/278).

### Example: Undefended Attack Boost (_Kree Manipulator_ `01178`)

"[star] **Boost**: If the villain is making an undefended attack, place 1 threat on the main scheme." Whether an attack was defended is a fact about the attack in progress, not the result of an earlier step, so the step carries the condition itself and is gated on it. Boosts are resolved after the defender is declared, and the combat pipeline hands `attackerType` and `defenderType` (`HERO` / `ALLY` / `UNDEFENDED`) to the gate:

```json
{
  "effect": "ADD_THREAT",
  "gate": "IF_CONDITION_MET",
  "condition": "UNDEFENDED_ATTACK",
  "gateParams": { "attackerKind": "VILLAIN" },
  "effectParams": { "amount": 1, "target": "MAIN_SCHEME" }
}
```

Do not write `"condition": "UNDEFENDED_ATTACK"` inside `effectParams`: nothing reads it there and the step would run on every attack. Use `IF_CONDITION_NOT_MET` for the opposite ("if the attack is defended ...").

### Example: Resource Payment Kicker Pattern (_Photonic Blast_ `01013`)

```json
{
  "steps": [
    {
      "id": "photonic_blast_damage",
      "effect": "DEAL_DAMAGE",
      "effectParams": {
        "amount": 5,
        "target": "CHOSEN_ENEMY"
      }
    },
    {
      "id": "photonic_blast_draw",
      "effect": "DRAW",
      "gate": "IF_RESOURCE_MATCH",
      "gateParams": {
        "resource": "energy",
        "count": 1
      },
      "effectParams": {
        "count": 1,
        "target": "SELF_IDENTITY"
      }
    }
  ]
}
```

### Example: Clear the Area Pattern (_Clear the Area_ `04049`)

```json
{
  "steps": [
    {
      "id": "remove_threat_step",
      "effect": "REMOVE_THREAT",
      "condition": "SCHEME_EMPTY",
      "effectParams": {
        "target": "CHOSEN_SCHEME",
        "amount": 2
      }
    },
    {
      "id": "draw_if_cleared",
      "effect": "DRAW",
      "gate": "IF_CONDITION_MET",
      "gateParams": {
        "targetStepId": "remove_threat_step"
      },
      "effectParams": {
        "count": 1
      }
    }
  ]
}
```

### Example: Trait Matching Gate Pattern (_Crisis Interdiction_ `01012`)

```json
{
  "steps": [
    {
      "id": "crisis_interdiction_base",
      "effect": "REMOVE_THREAT",
      "effectParams": {
        "amount": 2,
        "target": "CHOSEN_SCHEME"
      }
    },
    {
      "id": "crisis_interdiction_aerial_bonus",
      "condition": "TARGET_TRAIT_MATCH",
      "gate": "IF_CONDITION_MET",
      "gateParams": {
        "trait": "Aerial"
      },
      "effectParams": {
        "amount": 2,
        "target": "CHOSEN_SCHEME"
      }
    }
  ]
}
```

### Per-player resolution: `CardAbility.forEachPlayer` (#220)

"Each player discards the top 5 cards of their deck. For each printed [energy] resource a player discards this way, that player takes 1 damage." Each player resolves the whole sentence pair for themselves, so the second step must read the first step's result **of that player**. `forEachPlayer: true` on the ability header makes the engine run the ability's whole step list once per player, in player order (the first player, then clockwise, RR v1.8 Player Order):

```json
{
  "id": "electromagnetic_backlash_when_revealed",
  "timing": "WHEN_REVEALED",
  "trigger": "WHEN_REVEALED",
  "forEachPlayer": true,
  "steps": [
    { "effect": "DISCARD", "effectParams": { "source": "DECK", "mode": "TOP", "count": 5 } },
    { "effect": "DEAL_DAMAGE",
      "effectParams": { "target": "SELF_IDENTITY",
        "amount": { "from": "DISCARDED_CARDS", "discardAttribute": "RESOURCE_ICONS", "resourceType": "energy" } } }
  ]
}
```

- **Default `false`.** An ability without the field runs once for the resolving player, as before. The field exists only on the ability, never on a step.
- **Resolving player.** In each pass `context.playerId` is that player, so `SELF_IDENTITY`, `SELF_HERO` and the deck `DISCARD` act on them. The previous pass's `previousResult` and `discardedCards` are not visible (scoped per player).
- **Prompts.** A step that opens a prompt pauses the pass like any sequence (#248). The players who have not resolved yet wait in a pending entry placed beneath the rest of that pass, so the order is: finish this player, then the next one.
- **Not covered:** an ability that mixes per-player steps with run-once steps ("each player puts a Drone, then place 1 threat for each Drone", _Drone Factory_ `01148`) is [#272](https://github.com/SteveRodrigue/MCD/issues/272). Use `target: "ALL_PLAYERS"` when no step needs the per-player result (_The Vulture's Plans_ `01169`).
- **Player deck discard.** A deck `DISCARD` that empties the deck mid-way resets the deck and stops there: no card is discarded from the new deck (RR v1.8 Player Deck).

---

## 2. Interactive Decision Prompts (`PLAYER_CHOICE`)

- **References:** [`DecisionPromptModal.tsx`](../../../src/ui/components/board/DecisionPromptModal.tsx) / _Nick Fury_ `01084` / _Hydra Bomber_ `01110` / _Exhaustion_ `01191` / _Vision_ `01068`
- **Description:** Renders a Pop-Art comic decision modal, blocking state execution until the player resolves their choice. When a `PLAYER_CHOICE` prompt originates from an in-play ally or tableau card, the `sourceCardInstanceId` field on `PendingDecisionPrompt` is forwarded into `executeEffect` so that `MODIFY_STAT` with `target: "SELF"` resolves correctly against the ability-triggering card instance.
- **Results of earlier steps:** the cards discarded by the steps that ran before the choice in the same ability are kept on the prompt (`PendingDecisionPrompt.discardedCards`) and handed back to the chosen option, so an option amount can read them with `{ "from": "DISCARDED_CARDS", "discardAttribute": "BOOST_ICONS", "offset": 1 }` (_Ritual Combat_ `01159`: "X is 1 more than the number of boost icons on the discarded encounter card").

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

> [!NOTE]
> **Option Parameters vs Step Parameters:**  
> The parent `PLAYER_CHOICE` step strictly uses `"effectParams": { "title": "...", "options": [...] }`. Within each option of `options: []`, parameters configuring that choice's effect are declared under `"params": { ... }` per `DecisionPromptOptionSchema`.

> [!NOTE]
> **Option `steps`, `gate` and `cost` (Issue #158, ADR-0075):** an option may carry its own `steps: [...]` (run instead of the single `effect`/`params`), an availability `gate` + `gateParams` (evaluated by the shared step-gate evaluator, e.g. `"gate": "IF_FORM", "gateParams": { "form": "alter_ego" }`) and a `cost` (an `AbilityCost`, e.g. `{ "exhaustCard": "SELF_IDENTITY" }`). Availability is **re-evaluated whenever the prompt becomes the active head** (and after each resolved option), so a prompt queued behind an optional flip sees the flipped form; unavailable options are `disabled` with a `disabledReason` and are rejected by `resolveDecisionPrompt`. The cost is paid when the option is chosen. Prompt options are cloned per prompt, so shared card data is never mutated. A `PLAYER_CHOICE` whose source card is an `obligation` sets `completion: "DISCARD_SOURCE_OBLIGATION"`: once the option resolves, an obligation still in its owner's zone is discarded to the encounter discard.

> [!NOTE]
> The `promptId` field on `PendingDecisionPrompt` is **not** used by `resolveDecisionPrompt` for disambiguation — the resolver always pops the head of the `pendingDecisionQueue`. The `promptId` is retained in the queue for log tracing.

### `sourceCardInstanceId` Binding (ADR-0062)

When `PLAYER_CHOICE` is executed from a `USE_CARD_ABILITY` action on an in-play ally, `executeEffect` attaches `context.sourceCardInstance` to the prompt via `sourceCardInstanceId`. When the prompt is resolved via `resolveDecisionPrompt`, `prompt-queue.ts` looks up the ally by instanceId in `player.allies` and `player.tableau` and forwards it as `sourceCardInstance` into the synthetic ability execution. This guarantees that `target: "SELF"` in a `MODIFY_STAT` option correctly pushes the modifier onto the triggering ally's `activeStatModifiers`.

```json
// PendingDecisionPrompt fields relevant to source binding:
{
  "promptId": "...",
  "sourceCardName": "Vision",
  "sourceCardCode": "01068",
  "sourceCardInstanceId": "<runtime instanceId>"
}
```
