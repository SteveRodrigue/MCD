# Plan R2: One available-resource estimate

> **Status:** Proposed, waiting for owner approval.
> **Source:** post-remediation report of code audit AUD-20261017-232534 (item R2); leftover of F002 (single playability core, `44abeac`).
> **Gate:** 1 (affects card legality and the HeroZone resource counter). **Tier:** 2. **Estimate:** 4–6 h.
> **Queue:** section 3.5 of [teamwork_status_and_next_target.md](teamwork_status_and_next_target.md).

## Problem

Three code paths estimate how many resources a player can produce:

1. `getAvailableResources` (`src/engine/pipeline/cost-engine.ts:1200`): hand cards + **1 per ready generator** (whatever the generator produces) + 1 per usable identity resource ability. It re-implements form checks and `ONCE_PER_ROUND` / `ONCE_PER_PHASE` limit checks, and counts a generator with `uses` without checking that its ability generates anything.
2. `getGeneratorProvidedResources` (`cost-engine.ts:118`): the real amount per generator and per identity ability, with `fromCard`, printed-only and type filters. Used by the payment flow.
3. `maxPotentialResources` in `legality-checker.ts:1863`: identity + each generator through (2), plus its own hand count.

Callers of (1): `legality-checker.ts:781` and `effects/handlers/cards.ts:1199` (engine decisions) and `HeroZone.tsx:111` (display). A generator that produces 2 resources (or a double-resource card) is under-counted by (1), so legality can refuse a card the payment flow would accept, and the HeroZone counter disagrees with the payment modal.

## Rules / spec analysis

RR v1.8 "Resources" and "Resource Ability" (`npm run rule -- "resource ability"`, Topic map: Card Economy): a player may use any number of resource abilities and discard any number of hand cards to pay a cost; each resource symbol counts once. The estimate is an upper bound of what payment can produce, so it must equal the sum the payment flow can reach. Follow the Cross-Cutting Rules Protocol for "Resource", "Resource Ability", "Generate".

## Simplification & Refactor Check

- **Merge** (1) and (3) into one `getAvailableResources(player, state)` that sums hand resources + `getGeneratorProvidedResources` for the identity ability and each ready tableau generator. Keep the `{ total, breakdown, hand, generators, identity }` result (HeroZone uses it), with `generators` and `identity` now in resources, not in card counts.
- **Delete** the duplicated form and limit checks in (1) and the `maxPotentialResources` loop in `legality-checker.ts` (it calls the merged function).
- **Parameterize** nothing new: `getGeneratorProvidedResources` already takes the optional type filter.

## File changes

| File                                                    | Change                                                                    |
| ------------------------------------------------------- | ------------------------------------------------------------------------- |
| `src/engine/pipeline/cost-engine.ts`                    | Rewrite `getAvailableResources` on top of `getGeneratorProvidedResources` |
| `src/engine/pipeline/legality-checker.ts`               | Replace the `maxPotentialResources` block with the merged call            |
| `src/ui/components/board/HeroZone.tsx`                  | Breakdown label unchanged in shape; check the text                        |
| `tests/engine/playability-parity.test.ts`               | Extend with the cases below                                               |
| `changes/unreleased/<date>-single-resource-estimate.md` | `Fixed` fragment                                                          |

## Tests (write first)

1. A ready generator that produces 2 resources (pick a Core card with `GENERATE_RESOURCE` amount 2 or a double-resource effect; find one with `rg -n '"GENERATE_RESOURCE"' src/data/supplemental/pack/core.json`) counts 2 in `getAvailableResources` (fails today).
2. A card whose cost equals hand + that generator is legal in `legality-checker` and payable in the payment flow (parity).
3. A uses-only card without a resource ability (Tac Team) adds 0.
4. Exhausted generator and a used `ONCE_PER_ROUND` identity ability add 0 (behaviour kept).

## Open decisions

None expected. If a test shows a rules question about which resources may pay a given cost, stop and ask (confidence below 95 %).

## UI and Card Editor impact

HeroZone resource counter can show a higher number when a generator makes more than 1 resource. Card Editor: none.

## Acceptance

One function estimates available resources; `rg "maxPotentialResources" src` → 0; parity test green.

## Commit

`fix(engine): Estimate available resources from the generator amounts` with `Refs AUD-20261017-232534 R2`.
