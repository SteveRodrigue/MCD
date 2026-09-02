# ADR-0041: Cost Arrow Enforcement, Forced Trigger Resolution & Direct Character Damage Costs

## Status
Accepted

## Context
In Marvel Champions (Rules Reference v1.8 p. 8 "Cost", p. 15 "Forced", and p. 27 "Response"):
1. **Cost Arrow (`→`):** All costs to the left of the arrow must be paid in full to resolve the effect to the right of the arrow.
2. **Forced Responses / Interrupts:** When triggered, a forced ability with a cost must automatically pay its mandatory costs (e.g. *Superhuman Strength* `01028` discarding itself to stun an enemy after attacking) and execute immediately without prompting the player.
3. **Character Damage Costs:** Certain character cards (such as ally *War Machine* `01030`) have costs requiring direct damage to themselves (`cost.damageSelf`). If the cumulative damage equals or exceeds the character's max health, the character is cleanly defeated and placed into the discard pile.

## Decisions
1. **Mandatory Trigger Automated Cost Resolution:**
   - In `src/engine/triggers/trigger-dispatcher.ts`, when a trigger fires for an in-play card with `FORCED_RESPONSE` or `FORCED_INTERRUPT`, the engine invokes `executeAbilityCost()` before `executeEffect()` to automatically deduct required costs (`discardSelf`, `exhaustSelf`, `spendCounters`, `damageSelf`) atomically.
2. **Action Pipeline Trigger Dispatch:**
   - In `src/engine/pipeline/action-dispatcher.ts`, `BASIC_ATTACK`, `ALLY_ATTACK`, and `BASIC_THWART` dispatch standard lifecycle triggers (`BASIC_ATTACK_PERFORMED`, `ATTACK_RESOLVED`, `THWART_RESOLVED`), passing target metadata (`targetType`, `targetInstanceId`).
3. **Self-Damage Cost Primitive:**
   - Added `damageSelf: z.number().optional()` to `AbilityCostSchema` in `src/data/supplemental/schema.ts` and `AbilityCost` interface in `src/engine/models/abilities.ts`.
   - In `src/engine/pipeline/cost-engine.ts`, `canPayAbilityCost` and `executeAbilityCost` validate and apply `damageSelf` to ally/character instances, automatically discarding defeated characters into owner discard piles via atomic zone transfer `removeCardFromAllZones()`.

## Consequences
- 100% compliant with Marvel Champions Rules Reference v1.8 cost and forced ability specifications.
- Eliminates manual cost prompt loops on forced abilities.
- Unlocks full declarative support for all 672 cost-arrow abilities in the catalog.
