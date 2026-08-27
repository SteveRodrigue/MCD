# [ADR-0005] Internationalization (i18n) & Multi-Language Localization

* **Status:** Accepted
* **Date:** 2026-08-26
* **Authors:** MCD Core Team
* **Deciders:** User & Antigravity

---

## Context and Problem Statement
*Marvel Champions: The Card Game* is played worldwide and is officially published in numerous languages (English, French, Spanish, German, Italian, etc.). Furthermore, card databases such as `marvelsdb-json-data` provide translations for cards and encounter sets across multiple locales.

To ensure the game is accessible to an international audience, all UI text, gameplay prompts, logs, onomatopoeia badges, and card text must be easily translatable from default English without requiring modifications to the core game logic or UI component code.

---

## Decision Drivers
1. **Decoupled Text & Logic:** Zero hardcoded user-facing strings in UI components or engine rules. Card abilities must execute based on internal IDs and mechanics, not localized text strings.
2. **Community Translation Friendly:** Localization files must be stored in standard, human-readable JSON formats so contributors can easily add or correct translations via Pull Requests.
3. **Card Data Localization Alignment:** Seamless compatibility with `marvelsdb-json-data` multi-language schemas (e.g. English `en`, French `fr`, Spanish `es`, etc.).
4. **Comic Onomatopoeia Localization:** Support localized comic sound effects and dialogue bubbles (e.g. English *POW! / BAM! / THWIP!* vs. French *VLAM! / BAM! / POUF!*).
5. **Dynamic Locale Switching:** Players can change language on the fly in game settings without restarting the application.

---

## Considered Options

### Option 1: Structured JSON Locale Dictionaries with `react-i18next` / `i18next` + MarvelsDB Locale Ingestion
* UI strings and system logs are managed via key-based JSON files (`src/locales/en.json`, `src/locales/fr.json`, etc.).
* Card titles, traits, and ability texts are indexed by card ID and loaded dynamically based on active locale.
* Standardized, type-safe translation keys with fallback to English (`en`).

### Option 2: Hardcoded English with Late String Replacement
* Develop entire project in English and attempt string pattern replacement later.

### Option 3: External Translation API / Dynamic Runtime Machine Translation
* Send strings to external translation APIs at runtime.

---

## Decision Outcome

**Chosen Option:** **Option 1: Structured JSON Locale Dictionaries (`i18next`) + Multi-language Card Data Ingestion**

### Rationale ("The Why")
* **Clean Code Separation:** By establishing i18n from Day 1, developers are prevented from scattering hardcoded English strings across the codebase, avoiding painful retroactive refactoring.
* **Direct Compatibility with MarvelsDB:** The card database already structures translations by language code (`en`, `fr`, `de`, `es`, `it`). Our data ingestion layer can load card translations directly into the client dictionary.
* **Community Contributions:** Non-programmer fans who want to translate the game into their native language only need to edit a single JSON file without touching TypeScript code.
* **Interpolation & Pluralization:** Handles complex game messages cleanly (e.g., `"Deal {{count}} damage to {{target}}"` or `"{count, plural, one {1 threat} other {# threats}} removed"`).

---

## Architectural Guidelines for Implementation

1. **UI & Engine Prompts:**
   * All user prompts and log entries use translation keys:
     ```typescript
     // Example
     t('prompts.chooseTargetToAttack', { hero: 'Spider-Man' })
     t('keywords.guard')
     t('status.stunned')
     ```
2. **Card Data Layer:**
   * Core card definition stores structural data (cost, stats, faction, mechanical effect hooks).
   * Display text (name, subname, traits, rules text, flavor text) is resolved through the active locale dictionary:
     ```typescript
     getCardText(cardId: string, locale: string)
     ```
3. **Onomatopoeia Localizations:**
   * Sound effect badges can be mapped by locale (or customizable by player theme preference).

---

## Consequences

### Positive Consequences
* The game can effortlessly launch in English, French, and any other supported language.
* Clear translation boundaries simplify card database updates.
* High code quality by enforcing strict separation between logic and text presentation.

### Negative Consequences / Risks & Mitigations
* *Slight overhead during initial UI creation:* Requires wrapping strings in `t('key')` instead of typing raw English text.
  * *Mitigation:* We will provide strict TypeScript types for translation keys with autocomplete and default fallback to English.
