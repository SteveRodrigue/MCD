# Plan: Issue #154 — Cosmic Flight (01017) grants Aerial only in Hero form

> Status: **Awaiting approval** (no source/test/data edits made yet)

## 1. Reporter's question ("does the engine properly check conditional traits?")

No. Two gaps, both confirmed in code:

1. **Data:** `core.json` `01017` `cosmic_flight_aerial` is `CONSTANT` → `ADD_TRAIT: Aerial` with no gate.
2. **Engine:** `extractAddTraitEffects` (`stat-calculator.ts:166`) collects every `CONSTANT` `ADD_TRAIT` step and **never looks at `gate`**. So even a correctly gated card would still grant the trait. #122 (shared evaluator, `0acc25f`) already gave the stat loop gate support; the trait path was not covered.

## 2. Rules (RR v1.8)

- Printed text: "Captain Marvel gains the Aerial trait." Captain Marvel is the hero side; in Alter-Ego form (Carol Danvers) the identity is not Captain Marvel, so the trait must not apply (reporter's expectation). Verify with `npm run rule -- trait` and `npm run rule -- "alter-ego"` during implementation, following See also links per AGENTS.md.

## 3. Design

- **Engine (generic):** make `extractAddTraitEffects` honor `step.gate` using the shared evaluator.
  - Thread an optional `state?: GameState` through `getEffectivePlayerTraitsDetails`, `getEffectivePlayerTraits`, `hasPlayerTrait`, `getEffectiveCardTraitsDetails` (all optional, so the 16 existing call sites compile unchanged).
  - Export a small player-only `evaluateFormGate(player, gateParams)` from `step-gate-evaluator.ts` (and have `evaluateStepGate`'s `IF_FORM` branch call it). Trait extraction uses it for `IF_FORM`, which needs no `state`, so UI callers like `HeroZone.tsx:112` and `IdentityActionModal.tsx:56` work without changes.
  - Other state gates (e.g. `IF_CARD_IN_PLAY`) are evaluated when `state` is passed; without `state` a gated step is skipped (documented). Result-based gates never apply (same rule as #122).
  - Pass `state` from engine call sites that have it (`legality-checker.ts:1440`, `dynamic-formula-evaluator.ts:299`, `step-gate-evaluator.ts:163`).
- **Data:** add `"gate": "IF_FORM", "gateParams": { "form": "hero" }` to the `ADD_TRAIT` step of `cosmic_flight_aerial` (01017). `audit.comment` untouched (AGENTS.md).
- **Not changed:** `getEffectivePlayerTraitsDetails` still unions printed traits of both identity sides (existing tests assert this, e.g. `effective-traits.test.ts:~100`). See decision 1.

## 4. Files

| Tag | File | Change |
|---|---|---|
| MODIFY | `src/engine/pipeline/stat-calculator.ts` | Gate-aware `extractAddTraitEffects`; optional `state` params |
| MODIFY | `src/engine/pipeline/step-gate-evaluator.ts` | Export `evaluateFormGate` |
| MODIFY | `src/engine/pipeline/legality-checker.ts`, `src/engine/effects/dynamic-formula-evaluator.ts` | Pass `state` to trait helpers |
| MODIFY | `src/data/supplemental/pack/core.json` | Gate on `01017` `cosmic_flight_aerial` |
| MODIFY | `tests/engine/effective-traits.test.ts` | New cases |
| MODIFY | `docs/reports/supplemental_declarations_usage_report.md` | Regenerate (`rtk npm run report:declarations`) |
| MODIFY | `CHANGELOG.md`, backlog doc, spec/ADR | Status and docs |

## 5. UI / Card Editor impact

- UI: the identity trait badges (`HeroZone`, `IdentityActionModal`) stop showing Aerial in Alter-Ego form automatically; no component edits.
- Card Editor: none (gates on `ADD_TRAIT` already editable via the step gate fields).

## 6. TDD (red first)

1. Real Cosmic Flight card (`01017`) in tableau, hero form → `Aerial` in effective traits and `hasPlayerTrait(player,'Aerial')` true. **(passes today)**
2. Same card, Alter-Ego form → `Aerial` absent. **(red today)**
3. Synthetic CONSTANT `ADD_TRAIT` with `IF_FORM: alter_ego` → applies only in alter-ego form. **(red today; proves the engine fix independent of data)**
4. Ungated `ADD_TRAIT` still applies in both forms (regression, existing tests unchanged).
5. Downstream: a card requiring the Aerial trait (e.g. Captain Marvel's "+2 DEF if Aerial", `01015`-area dynamic bonus via `dynamic-formula-evaluator.ts:299`) does not get the Aerial bonus in alter-ego form.
6. Existing suites pass unchanged.

## 7. Verification

`rtk npm test -- tests/engine/effective-traits.test.ts`, `rtk npm run report:declarations`, `rtk npm run format:check`, `rtk npm run lint`, `rtk npm run typecheck`, `rtk npm test` (0 failed, 0 skipped).

## 8. Open decisions

1. **Union of printed traits across both sides.** Today a Captain Marvel player always has both Avenger/Captain Marvel and S.H.I.E.L.D./Soldier regardless of form. That is a separate, probably related correctness question (reporter: "some traits are added conditionally"). (Recommended: out of scope here; file a follow-up issue to audit form-specific printed traits, since existing tests encode the union.) Alternative: fix now, which changes the existing test contract.
2. **Fix level.** (Recommended: engine fix + data gate together, one commit `fix(engine): Honor step gates on ADD_TRAIT; gate Cosmic Flight Aerial to Hero form (Fixes #154)`.) Alternative: data-only, rejected because the gate would be ignored.
3. **Without `state`.** (Recommended: gated non-form steps are skipped when no `state` is supplied.)
4. **Docs.** (Recommended: extend the ADR-0019 addendum and the gate note in `10_sequences_and_prompts.md` to say gates apply to CONSTANT `ADD_TRAIT` too.)

## 9. Estimate

About 1 hour: 20 min tests, 25 min engine and data, 15 min docs and gates.
