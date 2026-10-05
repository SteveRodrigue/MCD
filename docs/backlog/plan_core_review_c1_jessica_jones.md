# Plan: Core review C1, Jessica Jones `01059` has an invented +4 THW cap

> **Status:** implemented 2026-10-04 (approved; committed `8762323`). Tier 1 (data) plus a one-line engine cleanup in the stat calculator. Tracker: [plan_core_player_cards_review.md](plan_core_player_cards_review.md).
> **UI / Card Editor impact:** none. `maxBonus` is not in `schema.ts`, the editor registry, or the spec; it only exists in one card's data and one engine line.

## 1. Printed text (upstream `core` 01059, ally, Justice, cost 3, ATK 2, THW 1, HP 3, trait Defender., unique)

> Jessica Jones gets +1 THW for each side scheme in play.

No cap is printed.

## 2. Original supplemental data (`core.json`, `01059`)

```json
{
  "id": "jessica_jones_thw_bonus",
  "timing": "CONSTANT",
  "steps": [
    { "effect": "MODIFY_STAT",
      "effectParams": { "stat": "THWART", "scaling": "PER_SIDE_SCHEME", "multiplier": 1, "maxBonus": 4 } }
  ]
}
```

## 3. Proposed supplemental data

```json
{ "effect": "MODIFY_STAT",
  "effectParams": { "stat": "THWART", "scaling": "PER_SIDE_SCHEME", "multiplier": 1 } }
```

`audit.updatedAt` and `reviewedAt` bumped; `audit.comment` untouched.

## 4. Why

- The data caps the bonus at +4. The card has no cap, so with 5 or more side schemes in play Jessica under-counts.
- `stat-calculator.ts` L102 also reads `maxBonus` with a default of 4: `(stepParams.maxBonus as number) || 4`. Even without the data field the engine would still cap at +4, so both must change.
- `maxBonus` is used by exactly one card in all supplemental packs (`core.json` L2194) and is documented nowhere (not in the schema, the editor, or the specs). Making it "opt-in" would leave a parameter no card uses. I propose removing the read from the engine entirely: no cap, as printed.

## 5. Engine change (Tier 1, one site)

`src/engine/pipeline/stat-calculator.ts`, `getEffectiveAllyStats`, the `PER_SIDE_SCHEME` branch becomes:

```ts
thwart += sideSchemeCount * ((stepParams.multiplier as number) || 1);
```

Nothing else reads `maxBonus` (grep over `src`: this line and the one data entry).

## 6. Tests (TDD, written first and seen failing)

Added to `tests/engine/dynamic-stat-calculator.test.ts` in the existing Jessica Jones block:

1. Five side schemes in play: THW is base 1 + 5 = 6 (fails today: 5).
2. Seven side schemes: THW is 8 (guards against any hidden cap).

Existing 0, 1, 2 side scheme assertions and `advanced-mechanics.test.ts` keep passing unchanged.

## 7. Out of scope, noted for later

`scaling: "PER_SIDE_SCHEME"` with `multiplier` is a card-shaped legacy parameter next to the generic dynamic formula `{ from: "ENTITY_COUNT", filter: { types: ["side_scheme"] } }` (already tested for Jessica in `dynamic-formula-evaluator.test.ts`). The CONSTANT stat loop does not evaluate dynamic `amount` formulas yet, so migrating Jessica to it is a separate Tier 2 change (generic dynamic amounts in CONSTANT `MODIFY_STAT`). Not part of C1: tracked as WP6 (#231).

## 8. Files

`src/data/supplemental/pack/core.json` (textual edit, `01059` only), `src/engine/pipeline/stat-calculator.ts`, `tests/engine/dynamic-stat-calculator.test.ts`, `CHANGELOG.md` `[Unreleased]`, the tracker status table, `teamwork_status_and_next_target.md`, and `npm run report:declarations`.

## 8b. Tracking

Part of the `effectParams` remediation: [plan_effect_params_remediation.md](plan_effect_params_remediation.md) (order, dependencies, work packages WP1-WP7, issues #226-#232) and the audit [effect_params_orphan_audit.md](../reports/effect_params_orphan_audit.md). The follow-up in section 7 is WP6 (#231), so no separate issue is needed.

## 9. Open decisions

None blocking. The section 7 migration is already filed as WP6 (#231).
