# [ADR-0044] Card Text Parsing and Declarative Mapping Analyzer Tool

- **Status:** Accepted
- **Date:** 2026-09-03
- **Authors:** MCD Core Team
- **Deciders:** User & Antigravity

---

## Context and Problem Statement
When integrating Marvel Champions cards into the declarative supplemental layer (`src/data/supplemental/pack/*.json`), developers and agents had to manually inspect raw card text from upstream JSON (`data/upstream/pack/*.json`) and translate abilities, timings, costs, triggers, limits, and effect primitives into strict Zod-validated JSON structures.

Manual transcription was error-prone, resulting in subtle discrepancies such as missed costs, invalid target selectors, or unrecognized properties (e.g. Issues #55 and #56). We needed an automated, deterministic parsing engine and CLI analyzer that transforms raw printed card text into valid declarative JSON while alerting developers to unparsed text nuances.

---

## Decision Drivers
- **Rules Reference Fidelity (RR v1.8):** Adhere strictly to printed card text conventions, cost arrow (`→`) semantics (ADR-0041), and timing classifications.
- **Strict Declarative Validation (ADR-0019, ADR-0043):** Generated output must strictly conform to `CardEnrichmentSchema.strict()` with zero undeclared keys.
- **Safety & Transparency:** Explicitly detect and highlight unmatched text fragments and warn when confidence drops below 95%.
- **Zero Runtime Engine Coupling:** Pure offline/tooling library and CLI, keeping the core game engine headless and decoupled.

---

## Considered Options
1. **Option 1: Unbounded Large Language Model / Fuzzy Parser Script:** Call an LLM prompt to convert text to JSON.
2. **Option 2: Pure Regex Tokenizer & Deterministic Pattern Engine:** Build a modular TypeScript library and CLI with clean text normalization, deterministic regex tables, cost arrow splitting, unmatched fragment isolation, and strict Zod validation.
3. **Option 3: Manual Card Integration (Status Quo):** Continue manual card authoring without automated text parsing assistance.

---

## Decision Outcome

**Chosen Option:** **Option 2: Pure Regex Tokenizer & Deterministic Pattern Engine**

### Rationale ("The Why")
Marvel Champions card text uses highly standardized, templated rules grammar (RR v1.8). Deterministic regular expressions paired with HTML normalization, arrow delimiter splitting, and Zod validation guarantee 100% reproducible results without hallucinating properties or generating invalid schemas. Flagging unmatched text fragments provides immediate visual alerts when a card features unique or non-standard mechanics requiring human architectural review.

---

## Evaluation of Options

### Option 1: Unbounded LLM / Fuzzy Parser
- **Pros:**
  - Can interpret arbitrary colloquial phrasings.
- **Cons:**
  - Non-deterministic and requires external API keys / network calls.
  - Can hallucinate unsupported effect primitives or invalid schema keys.

### Option 2: Pure Regex Tokenizer & Deterministic Pattern Engine
- **Pros:**
  - 100% deterministic, instant execution, and operates completely offline.
  - Validates outputs against `CardEnrichmentSchema.strict()` directly.
  - Isolates unmatched text fragments to guarantee human/agent audit awareness.
  - Exposes both a programmatic API (`src/tools/card-text-parser/`) and a rich CLI (`tools/audit/card-text-parser.ts`).
- **Cons:**
  - Requires maintaining pattern tables as new expansion keywords and mechanics are added (handled incrementally per roadmap milestone).

---

## Consequences

### Positive Consequences
- **Rapid Card Integration:** Accelerates Card Integration Protocol (CIP) execution from minutes to seconds per card.
- **Zero Schema Invalidation:** All parsed outputs are pre-validated against `CardEnrichmentSchema`.
- **High Visual Feedback:** CLI mode provides immediate ANSI feedback for matched tokens, unparsed fragments, and existing supplemental differences.

### Negative Consequences / Risks & Mitigations
- *Risk:* A complex multi-sentence card might not match any effect pattern.
  *Mitigation:* The parser logs an unmatched text fragment, caps confidence, and emits a safe placeholder to prompt human or agent review.
