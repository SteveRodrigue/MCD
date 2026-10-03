# Plan: Issue #122 — Extract shared step-gate evaluator (unblocks #154)

> Status: **Awaiting approval** (no source/test edits made yet)

## 1. Problem (verified in code)

- `shouldExecuteStep` (`src/engine/effects/index.ts:~699-860`) is the full gate evaluator for the effect pipeline: `THEN`, `IF_PREVIOUS_SUCCESS`, `IF_AMOUNT_ZERO`, `IF_FAILED`, `IF_ALREADY_HAS_STATUS`, `IF_RESOURCE_MATCH`, `IF_CARD_IN_PLAY`, `IF_CARD_NOT_IN_PLAY`, `IF_CONDITION_MET` (incl. `TARGET_TRAIT_MATCH`), `IF_FORM`.
- `stat-calculator.ts:~343` (CONSTANT loop over tableau abilities) has only an inline `IF_CONDITION_MET` + `TARGET_TRAIT_MATCH` check. Any other gate on a CONSTANT step (e.g. `IF_FORM` for #154) is silently ignored.
- `stat-calculator.ts` must not import `effects/index.ts` (heavy, likely circular), hence the need for a separate module.

## 2. Scope note (needs your call)

The issue body says: "strictly a refactor, no behavioral change… Defer until after Gate 1 Rhino Release ships." The backlog currently places it in Phase 3. See decision 1.

## 3. Design

- `[NEW]` `src/engine/pipeline/step-gate-evaluator.ts`: pure functions with no dependency on `effects/index.ts`.
  - `evaluateStepGate(step, ctx)` where `ctx = { state, player, prevResult?, stepResultsMap?, resourcesSpent?, discardedCards? }`.
  - Holds the **state/player-only gates**: `IF_ALREADY_HAS_STATUS`, `IF_CARD_IN_PLAY`, `IF_CARD_NOT_IN_PLAY`, `IF_CONDITION_MET` + `TARGET_TRAIT_MATCH`, `IF_FORM`, `IF_RESOURCE_MATCH`, and the result-based gates (`THEN`, `IF_PREVIOUS_SUCCESS`, `IF_AMOUNT_ZERO`, `IF_ZERO_HEALED`, `IF_FAILED`), moved verbatim.
  - Gates that need step results simply read `ctx.prevResult` / `ctx.stepResultsMap`; with no results (CONSTANT loop) they behave as today's `evaluatedResult === undefined` branch.
- `[MODIFY]` `effects/index.ts`: `shouldExecuteStep` becomes a thin wrapper building the context and calling `evaluateStepGate` (keeps its exported signature, so callers and tests are unchanged).
- `[MODIFY]` `stat-calculator.ts`: replace the inline check with `evaluateStepGate(step, { state, player })`. For gates that cannot be evaluated outside a pipeline run (e.g. `IF_PREVIOUS_SUCCESS` with no previous result), define explicit CONSTANT-context semantics in the module doc: unsupported gates on CONSTANT steps evaluate to "skip"? Decision 2.
- No supplemental data, UI, or Card Editor change in this issue. #154 (Cosmic Flight Aerial gated on `IF_FORM: HERO`) is a separate follow-up data fix.

## 4. Rules / docs

- Gate semantics follow RR v1.8 p. 2, 24 (conditional "if/then" effects), already cited in the code; no rule change.
- Docs to update: ADR addendum (ADR-0019 Zero Hardcoding or a short new ADR-0075) recording the single shared evaluator, and the gates section of the supplemental spec (`docs/specifications/supplemental/`, find via `rg -n "IF_CONDITION_MET" docs`) noting that all gates now apply to CONSTANT steps too.

## 5. Files

| Tag | File | Change |
|---|---|---|
| NEW | `src/engine/pipeline/step-gate-evaluator.ts` | Shared evaluator |
| MODIFY | `src/engine/effects/index.ts` | `shouldExecuteStep` delegates |
| MODIFY | `src/engine/pipeline/stat-calculator.ts` | Use shared evaluator in CONSTANT loop |
| NEW | `tests/engine/step-gate-evaluator.test.ts` | Unit tests in isolation |
| MODIFY | `CHANGELOG.md`, backlog doc, ADR/spec | Status and docs |

## 6. TDD (red first, then refactor green)

1. Unit tests for `evaluateStepGate`: one case per gate (true and false): `IF_FORM`, `IF_CARD_IN_PLAY`/`NOT_IN_PLAY`, `IF_ALREADY_HAS_STATUS`, `IF_RESOURCE_MATCH` (spent and discarded), `TARGET_TRAIT_MATCH`, result-based gates with and without `prevResult`. **Red** until the module exists.
2. Stat-calculator test: a CONSTANT `MODIFY_STAT` step with `gate: IF_FORM` (hero) applies only in hero form. **Red** today because the CONSTANT loop ignores `IF_FORM`. This is the one intentional behavior extension (it fixes the bug class behind #154); decision 3.
3. Existing suite unchanged: all current tests must pass without edits.

## 7. Verification

`rtk npm test -- tests/engine/step-gate-evaluator.test.ts`, full `rtk npm test`, `rtk npm run format:check`, `rtk npm run lint`, `rtk npm run typecheck` (0 failed, 0 skipped).

## 8. Open decisions

1. **Timing.** (Recommended: do it now. It is the declared dependency of #154 in the backlog, and the work is test-guarded.) Alternative: honor the issue's "after Gate 1" note and jump to #154 with a minimal inline `IF_FORM` check, which adds the ad-hoc debt #122 exists to remove.
2. **Unsupported gates on CONSTANT steps.** (Recommended: result-based gates evaluate to "do not apply" and are documented; state/player gates evaluate for real.)
3. **Behavior extension.** (Recommended: allow CONSTANT steps to honor `IF_FORM` etc. as part of this refactor, since that is the issue's stated benefit, even though the issue body says "no behavioral changes".) Alternative: pure move first, extension in the #154 commit.
4. **ADR.** (Recommended: addendum to ADR-0019 rather than a new ADR.)
5. **Delivery.** (Recommended: one commit `refactor(engine): Extract shared step-gate evaluator (Fixes #122)`.)

## 9. Estimate

About 1.5 hours: 30 min tests, 40 min extraction, 20 min docs and gates. Risk: medium (touches the core effect pipeline), mitigated by the unchanged existing suite.
