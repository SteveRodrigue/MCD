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

1. **The gate.** `checkAbilityTargets` in `src/engine/effects/target-choice.ts` answers "can this ability be initiated now?" for target validity: `{ allowed } | { allowed: false, reason }`. Steps whose selector is a player-chosen selector (`CHOSEN_*`) or a self selector (`SELF_HERO`, `SELF_IDENTITY`) are judged: the selector's targets are enumerated (`getValidStepTargets`) and filtered by what the effect needs from its target. An ability with any step that judges no target stays initiable ("any part"); an attack by a Stunned hero or a thwart by a Confused one discards the status card instead (RR v1.8 Stunned, Confused), which changes the board: the status card is the target, so the ability stays initiable whatever its own target (`isCancelledByOwnStatus`). A target the player already named is judged too (`chosenTargetId`).
2. **The rule table.** `AFFECT_RULES` is the only place that says what an effect needs from its target (`READY` needs an exhausted target, `HEAL_DAMAGE` a damaged one, `REMOVE_THREAT` threat, `ADD_STATUS` room for the status card, `EXHAUST` a ready target, `DEAL_DAMAGE` a target that can take damage). Effects without a rule are listed with a reason in `EFFECTS_WITHOUT_AFFECT_RULE`; a coverage test requires every schema effect in exactly one of the two, so a new effect cannot default to "always valid" unnoticed.
3. **Callers.** The gate is reached through `kernel.checkAbilityTargets` (ADR-0088) by: the hand and tableau trigger scans, forced abilities, queued prompts when they come up, prompt answers (abort before paying), `canInitiateAbility` (action buttons, `USE_CARD_ABILITY`), `canPlayCard` for events, and, through `getValidStepTargets`, the target choice of events and abilities. The UI reads the engine's answer (ADR-0074).
4. **Queued prompts are re-validated.** `pruneStaleOptionalPrompts` (`prompt-queue.ts`) runs after every answered prompt and after an ordering choice: an optional ability that can no longer be initiated (card left the hand, limit used, cost unpayable, no valid target) is dropped without paying, with a log line `ability.skipped.noValidTarget`. This generalises the threat and damage interrupt windows (#266, #267), whose two near-identical function sets were merged.
5. **Rule for change.** A new effect adds a rule to `AFFECT_RULES` (or a reasoned entry to `EFFECTS_WITHOUT_AFFECT_RULE`); a new caller calls the gate. A target-validity check by effect name or selector in a caller is rejected in review, and `tests/engine/legality-gate-guards.test.ts` fails on a new one (allow-list entries carry a reason and only shrink).

### Rationale ("The Why")

The rule is about the ability and its targets, not about who asks. Centralising it removes the class of defect, not one instance: the next effect with a state requirement is one table entry, and every caller gets it. The guard test and the guideline (`docs/coding_guidelines.md` §15, rule 11) keep the structure from sprawling again.

## Consequences

### Positive Consequences

- One-Two Punch, Arc Reactor, Indomitable and Tenacity are not offered to a ready hero; Aunt May cannot be used at full health; a second copy is skipped once the first made it illegal.
- Five duplicated blocks are deleted; the legality reason strings come from one table.

### Negative Consequences / Risks & Mitigations

- **Tracked gap.** Effects acting on a target without a state rule (`ADD_THREAT`, `REMOVE_STATUS`, `DISCARD`, `RETURN_TO_HAND`, counters and a few more) keep "always valid" until each is reviewed against the Target rule. They are listed under "tracked gap" in `EFFECTS_WITHOUT_AFFECT_RULE`; tracked in #365. `RETURN_TO_HAND` is the worked example: Hellcat (01020) used by Captain Marvel after Make the Call (01071) returns to the resolving player's hand (RR v1.8 "You, Your"), pinned by `tests/engine/hellcat-make-the-call.test.ts`; the handler only looks in the resolving player's play area, which a targeted use must not assume.
- **Remaining effect-name checks.** `legality-checker.ts` still checks DEAL_DAMAGE (Guard) by effect name; the guard test lists it as debt with a reason; #366 removes it, together with the second target-choice mechanism in `play.ts` and `abilities.ts`. The REMOVE_THREAT checks (Crisis, Patrol) are gone: see the addendum.
- **Few selectors judged.** The judged selectors are `CHOSEN_*` (except `CHOSEN_PLAYER`), the two self selectors and the scheme selectors `MAIN_SCHEME`, `SIDE_SCHEME` and `ALL_SCHEMES` (addendum); other selectors (for example `ALL_ENEMIES`) are not judged; #367 covers them.

## Addendum (2026-10-22, #331): Crisis, Patrol and Guard are written once

Legal Practice (`01023`) was offered the main scheme although a preventing icon was in play. The rule "this player's cards cannot remove threat from the main scheme" was written eight times (the thwart executor, two target enumerations, `canBasicThwart`, `canAllyThwart`, `hasEligibleThreatRemovalTarget`, event play and ability use), and two copies already disagreed on what `ignoresCrisis` ignores.

1. **One module.** `src/engine/pipeline/target-restrictions.ts` holds `getMainSchemeThreatBlock` (Crisis, Patrol) and `isVillainAttackBlockedByGuard` with their reason strings. Patrol is checked before Crisis. An encounter source ignores both; `ignoresCrisis` skips Crisis only. Only that module and `crisis.ts` read `Keyword.GUARD`, `Keyword.PATROL` or the Crisis icon count (guard test; two UI display reads are allow-listed).
2. **In the gate, not in the enumeration.** The restriction is part of the `REMOVE_THREAT` rule in `AFFECT_RULES` (`canAffect` now receives the acting player). The target enumerations no longer hide the main scheme, so an effect that is not a removal (for example `ADD_THREAT`) is not affected by Crisis.
3. **More selectors judged.** `MAIN_SCHEME`, `SIDE_SCHEME` and `ALL_SCHEMES` are judged like a chosen scheme (no prompt is opened for them). Steps whose state gate is closed (Mark V Helmet's Aerial branches) neither need a target nor excuse a missing one.
4. **Deleted.** Step 5A of `canInitiateAbility`, `hasEligibleThreatRemovalTarget` and `evaluateSchemeTargetRequirement`. `canBasicAttack` / `canAllyAttack` and `canBasicThwart` / `canAllyThwart` are merged into `canAttack` and `canThwart` (actor: `HERO_ACTOR` or an ally), sharing one `checkActionWindow` with recover and change form.
5. **Guard.** The Guard check of `DEAL_DAMAGE` abilities in `canInitiateAbility` remains #366 debt; it now calls the shared function.
