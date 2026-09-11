# [ADR-0048] Ability Timing vs. Trigger Condition Disambiguation & CARD_PLAYED vs. ENTERS_PLAY

- **Status:** Accepted
- **Date:** 2026-09-07
- **Authors:** MCD Core Team
- **Deciders:** User & Antigravity

---

## Context and Problem Statement

The declarative supplemental schema conflated two distinct concepts:

1. **Ability timing type** (the scheduling class that determines when in the resolution window an ability can be used: `ACTION`, `RESPONSE`, `FORCED_RESPONSE`, `CONSTANT`, etc.)
2. **Trigger condition** (the game event that fires the ability: `CARD_PLAYED`, `ENTERS_PLAY`, `VILLAIN_INITIATES_ATTACK`, etc.)

Concretely, `CARD_PLAYED` and `WHEN_PLAYED` appeared in `TimingTypeSchema` as "timing types" — but playing a card is a player ACTION, not a timing category. This caused:

- Attachment upgrades (Spider-Tracer `01007`, Inspired `01074`) to use `timing: "CARD_PLAYED"` — semantically wrong; the play action is an `ACTION`.
- Five ally cards (Spider-Woman `01011`, Shuri `01041`, Maria Hill `01067`, Mockingbird `01083`, Nick Fury `01084`) to use `trigger: "CARD_PLAYED"` when their printed text says *"After [card] enters play"* — semantically wrong per RR v1.8 pp. 11, 21.
- `ENTERS_PLAY` was missing entirely from `TriggerTypeSchema` and the engine's `TriggerType` union.
- All `CARD_PLAYED`/`ENTERS_PLAY` dispatch was handled by 4 ad-hoc inline loops instead of routing through the canonical `dispatchTrigger` function.

---

## Decision Drivers

- **RR v1.8 pp. 11, 21:** "Enters play" covers both played and put-into-play; "played" (cost paid) is a strict subset.
- **RR v1.8 p. 4:** "Attach to a minion/ally" is a play restriction — it defines *where* to place the card when played, not a distinct timing header. Playing a card with this restriction is an ACTION.
- **Engine attachment dispatch is timing-agnostic:** `action-dispatcher.ts` routes upgrades by scanning `steps.effect === 'ATTACH_TO_HOST'` — the `timing` field is never read for this purpose. This confirms `CARD_PLAYED` timing was always meaningless for attachments.
- **Legality-checker is timing-dependent for form-gating:** `legality-checker.ts` checks `ability.timing.startsWith('HERO_')` on `ATTACH_TO_HOST` steps to infer hero-form restrictions. This preserves Webbed Up (`01009`, `timing: "HERO_ACTION"`) form-gating while Spider-Tracer/Inspired (`timing: "ACTION"`) remain unrestricted.
- **Black Cat `01002` is correct:** Her printed text says *"After you play Black Cat"* — `trigger: "CARD_PLAYED"` is intentionally retained. Her ability only fires when played, NOT when put into play.
- **ADR-0047 precedent:** Cards played from non-hand zones via `PLAY_CARD_FROM_ZONE` are still "played" — both `CARD_PLAYED` and `ENTERS_PLAY` fire.

---

## Considered Options

1. **Option 1: Remove `CARD_PLAYED`/`WHEN_PLAYED` from TimingTypeSchema; add `ENTERS_PLAY` to TriggerTypeSchema; use `ACTION` for attachment timing.**
2. **Option 2: Keep `CARD_PLAYED` as a timing type; add a new `ENTERS_PLAY` timing type alongside it.**
3. **Option 3: Introduce a separate `ATTACH_TO` timing class for upgrade cards.**

---

## Decision Outcome

**Chosen Option: Option 1**

### Rationale ("The Why")

- Playing a card is an ACTION. There is no separate "card played" timing class in Marvel Champions — the scheduling window is ACTION (or HERO_ACTION for form-gated cards).
- `WHEN_PLAYED` had zero supplemental data references — it was dead code.
- Option 2 would perpetuate the conceptual conflation and add further schema drift.
- Option 3 would introduce a non-canonical timing class not derived from RR v1.8.
- `ENTERS_PLAY` as a trigger condition accurately captures "any card entering an in-play zone" — covering both played and put-into-play paths — per RR v1.8 p. 11.

---

## Evaluation of Options

### Option 1: Remove from timing; add ENTERS_PLAY to trigger (Chosen)
- **Pros:**
  - Strict RR v1.8 semantic alignment.
  - `TimingTypeSchema` and `AbilityTiming` engine model are now in full alignment.
  - Enables correct Black Cat / Mockingbird split: Black Cat fires only on play; Mockingbird fires on both play and put-into-play.
  - 4 inline dispatch loops replaced with canonical `dispatchTrigger` — engine is now fully event-driven.
- **Cons:**
  - Requires retrofit of 7 card entries and 4 engine dispatch sites.
  - Existing tests referencing `CARD_PLAYED` prompt strings needed updating.

### Option 2: Keep CARD_PLAYED as timing, add ENTERS_PLAY timing
- **Pros:** Minimal schema change.
- **Cons:** Perpetuates the timing/trigger conflation; contradicts RR v1.8.

### Option 3: Introduce ATTACH_TO timing class
- **Pros:** Semantic clarity for attachment cards.
- **Cons:** Non-canonical; creates a third source of drift not grounded in RR v1.8.

---

## Consequences

### Positive Consequences
- `TimingTypeSchema` and the engine's `AbilityTiming` type are now in perfect alignment — neither contains `CARD_PLAYED` or `WHEN_PLAYED`.
- Ally cards with "After [card] enters play" abilities (Mockingbird, Nick Fury, Spider-Woman, Shuri, Maria Hill) now correctly fire when cards are put into play via card effects (e.g. Rapid Response), not just when played.
- Black Cat's `FORCED_RESPONSE @ CARD_PLAYED` correctly does NOT fire when she is put into play via an effect.
- Spider-Tracer and Inspired correctly use `ACTION` timing, remaining unrestricted by form.
- All `CARD_PLAYED`/`ENTERS_PLAY` dispatch is now routed through `dispatchTrigger` — engine is fully event-driven with no ad-hoc inline loops.
- Card text parser gains an `ENTERS_PLAY` pattern for future card integrations.

### Negative Consequences / Risks & Mitigations
- **Risk:** Cards currently relying on the `timing: "CARD_PLAYED"` fallback (no `trigger` field + RESPONSE timing) in the old inline dispatch loop will no longer trigger.
  - **Mitigation:** All affected cards were explicitly audited and corrected in this ADR. The `ENTERS_PLAY` trigger is now declarative — no implicit fallback needed.
- **Tech debt:** `MINION_ENTERS_PLAY` (Hawkeye) is kept as a distinct trigger for now; collapsing into a filtered `ENTERS_PLAY` is deferred.
- **In-Play Instance Binding Invariant:** The requirement that in-play entities with `CARD_PLAYED` or `ENTERS_PLAY` only respond when their own `instanceId` matches `sourceInstanceId` is formalized in [ADR-0050](0050-universal-in-play-self-referential-trigger-instance-binding.md).
