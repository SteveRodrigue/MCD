# [ADR-0022] Authoritative Zod Supplemental Schema & CI/CD Quality Gate

* **Status:** **Accepted**
* **Date:** 2026-08-30
* **Authors:** MCD Core Team
* **Deciders:** User & Antigravity

---

## Context and Problem Statement
As the MCD card catalog grows to hundreds of cards across multiple packs, human contributors, AI agents, and fan-made content creators author declarative ability enrichments in `src/data/supplemental/pack/*.json`. 

Previously, supplemental data was checked only via static TypeScript interfaces. Because JSON files are loaded at runtime without direct compile-time type checking, subtle syntax errors, mistyped timing literals (e.g. `HERO_ACTIONS` instead of `HERO_ACTION`), invalid parameter formats, or missing audit fields could easily pass build steps and cause silent engine runtime failures or UI rendering crashes.

---

## Decision Drivers
* **Pre-Execution Validation:** Catch 100% of malformed card data before game execution.
* **Support for Fan-Made Content:** Provide a definitive, automated schema validation tool that community creators can run locally to verify their custom card packs.
* **CI/CD Quality Gate:** Block any commit or pull request from merging if a supplemental pack fails schema validation.
* **Self-Documenting Schema:** Single source of truth for runtime validation and generated TypeScript types.

---

## Considered Options
1. **Option 1: Rely solely on static TypeScript interface types (`CardEnrichment`).**
2. **Option 2: JSON Schema validation (`ajv` with `.schema.json` files).**
3. **Option 3: Authoritative Zod Schema (`schema.ts`) + Automated Vitest CI/CD Quality Gate.**

---

## Decision Outcome

**Chosen Option:** **Option 3: Authoritative Zod Schema (`schema.ts`) + Automated Vitest CI/CD Quality Gate.**

### Rationale ("The Why")
1. **Type Inference + Runtime Validation in One:** Zod provides both runtime parsing with clear error paths (`path: ["cards", "01023", "abilities", 0, "cost"]`) and automatic TypeScript type generation (`z.infer<typeof SupplementalPackSchema>`).
2. **Strict CI/CD Enforcement:** Implemented `tests/data/supplemental-schema.test.ts` which loads and validates every `.json` file in `src/data/supplemental/pack/` as part of `npm test`.
3. **Developer Ergonomics:** When a contributor creates an invalid card ability, the test runner outputs exact JSON line numbers and reasons, preventing guesswork.

---

## Consequences

### Positive Consequences
* **100% Guaranteed Structural Integrity:** All supplemental packs in the repository are verified on every test run.
* **Zero Silent Schema Drifts:** Modifying an ability parameter in code without updating schema tests immediately triggers a CI test failure.
* **Clean Fan-Made Ecosystem:** Fan-made authors can run `npm test` to validate custom hero and scenario packs in milliseconds.

### Negative Consequences / Tradeoffs
* Schema modifications require updating `src/data/supplemental/schema.ts` alongside any engine model changes.
