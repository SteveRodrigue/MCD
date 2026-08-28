# ADR-0008: Declarative Card Ability & Effect Enrichment Architecture

## Status
Accepted (Updated with Scanned-Only Policy, `noSupplementalNeeded` Signal & Engine Missing Supplemental Error)

## Context
As the engine grows to support hundreds of Marvel Champions cards, hardcoding card IDs (e.g. `if (player.card.code === '01001a')`) directly into the rules engine loops creates tight coupling, severe duplication, and unmaintainable code.

Many cards share identical or parameterized mechanics:
* Drawing cards upon a trigger condition (e.g. *Spider-Sense*, *Avengers Mansion*, *One-Two Punch*).
* Preventing attack damage (e.g. *Backflip*, *Side Step*, *Energy Barrier*).
* Dealing damage to enemies with keywords/tags (e.g. *Swinging Web Kick*, *Haymaker*, *Shield Toss*).
* Healing damage via actions (e.g. *Aunt May*, *First Aid*, *Med Team*).
* Resource generation via counters or tapping (e.g. *Web-Shooter*, *Helicarrier*, *Enhanced Reflexes*).

Furthermore, without an explicit contract, it is easy to mistakenly assume an unscanned card requires no supplemental logic, leading to silent rules failures when un-implemented cards enter play.

---

## Decision

We establish a **data-driven ability architecture with strict scanning criteria and runtime missing-supplemental validation**:

### 1. Supplemental Declarative Pack Data (`src/data/supplemental/pack/`)

Supplemental files mirror the upstream **zzorba pack datasets** 1-to-1:

```
src/data/supplemental/
├── index.ts                     # Aggregates and exports supplementalRegistry
└── pack/
    ├── core.json                # Supplemental data for scanned core player cards
    ├── core_encounter.json      # Supplemental data for scanned core encounter sets (Rhino, Bomb Scare, Standard, Expert, Nemesis)
    ├── goblin.json              # Future scenario pack supplemental
    └── ...
```

### 2. Scanned Cards Policy & Explicit `noSupplementalNeeded` Signal

**Cards are ONLY added to supplemental files if they have been actively scanned and evaluated.**

* **Scanned Card with Custom Abilities:** Stores declarative `abilities` (and optional `uses` counters or `isLandscape`).
* **Scanned Card with Standard Rules:** Stores an explicit `"noSupplementalNeeded": true` signal confirming it was scanned and requires no custom rules hooks.
* **Unscanned Card:** Is **omitted entirely** from the supplemental files.

```typescript
export interface CardEnrichment {
  noSupplementalNeeded?: boolean;
  cardName?: string;
  comment?: string;
  isLandscape?: boolean;
  uses?: CardUsesDefinition;
  abilities?: CardAbility[];
}
```

#### Example 1: Enriched Card with Custom Abilities
```json
"01001a": {
  "comment": "Hero Identity: When villain initiates an attack against you, draw 1 card.",
  "abilities": [
    {
      "id": "spider_sense",
      "timing": "INTERRUPT",
      "trigger": "VILLAIN_INITIATES_ATTACK",
      "effect": "DRAW_CARDS",
      "params": { "count": 1, "target": "SELF" }
    }
  ]
}
```

#### Example 2: Evaluated Standard Card (No Supplemental Needed)
```json
"01088": {
  "noSupplementalNeeded": true
}
```

### 3. Strict Engine Safety: Missing Supplemental Error

The rules engine strictly enforces that **any card loaded or instantiated into a live game MUST have a corresponding supplemental entry**.

If a card is not present in `supplementalRegistry`, the engine throws an error immediately:
```
Error: Supplemental data is missing for card <CODE> (<NAME>)
```
This guarantees that no unscanned card can silently enter a game and cause runtime bugs or missing triggers.

### 4. Generic Trigger Dispatcher & Reusable Effect Primitives (`src/engine/effects/` & `src/engine/triggers/`)

* The rules engine executes timing windows via a generic `TriggerDispatcher`.
* The engine contains **0 hardcoded card codes**.
* Reusable effect primitives (`draw-cards`, `deal-damage`, `prevent-damage`, `heal-damage`, `generate-resource`, `remove-threat`) resolve card abilities deterministically.

---

## Consequences

### Positive:
* **Fail-Safe Game Setup:** Attempting to play or load an unscanned card immediately halts with a descriptive error (`"Supplemental data is missing for card..."`).
* **No False Positives:** `"noSupplementalNeeded": true` is exclusively reserved for cards that were actually reviewed and verified as standard.
* **Clean & Readable Data:** Minimal JSON structure without redundant status fields.
* **Clear Phased Milestones:** Unscanned encounter and hero sets are cleanly added only when their phase is being implemented.
