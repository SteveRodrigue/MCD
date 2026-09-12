# [ADR-0051] Universal Two-Stage In-Play Card Interaction & Action Selection Pipeline

- **Status:** Accepted
- **Date:** 2026-09-12
- **Authors:** MCD Core Team
- **Deciders:** User & Antigravity

---

## Context and Problem Statement

In Marvel Champions Digital, clicking in-play cards on the player tableau occasionally executed actions silently without presenting an action picker or prompting for targets:
1. Clicking an **Ally** card silently thwarted `main_scheme` if threat $> 0$, or immediately attacked the Villain if threat $= 0$ and no minions were in play.
2. Clicking a **Tableau Support/Upgrade** card (e.g. Energy Channel) immediately executed the `firstUsable` ability found, ignoring other available activated abilities on the card.
3. Attacking or thwarting with single eligible targets bypassed player confirmation entirely.

This violated player agency (Issue #98), created confusing table dynamics, and removed the ability to inspect stats, review consequential damage, or abort an action before committing state mutations.

---

## Decision Drivers

- **Player Agency (RR v1.8 p. 3, 5, 29):** The player must always choose which action to perform and which target to affect. Actions must never be silently chosen by the engine or UI.
- **Consistency Across All In-Play Cards:** A uniform interaction model must govern Hero/Alter-Ego identity cards, Allies, Upgrades, Supports, and Attachments.
- **Clear Separation of Action Declaration vs. Parameter Resolution:** Choosing an action (Stage 1) must be cleanly decoupled from targeting and resource payment (Stage 2).
- **Zero Impact on Hand Cards:** Cards in hand follow the established playability evaluation and payment modal flow (`CardPaymentModal`).

---

## Considered Options

1. **Option 1: Direct Action Mini-Buttons Only (Remove Card Clicks Entirely)**
   - Disable clicks on in-play card views, requiring players to exclusively click small action buttons (`⚔️`, `🛡️`, `⚡`).
2. **Option 2: Unified Two-Stage In-Play Card Interaction Architecture (Chosen)**
   - Clicking ANY in-play card opens an action modal (Stage 1: `IdentityActionModal`, `AllyActionModal`, or `TableauActionModal`).
   - If the selected action requires targeting or resource payment, a secondary prompt opens (Stage 2: `AttackTargetModal`, `ThwartTargetModal`, or `CardPaymentModal`).
   - Shortcut buttons on the board directly trigger Stage 2 selectors with cancel options.

---

## Decision Outcome

**Chosen Option:** **Option 2: Unified Two-Stage In-Play Card Interaction Architecture**

### Rationale ("The Why")

Option 2 preserves intuitive physical card interactions: players naturally click on cards on the table to interact with them. By introducing dedicated action pickers (`AllyActionModal`, `TableauActionModal`, `IdentityActionModal`) followed by deterministic parameter selectors (`AttackTargetModal`, `ThwartTargetModal`), player agency is fully guaranteed while retaining quick-action board shortcuts. Furthermore, `canAllyThwart` legality checks and side scheme thwarting are properly implemented in the engine.

---

## Evaluation of Options

### Option 1: Direct Action Mini-Buttons Only
- **Pros:**
  - Simple to implement.
- **Cons:**
  - Poor UX; clicking character or card art is standard across digital card games.
  - Clutters cards with multiple micro-buttons for complex cards with multiple abilities.

### Option 2: Unified Two-Stage In-Play Card Interaction Architecture
- **Pros:**
  - Complete player agency with zero silent defaults.
  - Consistent across Hero, Allies, Supports, Upgrades, and Attachments.
  - Players can review stats, consequential damage, and cancel at either stage.
  - Fully supports side schemes, Crisis icons, and Patrol minions during thwarting.
- **Cons:**
  - Requires maintaining dedicated modal components and targeting utilities.

---

## Consequences

### Positive Consequences

- Issue #98 is completely resolved.
- Allies can thwart side schemes legally, reducing threat and defeating schemes when threat reaches 0.
- `canAllyThwart` legality checker enforces Crisis and Patrol rules.
- Players are never trapped into accidental attacks or thwarts.

### Negative Consequences / Risks & Mitigations

- **Risk:** Multiple modal layers if not properly managed.
  - **Mitigation:** Stage 1 action modals cleanly close before opening Stage 2 targeting modals, keeping modal depth at exactly 1 at all times.
