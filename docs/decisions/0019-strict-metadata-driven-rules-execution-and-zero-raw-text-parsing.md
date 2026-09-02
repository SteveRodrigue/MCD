# [ADR-0019] Strict Metadata-Driven Rules Execution & Zero Raw-Text Parsing

- **Status:** Accepted
- **Date:** 2026-08-27
- **Authors:** MCD Core Team
- **Deciders:** User & Antigravity

---

## Context

In card game engine architecture, it can be tempting to parse card text strings (e.g. `card.text.includes('Hero Action')`, `card.text.includes('Interrupt')`, `card.text.includes('Attach to your hero')`, or regex extraction). However, relying on raw card text is fundamentally fragile and introduces critical failure points:

1. **Internationalization & Localization (i18n - ADR-0005):**
   - Raw text string matching breaks immediately when loading translated card packs (e.g. French _"Action de héros"_, Spanish _"Acción de héroe"_, German _"Helden-Aktion"_). The rules engine must run identical game logic regardless of the UI display language.
2. **Upstream Typos, Formatting & Markdown Tags:**
   - Upstream database feeds frequently contain formatting tags (e.g. `<b>Hero Action</b>`, `[hero] Action:`), punctuation changes, spacing variations, or minor typos. String matching causes silent engine failures or regressions.
3. **Card Text Substring Collisions & Edge Cases:**
   - Card text often contains reminder text, flavor text, or references to other rules (e.g. _"When another player uses a Hero Action..."_) which produce false positives when matching raw strings.

---

## Decision

We establish the **Zero Raw-Text Parsing Principle**:

### 1. Zero Text-Matching in Engine & Legality Pipelines

- No file in `src/engine/` or UI legality checks may use `card.text.includes(...)`, `card.text.match(...)`, or regex string inspection to determine game rules, timings, forms, keywords, or triggers.
- The `card.text` field is designated strictly as **presentation/display data** for the UI card view, never as executable input for the rules engine.

### 2. Structured Metadata Authority

All game rules, timings, forms, costs, triggers, and targets must be derived exclusively from structured metadata:

- **Card Core Properties:** `type` (`CardType`), `faction` (`FactionCode`), `traits` (`string[]`), `resources` (`CardResources`), `isUnique` (`boolean`), `cost` (`number`).
- **Supplemental Ability Schema (`CardAbility`):**
  - `timing`: `'HERO_ACTION' | 'ALTER_EGO_ACTION' | 'ACTION' | 'HERO_INTERRUPT' | 'INTERRUPT' | 'HERO_RESPONSE' | 'RESPONSE' | 'CONSTANT' | 'SPECIAL' | 'SETUP'`
  - `trigger`: `'CARD_PLAYED' | 'THREAT_WOULD_BE_PLACED' | 'MINION_DEFEATED' | 'ROUND_END' | ...`
  - `tags`: `['ATTACK', 'THWART', 'DEFENSE']`
  - `cost`: `{ exhaustSelf?: boolean; removeCounter?: number; discardSelf?: boolean; resourceCost?: Partial<CardResources> }`
  - `effect`: Reusable effect primitive (e.g. `'DEAL_DAMAGE'`, `'REMOVE_THREAT'`, `'DRAW_CARDS'`, `'READY_CHARACTER'`)
  - `params`: Strongly typed structured parameters.

### 3. Unified Form Requirement Determination

Card form requirements (Hero vs Alter-Ego) are evaluated 100% via structured properties:

```typescript
const abilities = card.enrichment?.abilities || [];
const hasHeroTiming = abilities.some(
  (a) => a.timing && a.timing.startsWith("HERO_"),
);
const hasAlterEgoTiming = abilities.some(
  (a) => a.timing && a.timing.startsWith("ALTER_EGO_"),
);

const isHeroFormRequired = card.type === CardType.HERO || hasHeroTiming;
const isAlterEgoFormRequired =
  card.type === CardType.ALTER_EGO || hasAlterEgoTiming;
```

---

## Consequences

- **Multi-Language Ready:** Non-English card packs (French, Spanish, German, etc.) execute with 100% identical engine behavior without altering a single line of code.
- **Typo & Errata Immunity:** Errata or corrections in upstream card descriptions cannot break card execution or legality logic.
- **Deterministic & Type-Safe:** All card behaviors are strictly typed via TypeScript and validate against our JSON schemas.
