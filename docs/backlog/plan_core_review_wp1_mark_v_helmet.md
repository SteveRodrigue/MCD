# Plan: WP1 / review A4, Mark V Helmet `01037` ignores `aerialAllSchemes` ([#226](https://github.com/SteveRodrigue/MCD/issues/226))

> **Status:** implemented 2026-10-04 (approved with decisions 1(a) and 2: new gate and Patrol included; uncommitted). Tier 2 (new generic gate + executor fix). Part of [plan_effect_params_remediation.md](plan_effect_params_remediation.md); supersedes review item A4 in [plan_core_player_cards_review.md](plan_core_player_cards_review.md).
> **UI / Card Editor impact:** yes, if decision 1 (a) is approved: a new gate `IF_CONDITION_NOT_MET` (editor gate dropdown and its trait/condition fields). Otherwise none.

## 1. Printed text (upstream `core` 01037, upgrade, Hero, cost 1, traits Armor. Tech., unique)

> **Hero Action** *(thwart)*: Exhaust Mark V Helmet → remove 1 threat from a scheme (from **each** scheme instead if you have the [[Aerial]] trait).

## 2. Original supplemental data (`core.json`, `01037`)

```json
{
  "id": "mark_v_helmet",
  "timing": "HERO_ACTION",
  "cost": { "exhaustSelf": true },
  "steps": [
    { "effect": "REMOVE_THREAT",
      "effectParams": { "amount": 1, "aerialAllSchemes": true, "target": "CHOSEN_SCHEME" } }
  ]
}
```

## 3. Proposed supplemental data

```json
{
  "id": "mark_v_helmet",
  "timing": "HERO_ACTION",
  "cost": { "exhaustSelf": true },
  "steps": [
    { "id": "helmet_chosen_scheme",
      "effect": "REMOVE_THREAT",
      "gate": "IF_CONDITION_NOT_MET",
      "condition": "TARGET_TRAIT_MATCH",
      "gateParams": { "trait": "Aerial" },
      "effectParams": { "amount": 1, "target": "CHOSEN_SCHEME" } },
    { "id": "helmet_all_schemes",
      "effect": "REMOVE_THREAT",
      "gate": "IF_CONDITION_MET",
      "condition": "TARGET_TRAIT_MATCH",
      "gateParams": { "trait": "Aerial" },
      "effectParams": { "amount": 1, "target": "ALL_SCHEMES" } }
  ]
}
```

Exactly one step runs ("instead"): without Aerial the chosen-scheme step, with Aerial the all-schemes step. `audit.updatedAt` and `reviewedAt` bumped; `audit.comment` untouched. `aerialAllSchemes` is gone from the data.

## 4. Why (evidence)

- **The key is dead.** `aerialAllSchemes` has zero references in `src/` (audit: [effect_params_orphan_audit.md](../reports/effect_params_orphan_audit.md)). Today the card always removes 1 threat from one chosen scheme, Aerial or not. Spec `05_effects_combat_threat.md` L114 documents the key as implemented; the editor registry already dropped it (`StepPipelineEditor.test.tsx` L291 asserts it is hidden).
- **Why not reuse the Crisis Interdiction pattern (`01012`).** That card is additive ("Then, if you have Aerial, remove 2 more from a different scheme"): step 1 always runs, step 2 is gated on Aerial. Mark V Helmet says "**instead**": the chosen-scheme step must not run for an Aerial player. The gate system only has positive trait checks (`IF_CONDITION_MET` + `TARGET_TRAIT_MATCH`), so the non-Aerial branch has no way to say "only if not Aerial".
- **Rules lookups.** Crisis: the main scheme cannot be thwarted while a Crisis side scheme is in play (already handled by the `REMOVE_THREAT` executor for `ALL_SCHEMES`: it filters out the main scheme, `effects/index.ts` ~L3086). Patrol (`npm run rule -- patrol`): a player engaged with a Patrol minion cannot use cards to thwart the main scheme. The executor does **not** enforce Patrol for `ALL_SCHEMES` (the Patrol check lives in the target resolver for chosen targets, `target-resolver.ts` L1119, L1707, and in action legality), so as written the Aerial branch would remove threat from the main scheme through a Patrol minion.

## 5. Engine and schema changes

1. **New gate `IF_CONDITION_NOT_MET`** (generic, symmetric to `IF_CARD_NOT_IN_PLAY`): the negation of `IF_CONDITION_MET` for the same `condition` and `gateParams`. Touches: `ConditionGateSchema` in `schema.ts`, `schema.json` (`npm run schema:generate`), the `ConditionGate` type in `models/abilities.ts` L141, `evaluateStepGate` in `step-gate-evaluator.ts` (reuses the `IF_CONDITION_MET` branch, negated), the editor (`StepPipelineEditor.tsx` gate options and the condition/trait fields shown at L606), the gate list in `10_sequences_and_prompts.md`, and tests.
2. **Patrol for multi-scheme removal.** In the `REMOVE_THREAT` executor, when the targets are resolved from a multi-scheme selector (`ALL_SCHEMES`) and the resolving player has a Patrol minion engaged, exclude the main scheme exactly as Crisis does today (same filter, same log, no card names). Sources that print "ignores Patrol" keep working through the existing `ignoresPatrol` request flag, if it is wired through to this path; I will check and report if it is not.
3. **Cleanup:** remove `aerialAllSchemes` from the spec table in `05_effects_combat_threat.md`, and fix the `crisisIgnore` row there (the engine reads `ignoresCrisis`; `crisisIgnore` is read nowhere), noted as a drive-by finding for WP7 (#232) if you prefer to keep this change tight.

## 6. Tests (TDD, each written first and seen failing)

New `tests/engine/mark-v-helmet.test.ts`, through `dispatchAction` (`USE_CARD_ABILITY`) with real game setup (Iron Man, hero form, Mark V Helmet in the tableau):

1. No Aerial, main scheme and two side schemes in play: one chosen scheme loses 1 threat; the others are untouched (guards the "instead").
2. With Aerial (Cosmic Flight is Captain Marvel; for Iron Man use Rocket Boots `01039` in play or a hero with Aerial in a two-player game): every scheme loses 1 threat once, nothing is removed twice.
3. Aerial plus a Crisis side scheme: the main scheme is skipped, every side scheme (including the Crisis one) loses 1.
4. Aerial plus the player engaged with a Patrol minion: the main scheme is skipped (fails today).
5. Aerial with only the main scheme at 0 threat and no side schemes: nothing happens and the action does not crash.
6. Gate unit tests in `step-gate-evaluator.test.ts` for `IF_CONDITION_NOT_MET` (trait present and absent, with and without `gateParams.trait`).
7. Editor: `StepPipelineEditor` shows and round-trips `IF_CONDITION_NOT_MET` with its condition and trait fields; the schema test accepts the new gate and the pack still validates.

Existing Crisis Interdiction and `REMOVE_THREAT` tests must keep passing unchanged.

## 7. Files

`src/data/supplemental/pack/core.json` (`01037` only), `src/data/supplemental/schema.ts`, regenerated `schema.json`, `src/engine/models/abilities.ts`, `src/engine/pipeline/step-gate-evaluator.ts`, `src/engine/effects/index.ts` (Patrol filter), `src/ui/components/editor/StepPipelineEditor.tsx`, specs `05` and `10`, new and extended tests, `CHANGELOG.md` `[Unreleased]`, the tracker, the remediation tracker and the status doc, `npm run report:declarations`.

## 7b. Implementation notes (2026-10-04)

- Decisions taken by the user: (1) option (a), the generic gate `IF_CONDITION_NOT_MET`; (2) the Patrol fix is part of this change.
- **Extra root cause found while testing:** `action-dispatcher.ts` looks ahead for the first `CHOSEN_*` target of an ability or event and asks the player once, ignoring gates, so a gated-off non-Aerial step still opened "Choose Target" for an Aerial player. Fixed with `isStepGateClosedByState` (state-only gates: `IF_FORM`, `IF_CARD_IN_PLAY`, `IF_CARD_NOT_IN_PLAY`, `IF_CONDITION_MET` / `IF_CONDITION_NOT_MET` with `TARGET_TRAIT_MATCH`), used by both look-ahead loops. The event-play look-ahead got the same one-line guard; it has no dedicated test of its own (no core event is affected today).
- **Patrol:** implemented in the `REMOVE_THREAT` executor as `isMainSchemeBlockedByPatrol`, merged with the Crisis block for every path (chosen-scheme prompt, `distinctFrom`, multi-scheme selectors). The `ignoresPatrol` field on `ThwartRequest` is declared but unused anywhere, so no "ignores Patrol" opt-out was added.
- **Behaviour note:** with Aerial and no scheme holding threat, the action is rejected before any cost is paid (the existing "no scheme has threat" legality check), instead of resolving as a no-op; the test records this.
- Spec `05`: `aerialAllSchemes` removed and the wrong `crisisIgnore` row corrected to `ignoresCrisis` (WP7 drive-by).

## 8. Open decisions

1. **Exclusive branch mechanism.** (a) New generic gate `IF_CONDITION_NOT_MET` (recommended; clean, reusable for any "instead" card, small schema addition with editor and spec updates). (b) No schema change: gate the chosen-scheme step with `IF_FAILED` on the Aerial step. This misfires when the Aerial branch removes nothing (for example all schemes at 0 threat, or only a Crisis-blocked main scheme), because "nothing removed" counts as failed and the chosen-scheme prompt would then open for an Aerial player.
2. **Scope of the Patrol fix.** Include it here (recommended; without it the new Aerial branch breaks Patrol) or split it into its own issue and land the card with a known Patrol gap. I recommend including it.
