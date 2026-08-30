# [ADR-0025] Architectural Subsystem Completion & Mandatory Supplemental Review Pipeline

* **Status:** **Accepted**
* **Date:** 2026-08-30
* **Authors:** MCD Core Team
* **Deciders:** User & Antigravity

---

## Context and Problem Statement
When developing the rules engine, implementing an engine subsystem (e.g. Action Costs, Dynamic Stat Calculator, Search Pipeline, Nested Stack) often unblocks a cluster of cards that were previously held in `docs/ambiguities/` with low confidence scores.

Without a formalized protocol, developers and AI agents could implement an engine feature and move on to the next task without reviewing and promoting the cards that depend on that feature. This causes:
1. **Stale Ambiguity Reports:** Cards that are now fully supported remain marked as blocked in `docs/ambiguities/`.
2. **Untracked Regressions:** Missing automated unit tests for the newly enabled cards.
3. **Open GitHub Issues:** GitHub issues for resolved card mechanics remain open indefinitely.

---

## Decision Drivers
* **Inbox Zero Standard:** Eliminate ambiguity backlog immediately as enabling features are completed.
* **TDD Quality Gate:** Ensure every newly unlocked card has explicit unit test coverage in `tests/engine/`.
* **Issue Lifecycle Automation:** Automatically close corresponding GitHub issues with links to commits and tests.

---

## Decision Outcome

**Chosen Option:** **Codify a Mandatory 4-Step Review Trigger in `docs/coding_guidelines.md` (Section 3).**

### Protocol Rules:
Whenever an architectural subsystem or effect primitive is implemented or refactored:
1. **Mandatory Supplemental Review Trigger:** Immediately run a review pass with `card-integration-protocol` across all cards in `docs/ambiguities/` blocked by that subsystem.
2. **Supplemental Translation:** Update the card's entry in `src/data/supplemental/pack/*.json` to $\ge 95\%$ confidence.
3. **Automated Unit Tests:** Add regression unit tests in `tests/engine/` verifying the card mechanics end-to-end.
4. **Inbox Zero & GitHub Issue Closure:** Prune the ambiguity file in `docs/ambiguities/` and close the tracking GitHub issue via `gh issue close <id>`.

---

## Consequences

### Positive Consequences
* **Guaranteed Synchronization:** The engine code, supplemental data catalog, and ambiguity backlog remain 100% in sync at all times.
* **Measurable Progress:** Progress on GitHub issues and the ambiguity backlog is visible and continuous.
