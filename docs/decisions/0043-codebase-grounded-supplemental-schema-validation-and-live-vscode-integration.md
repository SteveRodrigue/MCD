# [ADR-0043] Codebase-Grounded Supplemental Schema Validation & Live VS Code Integration

- **Status:** Accepted
- **Date:** 2026-09-03
- **Authors:** MCD Core Team
- **Deciders:** User & Antigravity

---

## Context and Problem Statement

In Marvel Champions Digital (MCD), all card abilities, costs, timings, and triggers reside exclusively in the declarative supplemental layer (`src/data/supplemental/pack/*.json`) per the **Declarative Data-First Invariant** (ADR-0021). 

Historically, `AbilityStepSchema.effect` was typed as a loose string (`z.string().min(1)`). While this allowed rapid authoring, it introduced a significant architectural defect: speculative or unhandled effect primitives could be declared in JSON files without failing schema validation or build verification. Furthermore, subtle naming drifts (e.g. `MODIFY_ALLY_LIMIT` vs `ALLY_LIMIT_BONUS`, `GIVE_STATUS` vs `ADD_STATUS`, `WHEN_REVEALED_THREAT_PER_PLAYER` vs `ADD_THREAT_PER_PLAYER`) remained undetected until cards were played in game sessions, causing inert or failing actions. In addition, developers editing supplemental JSON in VS Code lacked real-time linting, autocompletion, and schema constraints.

How do we guarantee that every enum and effect declared in supplemental data is strictly backed by active engine execution handlers, while providing real-time in-editor diagnostics and autocompletion?

---

## Decision Drivers

- **Zero Speculative Drift:** Supplemental data must never contain unhandled effect primitives or unsupported enum values.
- **Immediate In-Editor Feedback:** Developers and agents editing JSON files in VS Code should receive instant red squigglies on typos and missing properties.
- **IntelliSense Autocomplete:** `Ctrl+Space` should provide rich autocomplete for all active engine effect primitives.
- **CI/CD Quality Gate:** Automated tests must verify 100% of supplemental card files against the active engine capabilities with zero errors.
- **Minimal Dependencies:** Avoid unnecessary npm packages by leveraging Zod v4's native `toJSONSchema`.

---

## Considered Options

1. **Option 1: Loose String Schema with Manual Audits**
   Keep `effect: z.string()` and rely on occasional manual code audits or external regex scripts to spot broken effect names.
2. **Option 2: External Schema Compiler & Standalone JSON Schema**
   Maintain a standalone `schema.json` manually and validate JSON files with Ajv separately from Zod.
3. **Option 3: Single Source of Truth Zod Enums with Native JSON Schema Export & VS Code Binding (Chosen)**
   Ground all effects in an exhaustive `EffectTypeSchema = z.enum([...])` matching active engine handlers. Export the Zod schema to `src/data/supplemental/schema.json` via a dedicated generator script (`tools/generate-supplemental-schema.ts`), bind it in `.vscode/settings.json`, and enforce bidirectional parity in CI/CD tests.

---

## Decision Outcome

**Chosen Option:** **Option 3: Single Source of Truth Zod Enums with Native JSON Schema Export & VS Code Binding**

### Rationale ("The Why")
1. **Single Source of Truth:** `src/data/supplemental/schema.ts` remains the authoritative TypeScript/Zod specification. Any change to the engine's effect capabilities is reflected in `EffectTypeSchema`, ensuring type safety across engine code and test suites.
2. **Live VS Code Integration:** By exporting `schema.json` and configuring `"json.schemas"` in `.vscode/settings.json`, VS Code provides real-time red squigglies, hover documentation, and `Ctrl+Space` autocomplete without requiring any custom VS Code extensions.
3. **Automated Parity & Zero Maintenance Drift:** The CI/CD suite (`tests/data/supplemental-schema.test.ts`) guarantees bidirectional parity: no unhandled effect can exist in JSON, and `schema.json` is verified to be up to date with the latest code on every test run.

---

## Evaluation of Options

### Option 1: Loose String Schema with Manual Audits
- **Pros:**
  - Zero initial refactor cost.
- **Cons:**
  - Silent runtime failures and inert cards.
  - No autocomplete or linting in VS Code.

### Option 2: External Schema Compiler & Standalone JSON Schema
- **Pros:**
  - Standard JSON Schema format.
- **Cons:**
  - Dual maintenance burden (Zod in TypeScript + manual JSON Schema).
  - High probability of drift between TypeScript types and JSON Schema.

### Option 3: Single Source of Truth Zod Enums with Native JSON Schema Export (Chosen)
- **Pros:**
  - 100% codebase-grounded validation.
  - Zero external dependencies using Zod v4's built-in `toJSONSchema`.
  - Real-time in-editor errors and autocomplete in VS Code.
  - Automated CI parity tests catch drift immediately.
- **Cons:**
  - Adding a new effect primitive requires adding it to `EffectTypeSchema` and running `npm run schema:generate`.

---

## Consequences

### Positive Consequences
- Impossible to commit cards with unsupported, misspelled, or speculative effect primitives.
- VS Code provides instant red squigglies and `Ctrl+Space` autocompletion for 100+ effect primitives.
- Existing drifted declarations (`01102` Sandman, `01108` Crowd Control, `01073` Triskelion) corrected and standardized.
- CI/CD quality gate enforces schema freshness and card conformance on every commit.

### Negative Consequences / Tradeoffs
- When developing new effect primitives, developers must remember to add the new enum variant to `EffectTypeSchema` and run `npm run schema:generate`. (Enforced by automated Vitest freshness test).
