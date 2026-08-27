# [ADR-0001] Record Architecture Decisions Using ADRs

* **Status:** Accepted
* **Date:** 2026-08-26
* **Authors:** MCD Core Team
* **Deciders:** User & Antigravity

---

## Context and Problem Statement
When developing a complex digital card game like Marvel Champions, many technical, architectural, and game rule design decisions will be made. Without a structured way to capture these decisions and the reasons behind them, context is easily lost, leading to repeated debates, inconsistent designs, or accidental regressions.

We need a systematic method to document all major decisions and the explicit **"why"** behind them.

---

## Decision Drivers
* **Traceability:** Ability to look back at any point and understand why a subsystem or technology was structured in a specific way.
* **Collaboration & Alignment:** Ensuring user and AI developer are completely aligned on vision, design philosophies, and tradeoffs.
* **Living Documentation:** Keeping the documentation right inside the codebase alongside the code so it stays versioned in git.

---

## Considered Options
1. **Option 1: Lightweight Markdown Architecture Decision Records (ADRs) in `docs/decisions/`**
2. **Option 2: Informal meeting notes or single monolithic document**
3. **Option 3: In-code comments only**

---

## Decision Outcome

**Chosen Option:** **Option 1: Lightweight Markdown Architecture Decision Records (ADRs)**

### Rationale ("The Why")
* ADRs provide a standardized, immutable history of decisions that evolves cleanly with git.
* Each decision is focused on a single topic with clear headers for Context, Decision Drivers, Considered Options, and **The Why** (Rationale & Consequences).
* An index table in `docs/decisions/README.md` provides an instant snapshot of all key decisions across the project lifetime.

---

## Consequences

### Positive Consequences
* Every significant architectural choice will have a recorded rationale.
* Easy onboarding and review for any future contributor or subagent.
* Clarifies assumptions before code is written.

### Negative Consequences / Risks & Mitigations
* Requires minor discipline to create/update an ADR when making architectural shifts. *Mitigation:* Antigravity will proactively draft ADRs whenever key decisions are discussed.
