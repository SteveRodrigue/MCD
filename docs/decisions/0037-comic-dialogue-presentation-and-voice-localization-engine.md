# [ADR-0037] Comic Dialogue Presentation and Character Voice Localization Engine

* **Status:** Accepted
* **Date:** 2026-08-31
* **Authors:** MCD Core Team
* **Deciders:** User & Antigravity

---

## Context and Problem Statement
In accordance with Marvel Champions rules transparency (ADR-0009) and the 1960s Pop-Art visual aesthetic (ADR-0004), raw game action logging (event keys, raw JSON payloads) must be presented in an authentic, engaging narrative comic format that immerses players into a living comic book story. Furthermore, this dialogue stream must be fully localizable across multiple languages without rules engine coupling (ADR-0005).

---

## Decision Drivers
1. **Authentic 1960s Marvel Comic Visuals:** Distinct, recognizable speech balloons reflecting hero, villain, and narrator voices.
2. **Actor & Speaker Role Differentiation:** Clear visual hierarchy between Hero Speech (white balloons), Alter-Ego Thought (scalloped cloud balloons), Villain Threat (jagged burst balloons), and Omniscient Narrator (Stan Lee golden yellow caption boxes).
3. **Decoupled i18n Localization (ADR-0005):** Rules engine outputs structured `GameLogEntry` objects; the UI translation engine handles locale template interpolation and localized character quotes.
4. **Dynamic Multilingual Switching:** Real-time on-the-fly language toggling without game state re-execution or mutation.

---

## Decision Outcome

We establish the **Comic Dialogue & Character Voice Presentation Architecture**:

### 1. 4-Tier Dialogue Presentation Hierarchy
* **`hero_speech` (`<HeroSpeechBalloon>`):** White rounded speech balloon with pointer tail, hero avatar badge (`🕷️ SPIDER-MAN`), in-character quip (`"Take that, horn-head!"`), and highlighted action prose with stat badges.
* **`hero_thought` (`<HeroThoughtBalloon>`):** Scalloped cloud thought balloon for alter-ego recovery and planning.
* **`villain_shout` (`<VillainSpeechBalloon>`):** Jagged spiky burst balloon with crimson/dark styling and loud capitalized shouting threats (`"I'M GONNA CRUSH YOU FLAT, BUG!"`).
* **`narrator_caption` (`<NarratorCaptionBox>`):** Classic Marvel yellow rectangular caption box (`bg-comic-yellow`) with Stan Lee style panel titles (`MEANWHILE...`, `ROUND 2...`).

### 2. Localization Dictionaries (`src/locales/{lang}/combat-log.json`)
* Contains parameterized narrative templates, character flavor quotes by context (`attack`, `thwart`, `recover`, `scheme`, `boost`), and localized sound effects (`POW!` vs. `VLAM !`, `THWIP!` vs. `TCHWIP !`).

### 3. Comic Action Chronicle Drawer (`CombatLogDrawer.tsx`)
* Full-height slide-over drawer styled as a vintage Daily Bugle action dispatch.
* Speaker category filters (`ALL`, `HEROES`, `VILLAINS`, `NARRATOR`).
* One-click language switcher (`EN` / `FR`).
* Interactive **Font Cycler** with `localStorage` persistence, enabling real-time preview between `Komika Text`, `Comic Relief`, `Comic Neue`, `Clean (Inter)`, and `Bangers`.
* Collapsible technical debug inspector for rules auditing.

### 4. Local-First Font Bundling & Base UI Scaling
* **100% Offline Font Assets:** `Komika Text` (`TypoPRO-KomikaText-*.ttf`), `Comic Relief` (`@fontsource/comic-relief`), and `Bangers` (`@fontsource/bangers`) are bundled directly into the local application package and production bundle (`dist/assets/`).
* **Root 110% Base UI Scaling:** Configured `html { font-size: 110%; }` in Tailwind base layers, uniformly scaling all `rem`-based cards, tableaus, boards, drawers, and typography by +10% without requiring manual browser zoom.

---

## Consequences

### Positive
* Game history feels like reading a classic Marvel comic book issue.
* Differentiates villain attacks from hero counter-attacks instantly.
* Fully accessible to international players across supported languages.
* 100% offline support with zero reliance on external font CDNs and zero flash-of-unstyled-text (FOUT).

### Negative
* Requires maintaining character voice quotes for future hero and scenario additions.
