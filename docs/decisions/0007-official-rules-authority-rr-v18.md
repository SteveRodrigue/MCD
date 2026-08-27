# [ADR-0007] Official Rules Authority: Rules Reference v1.8 & Learn to Play Guide

* **Status:** Accepted
* **Date:** 2026-08-26
* **Authors:** MCD Core Team
* **Deciders:** User & Antigravity

---

## Context and Problem Statement
*Marvel Champions: The Card Game* has evolved over multiple years with revised timing structures, keyword definitions, and card errata across different rulebook iterations.

To prevent conflicting interpretations and ensure strict rules accuracy across all contributors and automated test suites, the project must establish an explicit, authoritative source of truth for all game rules, timing triggers, and card errata.

---

## Decision Drivers
1. **Unambiguous Rules Authority:** A single, authoritative benchmark for all game mechanics, trigger priority, and timing windows.
2. **Up-to-Date Errata Integration:** Incorporating all official card errata and rules clarifications issued by Fantasy Flight Games (FFG).
3. **Local Reference Availability:** The official PDF rulebooks are stored directly in the `references/` directory for immediate offline verification.

---

## Decision Outcome

**Chosen Authority:** The official Fantasy Flight Games documents stored in `references/`:
1. **Primary Authority for Complex Rules, Timing & Errata:**
   * **[Rules Reference v1.8](references/mc_rulesreference_v18_compressed.pdf)** (`references/mc_rulesreference_v18_compressed.pdf`)
   * Defines: Trigger hierarchy (*Forced Interrupts, Interrupts, Replacement Effects, Forced Responses, Responses*), Cost Payment resolution, Attack/Defense/Thwart frameworks, Keyword mechanics, and official card errata.
2. **Introductory Authority for Sequence & Terminology:**
   * **[Learn to Play Guide](references/mvc01_learn_to_play_eng-compressed.pdf)** (`references/mvc01_learn_to_play_eng-compressed.pdf`)
   * Defines: Core phase structure, turn sequence, and player board concepts.

---

## Rules Hierarchy & Conflict Resolution

Whenever a rules ambiguity or card interaction is implemented or tested:
1. **The Golden Rule:** If the text of a card directly contradicts the text of the Rules Reference, the card text takes precedence.
2. **Rules Authority:** If a card's interaction is ambiguous, the **Rules Reference v1.8** is the definitive law.
3. **Official Errata:** Any card text that has received an official FFG errata in Rules Reference v1.8 (Section: *Errata*) must be implemented with its errata text applied via `src/data/overrides/`.

---

## Consequences

### Positive Consequences
* All automated unit tests in `tests/` will be written against verified Rules Reference v1.8 clauses.
* Eliminates guesswork, personal interpretations, or reliance on outdated v1.0–v1.4 rulebooks.
* Guarantees 100% tournament-accurate rules fidelity.
