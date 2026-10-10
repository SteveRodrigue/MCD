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

## Addendum (2026-10-03): Single Shared Step-Gate Evaluator (Issue #122)

Gate evaluation (`gate`, `gateParams`, `condition`) lives in one module, `src/engine/pipeline/step-gate-evaluator.ts` (`evaluateStepGate`). `shouldExecuteStep` (effect pipeline) delegates to it, and the `CONSTANT` stat-calculator loop calls it instead of an inline `TARGET_TRAIT_MATCH` check. New gate types therefore work for action and constant steps alike, with no per-card or per-pipeline code. Result-based gates do not apply to `CONSTANT` steps (no preceding step).

### Addendum (2026-10-03): Gates on CONSTANT `ADD_TRAIT` (Issue #154)

Trait computation (`getEffectivePlayerTraits*`, `hasPlayerTrait`, `getEffectiveCardTraits*`) honors `gate`/`gateParams` on `CONSTANT` `ADD_TRAIT` steps. `IF_FORM` needs only the player (`evaluateFormGate`), so UI callers without a `GameState` get correct results; other state gates are evaluated when an optional `state` argument is supplied and skipped otherwise. *Cosmic Flight* (`01017`) now declares `IF_FORM: hero`, so Aerial is not granted in Alter-Ego form.

### Addendum (2026-10-06): Per-player resolution is an ability header flag (Issue #220)

"Each player ... that player" resolves a step list once per player. The loop is a declarative boolean on the ability header, `forEachPlayer` (default `false`, next to `timing` and `trigger`), not a nested `steps` list or a new effect: ability -> steps -> effect stays the only shape. `executeEffect` runs the whole step list once per player in player order with a clean `previousResult` / `discardedCards` per pass; a prompt in one pass leaves the remaining players in a pending entry beneath the rest of that pass (same `pendingSequences` stack as #248). Abilities that mix per-player and run-once steps are #272. Specification: `10_sequences_and_prompts.md`.

### Addendum (2026-10-06): Boost abilities that wait for the activation's damage (Issue #221)

"If this activation deals damage to a friendly character, stun that character" (_Sweeping Swoop_ `01168`) cannot be decided when the boost is revealed: boosts resolve in step 5 and damage is dealt in step 6 (RR v1.8 Boost). The declarative answer is a gate, not a card special: `IF_ACTIVATION_DEALT_DAMAGE` (true when the activation's final damage is greater than 0, so DEF, Tough and prevention that bring it to 0 mean "no damage") and a target selector `DAMAGED_CHARACTER` (the hero or ally that took it). Decision (owner-approved): the engine defers any `BOOST` ability that contains a step with that gate, with no extra ability field. `step4_and_5_dealAndResolveBoostCards` queues it in `AttackExecutionContext.deferredBoostAbilities`, and `applyCalculatedAttackDamage` (shared by the direct step 6 path and the prevention-prompt resume) resolves the queue once, passing `activationDamage` and `damagedCharacter` through `EffectExecutionContext` to `evaluateStepGate` and `resolveTargets`. Scope: villain and minion attacks; the gate is closed outside that resolution. Damage dealt by other boost abilities does not count (Glossary Boost): the gate reads only the activation's own `finalDamage`. A step whose target no longer exists (the damaged ally was defeated, the hero reached 0 HP) resolves to nothing.

## Addendum (2026-10-06): Step Failures in a Sequence (Issue #225)

A step result has two kinds of `success: false`. With an `error` it is malformed data or an unsupported input: `executeSequence` logs an `engine.stepError` entry (shown in Dev Mode only), stops, and returns `success: false` with the error; steps already applied are kept (the engine has no rollback). Without an `error` it is an outcome that later gates read (`IF_FAILED`, for example `ENEMY_ATTACKS`), and the sequence continues.

## Addendum (2026-10-07): Cancelling the reveal of an encounter card (Issue #255)

The interrupt window of a reveal opens for **every** encounter card (new trigger `ENCOUNTER_CARD_REVEALED` for "When a card is revealed from the encounter deck", then `TREACHERY_REVEALED` for treacheries; `WHEN_REVEALED` stays the card's own printed ability and is no longer dispatched as a window), not only for cards that print a When Revealed ability. The cancel effects set `activeEncounterContext.cancelled` themselves (the three scattered setters in the trigger dispatcher and the prompt queue are gone); `CANCEL_WHEN_REVEALED_AND_REVEAL_ANOTHER` also sets `discardCard`, so a cancelled non-treachery card is discarded instead of entering play ("cancel the effects of that card and discard it"). "This effect cannot be canceled" is a step-level flag, `cannotBeCanceled`, resolved through one function, `canCancelEncounterReveal` (`pipeline/encounter-cancel.ts`), which also keeps villain and main scheme reveals out of reach (RR). A cancel that cannot cancel is not offered. Whole-card protection (expert-mode Spider-Man treacheries) is #286; the global *Dark Scepter* modifier is not scheduled. Eternity `21054` is the proof card (partial model, confidence 50).

## Addendum (2026-10-10): Attack steps report their outcome (Issue #295)

"Rhino attacks you. If a character is damaged by this attack, that character is stunned" (_Stampede_ `01106`) needs the outcome of an attack inside the ability that started it. `VILLAIN_ATTACKS` and `ENEMY_ATTACKS` now return step facts: `damageDealt` (final damage of step 6) and `damagedCharacter`; the result fact `DAMAGE_DEALT` (`IF_RESULT`, true above 0) and the `DAMAGED_CHARACTER` selector read them. The attack usually waits for a defender or prevention prompt: the step reports `attackPending`, `executeSequence` parks the later steps with `awaitsAttackOutcome`, and `resumePendingSequence` keeps them parked while the attack context is open, then joins `getAttackOutcomeFacts` (from `lastCombatOutcome`) to the previous result. `IF_ACTIVATION_DEALT_DAMAGE` stays the gate of deferred boost abilities. `VILLAIN_AND_ENGAGED_MINIONS_ATTACK` (several attacks) reports nothing.
