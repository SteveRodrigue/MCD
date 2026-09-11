# [ADR-0050] Universal In-Play Self-Referential Trigger Instance Binding

- **Status:** Accepted
- **Date:** 2026-09-11
- **Authors:** MCD Core Team
- **Deciders:** User & Antigravity

---

## Context and Problem Statement

Following the adoption of [ADR-0048](0048-ability-timing-vs-trigger-condition-disambiguation.md), play and enters-play lifecycle events were unified under event-driven triggers (`CARD_PLAYED` and `ENTERS_PLAY`) routed via `dispatchTrigger`.

However, in `src/engine/triggers/trigger-dispatcher.ts`, the in-play scan loop iterated across all in-play entities (`player.tableau`, `player.allies`, `player.attachments`) without asserting that the triggering event's source instance matched the scanned card instance for `ENTERS_PLAY` or `CARD_PLAYED`. Furthermore, the existing guard for `THWART_RESOLVED` and `ATTACK_RESOLVED` was strictly scoped to `cardInst.card.type === 'ally'`, leaving tableau cards (upgrades, supports, attachments) unconstrained.

This caused two severe engine defects:
1. **Nick Fury Re-trigger Bug ([Issue #93](https://github.com/SteveRodrigue/MCD/issues/93)):** Once Nick Fury (`01084`) was in play and had resolved his 3-choice `ENTERS_PLAY` prompt, playing *any subsequent ally* caused `dispatchTrigger(..., 'ENTERS_PLAY')` to scan Nick Fury again, re-opening his modal prompt.
2. **Black Cat Re-trigger Bug:** Black Cat (`01002`, `trigger: "CARD_PLAYED"`) in `player.allies` re-triggered her forced response (discarding 2 additional cards from the player deck) whenever any subsequent card was played.
3. **Tableau Vulnerability:** A full audit of all 120 Zzorba card packs revealed that permanent upgrades (such as Hercules' `59005`–`59007`) with `ENTERS_PLAY` abilities would re-trigger repeatedly whenever any other permanent entered play if the guard were restricted to allies.

---

## Decision Drivers

- **RR v1.8 pp. 11, 21:** "Enters play" and "play" refer to the transition of a specific card. A triggered ability reading "After [this card] enters play" or "After you play [this card]" fires once upon that specific card's transition, not when other cards transition.
- **Distinction between Self-Triggers and Observers:** Cards with `ENTERS_PLAY` or `CARD_PLAYED` represent abilities of the entering/played card itself. Observer cards that watch other cards enter play (e.g. Hawkeye `01066`, Widow's Bite `08010`, Utopia `33020`) use distinct observer triggers (`MINION_ENTERS_PLAY`, `ALLY_ENTERS_PLAY`, etc.).
- **Hero-Watching Upgrades vs Character-Specific Ally Actions:** For `ATTACK_RESOLVED` and `THWART_RESOLVED`, an ally's ability should only trigger if that specific ally attacked/thwarted, whereas an upgrade in the tableau (e.g. Superhuman Strength `01028`) watches the hero identity's attack.
- **Card-Agnostic Engine Invariant:** Engine pipelines must enforce rules via universal invariants rather than card-code hardcoding or overly narrow type filters.

---

## Considered Options

1. **Option 1: Add `ENTERS_PLAY` and `CARD_PLAYED` to an ally-only guard (`cardInst.card.type === 'ally'`).**
2. **Option 2: Universal in-play self-referential trigger instance binding for `ENTERS_PLAY` and `CARD_PLAYED` across all in-play card types, while preserving ally-specific scoping for `ATTACK_RESOLVED` and `THWART_RESOLVED`.**
3. **Option 3: Track a boolean `hasEnteredPlay` flag on each `CardInstance`.**

---

## Decision Outcome

**Chosen Option: Option 2: Universal in-play self-referential trigger instance binding for `ENTERS_PLAY` and `CARD_PLAYED` across all in-play card types, while preserving ally-specific scoping for `ATTACK_RESOLVED` and `THWART_RESOLVED`.**

### Rationale ("The Why")

- **Option 1** leaves upgrades (such as Hercules' 3 upgrades) and tableau supports vulnerable to the exact same re-trigger defect if they have `ENTERS_PLAY` or `CARD_PLAYED` triggers.
- **Option 3** introduces mutable state tracking on card instances that complicates state serialization, undo, and replay, while failing to handle `CARD_PLAYED` or recurring effects cleanly.
- **Option 2** enforces the exact rules boundary cleanly and immutably using the existing `context.sourceInstanceId`:
  - When `ENTERS_PLAY` or `CARD_PLAYED` is dispatched, *only* the card matching `sourceInstanceId` can fire its ability.
  - When `ATTACK_RESOLVED` or `THWART_RESOLVED` is dispatched, an ally only fires if `sourceInstanceId === ally.instanceId`, while upgrades in the tableau (which trigger on hero attacks like Superhuman Strength) continue to trigger correctly.

---

## Evaluation of Options

### Option 1: Ally-Only Guard
- **Pros:** Minimal localized change for Issue #93.
- **Cons:** Fails to protect upgrades or supports in `player.tableau`; inconsistent across card types.

### Option 2: Universal In-Play Play/Entry Guard (Chosen)
- **Pros:**
  - Solves Issue #93 and prevents dormant bugs across all 120 card packs.
  - Fixes Black Cat (`CARD_PLAYED`) re-triggering.
  - Preserves upgrade responses to hero attacks (Superhuman Strength `01028`).
  - Zero state mutations or extra fields required on `CardInstance`.
- **Cons:** Requires clear test contract asserting both ally and upgrade behavior.

### Option 3: Mutable State Flags
- **Pros:** Explicit per-card tracking.
- **Cons:** Mutates card state, violates declarative engine immutability, redundant with `sourceInstanceId`.

---

## Consequences

### Positive Consequences
- Nick Fury (`01084`), Mockingbird (`01083`), Spider-Woman (`01011`), Shuri (`01041`), and Maria Hill (`01067`) fire their `ENTERS_PLAY` abilities strictly once upon entering play.
- Black Cat (`01002`) fires `CARD_PLAYED` strictly once upon being played.
- Upgrades and supports in the tableau with `ENTERS_PLAY` or `CARD_PLAYED` triggers cannot be falsely re-triggered by subsequent card entries.
- Upgrades triggered by hero attacks (e.g. Superhuman Strength `01028`) continue to function without regression.
- Legitimate board observer cards (`MINION_ENTERS_PLAY`, `ALLY_ENTERS_PLAY`) remain completely unaffected.

### Negative Consequences / Risks & Mitigations
- **Risk:** Any future card that intends to watch *other* cards enter play must not use generic `ENTERS_PLAY` as its trigger name.
  - **Mitigation:** The supplemental schema strictly distinguishes self-entry (`ENTERS_PLAY`) from observer triggers (`MINION_ENTERS_PLAY`, `ALLY_ENTERS_PLAY`). Observer cards must use distinct trigger tokens.
