# Plan: WP2, Iron Man `01029a` hand size cap is never enforced ([#227](https://github.com/SteveRodrigue/MCD/issues/227))

> **Status:** implemented 2026-10-04 (approved; decision 9 = option (a), remove the clamp; committed `2a3aeb2`). Tier 2 (generic dynamic amount in the hand-size calculator). Part of [plan_effect_params_remediation.md](plan_effect_params_remediation.md); also retires the `PER_MATCHING_CARD` pseudo-primitive, the `MODIFY_HAND_SIZE` part of WP6 ([#231](https://github.com/SteveRodrigue/MCD/issues/231)).
> **UI / Card Editor impact:** yes: `MODIFY_HAND_SIZE.amount` becomes a dynamic value in the editor registry; `scaling`, `multiplier` and `filter` leave its parameter list.

## 1. Printed text: the official errata governs

Upstream text (MarvelCDB, what `audit.originalText` mirrors):

> You get +1 hand size for each [[Tech]] upgrade you control (to a maximum hand size of 7).

**Official errata** (`references/rules/appendices/05_card_errata.md`, IRON MAN #29A, change note: "Changed (to a maximum hand size of 7) to (to a maximum of +6 hand size)"):

> You get +1 hand size for each [[Tech]] upgrade you control (to a maximum of +6 hand size).

The cap is on the **bonus** (+6), not on the total. Iron Man's printed hand size is 1 (upstream `hand_size: 1`), so for the printed card both readings give 7, but the data should encode the errata wording (Golden Rule: errata supersedes the printed card). Nothing in the schema or engine can express "a maximum of +6" today.

## 2. Original supplemental data (`core.json`, `01029a`)

```json
{
  "id": "iron_man_hand_size",
  "timing": "CONSTANT",
  "steps": [
    { "effect": "MODIFY_HAND_SIZE",
      "effectParams": {
        "scaling": "PER_MATCHING_CARD",
        "filter": { "types": ["upgrade"], "traits": ["Tech"] },
        "multiplier": 1,
        "maxHandSize": 7,
        "applicableForm": "hero" } }
  ]
}
```

## 3. Proposed supplemental data

```json
{
  "id": "iron_man_hand_size",
  "timing": "CONSTANT",
  "errata": "You get +1 hand size for each [[Tech]] upgrade you control (to a maximum of +6 hand size).",
  "steps": [
    { "effect": "MODIFY_HAND_SIZE",
      "effectParams": {
        "amount": { "from": "ENTITY_COUNT",
                    "filter": { "types": ["upgrade"], "traits": ["Tech"] },
                    "clamp": { "max": 6 } } } }
  ]
}
```

`scaling`, `multiplier`, `maxHandSize` and `applicableForm` are gone. `audit.updatedAt` and `reviewedAt` bumped; `audit.originalText` and `audit.comment` untouched (the errata goes in the ability's existing `errata` field, which no card uses yet; the editor already has a field for it, `AbilityFormBuilder.tsx` L479).

## 4. Why (evidence)

- **The cap key is dead.** `maxHandSize` and `applicableForm` are not read anywhere in `src/` ([audit](../reports/effect_params_orphan_audit.md)). `getEffectiveHandSize` (`stat-calculator.ts` L430-470) only clamps the total to 1..10. With base 1, seven Tech upgrades give 8 cards. Spec `06_effects_zones_cards.md` marks `MODIFY_HAND_SIZE` "IMPLEMENTED" and documents `maxHandSize`, `minHandSize` and `applicableForm` as working; none is.
- **`applicableForm` is redundant.** Identity abilities are read from `player.activeFormCard` only, so the hero card's ability is inert in alter-ego form already. Test below guards it.
- **A generic building block already exists.** `DynamicValueSource` supports `from: ENTITY_COUNT` with a card filter (counts the player's tableau, `dynamic-formula-evaluator.ts` L263), `multiplier`, `offset` and `clamp: { min, max }` (L349-355), and the editor's `DynamicValueBuilder` already edits all of these. `MODIFY_HAND_SIZE` just does not evaluate a dynamic `amount` (it reads a numeric `amount` only, or the bespoke `PER_MATCHING_CARD` branch). Using the generic formula removes the card-shaped pseudo-primitive instead of adding another parameter (ADR-0021 spirit).

## 5. Engine changes (Tier 2, no card names)

1. `getEffectiveHandSize(player, state)` in `stat-calculator.ts`: evaluate `MODIFY_HAND_SIZE.amount` with `evaluateDynamicAmount` (numbers pass through unchanged), delete the `PER_MATCHING_CARD` branch. `state` becomes a required parameter (all source call sites already pass it: effects, legal-actions, clean-up, GameBoard, HeroZone; `ENTITY_COUNT` needs the state, and a silent 0 without it would be a regression). Typecheck proves no caller is missed.
2. The final clamp: see decision 1 in section 9.
3. No other engine file changes. `MODIFY_STAT`'s `PER_SIDE_SCHEME` and the dispatcher's `PER_DISCARDED_CARD` / `PER_RESOURCE_SPENT` stay for WP6.

## 6. Schema, editor and documentation

- Schema: no change (`MODIFY_HAND_SIZE.amount` is inside the untyped `effectParams`; `errata` and the dynamic formula already exist). `schema.json` is regenerated only if the generator shows a diff.
- Editor (`effect-parameter-registry.ts`): `MODIFY_HAND_SIZE.amount` gets `allowDynamic: true` (renders `DynamicValueBuilder`); remove `scaling`, `multiplier` and `filter` from the entry; keep the description.
- Spec `06_effects_zones_cards.md` (`MODIFY_HAND_SIZE`): rewrite the example and table to `amount` (number or dynamic formula), document the "maximum of +N" pattern with `clamp.max`, remove `scaling`, `filter`, `multiplier`, `maxHandSize`, `minHandSize`, `applicableForm`, and add the errata note. `minHandSize` is listed in the spec, read nowhere, and used by no card: removed rather than implemented.
- Spec `01_metadata_and_audit.md`: add a one-line example that `errata` carries the official errata text when it differs from the upstream printed text (first user: this card), pointing at `references/rules/appendices/05_card_errata.md`.
- `CHANGELOG.md`, trackers, WP6 note (the `MODIFY_HAND_SIZE` pseudo-primitive is retired here), declarations report.

## 7. Tests (TDD, each written first and seen failing)

In `tests/engine/dynamic-stat-calculator.test.ts` (Iron Man block) and a UI test:

1. Hero form, 6 Tech upgrades: hand size 7; 7 Tech upgrades: still 7; 9: still 7 (7 and 9 fail today: 8 and 10).
2. Non-Tech upgrades and Tech non-upgrades do not count.
3. Alter-ego form with Tech upgrades in play: hand size stays 6 (guards removal of `applicableForm`).
4. Numeric `amount` still works for a synthetic ability (flat +2 and -1), and a synthetic formula with `clamp.max` caps a bonus (shows the mechanism is generic, no card name).
5. Player-phase clean-up with 8 Tech upgrades draws up to 7, not 8 (`player-phase-cleanup`).
6. Schema/data: `01029a` validates with `errata` present; no `maxHandSize`, `applicableForm`, `scaling` left on any pack (`rg` guard in the test).
7. Editor: `MODIFY_HAND_SIZE` renders the dynamic value builder for `amount` and no longer lists `scaling`, `multiplier`, `filter` (extend `StepPipelineEditor.test.tsx` L96 block and `effect-parameter-registry.test.ts`).

Existing tests at `dynamic-stat-calculator.test.ts` L40-80 and `board-dynamic-stats-display.test.ts` keep passing unchanged.

## 8. Files

`src/data/supplemental/pack/core.json` (`01029a` only), `src/engine/pipeline/stat-calculator.ts`, `src/ui/components/editor/effect-parameter-registry.ts`, specs `06` and `01`, tests above, `CHANGELOG.md`, tracker, remediation tracker, status doc, `npm run report:declarations`.

## 8b. Implementation notes (2026-10-04)

- Decision taken by the user: option (a), the 1..10 clamp is removed; the hand size only cannot go below 0.
- `getEffectiveHandSize` now needs a `GameState`; typecheck flagged one caller (`HeroZone`, which can render without a game state), fixed with the same empty-board stub that its stat call already used.
- `stat-calculator.ts` now imports `evaluateDynamicAmount` from the effects folder (the evaluator already imported the stat calculator; ES module cycle, functions only used at call time, same as the existing step-gate cycle).
- Spec `06` previously marked `MODIFY_HAND_SIZE` implemented with `maxHandSize`/`minHandSize`/`applicableForm`; all three were documentation only and are removed.

## 9. Open decision (resolved)

**The 1..10 clamp on the total hand size** (`Math.max(1, Math.min(10, ...))`, `stat-calculator.ts` L470). I searched `references/rules/` for a maximum hand size and found none: the Rules Reference says a player draws or discards to "the number of cards indicated by their hand size value". The clamp was introduced with the calculator (`e05a04c`) and has no rules basis. Options: (a) remove the upper bound and the lower bound of 1, keeping only "cannot be negative" (recommended: literal to the rules, and it removes a hidden cap that would silently override an errata-style "+6"); (b) leave the 1..10 clamp untouched and file it as a separate issue. If you pick (b), Iron Man's cap still works (7 is below 10).
