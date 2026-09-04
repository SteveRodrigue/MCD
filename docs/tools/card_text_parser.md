# 🃏 Card Text Parser & Declarative Mapping Analyzer

The **Card Text Parser** is a deterministic, offline pattern-matching library and CLI analyzer designed to parse raw Marvel Champions card text into strict, Zod-validated declarative supplemental JSON (`CardEnrichment`).

---

## 🚀 Key Features

1. **Clean-Text Normalization:**
   - Strips cosmetic HTML formatting (`<b>`, `<i>`, `<em>`, `<strong>`).
   - Standardizes HTML entities (`&#8594;`, `&mdash;`, `&nbsp;`).
   - Normalizes unicode whitespace, dashes (`—`, `–`), and cost arrows (`→`).
2. **Formulaic Token Extraction:**
   - **Ability Names:** Leading bold titles separated by em-dash (e.g. `Scientist — `, `Spider-Sense — `).
   - **Timings:** All RR v1.8 ability timings (`HERO_ACTION`, `ALTER_EGO_ACTION`, `INTERRUPT`, `HERO_RESOURCE`, etc.).
   - **Action Traits:** `(attack)`, `(thwart)`, `(defense)`.
   - **Cost Arrows (`→`):** Pre-arrow costs (`exhaustSelf`, `discardCard`, `damageHero`, `resources`, `spendCounters`).
   - **Limits & Uses:** `Limit once per round`, `Max 1 per player`, `Uses (X counters)`.
   - **Effect Primitives:** Maps standard phrases to codebase-grounded `EffectType` primitives (`DEAL_DAMAGE`, `REMOVE_THREAT`, `DRAW_CARDS`, `HEAL_DAMAGE`, `GENERATE_RESOURCE`, `ADD_STATUS`, `PREVENT_DAMAGE`, `ATTACH_TO_HOST`).
3. **Unmatched Fragment Isolation & Safety:**
   - Automatically detects text spans not captured by any regex pattern.
   - Computes a quantitative `confidence` score (0–100%).
   - Validates generated structures against `CardEnrichmentSchema.strict()`.

---

## 💻 CLI Usage

Use the npm script `npm run parse:card` or run directly with `npx tsx`:

### 1. Parse an Existing Upstream Card
```bash
npm run parse:card -- --code 01001b
```
Output includes:
- Normalized card text
- Matched tokens with category tags
- Any unmatched text fragments
- Parser confidence score
- Validated declarative JSON structure
- Comparison against existing supplemental data

### 2. Parse Arbitrary Text
```bash
npm run parse:card -- --text "Hero Action (attack): Deal 8 damage to an enemy."
```

### 3. Output Pure JSON (for Shell Pipes & Tooling)
```bash
npm run parse:card -- --code 01005 --json
```

### 4. Safely Update or Add Card to Supplemental Data (`--write`)
To write the parsed declarative JSON directly into `src/data/supplemental/pack/<pack>.json`:
```bash
npm run parse:card -- --pack core --code 01001b --write
```
- **Safety Gate:** Writing is automatically blocked if confidence is $< 95\%$ or if schema validation fails.
- **Audit Metadata Stamping:** Automatically creates or updates Card Integration Protocol Step 8 audit metadata (`createdAt`, `updatedAt`, `reviewedAt`, `reviewedBy`, `rulesVersion: "v1.8"`, `originalText`).
- **Override Force:** Use `--force` to write even if warnings exist (use with caution):
```bash
npm run parse:card -- --pack core --code 01001b --write --force
```

---

## 🧪 Automated Testing

Run the dedicated test suite:
```bash
npx vitest run tests/tools/card-text-parser.test.ts
```

---

## 🔗 Architecture & Invariants

- **Controlling ADR:** [ADR-0044](../decisions/0044-card-text-parsing-and-declarative-mapping-analyzer.md)
- **Declarative Supplemental Schema:** `src/data/supplemental/schema.ts`
- **Zero Runtime Engine Coupling:** The parser lives in `src/tools/card-text-parser/` and `tools/audit/` and is never imported by the headless engine (`src/engine/`).
