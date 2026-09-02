# [ADR-0009] In-Game Action History & Real-Time Combat Log

* **Status:** Accepted
* **Date:** 2026-08-26
* **Authors:** MCD Core Team
* **Deciders:** User & Antigravity

---

## Context
In digital card games like *Marvel Champions*, players frequently need to:
1. **Understand Immediate Actions During Play:** Inspect the combat log to see why damage occurred, what boost icons were drawn, which interrupts triggered, and why a status card was discarded.
2. **Review Match Timeline Post-Game:** Review a completed game round-by-round to analyze decision branches, close calls, misplays, and key strategic turning points.
3. **Immersive 60s Comic Pop-Art Presentation:** Accompany log entries with dynamic comic onomatopoeia (`THWIP!`, `POW!`, `WHAM!`, `CLANG!`, `FOILED!`) to bring table actions to life.

## Decision
We establish a **Structured Invariant Game History Log (`state.log`)**:
1. **First-Class Immutable Event Entries (`GameLogEntry`):**
   * Every engine mutation emits a strongly-typed `GameLogEntry` containing:
     * `id`: Unique entry identifier.
     * `timestamp`: Unix timestamp of the event.
     * `round`: The round index in which the action occurred.
     * `phase`: `PLAYER_PHASE` vs. `VILLAIN_PHASE`.
     * `category`: `combat` | `scheme` | `card_play` | `status` | `phase` | `ability`.
     * `actor`: Entity responsible (`Spider-Man`, `Rhino`, `Hydra Mercenary`).
     * `key`: Localization/i18n message key for multilingual rendering (ADR-0005).
     * `params`: Key-value payload (damage values, boost icons, threat counts, card titles).
     * `onomatopoeia`: Stylized comic book sound effect (e.g. `POW!`, `THWIP!`, `WHAM!`).
     * `text`: Fallback human-readable formatted string for instant display.

2. **Dual-Use Presentation & Comic Book Dialogue Engine (ADR-0037):**
   * **In-Game (Action Chronicle Drawer):** A full-height comic issue drawer featuring 4-tier visual dialogue differentiation (`hero_speech`, `hero_thought`, `villain_shout`, `narrator_caption`), localized sound effects, and character flavor quotes.
   * **Post-Game (Match Review Modal / Log Export):** Full searchable, filterable chronological timeline with round headers, damage summaries, and exportable Markdown report format.

## Consequences
### Positive
* **100% Rule Transparency:** Eliminates player confusion regarding hidden boost cards, interrupt timings, or consequential damage.
* **Immersive Comic Dialogue:** Transforms mechanical actions into a dynamic, character-driven story stream.
* **Streamlined Debugging & AI Testing:** Automated bot simulations and test suites can generate human-readable reports from the exact same log structure.
* **i18n Compatible:** `key` + `params` allows instant on-the-fly language switching without re-logging.

### Negative
* `GameState` size grows with each turn; mitigated by lightweight string payloads and optional log trimming if game exceeds hundreds of rounds.
