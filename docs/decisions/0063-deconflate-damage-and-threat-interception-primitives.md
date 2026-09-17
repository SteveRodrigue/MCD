# [ADR-0063] Deconflate Damage and Threat Interception Primitives

- **Status:** Accepted
- **Date:** 2026-09-16
- **Authors:** MCD Core Team
- **Deciders:** User & Antigravity

---

## Context and Problem Statement

In ADR-0058, prospective damage prevention and threat interception abilities were consolidated under the single primitive `PREVENT_DAMAGE` while retiring `CONSUME_INTERCEPTED_EVENT`. However, conflating damage (dealt to characters) and threat (placed on schemes) into a single identifier created domain confusion and architectural coupling:
- Characters take damage; schemes accumulate threat.
- Cards such as *Emergency* (`01085`), *Jennifer Walters / "I Object!"* (`01019b`), and *Great Responsibility* (`01061`) declared `"effect": "PREVENT_DAMAGE"` despite intercepting scheme threat, which confused card supplemental authors and developers (Issue #120, Issue #123).
- The engine implementation of `PREVENT_DAMAGE` was forced to branch internally on `context.threatAmount`, checking whether the intercepted event was threat or damage.
- Card Supplemental Editor tooltips and UI parameter registries conflated damage and threat descriptions.

How do we establish strict domain boundaries and declarative clarity between damage prevention and threat interception without accumulating technical debt?

---

## Decision Drivers

- **Domain Integrity:** Strict adherence to Marvel Champions Rules Reference (RR v1.8) distinction between damage (characters) and threat (schemes).
- **Declarative Data-First Invariant:** Supplemental card definitions must reflect domain intent clearly without overloaded primitive semantics.
- **Zero Tech Debt Invariant:** Direct refactoring to canonical schemas across engine, supplemental data, tooling, and tests without backwards-compatibility aliases.
- **Editor Tooling Ergonomics:** Authors should have distinct, tailored form controls and documentation for threat interception (`target: 'MAIN_SCHEME'`, dynamic/ALL amounts) vs. damage prevention (`target: 'SELF'`).

---

## Considered Options

1. **Option 1: Retain `PREVENT_DAMAGE` for Both Domains (Status Quo)**
   - Keep `PREVENT_DAMAGE` handling both damage and threat by continuing to branch on `context.threatAmount`.
2. **Option 2: Deconflate Domains with Dedicated `PREVENT_THREAT` Primitive (Selected)**
   - Introduce `PREVENT_THREAT` into `EffectTypeSchema` and `EffectType`.
   - Provide a dedicated `PREVENT_THREAT` handler in `src/engine/effects/index.ts` and dispatch path in `src/engine/triggers/trigger-dispatcher.ts`.
   - Constrain `PREVENT_DAMAGE` strictly to character damage prevention (`damageAmount`).
   - Retrofit all 3 affected cards in `src/data/supplemental/pack/core.json` (`01019b`, `01061`, `01085`).
   - Register `PREVENT_THREAT` in `effect-parameter-registry.ts` and update editor tooling.
3. **Option 3: Generic `INTERCEPT_EVENT` Primitive**
   - Introduce a generic `INTERCEPT_EVENT` primitive with an `eventType: 'DAMAGE' | 'THREAT'` parameter.

---

## Decision Outcome

**Chosen Option:** **Option 2: Deconflate Domains with Dedicated `PREVENT_THREAT` Primitive**

### Rationale ("The Why")

1. **Strict Domain Separation (RR v1.8):** Damage is taken by characters (p. 8), while threat is placed on schemes (p. 31). A card that reduces or prevents impending threat is preventing *threat*, not damage. Naming the primitive `PREVENT_THREAT` mirrors the printed card text ("prevent 1 of that threat", "prevent all of it", "reduce the amount of threat placed by 1").
2. **Eliminates Engine Internal Branching:** `PREVENT_DAMAGE` no longer checks for `context.threatAmount` or logs `'card.effect.consumeInterceptedEvent'`. Each handler only inspects and modifies its respective context field (`damageAmount` vs. `threatAmount`).
3. **Zero Tech Debt Invariant:** Exactly three cards in the entire card catalog intercept threat (`01019b`, `01061`, `01085`). Performing a clean, 100% retrofit of these cards eliminates the need for any backwards-compatibility shims or duplicate dispatch code.
4. **Editor Alignment:** The Card Supplemental Editor can provide accurate contextual tooltips ("Prevent or reduce impending threat that would be placed on a scheme.") and appropriate defaults (`target: 'MAIN_SCHEME'`) instead of a single overloaded control.

---

## Evaluation of Options

### Option 1: Retain `PREVENT_DAMAGE` for Both Domains
- **Pros:**
  - No schema changes or card JSON modifications required.
- **Cons:**
  - Violates domain modeling principles; card text referring to threat is declared as damage.
  - Confuses contributors and supplemental authors (Issue #120).
  - Keeps fragile `threatAmount` branching inside damage engine pipelines.

### Option 2: Deconflate Domains with Dedicated `PREVENT_THREAT` Primitive
- **Pros:**
  - Perfectly reflects RR v1.8 domain semantics.
  - Resolves Issue #120 and Issue #123 definitively.
  - Decouples damage and threat handling in `src/engine/effects/index.ts` and `src/engine/triggers/trigger-dispatcher.ts`.
  - Full editor UI support with tailored parameter registration and React test coverage.
  - Zero tech debt: direct retrofit across all 3 affected cards.
- **Cons:**
  - Requires coordinated updates across schema, engine, card data, editor registry, and tests.

### Option 3: Generic `INTERCEPT_EVENT` Primitive
- **Pros:**
  - Single primitive for prospective interception.
- **Cons:**
  - Overly abstract; moves the domain distinction into an extra parameter while losing the clarity of dedicated primitives like `DEAL_DAMAGE` vs. `ADD_THREAT`.
  - Breaks consistency with the rest of the effect taxonomy (`REMOVE_THREAT`, `ADD_THREAT`, `DEAL_DAMAGE`, `HEAL_DAMAGE`).

---

## Consequences

### Positive Consequences
- Strict domain isolation between damage prevention (`PREVENT_DAMAGE`) and threat interception (`PREVENT_THREAT`).
- Engine effect handlers are single-responsibility and easy to test in isolation.
- Card Supplemental Editor exposes dedicated controls with appropriate scheme target defaults.
- All Core Set card definitions for Jennifer Walters (`01019b`), Great Responsibility (`01061`), and Emergency (`01085`) are clean, canonical, and accurately audited.

### Negative Consequences / Risks & Mitigations
- *Risk:* External or older card data files might use `PREVENT_DAMAGE` on `THREAT_WOULD_BE_PLACED`.
  - *Mitigation:* `tools/audit/migrate-declarative-taxonomy.ts` automatically translates legacy triggers to `PREVENT_THREAT`, and all in-tree supplemental packs are audited and verified.
