# Plan: Issues #180 + #129 — Payment modal resource-type enforcement

> Status: **Awaiting approval** (no source/test edits made yet)

## 1. Reports

- **#180** (Captain Marvel Rechannel, `01010a`): (a) Rechannel can be clicked with no Energy resource available; (b) in the payment modal, cards with no Energy/Wild icon can be selected. They should be grayed out.
- **#129** (Rhino attachment discard): in the "pay to discard attachment" modal, cards without a Physical/Wild icon can be selected. A card needs at least 1 Physical or Wild icon to be eligible.

## 2. Findings (read-only investigation)

- `CardPaymentModal.tsx:1004-1010` disables a hand card only when `requirePrinted` is true and the card has 0 matching printed icons. For ordinary typed costs (Rechannel `resources: ["energy"]`, Rhino attachment physical cost) `requirePrinted` is unset, so nothing is disabled. Wild icons are already counted as matching when `requirePrinted` is false (`committedMatching`, line ~447).
- Payment cost props come from `GameBoard.tsx:495-537` (ability path) and `GameBoard.tsx:670-700` (decision-prompt path); both pass `resourceType`, so the modal already knows the required type.
- The Rechannel button is enabled in `IdentityActionModal.tsx:244` via `canInitiateAbility` → `canPayAbilityCost` (`legality-checker.ts:1276`). Not yet confirmed whether that rejects `cost.resources: ["energy"]` when the hand/generators hold no Energy or Wild. A failing test decides this (step 1 below).
- Rhino attachment discard path: `CardAttachmentFan.tsx:55,122` and `legal-actions-generator.ts:486`; the cost reaches the modal through the same `abilityCost.resourceType`.

## 3. Rules (RR v1.8)

- A resource of a given type is paid with cards showing that icon; a Wild icon counts as any type (RR "Resources", p. 15). Verify with `npm run rule -- resource` and `npm run rule -- wild` during implementation.

## 4. Design

1. **Modal eligibility (UI):** in `CardPaymentModal.tsx`, when `abilityCost.resourceType` is a specific type, a hand card is disabled unless its printed icons include that type or Wild (only that type when `requirePrinted`, as today). Reuse `readCardResources`. Apply the same rule to generators (`isGenDisabled`, line ~1080) so the behavior stays consistent. Disabled cards use the existing `opacity-40 cursor-not-allowed` style; add a tooltip/reason.
2. **Extract the predicate:** move the "can this card pay resource type X" test into one small helper (new `src/ui/components/board/payment-eligibility.ts`, or `src/engine/queries/card-inspector.ts` if it is generic) so modal and tests share it. Engine stays headless.
3. **Rechannel enablement (engine, only if red test confirms the gap):** make `canPayAbilityCost` reject a typed `cost.resources` / `cost.resourceCost` when no hand card or generator can supply that type (Wild counts). Fix generically in the cost engine, not per card.
4. No supplemental data change expected (Rechannel and Rhino data are already declarative). No Card Editor change.

## 5. Files

| Tag | File | Change |
|---|---|---|
| MODIFY | `src/ui/components/board/CardPaymentModal.tsx` | Typed-resource eligibility for hand cards and generators |
| NEW | `src/ui/components/board/payment-eligibility.ts` | Shared predicate (name may change) |
| MODIFY | `src/engine/pipeline/legality-checker.ts` (or `cost-engine.ts`) | Typed-resource affordability, only if step 1 is red |
| NEW | `tests/ui/card-payment-modal-resource-eligibility.test.tsx` | Modal tests |
| MODIFY | `tests/engine/action-cost-engine.test.ts` | Rechannel affordability tests |
| MODIFY | `CHANGELOG.md`, `docs/backlog/teamwork_status_and_next_target.md` | Status |
| MODIFY/NEW | `docs/decisions/` | New ADR (or addendum to ADR-0072, unified payment subsystem) recording typed-resource eligibility |
| MODIFY | `docs/specifications/supplemental/03_costs_and_targeting.md` | Document typed-resource eligibility next to `requirePrinted` |

## 6. UI / Card Editor impact

- UI: payment modal grays and disables ineligible cards; Rechannel button grays when unaffordable (existing disabled style, comic pop-art unchanged).
- Card Editor: none.

## 7. TDD (red first)

1. Engine: Captain Marvel hero form, hand with no Energy/Wild icons, no generators → `canInitiateAbility(rechannel).allowed === false`. With an Energy card → true. With a Wild-only card → true.
2. Modal: Rechannel cost (energy 1): card with only Physical icon is disabled; Energy card and Wild card are enabled.
3. Modal: Rhino attachment cost (physical): card with only Mental/Energy is disabled; Physical and Wild enabled (#129).
4. Modal: `requirePrinted: true` keeps excluding Wild (existing behavior, regression).
5. Modal: untyped generic cost (`resourceType` undefined) leaves all cards selectable.
6. Generators with a mismatching type stay disabled (existing), matching ones enabled.

## 8. Verification

`rtk npm test -- <new test files>`, then `rtk npm run format:check`, `rtk npm run lint`, `rtk npm run typecheck`, `rtk npm test` (0 failed, 0 skipped).

## 9. Open decisions

1. **Rechannel button** (Recommended: fix generically in the engine cost check if the red test shows the gap). Alternative: UI-only graying.
2. **Docs home** (Recommended: addendum to ADR-0072 rather than a new ADR, since this refines the unified payment subsystem). Alternative: new ADR-0075.
3. **Delivery** (Recommended: one commit `fix(ui): Enforce resource type eligibility in payment modal (Fixes #180, Fixes #129)`). Alternative: two commits if the engine change is separate.

## 10. Estimate

About 1 hour: 20 min tests, 25 min implementation, 15 min docs and gates.
