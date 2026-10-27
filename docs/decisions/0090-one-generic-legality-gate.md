# [ADR-0090] One Generic Legality Gate for Target Validity

- **Status:** Accepted
- **Date:** 2026-10-22
- **Authors:** MCD Core Team
- **Deciders:** Owner & Claude
- **Related Issues:** #340 (One-Two Punch offered while the hero is already ready); follow-ups #365, #366, #367
- **Refines:** [ADR-0070](0070-systemic-chosen-entity-targeting-and-decision-fallback-architecture.md) (two-layer legality), [ADR-0077](0077-chosen-target-vs-event-target-and-step-level-target-choice.md) (step-level target choice), [ADR-0074](0074-engine-backed-tableau-card-actionability.md) (the UI asks the engine)

---

## Context and Problem Statement

RR v1.8 "Target": an ability that specifies a target can only be initiated if it has at least one valid target, and a target is valid when any part of the ability can affect it (healing, readying, removing threat, giving a status card, dealing damage). A ready hero cannot be affected by "ready"; a character at full health cannot be affected by "heal". "Initiating Abilities" step 2 applies this before any cost is paid.

The engine decided this in five places, each hardcoded by effect name and selector: `canAffect` (chosen selectors only), three HEAL/READY blocks in `legality-checker.ts`, and the effect-to-filter if-chains in `play.ts` and `abilities.ts`. A case none of them knew (`READY` on `SELF_HERO`) fell through all five, so One-Two Punch was offered to a ready hero (#340). The queued-prompt re-check (#266, #267) existed only for threat and damage interrupts, so a second copy was offered after the first had readied the hero.

## Decision Drivers

- One rule, one implementation: a defect is fixed once, for every caller.
- The UI, the bot, the trigger scan, queued prompts and event play must never disagree about what is legal (ADR-0074).
- A new effect or selector should need one edit, not five.
- The rule must be visible where it is incomplete, not silent.

## Considered Options

1. **Per-caller checks (status quo).** Rejected: five drifting copies, and the defect above.
2. **A gate only for the trigger scan and the queue.** Rejected: action buttons and event play would keep their own copies.
3. **One gate every caller asks (chosen).**

## Decision Outcome

**Chosen option 3.**

1. **The gate.** `checkAbilityTargets` in `src/engine/effects/target-choice.ts` answers "can this ability be initiated now?" for target validity: `{ allowed } | { allowed: false, reason }`. Steps whose selector is a player-chosen selector (`CHOSEN_*`) or a self selector (`SELF_HERO`, `SELF_IDENTITY`) are judged: the selector's targets are enumerated (`getValidStepTargets`) and filtered by what the effect needs from its target. A step that judges no target excuses a missing one only when it is a draw that always happens (RR v1.8 "Target": a draw always has a valid target while the player has a card to draw); a conditional draw, a discard or a keyword grant does not (#369); an attack by a Stunned hero or a thwart by a Confused one discards the status card instead (RR v1.8 Stunned, Confused), which changes the board: the status card is the target, so the ability stays initiable whatever its own target (`isCancelledByOwnStatus`). A target the player already named is judged too (`chosenTargetId`).
2. **The rule table.** `AFFECT_RULES` is the only place that says what an effect needs from its target (`READY` needs an exhausted target, `HEAL_DAMAGE` a damaged one, `REMOVE_THREAT` threat, `ADD_STATUS` room for the status card, `EXHAUST` a ready target, `DEAL_DAMAGE` a target that can take damage). Effects without a rule are listed with a reason in `EFFECTS_WITHOUT_AFFECT_RULE`; a coverage test requires every schema effect in exactly one of the two, so a new effect cannot default to "always valid" unnoticed.
3. **Callers.** The gate is reached through `kernel.checkAbilityTargets` (ADR-0088) by: the hand and tableau trigger scans, forced abilities, queued prompts when they come up, prompt answers (abort before paying), `canInitiateAbility` (action buttons, `USE_CARD_ABILITY`), `canPlayCard` for events, and, through `getValidStepTargets`, the target choice of events and abilities. The UI reads the engine's answer (ADR-0074).
4. **Queued prompts are re-validated.** `pruneStaleOptionalPrompts` (`prompt-queue.ts`) runs after every answered prompt and after an ordering choice: an optional ability that can no longer be initiated (card left the hand, limit used, cost unpayable, no valid target) is dropped without paying, with a log line `ability.skipped.noValidTarget`. This generalises the threat and damage interrupt windows (#266, #267), whose two near-identical function sets were merged.
5. **Rule for change.** A new effect adds a rule to `AFFECT_RULES` (or a reasoned entry to `EFFECTS_WITHOUT_AFFECT_RULE`); a new caller calls the gate. A target-validity check by effect name or selector in a caller is rejected in review, and `tests/engine/legality-gate-guards.test.ts` fails on a new one (allow-list entries carry a reason and only shrink).

### Rationale ("The Why")

The rule is about the ability and its targets, not about who asks. Centralising it removes the class of defect, not one instance: the next effect with a state requirement is one table entry, and every caller gets it. The guard test and the guideline (`docs/coding_guidelines.md` Â§15, rule 11) keep the structure from sprawling again.

## Consequences

### Positive Consequences

- One-Two Punch, Arc Reactor, Indomitable and Tenacity are not offered to a ready hero; Aunt May cannot be used at full health; a second copy is skipped once the first made it illegal.
- Five duplicated blocks are deleted; the legality reason strings come from one table.

### Negative Consequences / Risks & Mitigations

- **Tracked gap.** Effects acting on a target without a state rule (`ADD_THREAT`, `REMOVE_STATUS`, `DISCARD`, `RETURN_TO_HAND`, counters and a few more) keep "always valid" until each is reviewed against the Target rule. They are listed under "tracked gap" in `EFFECTS_WITHOUT_AFFECT_RULE`; tracked in #365. `RETURN_TO_HAND` is the worked example: Hellcat (01020) used by Captain Marvel after Make the Call (01071) returns to the resolving player's hand (RR v1.8 "You, Your"), pinned by `tests/engine/hellcat-make-the-call.test.ts`; the handler only looks in the resolving player's play area, which a targeted use must not assume.
- **Remaining effect-name checks.** None in `legality-checker.ts`: the REMOVE_THREAT (Crisis, Patrol) and DEAL_DAMAGE (Guard) checks are gone (addendum). #366 still removes the second target-choice mechanism in `play.ts` and `abilities.ts`, the attach-host requirements and the payment modal's effect-name picker.
- **Few selectors judged.** The judged selectors are `CHOSEN_*` (except `CHOSEN_PLAYER`), the two self selectors and the named selectors `MAIN_SCHEME`, `SIDE_SCHEME`, `ALL_SCHEMES` and `VILLAIN`, each for the effects it limits (addendum); other selectors (for example `ALL_ENEMIES`) are not judged; #367 covers them.

## Addendum (2026-10-22, #331): Crisis, Patrol and Guard are written once

Legal Practice (`01023`) was offered the main scheme although a preventing icon was in play. The rule "this player's cards cannot remove threat from the main scheme" was written eight times (the thwart executor, two target enumerations, `canBasicThwart`, `canAllyThwart`, `hasEligibleThreatRemovalTarget`, event play and ability use), and two copies already disagreed on what `ignoresCrisis` ignores.

1. **One module.** `src/engine/pipeline/target-restrictions.ts` holds `getMainSchemeThreatBlock` (Crisis, Patrol) and `isVillainAttackBlockedByGuard` with their reason strings. Patrol is checked before Crisis. An encounter source ignores both; `ignoresCrisis` skips Crisis only. Only that module and `icons.ts` read `Keyword.GUARD`, `Keyword.PATROL` or the Crisis icon count (guard test; two UI display reads are allow-listed).
2. **In the gate, not in the enumeration.** The restriction is part of the `REMOVE_THREAT` rule in `AFFECT_RULES` (`canAffect` now receives the acting player). The target enumerations no longer hide the main scheme, so an effect that is not a removal (for example `ADD_THREAT`) is not affected by Crisis.
3. **More selectors judged.** `MAIN_SCHEME`, `SIDE_SCHEME` and `ALL_SCHEMES` are judged like a chosen scheme (no prompt is opened for them). Steps whose state gate is closed (Mark V Helmet's Aerial branches) neither need a target nor excuse a missing one.
4. **Deleted.** Step 5A of `canInitiateAbility`, `hasEligibleThreatRemovalTarget` and `evaluateSchemeTargetRequirement`. `canBasicAttack` / `canAllyAttack` and `canBasicThwart` / `canAllyThwart` are merged into `canAttack` and `canThwart` (actor: `HERO_ACTOR` or an ally), sharing one `checkActionWindow` with recover and change form.
5. **Guard.** Guard is a rule of the gate too. `DEAL_DAMAGE` (`AFFECT_RULES`) makes the villain an invalid target of an ability labelled `ATTACK` while a Guard minion is engaged with the acting player; damage that is not an attack is not limited. `canAffect` and `getValidStepTargets` receive the ability for its labels, and the named selectors are one table (`NAMED_SELECTOR_JUDGED_EFFECTS`: schemes for `REMOVE_THREAT`, `VILLAIN` for `DEAL_DAMAGE`). The `CHOSEN_ENEMY` prompt of an attack event or ability therefore lists only the minions, where the old by-name check refused only when no minion was engaged at all. Step 5A of `canInitiateAbility` (Guard by effect name, also applied to non-attack damage) is deleted.

## Addendum (2026-10-26, #438): the payment modal shows the gate's targets

The payment modal listed every scheme, enemy, character and ally for an event (its own hand-built lists and default target, picked by effect name), so Legal Practice (`01023`) offered a scheme with no threat. `getEventTargetChoice` (`target-choice.ts`; now `getPlayTargetChoice`, #366) returns the valid targets of an event's first `CHOSEN_*` step through `getValidStepTargets`; `CardPaymentModal` renders those and defaults to the first. The modal's lists, its effect-name checks and its `ALLOWED_EFFECT_NAME_CHECKS` entry are deleted (part of #366, item 4). `checkAbilityTargets` also matches a chosen target with the same naming rules as the resolver (instance id, `main_scheme` or card code), so a main scheme named by card code is judged by `canAffect` instead of falling back to "some target exists".

## Addendum (2026-10-26, #387): the gate refuses resource abilities as actions

Web-Shooter (`01008`) could be started from the tableau action modal, spending a counter and exhausting for nothing. A resource ability is triggered only while paying a cost (RR v1.8 "Resource Ability"). `canInitiateAbility` now refuses `RESOURCE`, `HERO_RESOURCE` and `ALTER_EGO_RESOURCE` timings; the payment flow reads generators without asking the gate. The three "skip resource abilities" lines in `legal-actions-generator.ts` and the resource timings in `TableauActionModal` and `tableau-card-legality.ts` are deleted: the gate is the one place that decides.

## Addendum (2026-10-26, #370 to #372): where Crisis and Patrol are enforced, and who needs a prompt

1. **The block is where threat is removed.** `removeThreatFromScheme` (`threat-pipeline.ts`) is the only function that lowers scheme threat. It asks `getMainSchemeThreatBlock` (with `isPlayerSource` and `ignoresCrisis`), announces a block and returns `blocked`; `applyThwart` forwards to it. A distributed removal (`DISTRIBUTE_AMOUNT`, domain `THREAT_REMOVAL`) therefore obeys Crisis and Patrol, and `compileDistributionTargets` marks the shielded main scheme ineligible. A guard test fails if another engine module writes `.threat`.
2. **One distribution application.** `applyDistributedAmounts` (`effects/distribution.ts`) serves the step with assignments and the prompt answer, replacing two near-identical blocks.
3. **`getEligibleTargets` is structural.** It shares `schemeCandidates` with `resolveTargets` (one main-scheme id rule) and states in its comment that state rules are the gate's (`getValidStepTargets`).
4. **One definition of a prompted step.** `firstChosenTargetStep` (`target-choice.ts`) is used by the ability prompt, the event prompt and `getPlayTargetChoice` (formerly `getEventTargetChoice`); `CHOSEN_PLAYER` is never prompted there. The gate still judges a wider set (self and named selectors), which includes every prompted step. Ability and event choice prompts share `describeTarget`.

## Addendum (2026-10-27, #457): the gate model for #365 and #367

Reading 3,995 upstream cards showed the gate could not yet express what later packs need, so #365 (effect rules) and #367 (every selector) build on this model.

1. **One selector table.** `SELECTOR_CLASS` (`target-choice.ts`) classifies every schema selector as `CHOSEN`, `FIXED`, `GROUP`, `EVENT` or `DEPENDENT`, exhaustive over the schema (a new selector fails `typecheck`). `PLAYER_CHOSEN_SELECTORS` and the event selectors are derived from it. `DEPENDENT` selectors (`PREVIOUS_TARGET`, `DAMAGED_CHARACTER`, `HOST`, `HOST_ENEMY`, `TRIGGERING_*`) take their value from an earlier step or the host at run time, so they are never judged up front (Titania's Fury 01164 heals `PREVIOUS_TARGET` after its attack).
2. **`PLAYER_CHOICE` is read.** A choice whose options all name a target is valid when any option has a valid target (RR v1.8 "Target": a target is valid if any part can affect it). A choice with an option that needs no target never blocks. An option runs `option.steps`, or its own `effect` and `params` (`optionSteps`).
3. **Options are disabled, not hidden.** A `PLAYER_CHOICE` prompt (`checkOptionTargets`) disables an option with no valid target while another has one; when none has, all stay open (When Revealed is not gated and resolves as much as it can).
4. **Fallback.** A step with `fallback` ("attach to X, if able; if you cannot, ...") never blocks.
5. **Not yet.** Targets that live in params rather than a selector (a card in the discard pile, "up to 3 different enemies", a filtered ally) are not judged; #365 gives each effect its own candidates. `CHOSEN_PLAYER` and the `FIXED` and `GROUP` selectors are judged with #367.

## Addendum (2026-10-27, #365 and #367): every effect has a rule and every selector is judged

1. **Every selector is judged.** `judgedSelector` covers every `CHOSEN`, `FIXED` and `GROUP` selector (`CHOSEN_PLAYER` included); `EVENT` selectors are judged against the triggering event and `DEPENDENT` ones never. A chosen selector lists the player's candidates (`getEligibleTargets`), a fixed or group one resolves the entities it names (`resolveTargets`); a group is valid while at least one member can be affected (RR v1.8 "Target"). `NAMED_SELECTOR_JUDGED_EFFECTS` (#368) is deleted: the effect's rule decides, so an effect without a rule is valid while its selector names something. `THIS_SIDE_SCHEME` is the source card and is not judged without one. `CHOSEN_PLAYER` is judged but its prompt stays with the handlers that give a card, a resource or damage to a player.
2. **`STEP_RULES`.** Effects whose target is named by their own params are judged by one rule per effect, using the same helper as the handler (`effects/step-selection.ts`), so the two cannot disagree: `ADD_THREAT` (the scheme a card code names, as Yon-Rogg 01177 names the Psyche-Magnitron 01176, is in play), `ADD_TRAIT` (the identity lacks the trait), `DISCARD` (by source: a card in hand matching the filter, a deck or discard pile with cards because an empty deck is reset, a tableau card, the source, an attachment, cards underneath), `PUT_INTO_PLAY` (a matching card that passes the Unique Card rule), `REMOVE_COUNTERS` and `REMOVE_COUNTERS_MATCHING_FILTER` (a counter exists), `RETURN_TO_HAND` (the source is in its controller's play area or holds cards underneath: Hellcat 01020, Make the Call 01071, Highway Robbery 01166). `REMOVE_STATUS` is an `AFFECT_RULES` entry (the target holds a requested status card; the villain by default). `ADD_COUNTERS`, `REMOVE_FROM_GAME` and `PLACE_CARD_UNDER_HOST` act on the source card or a named host and join the "no target state limits it" list. The "tracked gap" group and its test are gone.
3. **Mixed abilities.** RR v1.8 "Target" says a target is valid if any part of the ability can affect it, and its own example of a player-directed step is Draw. So a draw that happens excuses a missing target, and any judged selector step that can affect a target makes the ability valid. A step judged only by its own params (a discard, a card put into play) decides the ability only when it is the only judged step: Repulsor Blast's spare discard does not excuse a thwart with nothing to thwart (#369), while a lone discard with an empty hand is not offered. A step on a selector filled in at run time (`HOST`, `PREVIOUS_TARGET`) is never judged, so Webbed Up (01009) still resolves against a Stalwart host. A rules question remains for a future card that mixes an untargeted effect with an empty judged step on one element (for example a draw of the top card as a Drone, with an empty deck, plus a bonus): the gate treats the empty step as the only target and skips the ability, as it does for Draw.
4. **Still extension points.** Targets that are neither a selector nor a step param (a card in the discard pile, "up to N different enemies", a filtered ally): add their candidates beside `STEP_RULES` when the first card arrives.

## Addendum (2026-10-27, #366): attachments, SEARCH and the two target-choice moments

1. **Attachments go through the gate.** `ATTACH_TO_HOST` has an `AFFECT_RULES` entry: a host that already holds `maxPerHost` copies of the played card (same code or name) is not a valid target (`hostHasRoom`, `effects/step-selection.ts`). `evaluatePlayTargetRequirement` asks the gate once for each ability a card runs when played (`abilitiesRunOnPlay`: an event's actions, an attachment's "attach to"), with the action's `targetInstanceId` as the chosen target. `evaluateMinionTargetRequirement`, `evaluateAllyTargetRequirement`, `evaluateEnemyTargetRequirement` and the `SEARCH` step of `canInitiateAbility` are deleted, and so is the minion check in `canPayAbilityCost` (all judged by effect or selector name). The aliases `MINION`, `ALLY` and `ENEMY` are gone; only schema selectors exist. The host prompt takes its candidates from `getValidStepTargets`, so it never lists a host the gate refuses.
2. **`SEARCH` is a step rule.** A public discard pile must hold a card that matches the filter; a deck is hidden, so a search of it only needs the deck not to be empty. A search over several zones needs one zone with something (before, every listed zone had to pass, so a search of the encounter deck and discard pile was refused with an empty discard).
3. **`getPlayTargetChoice`** (formerly `getEventTargetChoice`) also serves attachments, so the payment modal shows the valid hosts of Spider-Tracer, Inspired and Webbed Up and the minion-only picker built by selector is deleted.
4. **Two moments, one implementation.** The target of the first chosen step is asked _before_ the card or ability runs (`chooseInitialTarget`): a plain sequence does not pause at a step-level prompt (#248), so asking later would run the following steps first, and an event can still be cancelled before its extra cost is paid. `chooseStepTarget` asks for the targets of later steps, mid-run. Both build their options from `describeTarget`; a play-time prompt uses `targetChoiceOptions`. `chosenTargetTypeOf` (`actions/shared.ts`) replaces the two copies of the target-type derivation.
5. **The guard sees more.** `EFFECT_NAME_CHECK` covers every effect with a rule and `isStep` checks for `ATTACH_TO_HOST`, `SEARCH`, `DEAL_DAMAGE` and `REMOVE_THREAT`. The allow-list gains `legal-actions-generator.ts` (display only: it titles an encounter action "Discard").
