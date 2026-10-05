# Plan: #234, triggered abilities with a `CHOSEN_*` target never let the player choose

> **Status:** implemented 2026-10-05, not committed yet (approved with decision 3 = (a): #234 without Hulk `01050`, then resumable sequences next to finish Hulk). **Correction:** the plan first named that follow-up #225, but #225 is "executeSequence swallows step failures"; the pause-on-prompt problem is filed as [#248](https://github.com/SteveRodrigue/MCD/issues/248). Tier 3 by blast radius (effect-context contract refactor across the engine, then a generic fix). One card data change approved by the owner during implementation (Superhuman Strength `01028`, see 6b); no schema change. Triage outcome: **current-milestone priority** (core set player cards misplay in Gate 1 games). Closes #234 (`Fixes #234`); #235, #236 and #239 are already closed as its duplicates.
> **UI / Card Editor impact:** none expected. The new prompt is an ordinary decision prompt; `DecisionPromptModal` already renders options with a `cardCode`. No schema or editor change.

## 1. The bug, card by card

| Card | Printed text | What happens today |
| :-- | :-- | :-- |
| Daredevil `01058` (ally) | *Response: After Daredevil thwarts, deal 1 damage to an enemy.* | No choice. The 1 damage always goes to the villain (#234, #239). |
| Interrogation Room `01063` (support) | *Response: After you defeat a minion, exhaust Interrogation Room → remove 1 threat from a scheme.* | No choice of scheme (#235). |
| Mockingbird `01083` (ally) | *Response: After Mockingbird enters play, stun an enemy.* | No choice. Stuns the first minion engaged with you, else the villain (#236). |
| She-Hulk `01019a` (hero) | *Response: After you change to this form, deal 2 damage to an enemy.* | Same pattern, not reported: the damage always goes to the villain. |
| Chase Them Down `01052` (event, from hand) | *Response (thwart): After your hero attacks and defeats an enemy, remove 2 threat from a scheme.* | Same pattern, not reported; the test decides the exact symptom. |

The card data is correct for all five (`CHOSEN_ENEMY`, `CHOSEN_SCHEME`). The defect is in the engine, so this is not a data fix.

## 2. Root cause (two parts)

**R1. The event's subject leaks into the "chosen target" slot.**
`EffectContext.targetInstanceId` / `targetType` mean "the target the player chose" for player actions (the UI picks it before dispatch). The trigger paths fill the same fields with the **event's subject**:

- optional abilities, on "Yes": `src/engine/pipeline/prompt-queue.ts` L374-378;
- forced abilities on in-play cards: `src/engine/triggers/trigger-dispatcher.ts` L742-746 (same pattern in the identity and hand-reaction paths).

So for Daredevil the "chosen" target is the scheme that was thwarted; for Interrogation Room, the minion that was defeated. `REMOVE_THREAT` only opens its "Choose a Scheme" prompt when `context.targetInstanceId` is empty (`effects/index.ts` L3042), so the leak suppresses it.

**R2. Enemy targets have no choice step at all.**
`DEAL_DAMAGE` falls through to "default: deal damage to the villain" (`effects/index.ts` L2279); `ADD_STATUS` resolves `CHOSEN_ENEMY` through the resolver fallback (first minion engaged with you, else the villain, `target-resolver.ts` L656-705). Only `REMOVE_THREAT` with `CHOSEN_SCHEME` has its own prompt.

**Rules (RR v1.8 *Target*, `references/rules/glossary/T.md#target`):**

- "an enemy", "a scheme" are targets ("Examples of targets include … 'an enemy,' 'a scheme'").
- "If an ability … requires one or more targets, that ability … can only be initiated if it has at least one valid target."
- "A target is valid for an ability … if any part of that ability can affect that target." So an already stunned enemy is not a valid target for Mockingbird's stun, and a scheme with no removable threat (none on it, or blocked by a crisis icon) is not a valid target for "remove threat". Damage that would be prevented still counts as affecting the target (Tough does not make an enemy invalid).
- "The cost of an ability … is not considered when determining if that ability … can affect a target."

## 3. Proposed fix (generic, no card names, no legacy left behind)

Owner decisions (2026-10-05): **two prompts** (the Response's own trigger can start a chain that changes the board, so the target list must be built when the target prompt opens, never merged into "Do you want to use…"); **refactor now** (no narrow rule, no alias, no fallback kept "for compatibility").

### 3.1 Commit 1, `refactor(engine)`: split the effect context (no behaviour change)

`EffectExecutionContext` (`effects/index.ts` L97) loses `targetInstanceId` and `targetType`. They are replaced by two fields with one meaning each:

| New field | Meaning | Written by |
| :-- | :-- | :-- |
| `chosenTargetInstanceId`, `chosenTargetType` | the target the **player chose** for this ability (UI selection carried by a `PlayerAction`, or the answer to a target prompt) | `action-dispatcher.ts` (from `action.targetInstanceId`), the target prompt (3.2) |
| `eventTargetInstanceId`, `eventTargetType` | the target of the **event that triggered** the ability (the thwarted scheme, the defeated minion, the attacking enemy) | every trigger path in `trigger-dispatcher.ts` and `prompt-queue.ts`, copied from `TriggerContext` |

- `TriggerContext` (the event payload) keeps `targetInstanceId` / `targetType`: inside an event they can only mean the event's target.
- Every reader is classified by the selector it serves: `CHOSEN_*` and action-targeted effects read `chosenTarget*`; `TRIGGERING_*` (Hawkeye `01066`, Counter-Punch `01077`, resolver L279/L847/L869/L1230), "that" references and trigger filters read `eventTarget*`. Readers that today mix both get one meaning or are split.
- Inventory: about 99 reads in `target-resolver.ts`, `effects/index.ts`, `dynamic-formula-evaluator.ts`, `trigger-dispatcher.ts`; about 52 writes in 8 pipeline files. Removing the old fields makes `tsc` list every site, so none can be missed. `targetPlayerId` gets the same review; if it carries both meanings too, it is split the same way in this commit.
- `PlayerAction.targetInstanceId` (`models/actions.ts`) and the `effectParams.targetInstanceId` that prompt options carry stay: each already has one meaning (the chosen target).
- Tests that pass a context directly to `executeEffect` are updated to the new names; tests that dispatch actions are untouched. The whole suite must stay green with **no** assertion changed in this commit, which proves it is a pure refactor.

### 3.2 Commit 2, `fix(engine)`: one target choice for every `CHOSEN_*` step

1. **Rule in one place.** When a step targets a single-target `CHOSEN_*` selector and there is no `chosenTargetInstanceId` (and no `effectParams.targetInstanceId`), the player chooses. This applies to every execution path (triggered or not), because after 3.1 "no chosen target" can only mean "nobody chose yet".
2. **Candidates are built when the prompt opens**, from `getEligibleTargets`, keeping only **valid** targets (RR *Target*): `ADD_STATUS`, an enemy that can still receive that status (not already holding it; Stalwart and Steady respected); `REMOVE_THREAT`, a scheme with removable threat (crisis respected); `DEAL_DAMAGE`, every enemy.
3. **2 or more** valid targets: a decision prompt ("<Card>: choose an enemy" / "choose a scheme"), one option per target with its `cardCode`; the option re-runs the same step with the chosen id; the prompt carries `sourceCardInstanceId` (Overkill, logs). **Exactly 1**: used without a prompt. **0**: the step does nothing.
4. **Initiation needs a valid target, and optional stays optional** (RR v1.8 *Initiating Abilities*: declare intent; 2. check for at least one valid target; 5. pay costs, abort without paying if they cannot be paid; 6-7. resolve):
   - The "Do you want to use…? Yes / No" prompt is unchanged and always comes first for a non-forced ability; "No" means the ability does not happen. Forced abilities never get it.
   - An optional ability whose effect needs a `CHOSEN_*` target and has no valid target is **not offered**.
   - On "Yes", the valid-target check runs **again, before the cost is paid** (`prompt-queue.ts` L358 pays it unconditionally today): other prompts may have changed the board since the offer. If no valid target remains, the ability aborts and **no cost is paid**.
   - The target prompt opens during resolution (decision 1) and has **no cancel option**: after "Yes" and the cost, the player is committed and chooses among the valid targets.
   - A forced ability with no valid target resolves as far as it can (the step does nothing).
5. **Remove the guesses and the duplicate prompt** (they are the debt this bug came from):
   - the resolver fallbacks that pick a target nobody chose: `CHOSEN_ENEMY` (first engaged minion, else the villain, L680-703), `CHOSEN_MINION` (L773-799), `CHOSEN_ENGAGED_MINION` (`|| engagedMinions[0]`, L806) and any other `CHOSEN_*` fallback the inventory finds;
   - `DEAL_DAMAGE`'s "default: deal damage to the villain" for a `CHOSEN_*` target (L2279 keeps serving `VILLAIN` only);
   - `REMOVE_THREAT`'s two hand-written "Choose a Scheme" prompt blocks (L2960-3100), replaced by the shared chooser.
6. Any existing test that only passed because of a fallback guess is reported in the implementation notes and fixed to choose its target explicitly (through a prompt answer or an action target), never by keeping the fallback.

## 4. Cards inside multi-step sequences

The shared chooser (3.2) also reaches these, because it no longer depends on the trigger path:

- Nick Fury `01084` (*choose one: … deal 4 damage to an enemy*): the `PLAYER_CHOICE` option runs the step, the step prompts for the enemy. Covered by a test in this change.
- Wakanda Forever! `01047` / `01048` (`SPECIAL`): the special sequence already pauses on a prompt and resumes (#207), so a target prompt fits. Covered by a test in this change.
- Hulk `01050` (*Forced Response … Deal 2 damage to an enemy* as step 2 of 4): a prompt in the middle of a normal sequence lets steps 3 and 4 run before the choice (the #225 problem: `executeSequence` does not pause). **This is the one real prerequisite**, not debt from this change. Options: (a) do #225 first and come back; (b) include a resumable `executeSequence` in this change (it would also replace the special-only `pendingSpecialSequence`). **Owner decision, see section 7.**

## 5. Tests (written first, each seen failing)

New file `tests/engine/triggered-chosen-targets.test.ts`, through the real dispatch paths (`dispatchAction` and `RESOLVE_DECISION_PROMPT`), with Rhino plus one engaged minion so there is a real choice:

1. **Daredevil:** after Daredevil thwarts and the player says Yes, a prompt lists Rhino and the minion; choosing the minion damages the minion, not Rhino. (Fails today: Rhino takes the damage, no prompt.)
2. **Interrogation Room:** with a side scheme in play, after defeating a minion and saying Yes, the scheme prompt opens; choosing the side scheme removes 1 threat there. (Fails today.)
3. **Mockingbird:** on entering play and Yes, a prompt lists the enemies; the chosen one is stunned. (Fails today.)
4. **She-Hulk:** changing to hero form and Yes, the chosen enemy takes 2 damage.
5. **Chase Them Down:** after the hero defeats an enemy with a side scheme in play, the scheme prompt opens.
6. **One candidate:** Daredevil with only Rhino in play: no target prompt, Rhino takes 1 damage.
7. **Valid targets only:** Mockingbird with Rhino already stunned and one unstunned minion: no prompt, the minion is stunned. With every enemy already stunned: Mockingbird's Response is not offered.
8. **Guards (pass before and after):** Counter-Punch `01077` "that enemy" still hits the attacking enemy and Hawkeye `01066` still hits the entering minion (`TRIGGERING_*`); Spider-Tracer still prompts for a scheme (`relentless-assault-overkill.test.ts`); a player-played event with a UI-chosen target is unchanged.
9. **Nick Fury and Wakanda Forever!:** the enemy-damage option and the special sequence each prompt for the enemy and hit the chosen one.
10. **Chain reaction (decision 1):** a Response whose trigger defeats a minion before the target prompt opens: the defeated minion is not in the list.
11. **Optional stays optional:** answering "No" to Daredevil changes nothing (no damage, no prompt). Interrogation Room offered while one scheme has threat (every other scheme at 0), then that threat is removed by another prompt before the player answers "Yes": the ability aborts and Interrogation Room stays **ready** (cost not paid). The target prompt has no cancel option.

Commit 1 adds no test: its proof is the unchanged suite plus `tsc`.

## 6. Files

- Commit 1: `src/engine/effects/index.ts` (context type and reads), `target-resolver.ts`, `dynamic-formula-evaluator.ts`, `step-gate-evaluator.ts` if it reads them, `trigger-dispatcher.ts`, `prompt-queue.ts`, the 8 pipeline files that build contexts, and the tests that build contexts by hand
- Commit 2: a new module `src/engine/effects/target-choice.ts` (valid-target filter and prompt builder, so `effects/index.ts` does not grow), its call in step execution, the removals listed in 3.2 step 5, `tests/engine/triggered-chosen-targets.test.ts` (new)
- Docs: spec `02_timings_and_triggers.md` (trigger context: event target vs chosen target), spec `03_costs_and_targeting.md` (`CHOSEN_*`: who chooses, valid targets, 0/1/2+ rule, no fallback), new ADR (effect context contract: chosen target vs event target), ADR-0020 addendum
- `CHANGELOG.md`, this plan, the status file (section 3.1: item 3 triaged, this fix), [plan_core_player_cards_review.md](plan_core_player_cards_review.md) (the five cards)
- No supplemental data change, so no audit stamps change; `npm run report:declarations` is run anyway as part of the gates.

## 6b. Implementation notes (2026-10-05, in progress)

- **Commit 1 (context split) done:** `chosenTarget*` / `eventTarget*` replace `targetInstanceId` / `targetType` in `EffectExecutionContext`; all readers classified (resolver: `CHOSEN_*`, `PREVIOUS_*` and the default case read the chosen target; `TRIGGERING_*` and the `HOST` fallback read the event target). Dead `targetInstanceId` removed from `CardLocatorContext`. Only test fixtures changed (42 key renames, no assertion), suite green.
- **Regression found by a new test, not by the suite:** Superhuman Strength `01028` ("stun the attacked enemy") used `PREVIOUS_TARGET`, which only worked because the event target leaked into the chosen-target slot. Correct selector: `TRIGGERING_ENEMY`. Data change awaiting owner approval.
- **Commit 2 done except that data fix:** new `effects/target-choice.ts` (valid targets per RR "Target", 0/1/2+ rule, prompt that re-runs the step); hook in `executeStep`; optional abilities with no valid target are not offered (identity, in-play and hand scans); re-check on "Yes" before the cost (`prompt-queue.ts`); `REMOVE_THREAT`'s two hand-written scheme prompts removed (244 lines); resolver guesses removed (`CHOSEN_ENEMY`, `CHOSEN_MINION`, `CHOSEN_ENGAGED_MINION`, `TRIGGERING_MINION`, `TRIGGERING_ENEMY` without a villain event, `PREVIOUS_TARGET`); unused `ATTACK_TARGET` / `ATTACKED_ENEMY` / `TARGET_ENEMY` labels removed (the card-text parser now proposes `TRIGGERING_ENEMY`). New generic prompt field `isFinalStep` so a finisher bonus survives the target prompt (Wakanda Forever!).
- **Tests changed to state the new rule, not to hide it:** Wakanda Forever! tests now answer the enemy prompt (Rhino and a minion are both valid); the old `main_scheme` option alias is replaced by the main scheme's real id; Spider-Tracer gives the main scheme threat so it stays a valid target.
- **Superhuman Strength `01028` data fix approved by the owner and applied** (`PREVIOUS_TARGET` → `TRIGGERING_ENEMY`); full suite 1,850/1,850 green.
- **Out of scope, filed:** Hulk's mid-sequence prompt as [#248](https://github.com/SteveRodrigue/MCD/issues/248). Chase Them Down `01052` is never offered at all (no hand Response scan after a defeat, filter too narrow): [#247](https://github.com/SteveRodrigue/MCD/issues/247). Nick Fury `01084`'s option description says "from the active main scheme" while the card says "a scheme" (text only; the behaviour is right now).

## 7. Decisions

Taken by the owner (2026-10-05):

1. **Two prompts.** The first decision ("Do you want to use…") and the target choice stay separate: resolving the Response's trigger can start a chain reaction that changes the board, so merging them would break the rules.
2. **Refactor now.** The effect context is split for real (3.1); fallbacks and duplicated prompts are removed (3.2), not kept.

3. **Hulk `01050` and resumable sequences ([#248](https://github.com/SteveRodrigue/MCD/issues/248), first written as #225 by mistake): (a), decided by the owner.** The text below is kept for the record.

   **Hulk `01050` and resumable sequences (#225).** (a) Fix #234 for every card except Hulk, then do #225 next and finish Hulk there; or (b) include a resumable `executeSequence` in this change. **Recommendation: (a).** #225 is its own engine change with its own tests, and mixing it in makes this change hard to review. Hulk keeps its current behaviour for one item only, and the status file names it as the very next task, not a backlog entry.

Estimated effort: commit 1 about half a day (mechanical, compiler-driven, full suite after each file group); commit 2 about half a day; docs and ADR 1 hour.
