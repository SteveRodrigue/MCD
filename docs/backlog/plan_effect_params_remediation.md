# `effectParams` Remediation: Work Packages (living tracker)

> **Purpose:** one place to hand any work package below to another agent or developer. Each package is self-contained: problem, evidence, fix direction, acceptance criteria, dependencies, and the docs to update. Update the **Status** column here when a package is planned, approved, implemented or committed.
> **Evidence:** [effect_params_orphan_audit.md](../reports/effect_params_orphan_audit.md) (2026-10-04, read-only audit of all `effectParams` and `gateParams` keys in `core`, `core_encounter`, `cw_encounter`).
> **Root cause:** `AbilityStepSchema.effectParams` is `z.record(z.string(), z.any())` ([schema.ts:804](../../src/data/supplemental/schema.ts)), so any key validates. Four real cards ship keys the engine never reads; the specs documented some of them as implemented.

## Status

Order approved by the user on 2026-10-04. Order matters: fix the cards first, then add the guard that forbids the whole class, then clean up.

| Order | Package | Item | GitHub | Tier | Depends on | Status |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| 1 | **C1** | Jessica Jones `01059` invented `maxBonus` cap (engine default 4 too) | _(tracker item, no issue)_ | 1 | none | **Done 2026-10-04 (uncommitted):** [plan](plan_core_review_c1_jessica_jones.md) |
| 2 | **WP1** | Mark V Helmet `01037` `aerialAllSchemes` ignored (supersedes review item A4) | [#226](https://github.com/SteveRodrigue/MCD/issues/226) | 2 | none | **Done 2026-10-04 (uncommitted):** [plan](plan_core_review_wp1_mark_v_helmet.md) |
| 3 | **WP2** | Iron Man `01029a` hand size cap 7 never enforced | [#227](https://github.com/SteveRodrigue/MCD/issues/227) | 1-2 | none | **Done 2026-10-04 (`2a3aeb2`):** [plan](plan_core_review_wp2_iron_man_hand_size.md) |
| 4 | **WP4** | Kree Manipulator `01178` undefended-attack boost condition never evaluated | [#229](https://github.com/SteveRodrigue/MCD/issues/229) | 2 | none | **Done 2026-10-04 (`b2ab514`):** [plan](plan_core_review_wp4_kree_manipulator.md) |
| 4b | **WP8** | Electric Whip Attack `01173`: invented +1 ATTACK, wrong boost filter, no undefended gate, When Revealed choice unmodelled | [#241](https://github.com/SteveRodrigue/MCD/issues/241) | 2-3 | WP4 (undefended condition); When Revealed needs #222 | **Done 2026-10-04:** boost in `b2ab514`, When Revealed with #222 (uncommitted), [plan](plan_core_review_wp8_electric_whip_attack.md) |
| 4c | _(found in #222)_ | False Alarm `01112`: "if you are already confused, this card gains surge" not modelled | [#242](https://github.com/SteveRodrigue/MCD/issues/242) | 1 | none (uses the `SURGE` effect) | Not started |
| 5 | **WP3** | Genetically Enhanced `01163` invented key, printed text unmodelled | [#228](https://github.com/SteveRodrigue/MCD/issues/228) | 3 | #209, #218 | Not started |
| 6 | **WP5** | Guard: unknown `effectParams` key fails the data test | [#230](https://github.com/SteveRodrigue/MCD/issues/230) | 2 | C1, WP1-WP4 | Not started |
| 7 | **WP6** | Retire `scaling`/`multiplier`/`maxBonus` pseudo-primitives | [#231](https://github.com/SteveRodrigue/MCD/issues/231) | 2 | C1, WP2 | Not started |
| 8 | **WP7** | Close documentation gaps, remove decorative keys (audit class B) | [#232](https://github.com/SteveRodrigue/MCD/issues/232) | 1-2 | WP5 (guard must pass without exceptions) | Not started |

WP1, WP2 and WP4 are independent and can run in parallel by different agents. WP3 is likely blocked on #209 and #218; if so, apply the circuit-breaker (strip the placeholder ability, write an ambiguity report) and move on. WP5 must land after WP1-WP4 so it passes with zero exemptions (no skipped tests, no baseline list that hides known orphans). WP6 and WP7 can run in parallel after WP5.

## Rules every package follows (from `AGENTS.md`)

- **Plan first.** Write `docs/backlog/plan_<topic>.md` (printed text, original data, proposed data, why, tests, files, open decisions) and stop for approval before any change to `src/`, `tests/`, supplemental data or config. Card work follows the `card-integration-protocol` skill.
- **TDD:** a failing test first, never skipped or todo tests. Read cards literally ("your hero" is never the alter-ego). Never add or edit `audit.comment`.
- **Schema change rule:** any new or renamed supplemental key, effect, condition, filter or trigger is added in the same change to `schema.ts`, the regenerated `schema.json` (`npm run schema:generate`), the specs in `docs/specifications/supplemental/`, the Card Editor (`src/ui/components/editor/`, mainly `effect-parameter-registry.ts`), and a test.
- `src/engine/` stays headless; card behavior stays declarative in `src/data/supplemental/`; engine primitives are generic with no card names (ADR-0021).
- **Gates before reporting:** `npm test`, `npm run typecheck`, `npm run lint`, `npx prettier --check "src/**/*.{ts,tsx}" "tests/**/*.{ts,tsx}"`; `npm run report:declarations` after supplemental changes. Update `CHANGELOG.md` `[Unreleased]`, this table, and the core review tracker.
- Commit and push only on explicit request; Conventional Commits with `Fixes #N` where an issue exists.

## Work packages

### C1: Jessica Jones `01059`

Printed: *Jessica Jones gets +1 THW for each side scheme in play.* Data has `maxBonus: 4`; `stat-calculator.ts` L102 also defaults to 4. Fix: remove the key from data and delete the cap read; tests for 5 and 7 side schemes. Full plan: [plan_core_review_c1_jessica_jones.md](plan_core_review_c1_jessica_jones.md).

### WP1: Mark V Helmet `01037` ([#226](https://github.com/SteveRodrigue/MCD/issues/226))

- **Printed:** *Hero Action: Exhaust Mark V Helmet -> remove 1 threat from a scheme (from each scheme instead if you have Aerial).*
- **Data today:** `REMOVE_THREAT` with `{ amount: 1, aerialAllSchemes: true, target: CHOSEN_SCHEME }`.
- **Evidence:** zero references to `aerialAllSchemes` in `src/`. The card always removes 1 threat from one chosen scheme. Spec `05_effects_combat_threat.md` and `tests/ui/StepPipelineEditor.test.tsx` mention the key.
- **Fix direction:** two gated steps: `REMOVE_THREAT` on `CHOSEN_SCHEME` (no Aerial) and `REMOVE_THREAT` on `ALL_SCHEMES` (Aerial), gated by a player-trait check (same pattern as Crisis Interdiction `01012`, which uses `IF_CONDITION_MET` with a `trait`). Respect Crisis and Patrol rules when removing from the main scheme.
- **Acceptance:** with Aerial, one action removes 1 threat from every scheme; without Aerial, one chosen scheme; no `aerialAllSchemes` left in `src/`, specs or tests; regression tests for both cases and for Crisis/Patrol interaction. Also resolves review item A4.

### WP2: Iron Man `01029a` ([#227](https://github.com/SteveRodrigue/MCD/issues/227)), done 2026-10-04 (plan: [plan_core_review_wp2_iron_man_hand_size.md](plan_core_review_wp2_iron_man_hand_size.md))

- **Printed:** *You get +1 hand size for each Tech upgrade you control (to a maximum hand size of 7).*
- **Data today:** `MODIFY_HAND_SIZE` with `{ scaling: PER_MATCHING_CARD, filter: {types: [upgrade], traits: [Tech]}, multiplier: 1, maxHandSize: 7, applicableForm: hero }`.
- **Evidence:** `maxHandSize` and `applicableForm` are not read. `getEffectiveHandSize` (`stat-calculator.ts` ~L474) only clamps to 1..10, so the printed cap of 7 is not enforced. Spec `06_effects_zones_cards.md` documents both keys as if implemented.
- **Fix direction:** a generic, declarative cap on the effective hand size (no card name); decide whether `applicableForm` is still needed (the card sits on the hero side) or is removed from data and spec.
- **Acceptance:** boundary tests (base + bonus = 7, 8, 10) never exceed 7 for Iron Man; other heroes unaffected; spec, schema and editor registry match the final parameter names.

### WP4: Kree Manipulator `01178` ([#229](https://github.com/SteveRodrigue/MCD/issues/229))

- **Printed boost:** *If the villain is making an undefended attack, place 1 threat on the main scheme.* (When Revealed: place 1 threat on the main scheme; Surge.)
- **Data today:** boost `ADD_THREAT` with `effectParams.condition: "UNDEFENDED_ATTACK"`.
- **Evidence:** the literal exists nowhere in `src/engine/` and is not in the `StepConditionSchema` enum. The boost adds threat on every attack. Spec lists `condition` for `ADD_THREAT`.
- **Fix direction:** one real, schema-validated condition evaluated from the attack context (a new `StepCondition`, or a gate over the attack's defender), generic enough for other "undefended" boost cards; audit the other core encounter boosts that mention undefended or defended attacks.
- **Acceptance:** threat only when undefended; tests for undefended, hero-defended and ally-defended; schema, spec, editor registry updated together.

### WP8: Electric Whip Attack `01173` ([#241](https://github.com/SteveRodrigue/MCD/issues/241))

- **Printed:** *When Revealed: Choose to either deal 1 damage to your hero for each upgrade you control or choose and discard an upgrade you control.* / *[star] Boost: If the villain is making an undefended attack, choose and discard an upgrade you control.*
- **Data today:** an invented `CONSTANT MODIFY_STAT ATTACK +1`; a boost `DISCARD` filtered to `upgrade` **and** `support`; no undefended condition; no When Revealed ability.
- **Found by:** reading the data next to the printed text while planning WP4. The key audit cannot detect this class of error.
- **Fix direction:** reuse WP4's `UNDEFENDED_ATTACK` condition for the boost, correct the filter, remove the invented ability, model the When Revealed `PLAYER_CHOICE` (damage per upgrade via `ENTITY_COUNT`, or a chosen upgrade discard); circuit-breaker with an ambiguity report if an engine primitive is missing.
- **Acceptance:** every printed clause modelled or explicitly stripped; tests for undefended villain, defended and minion attacks, and both When Revealed options.

### WP3: Genetically Enhanced `01163` ([#228](https://github.com/SteveRodrigue/MCD/issues/228))

- **Printed:** *Attach to the minion with the highest printed hit points. If there are no minions in play, this card gains surge. Attached minion gets +3 hit points.*
- **Data today:** one CONSTANT `ADD_STATUS` with `{ bonusAttack: 1 }`: invented key, no-op effect, text unmodelled, no `audit.confidence`.
- **Blockers:** conditional attachment host selection (#209) and Surge (#218); tie-breaking for "highest printed hit points" needs a rules lookup (`npm run rule -- attach`) and your decision.
- **Acceptance:** either a faithful declarative model with tests, or (until the blockers land) the ability stripped, an ambiguity report in `docs/ambiguities/core_encounter_01163_*.md`, and an `audit` block explaining it. No invented keys.

### WP5: Guard against unknown `effectParams` keys ([#230](https://github.com/SteveRodrigue/MCD/issues/230))

- **Goal:** adding a key that the engine does not read, for an effect that does not list it, fails `tests/data/supplemental-schema.test.ts`.
- **Partly delivered with #222:** the `target` key slice (every `target` string in the packs is a valid `TargetSelector`, enforced by a data test with zero exemptions). Remaining: all other `effectParams` keys.
- **Direction:** per-effect allowed-key table or typed per-effect `effectParams` schemas, ideally one source of truth shared with the editor registry and a spec check. Capture the audit's "read through a params object" check as a repeatable script under `tools/audit/`.
- **Acceptance:** fails on a fabricated unknown key; passes on all packs with **zero exemptions**; record the decision in an ADR or an ADR addendum.

### WP6: Retire `scaling` / `multiplier` / `maxBonus` ([#231](https://github.com/SteveRodrigue/MCD/issues/231))

- **Progress:** the `MODIFY_HAND_SIZE` / `PER_MATCHING_CARD` pseudo-primitive was retired in WP2 (Iron Man now uses a dynamic `amount`). Remaining: `PER_SIDE_SCHEME` (Jessica Jones), `PER_DISCARDED_CARD` (Legal Practice), `PER_RESOURCE_SPENT` (Energy Channel).

- **Problem:** card-shaped pseudo-primitives pre-processed in `action-dispatcher.ts` (`PER_DISCARDED_CARD`, `PER_RESOURCE_SPENT`) and `stat-calculator.ts` (`PER_SIDE_SCHEME`, `PER_MATCHING_CARD`), duplicating generic dynamic amounts (`ENTITY_COUNT` etc.). Cards: `01059`, `01023`, `01018`, `01029a`.
- **Direction:** let CONSTANT `MODIFY_STAT` and `MODIFY_HAND_SIZE` evaluate dynamic `amount` formulas, migrate the four cards, delete the pseudo-primitives from engine, spec and editor registry.
- **Acceptance:** no `scaling`/`multiplier`/`maxBonus` read in `src/engine/`; existing behavior tests for the four cards pass unchanged.

### WP7: Documentation gaps and decorative keys ([#232](https://github.com/SteveRodrigue/MCD/issues/232))

**Added from the #222 selector survey:** (a) the engine-only selector strings `HERO` (`DEAL_DAMAGE`, resolver), `IDENTITY` (resolver, formula evaluator; the narrow `SELF | IDENTITY` counter-param enum is legitimate and stays) and `ALTER_EGO` (resolver candidates) are not in `TargetSelectorSchema` and no pack uses them: replace by a schema selector or delete; (b) `TRIGGERING_HERO` is documented as "the hero that triggered the event" but implemented as the resolving player's hero (overlaps `SELF_HERO`): implement its documented meaning or remove it; (c) `ATTACHED_VILLAIN` on Charge `01098` is removed in #222 (decorative); `ATTACHMENT_DAMAGE_SHIELD.mode` stays here.

Audit class B. Document and add to the registry the honored-but-missing keys; remove the keys the engine never reads (`TRANSFER_DAMAGE.from/to`, `ATTACHMENT_DAMAGE_SHIELD.mode/target`, and after a per-effect review the `target` on `PREVENT_DAMAGE`, `RETURN_TO_HAND`, `VILLAIN_ATTACKS`); remove the undocumented `threshold` alias for `maxAbsorb` in `damage-pipeline.ts`. Full key list: the audit report and issue #232.

## Handoff notes for the next agent

1. Read `AGENTS.md`, then this file, then the audit report, then the issue for your package.
2. Reproduce the audit quickly: for a key `K` of effect `E`, search `src/engine/` for reads through a params object (`params.K`, `effectParams?.K`, `stepParams.K`, destructuring) and open the effect's implementation in `src/engine/effects/index.ts` (some effects delegate to helpers, for example `DISCARD`; `ATTACHMENT_DAMAGE_SHIELD` is a no-op case whose logic is in `damage-pipeline.ts`).
3. Pick the first package whose dependencies are done (see the Status table), write its plan, and stop for approval.
