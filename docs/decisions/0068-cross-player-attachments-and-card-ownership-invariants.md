# [ADR-0068] Support Cross-Player Attachments & Card Ownership Invariants

- **Status:** Accepted
- **Date:** 2026-09-17
- **Authors:** MCD Core Team
- **Deciders:** User & Antigravity

---

## Context and Problem Statement

In Marvel Champions LCG, several player cards feature the rule *"Play under any player's control"* (e.g. `01057` Combat Training, `01065` Heroic Intuition, and `01081` Armored Vest), or attach to characters controlled by other players (e.g. `01074` Inspired attaching to a teammate's ally).

Per the Marvel Champions Rules Reference (RR v1.8 p. 23 "Ownership and Control"):
1. *"A card's owner is the player whose deck contained the card at the start of the game."*
2. *"A card enters play under the control of the player who played it, unless an ability specifies otherwise."*
3. *"Some cards have text that reads, 'Play under any player's control.' When playing such a card, the player playing it chooses which player's play area the card enters. That player takes control of the card."*
4. *"A player cannot choose to play such a card under a player's control if that player already has the maximum allowable copies of that card in play."*
5. *"When a card leaves play, it is placed in its owner's discard pile (or out of play area), regardless of who controlled it while it was in play."*

Previously, the headless engine assumed cards played by a player entered their own tableau and routed all discards from a player's tableau directly to that controller's discard pile. This caused cross-player cards to be misplaced into teammates' discard piles when discarded or when their host character was defeated, violating card conservation laws (ADR-0040) and RR v1.8 ownership rules.

---

## Decision Drivers

- Driver 1: **Rules Fidelity (RR v1.8 p. 23):** Persistent ownership must be strictly preserved across all zone transitions, ensuring cards always return to the deck owner's discard pile when leaving play.
- Driver 2: **Declarative Supplemental Architecture:** Card properties like *"Play under any player's control"* must be modeled declaratively in `CardEnrichmentSchema` (`playUnderAnyPlayerControl: true`) rather than hardcoded in the engine.
- Driver 3: **Consistent UI/UX via Modal Dialogs:** Multiplayer control selection must integrate seamlessly with `DecisionPromptModal`, graying out ineligible players who have already reached `maxPerPlayer`.
- Driver 4: **Universal Card Conservation (ADR-0040):** Card instances must never be duplicated or lost during cross-player transfers or discards.

---

## Considered Options

1. **Option 1: Controller-Centric Discard Routing with Manual Clean-Up**
   - Retain current controller-based discard routing and attempt to reconcile cards upon deck reshuffle.
2. **Option 2: Persistent `ownerId` Stamp on Card Instances with Centralized Discard Routing and Decision Prompts**
   - Stamp `ownerId` on all player card instances at setup (`pConfig.id`).
   - Declaratively flag cards with `playUnderAnyPlayerControl: true` in supplemental JSON.
   - Enqueue a `DecisionPromptModal` during multiplayer play to choose the controlling player, graying out players at `maxPerPlayer`.
   - Provide a centralized `discardCardInstance(state, card, fallbackPlayerId)` helper that atomically cascades host attachments, removes the card from all zones, and routes to `card.ownerId`'s discard pile.

---

## Decision Outcome

**Chosen Option:** **Option 2: Persistent `ownerId` Stamp on Card Instances with Centralized Discard Routing and Decision Prompts**

### Rationale ("The Why")

Option 2 strictly honors RR v1.8 p. 23 while preserving the zero-tech-debt invariant:
1. Stamping `ownerId` during `setupGame()` provides an immutable, persistent provenance record that survives cross-player transfers, attachments, and tableau moves.
2. Routing discards through `discardCardInstance()` guarantees universal card conservation (ADR-0040) and ensures attached upgrades (e.g. *Inspired*) return to the playing hero's discard pile when a teammate's ally leaves play.
3. Declarative `playUnderAnyPlayerControl` in `CardEnrichmentSchema` keeps card rules data-driven in `core.json`.
4. Supporting `disabled` and `disabledReason` on `DecisionPromptOption` and rendering them in `DecisionPromptModal` provides clear, accessible feedback to users on why a teammate cannot receive duplicate copies of restricted upgrades.

---

## Evaluation of Options

### Option 1: Controller-Centric Discard Routing with Manual Clean-Up
- **Pros:**
  - Minimal engine code adjustments initially.
- **Cons:**
  - Violates RR v1.8 p. 23 ("When a card leaves play, it is placed in its owner's discard pile").
  - Corrupts deck composition and player hand sizes across turns.
  - Generates severe tech debt and unmaintainable state reconciliation logic.

### Option 2: Persistent `ownerId` Stamp on Card Instances with Centralized Discard Routing and Decision Prompts
- **Pros:**
  - 100% compliant with RR v1.8 ownership and control rules.
  - Universal and composable across both upgrades and host attachments.
  - Fail-fast validation with disabled decision options preventing illegal game states.
  - Zero tech debt, robust state conservation.
- **Cons:**
  - Requires updating `createCardInstance`, `setupGame`, `canPlayCard`, and discard routing points.

---

## Consequences

### Positive Consequences
- Cards like *Combat Training*, *Heroic Intuition*, and *Armored Vest* can be legally played under any eligible player's control in multiplayer.
- Players at `maxPerPlayer` are disabled in the selection modal with a clear warning badge.
- If all players at the table have reached `maxPerPlayer`, `canPlayCard` rejects upfront without consuming resources.
- Discarding attachments or host defeat cleanly routes cards back to their original owners' discard piles.

### Negative Consequences / Risks & Mitigations
- *Risk:* In solo play, extra prompt overhead might interrupt game flow.
  *Mitigation:* In solo mode (`nextState.players.length === 1`), the engine automatically assigns the card to the sole player without opening a decision prompt.
