# `effectParams` Orphan Audit (core, core_encounter, cw_encounter)

> **Date:** 2026-10-04. **Scope:** every key used in `effectParams` and `gateParams` in the three supplemental packs, checked against what `src/engine/` actually reads. Read-only: no source or data was changed. **Trigger:** core review C1 (`maxBonus`), which showed that `effectParams` is `z.record(z.string(), z.any())` ([schema.ts:804](../../src/data/supplemental/schema.ts)), so the schema accepts any key.

## Method

1. Collected every `(effect, key)` pair from `effectParams` (including nested `PLAYER_CHOICE` option params) and from `gateParams`: **114 distinct `effectParams` pairs** and **9 `gateParams` pairs**.
2. Pass 1: does the key name appear anywhere in `src/engine/`? Pass 2: is it read through a params object (`params.key`, `effectParams?.key`, `stepParams.key`, destructuring) anywhere in `src/engine/`? Pass 3: is it read inside the implementation of its own effect (the `case` block in `effects/index.ts`)? Then every key that failed a pass was opened and read by hand.
3. Also checked each key against the editor registry (`effect-parameter-registry.ts`) and the supplemental specs.

Limits: a key can be read by a different effect than the one that declares it, and effects implemented in helpers outside their `case` block (for example `DISCARD`) show up in pass 3 as false positives; those were resolved by hand, not by the script. A key read anywhere is counted as honored only after I found the read.

## Result summary

| Class | Count | Meaning |
| :-- | --: | :-- |
| A. Never read by the engine | **4 keys, 4 cards** | Data says something the engine ignores. Each one is a functional bug on a real card. |
| B. Honored only by a hardcoded or hidden path | 9 keys | Works today, but is invisible to the schema, editor or spec, or silently defaulted. |
| C. Honored and documented | the rest of the 114 | No action. |
| `gateParams` | 9 of 9 read | Clean. |

## A. Never read by the engine (ignored)

| Key | Card | Printed text | Effect today |
| :-- | :-- | :-- | :-- |
| `REMOVE_THREAT.aerialAllSchemes` | Mark V Helmet `01037` | Remove 1 threat from a scheme (from **each** scheme instead if you have Aerial). | Zero references in `src/`. The Aerial bonus never applies; the card always removes 1 threat from one scheme. The spec (`05_effects_combat_threat.md`) and a UI test mention it as if it worked. Tracker item A4 called this only a "card-shaped param": it is also a **functional bug**. |
| `MODIFY_HAND_SIZE.maxHandSize`, `.applicableForm` | Iron Man `01029a` | +1 hand size per Tech upgrade you control (to a maximum hand size of 7). | Neither key is read. The printed cap of 7 is not enforced: `stat-calculator.ts` only clamps the result to 1..10 (L474). Documented in spec `06`. |
| `ADD_STATUS.bonusAttack` | Genetically Enhanced `01163` | Attach to the minion with the highest printed hit points (surge if none). Attached minion gets +3 hit points. | Key is not read, not in the spec, and `ADD_STATUS` without a status does nothing. The card's real text (attachment target, +3 HP, conditional surge) is not modelled; "+1 attack" appears nowhere on the card. |
| `ADD_THREAT.condition` (`"UNDEFENDED_ATTACK"`) | Kree Manipulator `01178` | Boost: if the villain is making an undefended attack, place 1 threat on the main scheme. | `UNDEFENDED_ATTACK` exists nowhere in `src/engine/` and is not a valid `StepCondition`. The boost places threat on **every** attack. |

## B. Honored through a hidden path, or decorative

| Key | Card(s) | Finding |
| :-- | :-- | :-- |
| `MODIFY_STAT.maxBonus` | Jessica Jones `01059` | Read in `stat-calculator.ts` with a hardcoded default of 4 (the C1 bug). Not in schema, registry or spec. |
| `scaling` + `multiplier` on `MODIFY_STAT`, `REMOVE_THREAT`, `ADD_COUNTERS`, `MODIFY_HAND_SIZE` | `01059`, `01023`, `01018`, `01029a` | Not read by the effect executors. They are consumed by pre-processing in `action-dispatcher.ts` (`PER_DISCARDED_CARD`, `PER_RESOURCE_SPENT`) and `stat-calculator.ts` (`PER_SIDE_SCHEME`, `PER_MATCHING_CARD`). Card-shaped pseudo-primitives that duplicate the generic dynamic amount formulas (ADR-0021 spirit). |
| `ATTACHMENT_DAMAGE_SHIELD.mode`, `.target` | Rhino attachment `01098` | The effect case is a no-op (`effects/index.ts` L3671); behavior is hardcoded in `damage-pipeline.ts`. `mode` and `target` are never read; only `maxAbsorb` is, with an undocumented alias `threshold` and a default of 5. |
| `TRANSFER_DAMAGE.from`, `.to` | Wakanda Forever! upgrade `01049` | Never read; the direction (your hero to an enemy) is hardcoded. |
| `target` on `PREVENT_DAMAGE`, `RETURN_TO_HAND`, `VILLAIN_ATTACKS` | `01003`, `01020`, `01078` | No read found in these effects' implementations; the target is implicit. Needs a per-effect review before calling it decorative. |
| `DEAL_DAMAGE.kickerResource`, `.overkillOnCondition`, `.overkillOnPhysical`; `GENERATE_RESOURCE.fromCard`; `REMOVE_THREAT.distinctFrom`; `ATTACH_TO_HOST.maxPerHost`; `DISCARD.matchingDestination` | `01053`, `01033`, `01012`, `01009`/`01074`, `01002` | Read and working, but missing from the spec, the editor registry, or both (10 pairs absent from the specs, 16 absent from the editor registry; list in the appendix). |

## Why this exists, and what it implies

- `effectParams` is the only untyped bag in the schema. `triggerFilter`, `cost`, and card attributes are strict, and ADR-0069 purged their orphans; nothing equivalent covered `effectParams`.
- Four cards are wrong today because a key is silently ignored. Three of them (`01037`, `01029a`, `01178`) carry `audit.confidence` 98 to 100, and `01163` has no confidence value at all.
- The spec sometimes documents a key the engine never implemented (`aerialAllSchemes`, `maxHandSize`, `applicableForm`, `condition`), so the docs gave false assurance.

## Tracking

Every recommendation below is a work package with a GitHub issue and acceptance criteria in [plan_effect_params_remediation.md](../backlog/plan_effect_params_remediation.md): WP1 #226 (Mark V Helmet), WP2 #227 (Iron Man hand size), WP3 #228 (Genetically Enhanced), WP4 #229 (Kree Manipulator), WP5 #230 (guard test), WP6 #231 (retire pseudo-primitives), WP7 #232 (documentation gaps).

## Recommendations

1. **Fix the four class A cards** as separate, planned items (one per card, per the card-integration protocol). Mark V Helmet becomes a Tier 2 item that supersedes tracker A4; Genetically Enhanced and Kree Manipulator are new defects not yet in the tracker.
2. **Add a guard** (a test, not a one-off script): per-effect allowed-key lists, or a typed `effectParams` schema per effect, so an unknown key fails `tests/data/supplemental-schema.test.ts`. This is the permanent fix for the whole class.
3. **Retire the pseudo-primitives** (`scaling`/`multiplier`/`maxBonus`) in favor of the generic dynamic amount formulas, once CONSTANT `MODIFY_STAT` can evaluate dynamic amounts.
4. **Fill the documentation gaps** in class B (spec and editor registry), and remove the undocumented `threshold` alias.

## Appendix: pairs missing from the editor registry (16)

`ADD_STATUS.bonusAttack`, `ADD_THREAT.cardCode`, `ADD_THREAT.condition`, `CHANGE_FORM.form`, `CHANGE_FORM.optional`, `DEAL_DAMAGE.kickerResource`, `DEAL_DAMAGE.overkillOnCondition`, `DEAL_DAMAGE.overkillOnPhysical`, `GENERATE_RESOURCE.fromCard`, `MODIFY_HAND_SIZE.applicableForm`, `MODIFY_HAND_SIZE.maxHandSize`, `MODIFY_STAT.atkBonus`, `MODIFY_STAT.maxBonus`, `MODIFY_STAT.thwBonus`, `REMOVE_THREAT.aerialAllSchemes`, `REMOVE_THREAT.distinctFrom`.
