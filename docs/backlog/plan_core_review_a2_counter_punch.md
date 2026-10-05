# Plan: Core review A2, Counter-Punch `01077` (cost and "that enemy")

> **Status:** implemented 2026-10-04 (approved by the user; committed `647f435`). Shared helper option (b); hero-defender rule enforced via the new `triggerFilter.defenderType`.
> **Tier:** Part 1 is Tier 1 (data). Part 2 is Tier 2 (generic engine helper) with a refactor of three existing dispatcher paths, so I treat its blast radius as the upper end of Tier 2 and guard it with characterization tests. Tracker: [plan_core_player_cards_review.md](plan_core_player_cards_review.md).
> **UI / Card Editor impact:** none (no new parameter or effect name; the prompt reuses the existing optional-trigger prompt).

## 1. Printed text (upstream `core` 01077, event, Protection, cost **0**, trait Attack.)

> **Response** *(attack)*: After your hero defends against an enemy attack, deal damage to that enemy equal to your hero's ATK.

## 2. Original supplemental data (`core.json`, `01077`)

```json
{
  "id": "counter_punch_response",
  "timing": "RESPONSE",
  "trigger": "ATTACK_DEFENDED",
  "zone": "HAND",
  "cost": { "discardSelf": true, "resourceCost": 1 },
  "steps": [
    { "effect": "DEAL_DAMAGE",
      "effectParams": { "amount": { "from": "STAT_VALUE", "stat": "ATTACK" }, "target": "ENEMY" } }
  ]
}
```

## 3. Proposed supplemental data

```json
{
  "id": "counter_punch_response",
  "timing": "RESPONSE",
  "trigger": "ATTACK_DEFENDED",
  "zone": "HAND",
  "cost": { "discardSelf": true },
  "steps": [
    { "effect": "DEAL_DAMAGE",
      "effectParams": { "amount": { "from": "STAT_VALUE", "stat": "ATTACK" }, "target": "TRIGGERING_ENEMY" } }
  ]
}
```

`audit.updatedAt` and `reviewedAt` bumped; `audit.comment` untouched.

## 4. Why

- **Cost.** The card costs 0. HAND reactions pay `ability.cost` as the play cost and fall back to the printed cost only when `ability.cost` has no resource part (`trigger-dispatcher.ts`, the `extractResourceCost(...)` blocks). `resourceCost: 1` makes the card cost 1.
- **Target.** `ENEMY` is not "that enemy". `TRIGGERING_ENEMY` is the existing selector for "the enemy that caused the trigger event" (spec `03`, `target-resolver.ts` L855). It reads `context.targetInstanceId` and falls back to the active villain.

## 5. Engine finding (to be confirmed by the failing test before any engine edit)

Reading `trigger-dispatcher.ts`, the in-hand scans cover only `DAMAGE_WOULD_BE_TAKEN` (section 3), `THREAT_WOULD_BE_PLACED` (section 4) and `WHEN_REVEALED`/`TREACHERY_REVEALED` (section 5). I found no hand scan for `ATTACK_DEFENDED`, which `step7_resolvePostAttackAndRetaliate` does dispatch. If confirmed, Counter-Punch never fires from the hand in a real game, and the existing test only passes because it calls `executeEffect` directly. In addition, `ATTACK_DEFENDED` is dispatched with `sourceInstanceId: attackerCard?.instanceId` (undefined for a villain attacker) and no `targetInstanceId`.

## 6. Part 2 engine change (Tier 2, generic, no card names)

1. `combat-pipeline.ts` (both `ATTACK_DEFENDED` dispatches): add `targetInstanceId` = the attacking enemy's instance id (the attacking minion, or the attacking villain's instance id), keeping `sourceInstanceId` as is.
2. `trigger-dispatcher.ts` (decided: shared helper). Replace the three near-duplicate in-hand scans (damage section 3, threat section 4, encounter section 5) with one `scanHandReactions` helper, then use it for `ATTACK_DEFENDED` too. The helper owns what is common: find the eligible hand card (form gate, `canPayAbilityCost`, `matchesTriggerFilter`), run the forced/accepted path (pay cost, move to discard unless `discardSelf: false`, `executeEffect` with the forwarded context and trigger chain) or enqueue the optional-trigger prompt (cost suffix, `requiresPayment` only when the cost is above 0). Trigger-specific behaviour stays in small per-trigger callbacks passed to the helper: damage (prevention amount, incoming-damage prompt fields), threat (threat reduction, which scans every player), encounter (cancel the active encounter context). `ATTACK_DEFENDED` gets a callback that requires the hero (not an ally) to be the defender.
   - Safety net first: before moving any code, I run the existing suites that cover the three paths (Backflip, Get Behind Me!, Enhanced Spider-Sense, Emergency, Great Responsibility: `event-interception-and-binding`, `interrupt-replacement-effects`, `cancel-when-revealed`, `combat-damage-prevention-and-overkill`, `optional-triggers`, `combat-defense-pipeline`) and add characterization tests for any behaviour of the three paths that no test pins down (for example the prompt text and `requiresPayment` flag). The refactor must keep all of them green with no edits to existing assertions.
   - ADR: add a short ADR (or addendum to the trigger dispatch ADR) recording the shared hand-reaction helper.
3. The prompt path already forwards `optContext.targetInstanceId` (`prompt-queue.ts` L347+), so no change there.
4. Update the spec (`02_timings_and_triggers.md`, trigger table) to document `ATTACK_DEFENDED` hand reactions and its `targetInstanceId`.

## 6b. Documentation and Card Editor sync (applies to this item and as a standing rule for the rest of the tracker)

Rule: whenever the engine accepts something new in the supplemental schema (effect, parameter, target selector, trigger, timing, condition), the same change updates the schema (`schema.ts` and the generated `schema.json`), the spec under `docs/specifications/supplemental/`, and the Card Editor (`src/ui/components/editor/`, mainly `effect-parameter-registry.ts`), with a test.

For this item, I checked the editor: target selector dropdowns (`StepPipelineEditor.tsx`, `AbilityCostSection.tsx`, `DynamicValueBuilder.tsx`) are built from `TargetSelectorSchema.options`, and `TRIGGERING_ENEMY` is already in that enum. So this item adds **no new schema**, and no editor code change is expected. What I will still do:

1. `02_timings_and_triggers.md`: document that `ATTACK_DEFENDED` reactions from the hand are dispatched, that the dispatch context carries `targetInstanceId` (the attacking enemy), and the hero-defender requirement.
2. `03_costs_and_targeting.md`: expand the `TRIGGERING_ENEMY` row so it states which triggers populate `targetInstanceId` (now including `ATTACK_DEFENDED`) and the villain fallback.
3. `docs/visual-guides/04-combat-and-villain-phase.md`: update the post-defense step if it describes `ATTACK_DEFENDED`.
4. Editor check: add or run a test that loads `01077` into the editor's form model and confirms `TRIGGERING_ENEMY` and `zone: HAND` round-trip with no unknown-value warnings. If this shows the editor drops or mislabels either value, I fix the editor in this item.
5. Regenerate `schema.json` if the generator reports a diff, and run `tests/data/supplemental-schema.test.ts` plus the editor tests.

If during implementation I need any new schema (for example a `triggerFilter` field for the hero-defender check), the editor registry, the spec and `schema.json` are updated in the same step, not deferred.

## 6c. Addendum while implementing (new schema field, per your docs/editor rule; scan scope)

- **New `triggerFilter.defenderType: 'HERO' | 'ALLY'`** (`TriggerFilterSchema`). "Your hero defends" has no existing filter: `defenderType` is already in the trigger context but nothing evaluates it. `matchesTriggerFilter` compares it to `context.defenderType`; `combat-pipeline.ts` passes `defenderType` on both `ATTACK_DEFENDED` dispatches. Counter-Punch becomes `triggerFilter: { "defenderType": "HERO", "targetPlayerScope": "SELF" }`. Same step updates: `schema.json` via `npm run schema:generate`, the filter table in `02_timings_and_triggers.md`, a `defenderType` select in `TriggerFilterSection.tsx`, tests (`trigger-filter-contract`, `TriggerFilterSection`, schema test).
- **Scan scope** (your note: co-op, many reactions apply to all players): the helper takes the scope per trigger. `THREAT_WOULD_BE_PLACED` and `ATTACK_DEFENDED` scan every player (the card's own filter decides who may react: for Counter-Punch `targetPlayerScope: SELF` means only the defending hero's controller). `DAMAGE_WOULD_BE_TAKEN` and encounter reveals stay on the targeted player, because their cards ("you") carry no filter and scanning every player would let another player's Backflip prevent my damage.
- **Behaviour differences found between the three old paths** (to be unified, rule-correct): the damage and threat accepted paths never paid the ability cost and the damage path only ran effects containing `PREVENT_DAMAGE`; the encounter path pays the cost and runs all effects. The helper pays the cost and runs the effect in all paths. Any existing test that breaks because of this is reported before I touch it.

## 7. Tests (TDD, each written first and seen failing)

In `tests/engine/resolution-stack-and-prompt-queue.test.ts` (or a new `tests/engine/counter-punch.test.ts`), through the real `dispatchTrigger` / combat pipeline:

1. Hand holds only Counter-Punch; hero defends a **villain** attack with `acceptOptionalTriggers: true`: villain takes ATK damage, card is in the discard, hand empty (fails today on cost, and on missing hand scan).
2. Hero defends a **minion** attack: the minion takes ATK damage, the villain takes none.
3. With extra cards in hand, only Counter-Punch leaves the hand (no resource card is discarded as payment).
4. Without `acceptOptionalTriggers`, a prompt is enqueued with no payment required, and accepting it deals the damage to the attacker.
5. Undefended attack or ally-defended attack: no Counter-Punch (it requires "your hero defends"). Current dispatch also fires `ATTACK_DEFENDED` for an ally defender, so this test decides whether a `triggerFilter` or form check is needed; I will report before changing it.

Existing tests keep passing. Nothing is skipped.

## 8. Files

`src/data/supplemental/pack/core.json` (`01077` only, textual edit), `src/engine/pipeline/combat-pipeline.ts`, `src/engine/triggers/trigger-dispatcher.ts`, the spec file above, tests, `CHANGELOG.md` `[Unreleased]`, the tracker, `teamwork_status_and_next_target.md`, and the regenerated declarations report.

## 9. Decisions

1. Hand-scan approach: **(b) shared helper**, decided by you.
2. Hero-defender rule: **enforced literally** ("your hero defends"); an ally defending does not enable Counter-Punch. Decided by you.

## 10. Open question

The shared helper changes dispatcher internals for three other cards' reactions. If the characterization tests show any of the three paths behaves differently from each other in a way that is not a bug (for example the threat path scanning all players while the others scan one), I keep that difference as an explicit helper option rather than unify it. I will list any such difference in the review recap.
