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
1. **Primary & Superseding Authority:**
   * **[Rules Reference v1.8](../../references/mc_rulesreference_v18_compressed.pdf)** (`references/mc_rulesreference_v18_compressed.pdf`)
   * **The Rules Reference v1.8 supersedes and corrects the Learn to Play guide in all cases.**
   * Defines: Precise timing hierarchies (*Forced Interrupts, Interrupts, Replacement Effects, Forced Responses, Responses*), Cost Payment resolution, Attack/Defense/Thwart frameworks, Keyword mechanics, and official card errata.
2. **Introductory Tutorial & Sequence Guide:**
   * **[Rules Reference Markdown](../../references/rules_reference_v18.md)** (`references/rules_reference_v18.md`)
   * Used for timing flows, basic component anatomy, and rules terminology. If any conflict exists, the Rules Reference v1.8 strictly prevails.

---

## Rules Hierarchy & Conflict Resolution

Whenever a rules ambiguity or card interaction is implemented or tested:
1. **The Golden Rule:** Card text overrides general rules; when card text is ambiguous, the Rules Reference v1.8 governs.
2. **Document Hierarchy:** **Rules Reference v1.8 strictly supersedes and corrects the Learn to Play guide.**
3. **Official Errata:** Any card text that has received an official FFG errata in Rules Reference v1.8 (Section: *Errata*) must be implemented with its errata text applied via `src/data/overrides/`.

---

## Consequences

### Positive Consequences
* All automated unit tests in `tests/` will be written against verified Rules Reference v1.8 clauses.
* Eliminates guesswork, personal interpretations, or reliance on outdated v1.0–v1.4 rulebooks.
* Guarantees 100% tournament-accurate rules fidelity.
