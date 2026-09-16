# 09. Action Sequencing & Interactive Prompts

---

## 1. Unified Action Step Sequencing (`steps: []`) & Conditional Gates

- **Status:** 🟢 `IMPLEMENTED (v1.0)` (ADR-0028, ADR-0030, ADR-0060 / _Split Personality_ `01025`, _Hard to Keep Down_ `01104`, _I'm Tough_ `01105`, _Photonic Blast_ `01013`, _Hulk_ `01050`, _Under Fire_ `01193`)
- **Description:** Decomposes all card abilities into an ordered execution pipeline of discrete, reusable atomic `AbilityStep` primitives, with optional conditional gating (`gate: ...`), separated gate parameters (`gateParams: { ... }`), effect execution parameters (`effectParams: { ... }`), and contextual data-flow passing (`target: "PREVIOUS_TARGET"`).

### Parameter Separation (`gateParams` vs `effectParams`, ADR-0060)

Under **ADR-0060**, parameters configuring conditional step gates and parameters configuring effect execution are decoupled:
- `gateParams`: Key-value map configuring the conditional gate check (e.g. required kicker resource, card code check, status check).
- `effectParams`: Key-value map configuring the effect primitive execution (e.g. damage amount, target selector, draw count).
- `params`: Retained for backward-compatible schema ingestion. Engine pipelines query parameters via `getStepEffectParams(step)` and `getStepGateParams(step)`, which read dedicated parameter objects first and fall back to `params`.

### Conditional Gates:

- `"ALWAYS"` _(Default)_: Executes unconditionally per RR v1.8 p. 2 "Do as much as you can".
- `"THEN"` / `"IF_PREVIOUS_SUCCESS"`: Executes Step $N$ only if Step $N-1$ mutated the game state (RR v1.8 p. 24 "Then").
- `"IF_AMOUNT_ZERO"` / `"IF_ZERO_HEALED"`: Executes Step $N$ (e.g. `SURGE`) if Step $N-1$ caused 0 state mutation (e.g. at full health).
- `"IF_ALREADY_HAS_STATUS"`: Executes Step $N$ if the target already has the status card before applying (`gateParams: { status, target }`).
- `"IF_CARD_IN_PLAY"`: Executes Step $N$ if the specified card is in play (`gateParams: { cardCode }`).
- `"IF_CARD_NOT_IN_PLAY"`: Executes Step $N$ if the specified card is not in play (`gateParams: { cardCode }`).
- `"IF_FAILED"`: Executes Step $N$ if Step $N-1$ (or `gateParams.targetStepId`) could not resolve.
- `"IF_RESOURCE_MATCH"`: Evaluates whether resources spent during action payment (`context.resourcesSpent`) or discarded cards (`context.discardedCards`) match required criteria:
  - `resource`: Required resource type (`"energy" | "physical" | "mental" | "wild"`). Wild resources always count toward the match.
  - `count` (or `requiredCount`): Number of matching resources required (default: `1`).
  - `aspect` (or `reqAspect`): Required aspect if checking aspect resources.
  - `printedResource` (or `requirePrinted`): When `true`, inspects printed resources on discarded cards (e.g. Hulk `01050`) rather than generated payment resources.
  - `only` (or `requireOnly`): When `true`, requires 100% of spent resources to match the specified resource type.
- `"IF_CONDITION_MET"` ([ADR-0049](../../decisions/0049-composable-value-transformers-and-event-interception.md)): Executes Step $N$ only if the explicitly monitored condition (`condition` in Step $N-1$ or targeted by `targetStepId`) evaluated to `true`.

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
| **Entity State**   | `TARGET_ALREADY_EXHAUSTED` | Target was already exhausted.                                          | `EXHAUST`                                                  |
| **Entity State**   | `TARGET_TRAIT_MATCH`       | Targeted entity possesses specified trait (e.g. `[[AERIAL]]`).         | Card filter                                                |
| **Entity State**   | `TARGET_FORM_MATCH`        | Identity is in specified form (`hero`, `alter_ego`, etc.).             | Form check                                                 |
| **Resource**       | `RESOURCE_KICKER_MET`      | Resources spent to pay for card match required kicker icon(s).         | _Photonic Blast_ (`01013`), _Relentless Assault_ (`01053`) |
| **Threshold**      | `COUNTER_THRESHOLD_MET`    | Target upgrade/support has reached or exceeded counter count.          | _Energy Channel_ (`01018`)                                 |
| **Threshold**      | `ZONE_EMPTY`               | Evaluated zone (e.g. hand, discard) contains 0 cards.                  | Zone check                                                 |

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

---

## 2. Interactive Decision Prompts (`PLAYER_CHOICE`)

- **Status:** 🟢 `IMPLEMENTED (v1.0)` ([`DecisionPromptModal.tsx`](../../../src/ui/components/board/DecisionPromptModal.tsx) / _Nick Fury_ `01084` / _Hydra Bomber_ `01110` / _Exhaustion_ `01191` / _Vision_ `01068`)
- **Description:** Renders a Pop-Art comic decision modal, blocking state execution until the player resolves their choice. When a `PLAYER_CHOICE` prompt originates from an in-play ally or tableau card, the `sourceCardInstanceId` field on `PendingDecisionPrompt` is forwarded into `executeEffect` so that `MODIFY_STAT` with `target: "SELF"` resolves correctly against the ability-triggering card instance.

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
        "params": { "stat": "THW", "amount": 2, "duration": "PHASE", "target": "SELF" }
      },
      {
        "id": "boost_atk",
        "label": "+2 ATK",
        "description": "Vision gets +2 ATK until the end of the phase.",
        "effect": "MODIFY_STAT",
        "params": { "stat": "ATK", "amount": 2, "duration": "PHASE", "target": "SELF" }
      }
    ]
  }
}
```

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
