# [ADR-0002] Decoupled Headless Rules Engine Architecture

* **Status:** Accepted
* **Date:** 2026-08-26
* **Authors:** MCD Core Team
* **Deciders:** User & Antigravity

---

## Context and Problem Statement
*Marvel Champions: The Card Game* has intricate rules interactions involving simultaneous triggers, interrupts, forced interrupts, replacement effects (e.g., Tough status cards absorbing damage), dynamic keyword restrictions (Guard, Patrol, Crisis, Hazard), and multi-step phase sequences (Player phase, Villain attack/scheme steps with boost resolution).

Coupling rule execution directly to a rendering framework or UI components (such as React state or Unity MonoBehaviours) leads to massive complexity, difficulty in testing edge cases, and high refactoring costs when UI designs change.

---

## Decision Drivers
* **100% Deterministic Rules Verification:** We must be able to run hundreds of unit and scenario tests in milliseconds without launching a UI.
* **Separation of Concerns:** The engine should only care about game rules, state transitions, and event emission. The UI should only care about rendering state, animating transitions, and capturing player inputs.
* **Serialization & State Time Travel:** The engine state must be fully serializable (JSON) to enable saving/loading games, undoing actions, replay viewing, and future network multiplayer synchronization.
* **UI Flexibility:** Freedom to build or switch UI frontends (Web React, Canvas/Pixi, or native desktop) without touching a single line of game rules logic.

---

## Considered Options
1. **Option 1: Decoupled Headless Rules Engine (Core Logic as a pure standalone module/package)**
2. **Option 2: UI-Coupled Game Logic (State directly bound to UI framework components)**
3. **Option 3: Full Game Engine Monolith (e.g., Godot/Unity built-in scene script hierarchy)**

---

## Decision Outcome

**Chosen Option:** **Option 1: Decoupled Headless Rules Engine**

### Rationale ("The Why")
* **Testability:** With a pure headless engine, we can write automated tests verifying every single Marvel Champions card and rules edge case (e.g. testing whether *Spider-Sense* triggers before the boost card is flipped, whether *Tough* prevents excess damage without triggering *After Taking Damage* responses, etc.) via simple, lightning-fast test suites.
* **Modularity:** Changes to visual styling, animations, or UI layouts will never break game rules logic, and rules fixes will never cause UI regressions.
* **Future-Proofing:** A headless engine can easily run inside a browser, in a Web Worker, inside a desktop app, or even on a dedicated multiplayer backend server with zero code duplication.

---

## Consequences

### Positive Consequences
* Test-Driven Development (TDD) can be utilized to implement card by card with 100% confidence.
* Clean, serializable `GameState` tree and an explicit `Action / Event` pipeline.
* Rapid prototyping and regression testing.

### Negative Consequences / Risks & Mitigations
* Requires an explicit communication/event bridge between the headless engine and the UI client. *Mitigation:* We will implement a clear `dispatchAction()` and `onStateChange()` subscription pattern.
