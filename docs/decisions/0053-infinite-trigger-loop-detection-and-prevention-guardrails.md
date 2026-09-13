# [ADR-0053] Infinite Trigger Loop Detection & Prevention Guardrails

- **Status:** Accepted
- **Date:** 2026-09-12
- **Authors:** MCD Core Team
- **Deciders:** User & Antigravity

---

## Context and Problem Statement
In *Marvel Champions: The Card Game* (Rules Reference v1.8 p. 16 "Priority of Timing", p. 24 "Triggered Abilities"), forced abilities (Forced Interrupts and Forced Responses) execute automatically whenever their trigger conditions occur without requiring player consent or an opportunity to pass.

When card abilities or engine primitives interact, circular dependencies can emerge:
1. **Direct Mutual Cycles (A ? B):** Ability A on Card 1 triggers on Event X and produces Event Y (e.g. Dealing damage). Ability B on Card 2 triggers on Event Y and produces Event X (e.g. Taking damage or discarding a card).
2. **Self-Triggering Loops (A ? A):** Ability A triggers on an event type (e.g. DAMAGE_DEALT or CARD_DISCARDED) and its execution emits that exact same event type, recursively re-triggering itself without a terminal base case.
3. **Unbounded Cascades:** Complex chains of chained triggers (A ? B ? C ? D ...) that fail to terminate due to missing exhaustion costs, missing ability limits (ONCE_PER_ROUND), or recursive replacement effects.

In a JavaScript / TypeScript single-threaded runtime, unchecked circular recursion results in RangeError: Maximum call stack size exceeded, which terminates or freezes the engine and web application with no actionable diagnostic feedback to the user.

How should the MCD rules engine detect, prevent, diagnose, and recover from infinite trigger loops?

---

## Decision Drivers
- **Driver 1: Official Rules Fidelity & Integrity (RR v1.8):** Adhere to the core rule that mandatory effects without progression cannot loop indefinitely.
- **Driver 2: Runtime Crash Immunity:** Prevent unhandled RangeError call stack overflows and thread freezes in both Node.js and browser runtimes.
- **Driver 3: Precise Actionable Diagnostics:** Identify the exact offending cards, ability IDs, trigger events, and cycle path ( \rightarrow B \rightarrow A$) so players and developers immediately understand what caused the halt.
- **Driver 4: Zero False Positives for Legitimate Chained Triggers:** Legitimate multi-step sequences (e.g., Attack ? Damage ? Boost ? Retaliate ? Response) must resolve without disruption.
- **Driver 5: Headless & UI Resilience:** Throw typed errors for headless simulation/test assertions while providing graceful presentation modals in the React UI.

---

## Considered Options
1. **Option 1: Static Ability Graph Pre-Analysis**
2. **Option 2: Arbitrary Execution Timeout / Watchdog**
3. **Option 3: Dynamic Trigger Call Chain Tracking, Cycle Detection & Depth Guard (Chosen)**

---

## Decision Outcome

**Chosen Option:** **Option 3: Dynamic Trigger Call Chain Tracking, Cycle Detection & Depth Guard**

### Rationale ("The Why")
- Static pre-analysis (Option 1) is intractable for dynamic card games because trigger validity depends on runtime state (in-play zones, costs, status tokens, current hero form, and targeting legality).
- Timeouts (Option 2) are non-deterministic, cause race conditions in slow testing or mobile environments, and cannot reconstruct the exact card cycle.
- Dynamic call chain tracking (Option 3) is deterministic, serializable, detects loops at the exact moment a cycle completes ((N)$ with  \le 15$), provides full stack attribution, and works identically across headless CLI and browser UI.

---

## Evaluation of Options

### Option 1: Static Ability Graph Pre-Analysis
- **Pros:**
  - Zero runtime overhead during gameplay.
- **Cons:**
  - High false positive rate: many theoretical loops cannot happen because of mutually exclusive hero forms, zone restrictions, or costs.
  - Does not protect against unexpected combinations introduced by future encounter sets or modular scenarios.

### Option 2: Arbitrary Execution Timeout / Watchdog
- **Pros:**
  - Trivial to implement using setTimeout or worker threads.
- **Cons:**
  - Highly non-deterministic and flaky across different hardware.
  - Produces poor diagnostics (e.g., "Operation timed out" instead of pinpointing the two cards looping).

### Option 3: Dynamic Trigger Call Chain Tracking, Cycle Detection & Depth Guard (Chosen)
- **Pros:**
  - Pinpoints the exact cycle path (e.g., Card A [01015] (ability_1) ? Card B [01020] (ability_2) ? Card A [01015] (ability_1)).
  - Zero external timers; purely functional state evaluation.
  - Two-tier safety net: immediate cycle detection for recurring loops, and hard depth ceiling (MAX_TRIGGER_DEPTH = 15) for unbounded non-cyclic cascades.
  - Typed InfiniteLoopError allows unit tests to assert loop detection while the UI catches and presents a friendly comic modal.
- **Cons:**
  - Requires propagating 	riggerChain and 	riggerDepth through TriggerContext and EffectExecutionContext.

---

## Consequences

### Positive Consequences
- Guarantees runtime stability: the MCD engine will never crash from unhandled call stack overflows due to circular card triggers.
- Provides immediate debugging clarity for content designers and automated test suites with structured TriggerCallNode[] cycle dumps.
- Enhances player UX with a comic-styled modal dialog detailing why an action halted.

### Negative Consequences / Mitigations
- Context propagation: Child effect steps in src/engine/effects/index.ts that dispatch secondary triggers must forward the existing 	riggerChain and increment 	riggerDepth.
