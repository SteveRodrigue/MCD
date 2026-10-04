# Plan: Issue #131 — Rocket Boots (01039) never grants Aerial (review item A3)

> Status: **Implemented (uncommitted)**, 2026-10-04. Tests: 13 across 3 files, full suite green.
> Roadmap: `teamwork_status_and_next_target.md`, Phase 5, Track A, step 3. Tracker: `plan_core_player_cards_review.md` item A3.
> Tier 2 (new generic engine mechanism). UI / Card Editor impact: yes, one new `duration` parameter on `ADD_TRAIT` in the editor registry; no board UI change (timed traits flow through the existing dynamic-trait pills).

## 1. Card (4-point review)

1. **Printed text (`core`, Iron Man upgrade):** "You get +1 hit point. **Hero Action**: Exhaust Rocket Boots and spend a [mental] resource → gain the [[Aerial]] trait until the end of the phase."
2. **Original data** (`src/data/supplemental/pack/core.json`, `01039`): `rocket_boots_hp` (CONSTANT, `MODIFY_MAX_HEALTH +1`) and `rocket_boots_aerial` (`HERO_ACTION`, cost exhaust + `mental`, step `ADD_TRAIT { target: "SELF", trait: "Aerial" }`).
3. **Proposed data:** the same, with the `ADD_TRAIT` step changed to `{ "trait": "Aerial", "target": "SELF_IDENTITY", "duration": "PHASE" }`.
4. **Why:** (a) `ADD_TRAIT` is only evaluated for CONSTANT abilities, so the action pays its cost and grants nothing; (b) `SELF` is the host card, but the printed text says the **hero** ("you") gains the trait; (c) the printed duration "until the end of the phase" has no representation.

## 2. Verified state (tests in `tests/engine/rocket-boots.test.ts`)

| Behavior | Today |
|---|---|
| +1 hit point while in play | works (green) |
| Hero Action cost: exhausts the boots, spends a mental resource, fails without payment | works (green) |
| Action grants Aerial | **missing** (red: traits stay `['Avenger','Genius']`) |
| Aerial ends at the end of the phase | **red** (never granted) |
| Repeated use does not duplicate the trait | **red** (never granted) |

Aerial matters because other core cards check the trait (for example Mark V Helmet `01037` and Powered Gauntlets `01038` print "if you have the Aerial trait" clauses).

## 3. Duration audit and default (decision 2, resolved)

**Your ruling:** `ADD_TRAIT` lasts while the source card stays in play unless the supplemental data states a duration.

**Audit** (all 67 cards in every upstream pack whose text says `gain(s) the [[X]] trait`; a looser search for any trait wording found 209, mostly conditionals such as "if you have the Aerial trait"):

| Kind | Count | Printed duration | What it needs |
|---|---|---|---|
| Passive/constant or attached ("X gains the Aerial trait", Cosmic Flight, Jet Boots, Storm's Cape, attachments, ...) | 62 | none: lasts while the card is in play | already the CONSTANT path |
| Triggered (Hero Action) that grants a trait | **5** (Rocket Boots `01039`, Fury's Flying Car `50040`, Silk's Organic Webbing `52009`, Spider-Ham's Organic Webbing `30011`, Daredevil's Billy Club `60017`) | **all five print "until the end of the phase/round"** | an explicit `duration` |
| Triggered grant with **no** printed duration | **0** | n/a | nothing in the data contradicts your default |

So the default never collides with a printed card: it covers the passive family (already implemented), and every action-granted trait in the game states its own duration. The audit did not turn up a counter-example.

**Pros of your default (source-bound unless a duration is given)**
- One consistent meaning: a trait lasts as long as the card that grants it, matching the existing spec wording for `ADD_TRAIT` ("as long as the source card remains in play") and the CONSTANT behavior.
- No required parameter in the common case; less boilerplate; no hard failure path in the executor.
- Matches the literal reading of the Rules Reference, which has no "default permanent" rule for lasting effects (a glossary search for duration/lasting/default found none).

**Cons and how they are handled**
- A forgotten `duration` on a phase-limited card would silently grant the trait for as long as the card stays in play (for Rocket Boots: Aerial forever). Mitigation: a data test that fails when a non-CONSTANT `ADD_TRAIT`'s `audit.originalText` says "until ..." but the step declares no `duration` (it flags all five cards above if any is wrong).
- "While the source is in play" for a triggered effect needs a source binding (`sourceInstanceId`) and an in-play check at calculation time, which CONSTANT effects get for free. Handled by evaluating the check dynamically (no cleanup when the source leaves), at the cost of a small lookup per trait read.
- It is slightly less explicit than a required parameter; the guard test above restores the explicitness where the printed text demands it.

**Recommendation:** adopt your default plus the guard test. It is cheap, matches the data, and keeps authoring errors loud where they matter.

## 4. Design (generic, no card-specific names, ADR-0018/0021)

- **State:** `PlayerState.activeTraitModifiers?: { trait: string; duration?: Duration; sourceInstanceId?: string; sourceCardName?: string; sourceCardCode?: string }[]`, mirroring `activeStatModifiers` (`models/state.ts:80`). `duration` absent means "while the source card is in play".
- **Executor:** `ADD_TRAIT` handled as an effect step (new `case` in `effects/index.ts`) when the ability is not CONSTANT: pushes a modifier on the resolving player (`SELF_IDENTITY`) with the step's `duration` (if any) and the source card's `instanceId`.
- **Calculation:** `getEffectivePlayerTraitsDetails` (`stat-calculator.ts`) adds a modifier's trait to `dynamicTraits` when it has a `duration` (expiry removes it) or its source is still in play (reuse `findInPlayCardInstance` from `action-dispatcher.ts`, extracted to a neutral module if importing the dispatcher would be circular). `dedupeTraits` already removes duplicates.
- **Expiry:** wherever `PHASE`/`ROUND` stat modifiers are cleared today (`player-phase.ts` start and end, `villain-phase.ts:~769`, `round-upkeep.ts:~44`), clear matching trait modifiers with the same inline filter, following the surrounding code. Source-bound modifiers need no expiry step.
- **Out of scope:** traits granted to allies/enemies by action (none exist in supplemental data; the only `ADD_TRAIT` users are `01017` constant and this card).

## 5. Files

| Tag | File | Change |
|---|---|---|
| MODIFY | `src/engine/models/state.ts` | `ActiveTraitModifier`, `PlayerState.activeTraitModifiers` |
| MODIFY | `src/engine/effects/index.ts` | `ADD_TRAIT` action executor |
| MODIFY | `src/engine/pipeline/stat-calculator.ts` | include timed traits |
| MODIFY | `player-phase.ts`, `villain-phase.ts`, `round-upkeep.ts` | expiry |
| MODIFY | `src/data/supplemental/pack/core.json` | `01039` step params; audit stamp (`updatedAt`/`reviewedAt`); `audit.comment` untouched |
| MODIFY | `src/ui/components/editor/effect-parameter-registry.ts` | `duration` param on `ADD_TRAIT` |
| MODIFY | `docs/specifications/supplemental/07_effects_status_economy.md` | `duration`, timed traits, action use |
| NEW | `tests/engine/rocket-boots.test.ts` | 5 tests (3 red now) plus source-bound default tests |
| NEW | `tests/data/add-trait-duration.test.ts` | guard: printed "until ..." requires a `duration` |
| MODIFY | `CHANGELOG.md`, backlog and tracker docs | status; regenerate the declarations report |

## 6. TDD

1. **Red (done):** 3 failing tests above.
2. **Green:** model, executor, calculator, expiry, data.
3. **Extra tests:** expiry at villain-phase end and round end for `ROUND`; a non-CONSTANT `ADD_TRAIT` without `duration` lasts while its source is in play and disappears when the source leaves play; the data guard test; Cosmic Flight (CONSTANT) unchanged (existing `conditional-trait-gating.test.ts`).
4. **Verification:** full suite (baseline 1,688), `tests/data/supplemental-schema.test.ts`, `typecheck`, `lint`, `format:check`, `report:declarations`.

## 7. Decisions (resolved)

1. **Storage:** players only, mirroring `activeStatModifiers`. *Approved.*
2. **Default duration:** while the source card is in play unless the data states one; guard test for printed "until ...". *Approved (your ruling), audit and pros/cons above.*
3. **Target:** `SELF` to `SELF_IDENTITY`. *Approved.*
4. **Expiry code:** inline at the four existing sites. *Approved.*

## 8. Estimate

About 2 hours: 45 min engine, 30 min data/editor/spec, 45 min tests and verification. One commit: `fix(engine): Grant Aerial for the phase from Rocket Boots via timed trait modifiers (Fixes #131)`.
