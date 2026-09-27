# [ADR-0070] Systemic Chosen Entity Targeting and Decision Fallback Architecture

- **Status:** Accepted
- **Date:** 2026-09-27
- **Authors:** MCD Core Team
- **Deciders:** User & Antigravity
- **Related Issues:** #146 ("First Aid: Didn't offer to heal both heroes while both are injured")

---

## Context and Problem Statement

When playing cards with targeting requirements (such as *First Aid*, *Get Ready*, or *Medical Team*), the engine exhibited two interrelated failure modes:
1. **Target Pre-Binding Incompleteness:** Playing *First Aid* did not allow players in the UI to select among multiple injured characters across the table, or omitted valid identity targets when both heroes were injured.
2. **Coupled Scope and State Filter Defect:** The engine lacked a unified discovery primitive that decoupled the *structural scope* (`CHOSEN_CHARACTER`, `CHOSEN_FRIENDLY_CHARACTER`, `CHOSEN_ALLY`, `CHOSEN_MINION`, `CHOSEN_PLAYER`, `CHOSEN_SCHEME`, `CHOSEN_ENEMY`) from optional *predicate filters* (`damaged?: boolean`, `exhausted?: boolean`, `traits?: string[]`, `status?: StatusCard`).
3. **Missing Two-Layer Legality & Fallback Architecture:**
   - **Layer 1 (Legality Gate):** Per Rules Reference v1.8 p. 3, a card cannot be played unless it has the potential to change the game state. When 0 eligible damaged targets exist, *First Aid* should not be playable.
   - **Layer 2 (Execution Safety & Decision Fallbacks):** If a card or ability is dispatched without a target ID when multiple eligible candidates exist, the engine should enqueue a `PendingDecisionPrompt` rather than failing or arbitrarily defaulting to self.

---

## Decision Drivers

- **RR v1.8 Precision:** Rules Reference v1.8 p. 3 ("Change the Game State"), p. 11 ("Damage"), p. 16 ("Play Requirements"), and p. 19 ("Target").
- **Unfiltered Scopes vs Optional Filters:** A target scope like `CHOSEN_CHARACTER` is structurally universal (all characters). State predicates (such as `damaged: true` or `exhausted: true`) are optional constraints passed via `TargetFilterOptions`.
- **Headless Decoupling:** Candidate discovery and decision prompting must live in the headless engine (`target-resolver.ts`, `legality-checker.ts`, `action-dispatcher.ts`), independent of React or DOM.
- **No Friction Auto-Binding:** If exactly 1 valid candidate exists when the target is omitted, auto-bind without interrupting player flow.
- **Pre-Play UI Targeting:** `CardPaymentModal` must present comic-styled target selector badges for heal, ally, scheme, and minion targets prior to committing payments and dispatching `PLAY_CARD`.

---

## Decision Outcome

**Chosen Option:** Implement **Path B (Systemic Targeting Architecture)** across engine candidate resolution, pre-play validation, decision prompt fallbacks, and UI selectors.

### 1. Unified Candidate Discovery Engine (`getEligibleTargets`)
Added `TargetFilterOptions` and `getEligibleTargets(state, player, targetScope, filterOptions)` to [`src/engine/effects/target-resolver.ts`](../../src/engine/effects/target-resolver.ts):
- Structural scopes supported: `CHOSEN_CHARACTER`, `CHOSEN_FRIENDLY_CHARACTER`, `CHOSEN_ALLY`, `CHOSEN_MINION`, `CHOSEN_PLAYER`, `CHOSEN_SCHEME`, `CHOSEN_ENEMY`, `CHOSEN_HERO`, `SELF`, `SELF_IDENTITY`, `IDENTITY`, `ACTIVE_IDENTITY`.
- Predicate filters supported: `damaged?: boolean`, `exhausted?: boolean`, `traits?: string[]`, `status?: StatusCard`.

### 2. Layer 1: Pre-Play Legality Gating
Extended [`src/engine/pipeline/legality-checker.ts`](../../src/engine/pipeline/legality-checker.ts):
- `evaluateCharacterTargetRequirement`: Validates that cards/abilities with heal effects have at least 1 damaged character in play.
- `evaluateAllyTargetRequirement`: Validates that cards/abilities with readying effects have at least 1 exhausted ally in play.
- Integrated into `canPlayCard` and `canInitiateAbility`.

### 3. Layer 2: Action Execution & Decision Prompt Fallbacks
Extended [`src/engine/pipeline/action-dispatcher.ts`](../../src/engine/pipeline/action-dispatcher.ts):
- `PLAY_CARD`: If `targetInstanceId` is omitted, evaluates eligible targets. If exactly 1 exists, auto-binds. If multiple exist, enqueues a `PendingDecisionPrompt` with option handlers for `EVENT_CHOSEN_TARGET`.
- `USE_CARD_ABILITY`: For non-player chosen targets (e.g. *Medical Team*, *Tac Team*), auto-binds single candidates or enqueues a decision prompt with `ABILITY_CHOSEN_TARGET`. Built-in multiplayer handlers for `CHOSEN_PLAYER` (e.g. *Helicarrier*, *Avengers Mansion*, *Stark Tower*) continue to manage contextual player prompts.
- `RESOLVE_DECISION_PROMPT`: Handles `isEventTargetChoice` and `isAbilityTargetChoice`.

### 4. Pre-Play UI Selection
Updated [`src/ui/components/board/CardPaymentModal.tsx`](../../src/ui/components/board/CardPaymentModal.tsx):
- Auto-detects heal, ally, scheme, and minion target scopes.
- Displays comic-styled target selection buttons showing current/max HP and damage taken for heal targets, exhausted badges for allies, and player form indicators.

---

## Consequences

- **Positive:** Issue #146 is resolved structurally; First Aid and all future heal/ready/target cards provide multi-target options seamlessly.
- **Positive:** Unfiltered targeting is fully preserved for cards that do not require state predicates.
- **Positive:** Headless test coverage is comprehensive across candidate discovery, legality gating, auto-binding, multi-choice prompt resolution, and minion/villain restrictions.
