# Plan: WP4, Kree Manipulator `01178` boost fires on every attack ([#229](https://github.com/SteveRodrigue/MCD/issues/229))

> **Status:** implemented 2026-10-04 (approved; committed `b2ab514`). Tier 2 (new generic step condition plus attack context passed to boost resolution). Part of [plan_effect_params_remediation.md](plan_effect_params_remediation.md). A second card with the same missing condition, Electric Whip Attack `01173`, is split into WP8 ([#241](https://github.com/SteveRodrigue/MCD/issues/241)) and planned immediately after this item.
> **UI / Card Editor impact:** the new condition appears in the editor's condition dropdown automatically (built from `StepConditionSchema`); the gate parameter panel gains an `attackerKind` field for it.

## 1. Printed text (upstream `core_encounter` 01178, treachery, star boost)

> **Surge.** *(After this card resolves, reveal 1 additional encounter card.)*
> **When Revealed**: Place 1 threat on the main scheme.
> [star] **Boost**: If the villain is making an **undefended attack**, place 1 threat on the main scheme.

Rules lookup: `npm run rule -- undefended` only points to "Attack (Enemy Activation)". An attack is undefended when no hero or ally was declared as its defender. The boost wording names "the villain", so an attack by a minion does not qualify.

## 2. Original supplemental data (`core_encounter.json`, `01178`, boost ability)

```json
{
  "id": "kree_manipulator_boost",
  "timing": "BOOST",
  "trigger": "BOOST_STAR_RESOLVED",
  "steps": [
    { "effect": "ADD_THREAT",
      "effectParams": { "amount": 1, "target": "MAIN_SCHEME", "condition": "UNDEFENDED_ATTACK" } }
  ]
}
```

(`When Revealed` ability and the Surge keyword are separate: Surge is blocked on #218, unchanged here.)

## 3. Proposed supplemental data

```json
{
  "id": "kree_manipulator_boost",
  "timing": "BOOST",
  "trigger": "BOOST_STAR_RESOLVED",
  "steps": [
    { "effect": "ADD_THREAT",
      "gate": "IF_CONDITION_MET",
      "condition": "UNDEFENDED_ATTACK",
      "gateParams": { "attackerKind": "VILLAIN" },
      "effectParams": { "amount": 1, "target": "MAIN_SCHEME" } }
  ]
}
```

`audit.updatedAt` and `reviewedAt` bumped; `audit.comment` untouched. The trigger value is left as is (the combat pipeline selects boost abilities by `timing === 'BOOST'`, not by trigger; see section 5).

## 4. Why (evidence)

- `effectParams.condition: "UNDEFENDED_ATTACK"` is read nowhere in `src/engine/` and is not in `StepConditionSchema`, so the boost places 1 threat on **every** attack ([audit](../reports/effect_params_orphan_audit.md)). The real mechanism for conditions is the step-level `condition` plus a gate (spec `10_sequences_and_prompts.md`), which this ability never used.
- The boost resolver calls `executeEffect(state, boostAbility, { playerId, sourceCardInstance })` (`combat-pipeline.ts` ~L757), so the effect pipeline has no idea who is attacking or whether a defender was declared, even though `attackContext.attackerType` and `attackContext.defender` are known at that point (boosts resolve in step 5, after the defender is declared in step 3).
- The spec table of `ADD_THREAT` (05) lists `condition` as if supported.

## 5. Engine and schema changes (Tier 2, no card names)

1. **New `StepCondition` `UNDEFENDED_ATTACK`:** true when the attack currently resolving has no defender (`defenderType === 'UNDEFENDED'`). Optional `gateParams.attackerKind` (`VILLAIN` | `MINION` | `ANY_ENEMY`, the same enum as `triggerFilter.attackerKind`) restricts who is attacking. Outside an attack (for example a scheme-activation boost) the condition is false. Touches `StepConditionSchema` (`schema.ts`), regenerated `schema.json`, the `StepCondition` type, `evaluateStepGate` (new branch in the `IF_CONDITION_MET` evaluation; `IF_CONDITION_NOT_MET` negates it for free), the spec condition table and the editor.
2. **Attack facts reach the gate:** `StepGateContext` and `EffectExecutionContext` gain optional `attackerType` (`VILLAIN` | `MINION`) and `defenderType` (`HERO` | `ALLY` | `UNDEFENDED`); the boost resolver passes `attackerType: attackContext.attackerType` and `defenderType: attackContext.defender?.type ?? 'UNDEFENDED'`.
3. **Editor:** the gate parameter panel (`StepPipelineEditor.tsx`, the `IF_CONDITION_MET` / `IF_CONDITION_NOT_MET` block) shows an "Attacker Kind" select when `condition === 'UNDEFENDED_ATTACK'`.
4. **Docs:** spec `10` condition table row (with this card as the example), spec `05` `ADD_THREAT` (remove the `condition` row if present or correct it), a short usage note next to the gate guide ("undefended" is a fact about the attack, not a step result), ADR-0049 addendum line.

Not part of this change (tracked elsewhere): the Surge keyword (#218), `isStepGateClosedByState` stays unchanged because this condition depends on the attack context, not on the state alone.

## 6. Tests (TDD, each written first and seen failing)

New `tests/engine/kree-manipulator-boost.test.ts`, driving a real attack through `initiateEnemyAttack` / `resolveDefenderDeclaration` with the boost deck stacked with Kree Manipulator (and a stacked 0-icon deck to avoid extra boosts):

1. Villain attack, **undefended**: main scheme gains 1 threat (the boost) and the attack deals damage (fails today only in the negative cases below, passes here: guards the happy path).
2. Villain attack **defended by the hero**: no threat added by the boost (fails today).
3. Villain attack **defended by an ally**: no threat added (fails today).
4. **Minion** attack, undefended: no threat added (the boost says "the villain"; fails today).
5. Gate unit tests in `step-gate-evaluator.test.ts`: `UNDEFENDED_ATTACK` true/false for each `defenderType`, with and without `attackerKind`, false when `defenderType` is absent, and negated by `IF_CONDITION_NOT_MET`.
6. Schema test: the new condition and the step shape validate; the pack no longer contains `"condition": "UNDEFENDED_ATTACK"` inside `effectParams`.
7. Editor test: selecting `UNDEFENDED_ATTACK` shows the Attacker Kind select and round-trips `gateParams.attackerKind`.

Existing boost tests (`combat-boost-and-star-abilities.test.ts` and friends) must pass unchanged.

## 7. Files

`src/data/supplemental/pack/core_encounter.json` (`01178` only), `src/data/supplemental/schema.ts`, regenerated `schema.json`, `src/engine/models/abilities.ts` (`StepCondition`), `src/engine/pipeline/step-gate-evaluator.ts`, `src/engine/effects/index.ts` (context type), `src/engine/pipeline/combat-pipeline.ts`, `src/ui/components/editor/StepPipelineEditor.tsx`, specs `10` and `05`, ADR-0049 addendum, the new and extended tests, `CHANGELOG.md`, trackers, `npm run report:declarations`.

## 8. Findings and follow-ups

- **WP8 / [#241](https://github.com/SteveRodrigue/MCD/issues/241) (new):** Electric Whip Attack `01173` shares the missing undefended condition and has three more defects (an invented `CONSTANT +1 ATTACK`, a boost filter that includes supports although the card says only upgrades, and the whole When Revealed choice unmodelled). It is added to the remediation tracker right after WP4 and will be planned as soon as WP4 is committed.
- The key-level audit cannot catch semantic errors like these; `01173` was found by reading its data next to the printed text. WP5's guard test will not either. I recommend a one-off read-through of every core encounter card's data against its printed text after WP8; say so if you want it filed as its own issue.

## 8b. Implementation notes (2026-10-04)

- The minion-attack test passes before and after the change: non-villainous minions deal no boost cards, so the `attackerKind: VILLAIN` restriction is a guard for villainous minions and for the generic condition rather than a behaviour change today.
- No new editor panel beyond one select: the condition dropdown already derives from `StepConditionSchema`.

## 9. Open decisions

None blocking. The condition is generic (`UNDEFENDED_ATTACK` plus an optional `attackerKind`), following the same pattern as `TARGET_TRAIT_MATCH` + `gateParams.trait`.
