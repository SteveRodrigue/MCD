# [ADR-0078] One Damage Pipeline and the Attack Label

- **Status:** Accepted (parts 1 to 3)
- **Date:** 2026-10-05
- **Deciders:** Owner & Claude
- **Related Issues:** #247 (Chase Them Down `01052`), #269 (enemy attack damage onto the same pipeline), #246 (player elimination)

---

## Context

Damage was applied by two parallel mechanisms. `applyDamageToTarget` (`damage-pipeline.ts`) implements the RR v1.8 damage steps (would be dealt, Tough, would be taken, placing damage, defeat, Retaliate) and was used by basic attacks and by `DEAL_DAMAGE` aimed at the villain. Every other `DEAL_DAMAGE` branch (all characters, the explosion assignment, heroes and identities, engaged and all enemies, a chosen minion) wrote damage by hand, each with its own idea of Tough, shields, Overkill, Retaliate and defeat. The visible failures:

- A minion or the villain defeated by an event fired no `DEFEATED` or `CHARACTER_DEFEATED`, so no Response could follow it (the blocker of #247).
- Damage shields and "would be taken" interrupts applied to some targets only.
- Eight places wrote `state.winner = 'VILLAIN'` directly, and the pipeline's own player branch never did.
- `DamageRequest.hasOverkill` was declared but unused; the chosen-minion branch had a private Overkill, Retaliate and excess-damage implementation.
- Three copies of the defeat dispatch existed (`damage-pipeline.ts`, `combat-pipeline.ts`, `action-dispatcher.ts`), none saying who defeated the character.

## Decision (part 1)

1. **`applyDamageToTarget` is the only way an ability or a player attack deals damage.** Every `DEAL_DAMAGE` branch builds its target list and calls the pipeline once per target; `dealDamageToIdentity` and `dealDamageToEnemies` are thin callers. The existing prompts (choose a player, explosion distribution) are unchanged.
2. **The pipeline owns the rules that were duplicated:**
   - **Overkill:** with `hasOverkill`, the excess over a defeated minion goes to the active villain through the pipeline (`sourceType: 'OVERKILL'`, no Retaliate), so the villain's Tough and shields apply.
   - **Excess and defeat:** `DamageResult` gains `excessDamage`; with `targetDefeated` it feeds the `EXCESS_DAMAGE_DEALT` and `TARGET_DEFEATED` step conditions.
   - **Hero defeat:** a player reduced to 0 sets `state.winner = 'VILLAIN'` in the pipeline, once. Elimination in multiplayer stays #246.
   - **DAMAGE_TAKEN window:** the pipeline opens it for a player target when the request asks (`dispatchDamageTaken`), after Tough and shields, so an interrupt can lower the damage. Only ability damage to heroes (identity selectors, `ALL_HEROES`) asks, as before; the pipeline had no equivalent dispatch, so there is exactly one.
3. **One defeat dispatch, `dispatchDefeat`**, replaces the three copies. It dispatches `DEFEATED` then `CHARACTER_DEFEATED` (or `SCHEME_DEFEATED`) and adds `defeatSource: { kind: 'HERO' | 'ALLY' | 'ENEMY' | 'EFFECT', playerId?, instanceId?, byAttack }` to the context. The pipeline derives it from the request: `sourceType` `HERO` gives `HERO`, `ALLY` gives `ALLY`, `VILLAIN` and `MINION` give `ENEMY`, `CARD_EFFECT`, `RETALIATE` and `OVERKILL` give `EFFECT`; `byAttack` is `isAttack`.
4. **Out of scope:** enemy attack damage to heroes and allies (`applyCalculatedAttackDamage` in `combat-pipeline.ts`, with its own Overkill spillover) stays as is and is issue #269. It only switches to `dispatchDefeat`, with `defeatSource` `{ kind: 'ENEMY', byAttack: true }`.

## Decision (part 2): the "(attack)" label

1. **Data.** `CardAbility.labels?: ('ATTACK' | 'THWART' | 'DEFENSE')[]`, matching the printed "(attack)", "(thwart)", "(defense)". Only `ATTACK` changes behaviour; `THWART` and `DEFENSE` are declared and documented as not yet read. The 13 core cards that print "(attack)" carry `labels: ["ATTACK"]` on the ability with that text.
2. **Engine.** RR v1.8 glossary L: "When a player resolves an ability labeled '(attack),' that ability is considered to be an attack made by that player's identity." `executeEffect` resolves a labelled ability with `isAttack: true` and `labelledAttack: true` in its context; `DEAL_DAMAGE` then sends `sourceType: 'HERO'` and `isAttack: true` to the pipeline, so `defeatSource` is `{ kind: 'HERO', playerId: the resolving player, byAttack: true }`, and Retaliate and attack-only shields apply again.
3. **One attack.** An ability labelled `ATTACK` is a single attack, even with several damage instances (RR glossary A). When it has fully resolved, `ATTACK_RESOLVED` is dispatched once, for the first enemy it damaged, with the same context as a basic attack. A target chosen from a prompt keeps all the ability's labels (the option carries the `labels` array unchanged), and a sequence that pauses for a prompt dispatches when its last step finishes.
4. **`TRANSFER_DAMAGE`** (Vibranium Suit `01049`) was found to move damage outside the pipeline at this point; part 3 moves it onto the pipeline.

## Decision (part 3): Responses to a defeat

1. **`TRANSFER_DAMAGE` joins the pipeline** (found while labelling Vibranium Suit `01049`): its enemy damage calls `applyDamageToTarget` like `DEAL_DAMAGE`, with the same attack handling (`isAttack`, `sourceType: 'HERO'` for a labelled ability). `dealDirectDamage` is removed. This closes the known gap of part 2: shields, Retaliate, defeat triggers and villain defeat now apply.
2. **Hand scan after a defeat**, in `dispatchTrigger`, through `scanHandReactions` (all eligible cards, first player first, as the threat window of #266): once per defeat, on `DEFEATED` for characters only, matching hand abilities on `DEFEATED` or `CHARACTER_DEFEATED`. No window-closing rule: a Response follows the event.
3. **`TriggerFilter`:** `targetType` gains `ENEMY` (villain or minion); `defeatedByAttackOf: 'YOUR_HERO' | 'THIS_CARD'` is evaluated against `context.defeatSource` (`YOUR_HERO`: `HERO`, `byAttack`, `playerId` is the responder; `THIS_CARD`: `byAttack`, `instanceId` is the ability's card).
4. **Data:** Chase Them Down `01052` (`zone: HAND`, `cost: { discardSelf: true }` as every in-hand event Response, `targetType: ENEMY`, `defeatedByAttackOf: YOUR_HERO`) and Tigra `01051` (`defeatedByAttackOf: THIS_CARD`, the half of #257 this covers).

## Consequences

- Any damage effect that defeats something now fires the defeat triggers, so Responses to a defeat become possible (hand scan and trigger filters come in later parts of #247).
- A damage effect that is not an attack no longer provokes Retaliate (it did before, through the hand-written chosen-minion branch). Until the "(attack)" label is modelled (part 2), abilities that are attacks by printed text (Uppercut and the other twelve cards) must set `isAttack` themselves.
- Allies and heroes hit by ability damage now fire `DEFEATED` as well as `CHARACTER_DEFEATED`, and a villain defeated by an event fires both, as every other defeat does.
- Damage shields and "would be taken" interrupts now apply uniformly to every `DEAL_DAMAGE` target.
- Chase Them Down is offered after your hero defeats an enemy by a basic attack or a labelled attack, and not after an ally, an unlabelled effect, or another player's hero. Tigra no longer heals when someone else defeats a minion.
- With the label, Uppercut and the other labelled attacks provoke Retaliate again, and "after your hero attacks" Responses also follow attack events, not only basic attacks.
