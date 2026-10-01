---
name: single-card-supplemental
description: 'Translate and generate minimal supplemental card data for a single card into temp/supp_<card-id>.md using extract-card.ts and RR v1.8 methodology. Trigger on "supplemental for card", "translate card", or prefixed with "single-card-supplemental:".'
---

# Single Card Supplemental Data Generator

This skill defines the canonical methodology to analyze a single Marvel Champions card and generate its schema-compliant supplemental data into a minimal markdown file at `temp/supp_<card-id>.md`.

---

## The 4-Step Methodology

### Step 1: Extract Upstream Card Data

Execute the extraction script:

```powershell
rtk npm run card:extract -- <card-id>
```

_Take note of the extracted JSON: `code`, `name`, `type_code`, `traits`, `cost`, `text`, `pack_code`, and any `existing_supplemental`._

---

### Step 2: Research Rules & Mechanics (RR v1.8)

1. Use the lookup command for keywords, timing, or effects mentioned in the card text:
   ```powershell
   rtk npm run rule -- <keyword_or_mechanic>
   ```
2. Check `references/rules/glossary/` to determine:
   - **Timing Type:** Is it an `ACTION`, `HERO_ACTION`, `ALTER_EGO_ACTION`, `INTERRUPT`, `RESPONSE`, or `CONSTANT`?
   - **Multi-Part Abilities:** If it says "Make the following X attacks/thwarts in order", each is a separate attack/thwart step (RR v1.8 p. 6).
   - **Status Card Interactions:** How does the ability interact with Stunned, Confused, or Tough?
   - **Keywords & Constraints:** Are there Guard, Retaliate, Overkill, Piercing, or Ranged interactions?

---

### Step 3: Map to Modular Declarative Specifications & Schema

Consult the authoritative schema and modular specifications to ensure exact parameter and variable compliance:

1. **Authoritative Source of Truth:**
   - [`src/data/supplemental/schema.ts`](../../../src/data/supplemental/schema.ts) defines the canonical Zod types and enums:
     - **Timing:** `TimingTypeSchema` (`ACTION`, `HERO_ACTION`, `ALTER_EGO_ACTION`, `INTERRUPT`, `RESPONSE`, `CONSTANT`, `SPECIAL`, `SETUP`, `WHEN_REVEALED`)
     - **Triggers:** `TriggerTypeSchema` (`WHEN_REVEALED`, `ENEMY_INITIATES_ATTACK`, `DEFEND`, `DAMAGE_TAKEN`, `CHARACTER_DEFEATED`, etc.)
     - **Effects:** `EffectTypeSchema` (`DEAL_DAMAGE`, `REMOVE_THREAT`, `DRAW`, `DISCARD`, `SEARCH`, `PUT_INTO_PLAY`, `ADD_STATUS`, `GENERATE_RESOURCE`, etc.)
     - **Target Selectors:** `TargetSelectorSchema` (`CHOSEN_ENEMY`, `CHOSEN_CHARACTER`, `VILLAIN`, `ALL_ENEMIES`, `SELF`, `SELF_IDENTITY`, `CHOSEN_PLAYER`, etc.)
     - **Step Conditions:** `StepConditionSchema` (`TARGET_DEFEATED`, `EXCESS_DAMAGE_DEALT`, `SCHEME_EMPTY`, `FULLY_HEALED`, etc.)
     - **Condition Gates:** `ConditionGateSchema` (`IF_FORM`, `IF_RESOURCE_MATCH`, `IF_STATUS`, `IF_TARGET_TYPE`, etc.)
     - **Durations:** `DurationSchema` (`PHASE`, `ROUND`, `TURN`)

2. **Modular Documentation Guides:**
   - Timing & Triggers: `docs/specifications/supplemental/02_timings_and_triggers.md`
   - Targeting & Scopes: `docs/specifications/supplemental/03_costs_and_targeting.md`
   - Combat & Threat: `docs/specifications/supplemental/05_effects_combat_threat.md`
   - Zones & Search: `docs/specifications/supplemental/06_effects_zones_cards.md`
   - Status & Economy: `docs/specifications/supplemental/07_effects_status_economy.md`
   - Formulas & Math: `docs/specifications/supplemental/08_dynamic_formulas.md`

3. **Drafting Invariants:**
   - **Generic Primitives Only (ADR-0021):** Never invent card-specific effect names (e.g. do not use `DANCE_OF_DEATH_ATTACK`; use generic `DEAL_DAMAGE`).
   - **Exact Enum Values:** All effect, timing, and target strings must match the TypeScript enums in `schema.ts` exactly.
   - **Strict Schema Compliance:** `CardEnrichmentSchema` is strict; undeclared or hallucinated properties will cause validation failure.
   - **Exact Printed Text:** In `audit.originalText`, use the exact text from Step 1.
   - **Card Comments Policy (ADR-0067):** Never add or modify `audit.comment`.

---

### Step 4: Write Minimal Output File to `temp/supp_<card-id>.md`

Write the resulting translation to `temp/supp_<card-id>.md` (e.g. `temp/supp_08004.md`).

**The output file must be minimal.** Follow this exact format:

````markdown
# Supplemental: [{card_name}] ({card_code})

- **Pack:** {pack_code}
- **Type:** {type_code} | **Traits:** {traits} | **Cost:** {cost}
- **Printed Text:** {text}

## Rules Notes (RR v1.8)

- {key rule or timing nuance 1}
- {key rule or timing nuance 2}

## Proposed Supplemental JSON

```json
{
  "abilities": [
    ...
  ],
  "audit": {
    "rulesVersion": "v1.8",
    "confidence": 100,
    "originalText": "{text}"
  }
}
```
````

````

---

### Step 5: Validate Against Schema (Automated Gate)

Execute the card validation tool on the generated markdown file:

```powershell
rtk npm run card:validate -- temp/supp_<card-id>.md
````

- **If validation succeeds:** `✅ Schema validation passed for: temp/supp_<card-id>.md`
- **If validation fails:** The tool prints the exact path and error (e.g. `[abilities.0.steps.0.effect]: Invalid enum value`). Adjust the JSON in `temp/supp_<card-id>.md` to match `src/data/supplemental/schema.ts` and re-run until it passes.

---

## 🎯 Final Presentation to User

Present the user with a concise 2–3 line summary and link to the validated markdown file:

- Mention card name, code, and pack.
- Confirm schema validation passed (`npm run card:validate`).
- Link directly to `temp/supp_<card-id>.md`.
