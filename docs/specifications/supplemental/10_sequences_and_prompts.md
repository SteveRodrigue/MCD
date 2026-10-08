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

### Conditional Gates (ADR-0080):

Steps execute conditionally by specifying `gate` from the 9 canonical `StepGate` values, parameterized by typed `gateParams`:

- `"THEN"`: Executes Step $N$ only if the referenced step (or Step $N-1$) completed successfully (not skipped and not failed; RR v1.8 p. 24 "Then"). Use `gateParams: { "negate": true }` for fallbacks ("if Step failed").
  - `gateParams`: `{ step?: string, negate?: boolean }`.
- `"IF_RESULT"`: Executes Step $N$ only if the referenced step produced the specified milestone fact.
  - `gateParams`: `{ fact: ResultFact, step?: string, negate?: boolean }`.
  - Supported facts: `"defeated"`, `"excessDamage"`, `"amountZero"`, `"threatZero"`, `"fullyHealed"`, `"statusAdded"`, `"statusRemoved"`, `"villainDefeated"`.
- `"IF_FORM"`: Executes Step $N$ based on identity form (hero vs alter-ego).
  - `gateParams`: `{ form?: "HERO" | "ALTER_EGO", target?: "INITIATOR" | "TARGET", negate?: boolean }`.
- `"IF_PLAYER_HAS_TRAIT"`: Executes Step $N$ if the player possesses the specified trait (e.g. `[[AERIAL]]`).
  - `gateParams`: `{ trait: Trait, negate?: boolean }`.
- `"IF_ZONE_EMPTY"`: Executes Step $N$ if the specified zone has 0 cards.
  - `gateParams`: `{ zone: Zone, negate?: boolean }`.
- `"IF_CARD_IN_PLAY"`: Executes Step $N$ if the specified card is in play. Use `negate: true` for "if not in play".
  - `gateParams`: `{ cardId: string, negate?: boolean }`.
- `"IF_RESOURCE_MATCH"`: Evaluates whether resources spent during action payment match required criteria:
  - `gateParams`: `{ resource: ResourceType, count?: number, negate?: boolean }`.
- `"IF_UNDEFENDED_ATTACK"`: True when the attack being resolved has no defender.
  - `gateParams`: `{ attackerKind?: "VILLAIN" | "MINION" | "ANY_ENEMY", negate?: boolean }`.
- `"IF_ACTIVATION_DEALT_DAMAGE"` ([Issue #221](https://github.com/SteveRodrigue/MCD/issues/221)): True when the enemy activation dealt final damage greater than 0.
  - `gateParams`: `{ negate?: boolean }`.

> **Shared evaluator (Issue #122, ADR-0080):** every gate is evaluated by `evaluateStepGate` in `src/engine/pipeline/step-gate-evaluator.ts`, used by both the effect pipeline (`shouldExecuteStep`) and the `CONSTANT` stat-calculator loop. State gates (`IF_FORM`, `IF_PLAYER_HAS_TRAIT`, `IF_ZONE_EMPTY`, `IF_CARD_IN_PLAY`) work on `CONSTANT` steps. Result-based gates (`THEN`, `IF_RESULT`) and context-based gates (`IF_RESOURCE_MATCH`, `IF_UNDEFENDED_ATTACK`, `IF_ACTIVATION_DEALT_DAMAGE`) require execution context or preceding steps, so they never apply to `CONSTANT` steps.
> Gates on `CONSTANT` `ADD_TRAIT` steps are honored by the trait calculators too (e.g. *Cosmic Flight* `01017` uses `"gate": "IF_FORM", "gateParams": { "form": "HERO" }`); state gates (other than `IF_FORM`) need the optional `state` argument and are skipped without it (Issue #154).

### Gating Patterns: THEN, IF_RESULT, and IF_PLAYER_HAS_TRAIT

| Pattern | Gate | Typical shape / Wording |
| :-- | :-- | :-- |
| **Sequential dependency** | `THEN` | "Then, do X" (Step 2 executes only if Step 1 succeeded). |
| **Fallback on failure** | `THEN` (`negate: true`) | "If your nemesis minion does not enter play this way, this card gains surge." (`gateParams: { step: "step_1_id", negate: true }`). |
| **Milestone outcome** | `IF_RESULT` | "If this removes the last threat from that scheme, draw 1 card." (`gateParams: { fact: "threatZero" }`). |
| **Player trait bonus** | `IF_PLAYER_HAS_TRAIT` | "Then, if you have the Aerial trait, remove 2 threat..." (`gateParams: { trait: "Aerial" }`). |
| **Exclusive trait branches** | `IF_PLAYER_HAS_TRAIT` | Step 1 has `negate: true` (non-Aerial); Step 2 has no negation (Aerial). |

**Additive example: Crisis Interdiction `01012`** ("Remove 2 threat from a scheme. Then, if you have the Aerial trait, remove 2 threat from a different scheme."):

```json
"steps": [
  { "effect": "REMOVE_THREAT", "effectParams": { "amount": 2, "target": "CHOSEN_SCHEME" } },
  { "effect": "REMOVE_THREAT",
    "gate": "IF_PLAYER_HAS_TRAIT",
    "gateParams": { "trait": "Aerial" },
    "effectParams": { "amount": 2, "target": "CHOSEN_SCHEME", "distinctFrom": "PREVIOUS_TARGET" } }
]
```

**Exclusive example: Mark V Helmet `01037`** ("Remove 1 threat from a scheme (from each scheme instead if you have the Aerial trait)."). Without Aerial only the first step runs; with Aerial only the second one does:

```json
"steps": [
  { "id": "helmet_chosen_scheme", "effect": "REMOVE_THREAT",
    "gate": "IF_PLAYER_HAS_TRAIT", "gateParams": { "trait": "Aerial", "negate": true },
    "effectParams": { "amount": 1, "target": "CHOSEN_SCHEME" } },
  { "id": "helmet_all_schemes", "effect": "REMOVE_THREAT",
    "gate": "IF_PLAYER_HAS_TRAIT", "gateParams": { "trait": "Aerial" },
    "effectParams": { "amount": 1, "target": "ALL_SCHEMES" } }
]
```

**Fallback example: Shadow of the Past `01190`:**
Step 4 gains surge if Step 1 (spawning nemesis minion) did not succeed:
```json
{
  "id": "step_4_fallback_surge",
  "effect": "SURGE",
  "gate": "THEN",
  "gateParams": {
    "step": "step_1_spawn_nemesis_minion",
    "negate": true
  }
}
```

> **Chosen-target pre-selection:** before an ability runs, the dispatcher looks ahead for the first `CHOSEN_*` target to ask the player once. Steps whose gate is a state-only gate and is closed right now (`IF_FORM`, `IF_PLAYER_HAS_TRAIT`, `IF_ZONE_EMPTY`, `IF_CARD_IN_PLAY`) are ignored by that look-ahead (`isStepGateClosedByState`), so a closed branch never asks for a target. Result-based gates cannot be known in advance and are not skipped.

### Typed Milestone Facts (`StepFacts` under ADR-0080)

Under **ADR-0080**, effect primitives automatically emit typed facts into `EffectResult.facts` without needing an explicit `condition` declaration on the producing step:

| Result Fact | Emitting Effect Primitive | Milestone Event | Example Cards |
| :--- | :--- | :--- | :--- |
| `threatZero` | `REMOVE_THREAT` | Targeted scheme threat reached `0`. | _Clear the Area_ (`04049`), _Turn the Tide_ (`13015`) |
| `defeated` | `DEAL_DAMAGE` | Targeted character reached 0 HP from damage. | _Relentless Assault_ (`01053`), _Chase Them Down_ (`01052`) |
| `excessDamage` | `DEAL_DAMAGE` | Damage exceeded remaining HP (numeric amount stored in `facts.excessDamage`). | _Relentless Assault_ (`01053`), _Hand Cannon_ |
| `fullyHealed` | `HEAL_DAMAGE` | Targeted character damage reduced to 0 (`health === maxHealth`). | _First Aid_ (`01086`), _Aunt May_ (`01006`) |
| `statusAdded` | `ADD_STATUS` | Status was placed on target. | _Mockingbird_ (`01083`) |
| `statusRemoved` | `REMOVE_STATUS` | Status was removed from target. | _Get over Here!_ |
| `amountZero` | `executeSequence` | Effect result `value === 0`. | Zero damage/threat/heal fallbacks |
| `villainDefeated` | `DEAL_DAMAGE` | Active villain was defeated by damage. | Stage transition abilities |

### Example: Undefended Attack Boost (_Kree Manipulator_ `01178`)

```json
{
  "effect": "ADD_THREAT",
  "gate": "IF_UNDEFENDED_ATTACK",
  "gateParams": { "attackerKind": "VILLAIN" },
  "effectParams": { "amount": 1, "target": "MAIN_SCHEME" }
}
```

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
      "effectParams": {
        "target": "CHOSEN_SCHEME",
        "amount": 2
      }
    },
    {
      "id": "draw_if_cleared",
      "effect": "DRAW",
      "gate": "IF_RESULT",
      "gateParams": {
        "fact": "threatZero",
        "step": "remove_threat_step"
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
      "effect": "REMOVE_THREAT",
      "gate": "IF_PLAYER_HAS_TRAIT",
      "gateParams": {
        "trait": "Aerial"
      },
      "effectParams": {
        "amount": 2,
        "target": "CHOSEN_SCHEME",
        "distinctFrom": "PREVIOUS_TARGET"
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
- **Prompt layout:** header (decision point or forced resolution, optional or forced chip), then the body: title, description, then up to two card panels, then the options. The TRIGGERING panel (`TRIGGERING ENCOUNTER CARD` or `TRIGGERING CARD`) shows the card that caused the prompt (`triggerSourceCard`, `triggerSourceCode`, or the single revealed card). The `ABILITY CARD` panel is shown for an optional (`isVoluntary`) prompt when `sourceCardCode` resolves in the catalog and is not already the triggering card. Both panels are the shared `PromptCardPanel`: type chip, `sm` card icon with hover zoom, name, traits and the full printed text as-is (no truncation). There is no provenance banner. Specialised modals (`WakandaForeverModal`, `DistributeAmountModal`) are unaffected.
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

### Multi-select card prompt (`SEARCH`, #260)

A `SEARCH` that lets the player take several cards (`takeCount` > 1) or none (`minimumTake` 0) opens a prompt with `selection: { min, max, distinctBy? }`; one option per candidate (`params.cardName`, `params.cardCode`). The answer is `RESOLVE_DECISION_PROMPT` with `selectedOptionIds` (possibly empty) and `selectedOptionId: 'confirm_selection'`. The engine rejects a count outside `min..max`, an unknown or repeated id, and two cards with the same name when `distinctBy` is `NAME` (`validateSearchSelection`). A single mandatory pick (`minimumTake` 1, one card) keeps the one-click flow with no `selection`. The UI is `SelectCardsModal` (card tiles, counter, Confirm). A search with no candidate writes the log key `card.search.nothingFound`, opens no prompt and still shuffles a searched deck.
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
