---
name: card-integration-protocol
description: >-
  Standard 8-step protocol for analyzing, translating, validating, and integrating
  Marvel Champions cards into the declarative supplemental layer (src/data/supplemental/)
  and rules engine. Enforces a 3-tier blast-radius refactor guardrail, 3-iteration circuit-breaker,
  batch-resilient ambiguity isolation, encapsulated audit metadata (ISO timestamps with HH:MM),
  progress logging with confidence level in logs/skills/, and 1-file-per-card tracking in docs/ambiguities/ (Inbox Zero).
  Use whenever adding or refining any card.
---

# Card Integration Protocol (8-Step Standard Workflow)

This skill guides the agent and developers through the rigorous, deterministic process of integrating Marvel Champions cards into the digital game engine.

---

## 📝 Execution Logging Requirement (`logs/skills/`)

Whenever this skill executes (for a single card or a batch review), it must append timestamped progress entries with the **confidence level** to `logs/skills/card_integration_{YYYY-MM-DD}.log`:

```text
YYYY-MM-DDTHH:mm:ss.sssZ [INFO] Looking at card [card_name] #{card_code}
YYYY-MM-DDTHH:mm:ss.sssZ [INFO] Card [card_name] #{card_code} integrated without any code change required (Tier 1, confidence 98%).
YYYY-MM-DDTHH:mm:ss.sssZ [INFO] Card [card_name] #{card_code} integrated with code change (Tier 2, confidence 98%).
YYYY-MM-DDTHH:mm:ss.sssZ [WARN] Card [card_name] #{card_code} card ambiguity: Circuit-Breaker fired (confidence 70%) -> docs/ambiguities/{pack}_{code}_{slug}.md
YYYY-MM-DDTHH:mm:ss.sssZ [WARN] Card [card_name] #{card_code} card ambiguity: Structural Refactor Gate (Tier 3, confidence 80%) -> docs/ambiguities/{pack}_{code}_{slug}.md
```

---

## 🚦 Blast-Radius Refactor Guardrails (3-Tier Classification)

Before modifying engine source code, classify the required change into one of three tiers:

* **Tier 1 (Fast-Track — Direct Execution):** Supplemental JSON edits, adding enum/union literals (`TriggerType`, `EffectType`), adding `case` branches to existing switch dispatchers, adding unit tests.
* **Tier 2 (Additive Generic Helpers — Permitted with 0 Regressions):** Adding pure generic utility functions in `src/engine/effects/` (e.g. deck inspection, stack filtering). All existing tests must pass with zero regressions.
* **🛑 Tier 3 (Structural Refactor Gate — Mandatory Plan & User Approval):** Modifying core state schemas (`GameState`, `PlayerState`, `CardInstance`), refactoring phase loops in `villain-phase.ts`, altering action dispatch contracts, or rewriting major subsystems.
  * **In Single-Card Mode:** Stop immediately, log to `docs/ambiguities/`, create `implementation_plan.md`, and wait for explicit user approval before touching source code.
  * **In Batch-Mode (Scanning multiple cards / sets):** **Do not halt the batch.** Log a dedicated ambiguity file to `docs/ambiguities/{pack}_{code}_{slug}.md` with `blocker_category: "TIER_3_STRUCTURAL_REFACTOR"`, skip the blocked card, continue scanning all remaining cards in the set, and present a consolidated report + implementation plan at the end of the batch run.

---

## 🔄 The 8-Step Integration Workflow

```mermaid
flowchart TD
    S1["1. Read Upstream Card Text (data/upstream/)"] --> S2["2. Literal Semantic Mapping (No Guesswork)"]
    S2 --> S3["3. Draft Supplemental JSON Schema & Audit Block"]
    S3 --> S4["4. Consult Ground Truth & MarvelCDB (references/links.md)"]
    S4 --> S5{"5. Round-Trip Test (Confidence >= 95%)?"}
    S5 -- "Yes (>= 95%)" --> S6["6. Engine Primitive & Trigger Reuse Check"]
    S5 -- "No (< 95%, Attempts < 3)" --> S3
    S5 -- "No (< 95%, Attempts >= 3)" --> CB["🚨 TRIGGER CIRCUIT-BREAKER:
Log to docs/ambiguities/{pack}_{code}_{slug}.md & Isolate"]
    S6 --> S7{"7. Blast-Radius Tier Check"}
    S7 -- "Tier 1 / Tier 2" --> S8["8. Author Composable Primitives, Stamp Audit & Prune Ambiguity"]
    S7 -- "Tier 3 (Structural)" --> T3{"Single Card or Batch?"}
    T3 -- "Single Card" --> T3S["Log Ambiguity, Write Implementation Plan & STOP for Approval"]
    T3 -- "Batch Mode" --> T3B["Log Ambiguity in docs/ambiguities/, Skip & Continue Batch"]
```

### Step 1: Ingest & Read Upstream Card Text
* Append `[INFO] Looking at card [card_name] #{card_code}` to `logs/skills/card_integration_{YYYY-MM-DD}.log`.
* Fetch the exact printed card text from `data/upstream/pack/{pack_code}.json`.
* Do not paraphrase, summarize, or alter the upstream text during analysis.

### Step 2: Literal Semantic Mapping (Zero Interpretation / Zero Guesswork)
* Per **ADR-0018** & **ADR-0019**, never interpret or guess unstated card rules.
* Identify the exact ability type:
  * **Timing:** `ACTION`, `HERO_ACTION`, `ALTER_EGO_ACTION`, `RESOURCE`, `INTERRUPT`, `HERO_INTERRUPT`, `RESPONSE`, `HERO_RESPONSE`, `FORCED_INTERRUPT`, `FORCED_RESPONSE`, `CONSTANT`, `SETUP`.
  * **Trigger:** Exact event (e.g. `VILLAIN_SCHEMES`, `VILLAIN_INITIATES_ATTACK`, `TAKE_ATTACK_DAMAGE`, `CARD_PLAYED`, `ROUND_END`).
  * **Target:** Exact entity (e.g. `the villain` $\neq$ `minions`; `an enemy` = `villain or minion`).
  * **Form Requirement:** Derived strictly from ability timing (`HERO_` vs `ALTER_EGO_` vs neutral).

### Step 3: Draft Structured Supplemental Schema & Audit Block
* **MANDATORY EXECUTABLE ABILITIES REQUIREMENT:** `mechanicSteps` and `comment` are human-readable documentation and **CANNOT** replace engine data. Every card with printed rules text (Actions, When Revealed, Interrupts, Responses, Keywords, Passives, Scheme Icons) **MUST** have its logic fully encoded in `abilities: [...]` (or explicit schema properties).
* `noSupplementalNeeded: true` is **ONLY** valid for pure vanilla cards with zero rules text (e.g. double resources, basic allies without abilities, or villain stages without abilities). Any card with rules text marked `noSupplementalNeeded: true` is an invalid schema error.
* Compose the JSON entry in `src/data/supplemental/pack/{pack_code}.json`:
```json
"{card_code}": {
  "comment": "<Brief human summary>",
  "audit": {
    "createdAt": "YYYY-MM-DDTHH:mm",
    "updatedAt": "YYYY-MM-DDTHH:mm",
    "reviewedAt": "YYYY-MM-DDTHH:mm",
    "reviewedBy": "antigravity",
    "rulesVersion": "v1.8",
    "confidence": 98
  },
  "mechanicSteps": [
    "Trigger: <Timing & Trigger event>",
    "Step 1: <Inspection/Cost>",
    "Step 2: <Filter/Targeting>",
    "Step 3: <Resolution/State Change>",
    "Step 4: <Cleanup/Destination>"
  ],
  "abilities": [
    {
      "id": "<card_name_ability_slug>",
      "timing": "<TIMING>",
      "trigger": "<TRIGGER_IF_REACTIVE>",
      "limit": "<ONCE_PER_ROUND | ONCE_PER_PHASE>",
      "cost": {
        "exhaustSelf": true,
        "removeCounter": 1,
        "discardSelf": true,
        "resourceCost": { "physical": 1 }
      },
      "effect": "<EFFECT_PRIMITIVE>",
      "params": { ... }
    }
  ]
}
```

### Step 4: Consult Ground Truth References (`references/`)
* Check `references/rules_reference_v18.md` for official timing rules.
* Consult `references/links.md` for:
  * Official FAQ & Errata: `https://marvelcdb.com/faqs`
  * Card-specific discussion: `https://marvelcdb.com/card/{card_code}`
* **The Golden Rule (RR v1.8 p. 2):** If the printed card text explicitly contradicts a general rule in the Rules Reference, the card text takes precedence.

### Step 5: Bidirectional Round-Trip Validation & Circuit-Breaker Rule
* **The Test:** Read your drafted JSON `abilities: [...]` schema and translate it back into plain human language.
* **Criterion:** Does the reconstructed description match 100% of the printed card's intended behavior without omissions, unintended side effects, or missing constraints?
* **Confidence Target:** Must reach **$\ge 95\%$** before proceeding.
* **Executable Completion Gate:** If a card has rules text but its `abilities: [...]` array is missing, empty, or cannot execute the printed mechanic, **confidence CANNOT exceed 50%**.
* **Refinement Iteration Limit:** Max **3 refinement iterations** between Steps 3 $\rightarrow$ 4 $\rightarrow$ 5.
* **🚨 CIRCUIT-BREAKER PROTOCOL (If Confidence Remains $< 95\%$ after Attempt 3):**
  1. **DO NOT** commit or integrate incomplete supplemental logic into the active game engine.
  2. Create a dedicated ambiguity report file in `docs/ambiguities/{pack}_{card_code}_{slug}.md`.
  3. Log warning to `logs/skills/card_integration_{YYYY-MM-DD}.log`:
     `[WARN] Card [card_name] #{card_code} card ambiguity: Circuit-Breaker fired (confidence {confidence}%) -> docs/ambiguities/{pack}_{code}_{slug}.md`
  4. In batch mode: proceed to the next card; in single-card mode: report block to user.

### Step 6: Engine Primitive & Trigger Reuse Check
* Verify whether existing effect primitives in `src/engine/effects/` or triggers in `src/engine/triggers/` already satisfy the card's requirements.
* Avoid duplicating or creating card-specific one-off functions.

### Step 7: Composable Generic Primitives & Blast-Radius Gate
* Check change tier (Tier 1 vs Tier 2 vs Tier 3):
  * **Tier 1 (No code change needed / Fast-track):** Log `[INFO] Card [card_name] #{card_code} integrated without any code change required (Tier 1, confidence {confidence}%).`
  * **Tier 2 (Additive helper added):** Implement generic reusable building block and log `[INFO] Card [card_name] #{card_code} integrated with code change (Tier 2, confidence {confidence}%).`
  * **Tier 3 (Structural):** Log `[WARN] Card [card_name] #{card_code} card ambiguity: Structural Refactor Gate (Tier 3, confidence {confidence}%) -> docs/ambiguities/{pack}_{code}_{slug}.md`. In single-card mode: stop and request approval; in batch mode: isolate and continue batch.

### Step 8: Stamp Audit Metadata (HH:MM), Codify Specs & Prune Ambiguity
1. **Audit Timestamping:**
   * If creating a new card: set `createdAt`, `updatedAt`, and `reviewedAt` to current ISO timestamp with `HH:mm` (e.g. `"2026-08-28T08:47"`).
   * If modifying logic/fixing a bug: bump `updatedAt` and `reviewedAt` to current timestamp.
   * If auditing/confirming an existing card with no code changes: bump `reviewedAt` only.
2. **Populate `mechanicSteps`:** Ensure `mechanicSteps` is populated in the JSON schema.
3. **Document in Specs:** Add an entry to `docs/specs/card-mechanics-breakdown.md`.
4. **Inbox Zero Pruning:** If an open ambiguity file existed in `docs/ambiguities/` for this card, **delete it**.
5. **Canonical Card ID Sorting:** When saving `src/data/supplemental/pack/*.json`, always preserve canonical ascending card ID order (numerically by code with `a`/`b` identity letters, e.g. `01001a` -> `01001b` -> `01002`). Never append new keys out-of-order at the bottom of the file.
6. **Verify:** Run test suite: `npm test; npm run typecheck; npm run build`.
