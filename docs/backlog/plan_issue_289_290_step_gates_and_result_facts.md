# Plan: step gates and result facts (#289, #290)

**Status:** design complete, awaiting owner approval to implement. Decisions D1 to D14 come from the `/grill-me` session and D15 to D19 from the follow-up, all on 2026-10-07. No code written yet.

Issues: [#289](https://github.com/SteveRodrigue/MCD/issues/289) (gate / condition / gateParams), [#290](https://github.com/SteveRodrigue/MCD/issues/290) (result milestones). One plan, because both issues change the same three fields (`gate`, `condition`, `gateParams`) and the same evaluator.

## 1. Problem (verified against the code)

- `AbilityStep.condition` does two unrelated jobs:
  - **State check** read by the gate: `TARGET_TRAIT_MATCH`, `ZONE_EMPTY`, `UNDEFENDED_ATTACK` under `IF_CONDITION_MET` / `IF_CONDITION_NOT_MET` ([step-gate-evaluator.ts L168-195](../../src/engine/pipeline/step-gate-evaluator.ts)).
  - **Instruction to the producer**: the effect computes a milestone only if its own step names it (`effects/index.ts` ~L2398, ~L2785, ~L3095, ~L3225, ~L3294), and a later step then reads `conditionMet`.
- `TARGET_TRAIT_MATCH` never looks at a target. It calls `hasPlayerTrait(player, trait)`.
- **#290's evidence is wrong:** no card data uses the 5 milestones `SCHEME_EMPTY`, `TARGET_DEFEATED`, `FULLY_HEALED`, `STATUS_APPLIED`, `EXCESS_DAMAGE_DEALT`. The "~7 data steps" are the state checks above. The only result check in data is `IF_ALREADY_HAS_STATUS` (01105, 01112). It reads the default `conditionMet` of the previous `ADD_STATUS` step, so its `gateParams` `status` / `target` are never read.
- Hidden coupling: with `condition: EXCESS_DAMAGE_DEALT`, the damage effect also replaces its `value` with the excess amount.
- `REMOVE_STATUS` reports "removed > 0" under the name `STATUS_APPLIED`.
- Duplicate gates: `THEN` = `IF_PREVIOUS_SUCCESS`, `IF_AMOUNT_ZERO` = `IF_ZERO_HEALED` (identical code). `IF_FAILED` = negation of `THEN`.
- `gateParams` is `z.record(any)`. The evaluator accepts aliases: `resource`|`aspect` and `count`|`amount` (IF_RESOURCE_MATCH), `cardCode`|`code` (IF_CARD_IN_PLAY), `trait`|`traits[0]`, `alter-ego`|`alter_ego` (IF_FORM). Data mixes `hero` (01017) with `HERO` / `ALTER_EGO` (01106, 01187, 01189).
- A `targetStepId` that is not found silently falls back to the previous result. A skipped step does not update `prevResult` (`effects/index.ts` L1152-1160), so `THEN` after a skipped step reads an older step.

## 2. Decisions (grill session)

| #   | Decision |
| :-- | :------- |
| D1  | `step.condition` is removed (schema, engine, editor, data). Each check is its own gate. No alias. |
| D2  | Negation is a common flag `gateParams.negate: true`, applied once by the evaluator to any gate. It replaces `IF_CONDITION_NOT_MET`, `IF_CARD_NOT_IN_PLAY` and `IF_FAILED`. |
| D3  | New state gates: `IF_PLAYER_HAS_TRAIT {trait}`, `IF_ZONE_EMPTY {zone}`, `IF_UNDEFENDED_ATTACK {attackerKind?}`. |
| D3b | `form` (`HERO` \| `ALTER_EGO`, see D19) is an optional qualifier on every player gate (`IF_PLAYER_HAS_TRAIT`, `IF_RESOURCE_MATCH`). `IF_FORM` stays for a form-only check. |
| D4  | Effects always write typed facts to `StepResolutionResult.facts`. One gate `IF_RESULT {result, step?}` reads them. All facts are kept, each with a test. |
| D5  | `THEN` stays (RR "Then"). `AMOUNT_ZERO` becomes an `IF_RESULT` fact. `IF_PREVIOUS_SUCCESS`, `IF_AMOUNT_ZERO`, `IF_ZERO_HEALED`, `IF_FAILED` are deleted. `targetStepId` is renamed `step`. |
| D6  | One strict Zod params schema per gate. Aliases are removed and data is migrated to the canonical keys. |
| D7  | Two fields stay: `gate` (string) and optional `gateParams` (object), same split as `effect` / `effectParams` (ADR-0060). A gate with no parameters has no `gateParams`. Validation is a `superRefine` on `AbilityStepSchema`, so a bad card fails at load and in `card:validate`. `ALWAYS` is removed (no gate = always). |
| D8  | Facts: `{ targetDefeated, excessDamage: number, fullyHealed, schemeEmpty, statusApplied, alreadyHadStatus, statusRemoved, amountZero }`. `value` is always the main amount. The excess amount is read through a dynamic value source. Renames: `ALREADY_HAS_STATUS` → `ALREADY_HAD_STATUS`; REMOVE_STATUS reports `STATUS_REMOVED`. |
| D9  | New ADR-0080 "Step gates and result facts". It supersedes ADR-0049 section 3 ("Explicit Condition Contracts"). ADR-0049 gets a one-line superseded note. |
| D10 | The Card Editor gate panel is generated from the gate registry: typed fields, a `Negate (NOT)` checkbox, a `step` picker for result gates, `form` on player gates. The "Step Condition" dropdown is removed. |
| D11 | Load-time checks: `step` must name an earlier step of the same ability. A result gate on the first step, or in a CONSTANT ability, is an error. At runtime, a referenced step that was skipped has "no result". |
| D12 | The implicit previous step is the **immediately preceding** step. If it was skipped, there is no result: `THEN` is closed, `THEN` + `negate` is open (RR glossary "Then"). |
| D13 | Delivered in 2 green commits (see section 9). |
| D14 | Crisis Interdiction `01012` keeps only the trait gate. Owner's note: the printed "Then" adds nothing to the design intent, which the 2 steps already achieve (card tested, confidence 100). No `then` modifier is added. No `audit.comment` is written. |

## 3. Rules analysis

- **Then** (`references/rules/glossary/T.md#then`): "If the pre-'then' text of an effect does not fully resolve, the post-'then' text does not attempt to resolve." So D12 follows the text: the "then" part reads the part immediately before it, and a part that was skipped did not resolve. Referenced by **Ability** (`A.md#ability`); nothing there conflicts.
- "If X, ... instead" (Mark V Helmet 01037, Captain Marvel's Helmet 01016) is modelled as two steps whose gates are exact negations (D2). That is the current behavior, written in a different form.
- "If ... already has" (01105, 01112) reads the state **before** the status is given. Only the `ADD_STATUS` result knows that. So it must be a result fact (`ALREADY_HAD_STATUS`), not a state gate.
- Topic cluster: Timing & Triggers (sequencing within one ability). No change to trigger windows, costs or targeting.

## 4. Target model

### 4.1 Gate registry (`src/data/supplemental/gate-params.ts`, new)

Single source of truth for the schema, the evaluator dispatch, `isStepGateClosedByState`, and the Card Editor.

| Gate | Kind | Params (required **bold**) | Common keys allowed |
| :--- | :--- | :------------------------- | :------------------ |
| `THEN` | RESULT | `step?` | `negate` |
| `IF_RESULT` | RESULT | **`result`** (`ResultFact` enum), `step?` | `negate` |
| `IF_FORM` | STATE | **`form`** (`IdentityFormSchema`: `HERO` \| `ALTER_EGO`) | `negate` |
| `IF_PLAYER_HAS_TRAIT` | STATE | **`trait`** | `negate`, `form` |
| `IF_ZONE_EMPTY` | STATE | **`zone`** (`SIDE_SCHEMES` \| `ENCOUNTER_DECK` \| `ENCOUNTER_DISCARD` \| `HAND` \| `DECK` \| `DISCARD`) | `negate` |
| `IF_CARD_IN_PLAY` | STATE | **`cardCode`** | `negate` |
| `IF_RESOURCE_MATCH` | CONTEXT (cost) | **`resource`**, `count?` (default 1), `printedResource?`, `only?` | `negate`, `form` |
| `IF_UNDEFENDED_ATTACK` | CONTEXT (attack) | `attackerKind?` (`VILLAIN` \| `MINION` \| `ANY_ENEMY`) | `negate` |
| `IF_ACTIVATION_DEALT_DAMAGE` | CONTEXT (boost) | none | `negate` |

Each entry has: `kind`, a strict Zod object, and per-key editor metadata (label, control type, enum options, required).

`ResultFact` enum and producers:

| `result` | Fact field | Producer | True when |
| :------- | :--------- | :------- | :-------- |
| `TARGET_DEFEATED` | `targetDefeated` | `DEAL_DAMAGE` (via `applyDamageToTarget`) | target defeated |
| `EXCESS_DAMAGE_DEALT` | `excessDamage` (number) | `DEAL_DAMAGE` | `excessDamage > 0` |
| `FULLY_HEALED` | `fullyHealed` | `HEAL_DAMAGE` | no damage left |
| `SCHEME_EMPTY` | `schemeEmpty` | `REMOVE_THREAT` | remaining threat is 0 |
| `STATUS_APPLIED` | `statusApplied` | `ADD_STATUS` | a status card was placed |
| `ALREADY_HAD_STATUS` | `alreadyHadStatus` | `ADD_STATUS` | target had it before |
| `STATUS_REMOVED` | `statusRemoved` | `REMOVE_STATUS` | removed > 0 |
| `AMOUNT_ZERO` | `amountZero` | pipeline, every step | `!mutatedState \|\| value === 0` |

The registry also maps each effect to the facts it produces (`FACT_PRODUCERS`). That map lets validation reject an `IF_RESULT` that reads a fact the referenced step can never produce (D16).

### 4.2 Schema (`schema.ts`)

- Delete `StepConditionSchema` / `StepCondition` and the `condition` member of `AbilityStep` / `AbilityStepSchema`.
- `ConditionGateSchema` → `StepGateSchema` (D15), members = the 9 gates above.
- `AbilityStepSchema.superRefine`:
  - `gateParams` without `gate` → error.
  - `gateParams` checked against the registry's strict object for that gate: unknown key, missing required key, or wrong type → error with the card code, ability id and step index.
- Ability-level `superRefine` (needs the step list):
  - `step` must name the `id` of an earlier step in the same ability.
  - A RESULT gate on step 0 → error.
  - A RESULT or CONTEXT gate in a `CONSTANT` ability → error.
- `src/engine/models/abilities.ts`: delete the hand-written gate union (L134 area) and `conditionMet`. Use the schema-inferred types instead (one source). Add `facts?: StepFacts` to `StepResolutionResult`.
- `DynamicValueSourceSchema.from`: add `PREVIOUS_EXCESS_DAMAGE`, which reads `previousResult.facts.excessDamage` (D17).
- New `IdentityFormSchema = z.enum(['HERO', 'ALTER_EGO'])` (D19). It replaces the two inline enums (`triggerFilter.targetForm`, `identityForm`) and is used by the gate registry.
- `schema.json` is regenerated (`npm run schema:generate`). JSON Schema cannot express the `superRefine`; Zod at load remains the authority (ADR-0022).

### 4.3 Engine

- `step-gate-evaluator.ts`, `evaluateStepGate(step, prevResult, state, context, stepResultsMap)`:
  1. No gate → `true`.
  2. Resolve the result the gate reads:
     - `gateParams.step` given → `stepResultsMap.get(step)`.
     - Otherwise → the immediately preceding step's entry.
     - A skipped step → `undefined` (D12).
  3. Dispatch by gate (one `switch`, no fallthrough default `true`; an unknown gate throws, since the schema already rejects it).
  4. If the gate has a `form` qualifier, it must also match.
  5. `negate` inverts the final value.
- `isStepGateClosedByState` uses `kind === 'STATE'` from the registry (no hand-kept list).
- `effects/index.ts`:
  - Delete every `step.condition` read.
  - Each producer always fills `facts`; `value` is never overwritten by the excess.
  - `executeSequence`:
    - Records a skipped step as `{ skipped: true }` (no `conditionMet`) and passes it as the next step's "previous".
    - Computes `facts.amountZero` for every executed step.
  - The `prevResult` used for `PREVIOUS_TARGET` / `distinctFrom` keeps today's "last executed step" meaning. Only gates use the D12 rule (D18).
- `stat-calculator.ts`: CONSTANT loop calls the same evaluator (only STATE gates can reach it, by D11).
- `IF_ALREADY_HAS_STATUS` state fallback (villain status) is deleted.

## 5. Data migration (owner approval required for each block)

Pretty-printed from `npm run card:get`. Only the changed steps are shown. `effectParams` are unchanged unless shown.

### 01012 Crisis Interdiction (core)

> **Hero Action** (thwart): Remove 2 threat from a scheme. Then, if you have the [[Aerial]] trait, remove 2 threat from a different scheme.

```json
// before (step 2)
{
  "effect": "REMOVE_THREAT",
  "gate": "IF_CONDITION_MET",
  "condition": "TARGET_TRAIT_MATCH",
  "gateParams": { "trait": "Aerial" },
  "effectParams": { "amount": 2, "target": "CHOSEN_SCHEME", "distinctFrom": "PREVIOUS_TARGET" }
}
// after (step 2), D14: no THEN
{
  "effect": "REMOVE_THREAT",
  "gate": "IF_PLAYER_HAS_TRAIT",
  "gateParams": { "trait": "Aerial" },
  "effectParams": { "amount": 2, "target": "CHOSEN_SCHEME", "distinctFrom": "PREVIOUS_TARGET" }
}
```

### 01016 Captain Marvel's Helmet (core, CONSTANT)

> Captain Marvel gets +1 DEF (+2 DEF instead if you have the [[Aerial]] trait).

```json
// before (step 2)
{
  "effect": "MODIFY_STAT",
  "gate": "IF_CONDITION_MET",
  "condition": "TARGET_TRAIT_MATCH",
  "gateParams": { "trait": "Aerial" },
  "effectParams": { "stat": "DEFENSE", "amount": 1 }
}
// after (step 2)
{
  "effect": "MODIFY_STAT",
  "gate": "IF_PLAYER_HAS_TRAIT",
  "gateParams": { "trait": "Aerial" },
  "effectParams": { "stat": "DEFENSE", "amount": 1 }
}
```

### 01037 Mark V Helmet (core)

> **Hero Action** (thwart): Exhaust Mark V Helmet → remove 1 threat from a scheme (from each scheme instead if you have the [[Aerial]] trait).

```json
// before
[
  {
    "id": "helmet_chosen_scheme",
    "effect": "REMOVE_THREAT",
    "gate": "IF_CONDITION_NOT_MET",
    "condition": "TARGET_TRAIT_MATCH",
    "gateParams": { "trait": "Aerial" },
    "effectParams": { "amount": 1, "target": "CHOSEN_SCHEME" }
  },
  {
    "id": "helmet_all_schemes",
    "effect": "REMOVE_THREAT",
    "gate": "IF_CONDITION_MET",
    "condition": "TARGET_TRAIT_MATCH",
    "gateParams": { "trait": "Aerial" },
    "effectParams": { "amount": 1, "target": "ALL_SCHEMES" }
  }
]
// after
[
  {
    "id": "helmet_chosen_scheme",
    "effect": "REMOVE_THREAT",
    "gate": "IF_PLAYER_HAS_TRAIT",
    "gateParams": { "trait": "Aerial", "negate": true },
    "effectParams": { "amount": 1, "target": "CHOSEN_SCHEME" }
  },
  {
    "id": "helmet_all_schemes",
    "effect": "REMOVE_THREAT",
    "gate": "IF_PLAYER_HAS_TRAIT",
    "gateParams": { "trait": "Aerial" },
    "effectParams": { "amount": 1, "target": "ALL_SCHEMES" }
  }
]
```

### 01104 Hard to Keep Down (core_encounter)

> **When Revealed**: Rhino heals 4 damage. If no damage was healed this way, this card gains surge.

```json
// before (step 2)
{ "id": "hard_to_keep_down_surge_step", "effect": "SURGE", "gate": "IF_AMOUNT_ZERO" }
// after (step 2)
{
  "id": "hard_to_keep_down_surge_step",
  "effect": "SURGE",
  "gate": "IF_RESULT",
  "gateParams": { "result": "AMOUNT_ZERO" }
}
```

### 01179 Yon-Rogg's Treason (core_encounter)

> **When Revealed**: Discard each [energy] resource from your hand. If you discarded no cards this way, this card gains surge.

```json
// before (step 2)
{ "effect": "SURGE", "gate": "IF_AMOUNT_ZERO" }
// after (step 2)
{ "effect": "SURGE", "gate": "IF_RESULT", "gateParams": { "result": "AMOUNT_ZERO" } }
```

### 01105 "I'm Tough" (core_encounter)

> **When Revealed**: Give Rhino a tough status card. If Rhino already has a tough status card, this card gains surge.

```json
// before (step 2)
{
  "id": "im_tough_surge_step",
  "effect": "SURGE",
  "gate": "IF_ALREADY_HAS_STATUS",
  "gateParams": { "status": "TOUGH", "target": "VILLAIN" }
}
// after (step 2)
{
  "id": "im_tough_surge_step",
  "effect": "SURGE",
  "gate": "IF_RESULT",
  "gateParams": { "result": "ALREADY_HAD_STATUS" }
}
```

### 01112 False Alarm (core_encounter)

> **When Revealed**: You are confused. If you are already confused, this card gains surge.

```json
// before (step 2)
{
  "id": "false_alarm_surge_step",
  "effect": "SURGE",
  "gate": "IF_ALREADY_HAS_STATUS",
  "gateParams": { "status": "CONFUSED", "target": "SELF_IDENTITY" }
}
// after (step 2)
{
  "id": "false_alarm_surge_step",
  "effect": "SURGE",
  "gate": "IF_RESULT",
  "gateParams": { "result": "ALREADY_HAD_STATUS" }
}
```

### 01111 Explosion (core_encounter)

> **When Revealed**: If Bomb Scare is in play, assign X damage among heroes and allies, where X is the amount of threat on Bomb Scare. If Bomb Scare is not in play, this card gains surge.

```json
// before (step 2)
{
  "id": "step_2_fallback_surge",
  "gate": "IF_CARD_NOT_IN_PLAY",
  "gateParams": { "cardCode": "01109" },
  "effect": "SURGE"
}
// after (step 2)
{
  "id": "step_2_fallback_surge",
  "gate": "IF_CARD_IN_PLAY",
  "gateParams": { "cardCode": "01109", "negate": true },
  "effect": "SURGE"
}
```

### 01164 Titania's Fury (core_encounter)

> **When Revealed**: Titania attacks your hero. If Titania did not attack, heal all damage from Titania and this card gains surge.

```json
// before (steps 2 and 3)
[
  {
    "id": "titania_heals",
    "effect": "HEAL_DAMAGE",
    "gate": "IF_FAILED",
    "gateParams": { "targetStepId": "titania_attacks" },
    "effectParams": { "amount": "ALL", "target": "PREVIOUS_TARGET" }
  },
  {
    "id": "titania_surges",
    "effect": "SURGE",
    "gate": "IF_FAILED",
    "gateParams": { "targetStepId": "titania_attacks" }
  }
]
// after (steps 2 and 3)
[
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
```

### 01190 Shadow of the Past (core_encounter)

> **When Revealed**: ... If your nemesis minion does not enter the game this way, this card gains surge.

```json
// before (step 4)
{
  "id": "step_4_fallback_surge",
  "effect": "SURGE",
  "gate": "IF_FAILED",
  "gateParams": { "targetStepId": "step_1_spawn_nemesis_minion" }
}
// after (step 4)
{
  "id": "step_4_fallback_surge",
  "effect": "SURGE",
  "gate": "THEN",
  "gateParams": { "step": "step_1_spawn_nemesis_minion", "negate": true }
}
```

### 01173 Electric Whip Attack, 01178 Kree Manipulator (core_encounter, Boost)

> [star] **Boost**: If the villain is making an undefended attack, choose and discard an upgrade you control. / ... place 1 threat on the main scheme.

```json
// before (01173 step 1; 01178 identical gate fields)
{
  "effect": "DISCARD",
  "gate": "IF_CONDITION_MET",
  "condition": "UNDEFENDED_ATTACK",
  "gateParams": { "attackerKind": "VILLAIN" },
  "effectParams": { "source": "TABLEAU", "filter": { "types": ["upgrade"] }, "target": "DEFENDING_PLAYER" }
}
// after
{
  "effect": "DISCARD",
  "gate": "IF_UNDEFENDED_ATTACK",
  "gateParams": { "attackerKind": "VILLAIN" },
  "effectParams": { "source": "TABLEAU", "filter": { "types": ["upgrade"] }, "target": "DEFENDING_PLAYER" }
}
```

```json
// 01178 after
{
  "effect": "ADD_THREAT",
  "gate": "IF_UNDEFENDED_ATTACK",
  "gateParams": { "attackerKind": "VILLAIN" },
  "effectParams": { "amount": 1, "target": "MAIN_SCHEME" }
}
```

### 01192 Masterplan (core_encounter)

> **When Revealed**: Place 4 threat on each side scheme. If there are no side schemes in play, discard cards from the top of the encounter deck until a side scheme is discarded. Reveal that side scheme.

```json
// before (step 2, gate fields)
{
  "id": "step_2_discard_until_side_scheme_and_reveal",
  "effect": "DISCARD",
  "condition": "ZONE_EMPTY",
  "gate": "IF_CONDITION_MET",
  "gateParams": { "zone": "SIDE_SCHEMES" }
}
// after (step 2, gate fields; effectParams unchanged)
{
  "id": "step_2_discard_until_side_scheme_and_reveal",
  "effect": "DISCARD",
  "gate": "IF_ZONE_EMPTY",
  "gateParams": { "zone": "SIDE_SCHEMES" }
}
```

### 01017 Cosmic Flight (core, CONSTANT): canonical form value (D19)

> Captain Marvel gains the [[Aerial]] trait.

```json
// before
{
  "effect": "ADD_TRAIT",
  "gate": "IF_FORM",
  "gateParams": { "form": "hero" },
  "effectParams": { "trait": "Aerial" }
}
// after
{
  "effect": "ADD_TRAIT",
  "gate": "IF_FORM",
  "gateParams": { "form": "HERO" },
  "effectParams": { "trait": "Aerial" }
}
```

Unchanged (already canonical): 01013, 01025 (`THEN`), 01050, 01053, 01106, 01168, 01187, 01189 (`HERO` / `ALTER_EGO`). Every migrated card gets `audit.updatedAt` bumped. `confidence` is not changed.

## 6. Card Editor (`StepPipelineEditor.tsx`)

- Remove the "Step Condition" dropdown and the hand-written panels (L473-640).
- New `GateParamsPanel`, built from the registry. It renders, per key: enum → select, string → text, number → number input, boolean → checkbox. Required keys are marked.
- Always shown when a gate is set: `Negate (NOT)` checkbox. Shown for player gates: `Form` select. Shown for result gates: `Step` select listing the ids of earlier steps (default "previous step").
- Validation errors from the `superRefine` are shown inline (same channel the editor uses today for schema errors).
- Step summaries (`step-pipeline-utils.ts`, `step-pipeline-summaries`) read the gate and params, e.g. "if NOT: player has trait Aerial".
- Comic pop-art styling unchanged (existing editor tokens).

## 7. Documentation

- New `docs/decisions/0080-step-gates-and-result-facts.md`. It records D1 to D14, supersedes ADR-0049 section 3, and references ADR-0019, ADR-0028 and ADR-0060.
- ADR-0049: one line under section 3, "Superseded by ADR-0080".
- `docs/decisions/README.md` index row.
- `docs/specifications/supplemental/10_sequences_and_prompts.md`: rewrite the gate section from the registry table (4.1), add the facts table, the negate / form / step keys, and the load-time rules.
- Specs 05, 06, 07, 08: replace `condition` / old gate names in examples.
- `docs/visual-guides/02-ability-lifecycle.md`, `05-card-authoring-decision-guide.md`: gate decision tree.
- `docs/reports/**` are historical snapshots and stay untouched.
- `CHANGELOG.md` entry. Status file: queue row for this plan, and "Done" row after commit 2.

## 8. Tests (written first)

- `tests/data/gate-params.test.ts` (new):
  - Every registry gate accepts its minimal valid params.
  - It rejects an unknown key, a missing required key, `gateParams` without `gate`, every removed alias, `condition` on a step, and `ALWAYS`.
  - Ability-level checks: a `step` that is unknown or names a later step; a result gate on step 0; a RESULT or CONTEXT gate in a CONSTANT ability.
  - (D16) `IF_RESULT` with a fact the referenced effect cannot produce.
- `tests/engine/step-gate-evaluator.test.ts` (rewrite): each gate true/false; `negate` on each gate; `form` qualifier; `step` reference; skipped previous step = no result for `THEN` and `IF_RESULT` (D12).
- `tests/engine/result-facts.test.ts` (new): each producer fills its facts without any step flag. Cases: damage defeats / excess; heal full / partial; remove threat to 0 / not; add status new / already had / immune; remove status; `amountZero` on 0 and on unmutated; `value` not overwritten by excess; `PREVIOUS_EXCESS_DAMAGE` source.
- Card behavior, must stay green after migration:
  - Existing: `masterplan`, `shadow-of-the-past-sequencing`, `condition-based-modifiers` (01016), `effect-sequences-and-gates`, `sequence-step-failures`, `side-scheme-defeat`, `damage-pipeline-unified`, `universal-discard-engine`, `ability-members-batch3`.
  - Add one test each for 01037 (both branches), 01111 (both branches), 01164 (attack / no attack), 01105, 01112, 01104, 01179, 01173 / 01178 (defended / undefended), and the 01106 form split, and 01017 (Aerial only in `HERO` form). Skip any card that already has such a test.
- `gate-params.test.ts` also rejects lowercase `hero` / `alter_ego` in `IF_FORM.form` and the `form` qualifier (D19).
- `tests/ui/StepPipelineEditor.test.tsx`: the generated panel renders the right fields per gate; negate toggles `gateParams.negate`; the step picker lists only earlier ids; the condition dropdown is gone.
- Old-name guard: a test asserting that no supplemental JSON contains `"condition"` or a removed gate name.

## 9. Delivery

1. **Commit 1** (`Refs #289 #290`): ADR-0080 + ADR-0049 note + specs; registry, schema, `superRefine`; evaluator; facts; `executeSequence` skip semantics; data migration; engine and data tests; the editor reduced to a gate dropdown that compiles plus the existing params it can still show (no generated panel yet); `schema.json` regenerated; CHANGELOG.
2. **Commit 2** (`Fixes #289`, `Fixes #290`): generated `GateParamsPanel`, summaries, UI tests; this plan file deleted; status file updated.

Each commit passes `npm run verify`.

## 10. Files

| Area | Files |
| :--- | :---- |
| Schema | `src/data/supplemental/gate-params.ts` (new), `schema.ts`, `schema.json` (generated) |
| Engine | `src/engine/pipeline/step-gate-evaluator.ts`, `src/engine/effects/index.ts`, `src/engine/effects/dynamic-formula-evaluator.ts`, `src/engine/models/abilities.ts`, `src/engine/pipeline/stat-calculator.ts` |
| Data | `src/data/supplemental/pack/core.json`, `core_encounter.json` |
| Editor | `src/ui/components/editor/StepPipelineEditor.tsx`, `GateParamsPanel.tsx` (new), `step-pipeline-utils.ts`, `effect-parameter-registry.ts` |
| Tests | see section 8 (about 15 existing files touched, 3 new) |
| Docs | ADR-0080 (new), ADR-0049, `docs/decisions/README.md`, specs 05-08 and 10, visual guides 02 and 05, `CHANGELOG.md`, status file |

## 11. Resolved follow-up decisions (owner, 2026-10-07)

| #   | Decision |
| :-- | :------- |
| D15 (O1) | `ConditionGateSchema` / `ConditionGate` are renamed `StepGateSchema` / `StepGate`. |
| D16 (O2) | Validation rejects an `IF_RESULT` whose `result` cannot be produced by the referenced step's effect (`FACT_PRODUCERS`). |
| D17 (O3) | Dynamic value source `PREVIOUS_EXCESS_DAMAGE` is added now. It reads `previousResult.facts.excessDamage`. |
| D18 (O4) | D12 applies to gates only. `PREVIOUS_TARGET`, `distinctFrom` and `PREVIOUS_RESULT` keep "last executed step". |
| D19 | Identity form values in supplemental data are uppercase `HERO` \| `ALTER_EGO`, like every other enum the project owns. Lowercase values only copy MarvelCDB fields (card types, resources). One shared `IdentityFormSchema` is used by `IF_FORM.form`, the `form` qualifier, `triggerFilter.targetForm` and `identityForm` (schema.ts L375, L876). The evaluator converts it to the engine's `IdentityFormType` (`hero` \| `alter_ego`) in one function. Data accepts only one spelling, so this is not an alias. |

No open decisions remain.
