# Plan R3: Enforce the Event `discardSelf` invariant in card validation

> **Status:** Proposed, waiting for owner approval.
> **Source:** post-remediation report of code audit AUD-20261017-232534 (item R3); leftover of F019 (`36806cc`).
> **Gate:** Tech Debt & Tooling. **Tier:** 1. **Estimate:** 1–2 h.
> **Queue:** section 3.5 of [teamwork_status_and_next_target.md](teamwork_status_and_next_target.md).

## Problem

"An Event card cannot declare `cost.discardSelf`" (issue #271, RR v1.8 Event: an event is discarded intrinsically after it resolves) is checked only in the Card Editor save endpoint (`src/tools/editor/api-middleware.ts:337-347`). `npm run card:validate` and the data tests do not enforce it, so a hand-edited pack can break it unnoticed.

The Zod schema cannot do it alone: `CardEnrichmentSchema` validates supplemental data without the upstream card type. `src/data/supplemental/schema.ts:186` only covers the related `zone: 'HAND'` case.

## Rules / spec analysis

RR v1.8 "Event" (`npm run rule -- event`): "After an event resolves, it is placed in its owner's discard pile." `discardSelf` on an event would discard it twice. Confidence 100 %.

## Simplification & Refactor Check

- **Move** the check into one exported function next to the schema, e.g. `findEventDiscardSelfViolations(upstreamType, enrichment)` in `src/data/supplemental/schema.ts` (or the module that already joins upstream and supplemental data in `scripts/validate-card.ts`; read it first and use what is there).
- **Call** it from `scripts/validate-card.ts`, the data test that validates every pack, and the editor middleware (which then drops its inline copy).
- **Delete** the inline middleware block.

## File changes

| File                                                                                 | Change                          |
| ------------------------------------------------------------------------------------ | ------------------------------- |
| `src/data/supplemental/schema.ts` (or the join module)                               | New exported check              |
| `scripts/validate-card.ts`                                                           | Call it                         |
| `src/tools/editor/api-middleware.ts`                                                 | Use it; delete the inline block |
| Pack validation test (find with `rg -l "supplementalRegistry\|validate" tests/data`) | Assert no pack violates it      |

## Tests (write first)

1. Check returns a violation for an event with `cost.discardSelf: true`, none for an upgrade.
2. All shipped packs pass.
3. Editor API test (existing, `tests/tools` or `tests/ui`): saving such an event is still rejected with the same message.

## Open decisions

None.

## UI and Card Editor impact

Card Editor behaviour unchanged (same rejection message). `card:validate` now reports the violation.

## Commit

`refactor(data): Validate the Event discardSelf rule outside the editor` with `Refs AUD-20261017-232534 R3`.
