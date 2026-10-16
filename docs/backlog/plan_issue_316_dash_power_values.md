# Plan: Issue #316 — Dash (–) basic power values

> **Status:** Approved (2026-10-15).
> **Issue:** [#316](https://github.com/SteveRodrigue/MCD/issues/316) · **Milestone:** Gate 1 — Rhino Release · **Labels:** bug, priority:P0-blocker, subsystem:engine, subsystem:data
> **Triage outcome:** `current-milestone priority` — Hulk (`01050`) is a Core Set ally in the Gate 1 card pool.
> **Blast radius:** Tier 2 (loader + engine legality/stat calculation + UI display; shared `NormalizedCard` contract).
> **Runs before:** [`plan_card_editor_rearchitecture.md`](plan_card_editor_rearchitecture.md) (same ally block in `card-loader.ts`).

## 1. Rules (RR v1.8)

From [`references/rules/glossary/D.md#dash-value`](../../references/rules/glossary/D.md):

> A value presented as a dash (–) indicates that value cannot be used.
> - If a character's power (ATK, DEF, REC, SCH, and THW) has a dash (–) as the value, the character cannot exhaust to use that power.
> - If a game step or card ability references a value of dash (–), that value is treated as an unmodifiable 0.

The other bullet (dash *cost*: card cannot be played) is out of scope. No upstream player card has a `null` cost.

## 2. Root cause

Upstream MarvelCDB JSON encodes a printed dash as `null`. [`card-loader.ts:310-421`](../../src/data/importer/card-loader.ts#L310-L421) coerces it with `??`:

| Type | Line | Coercion |
| :-- | :-- | :-- |
| Hero | 317, 319, 321 | `thwart` / `attack` / `defense` `?? 0` |
| Alter-ego | 332 | `recover ?? 0` |
| Villain | 351, 353 | `scheme` / `attack` `?? 0` |
| Ally | 397, 399 | `thwart` / `attack` `?? 1` |
| Minion | 412, 413 | `scheme` / `attack` `?? 0` |

Result for Gate 1: **Hulk (`01050`, THW –) loads as THW 1.** The player can exhaust Hulk to thwart for 1, and +THW effects (e.g. Inspired `01074`) raise it further. Both are illegal under RR v1.8.

Downstream, nothing can tell a dash from a real 0:

- [`legality-checker.ts`](../../src/engine/pipeline/legality-checker.ts) `canAllyThwart` (393), `canAllyAttack` (262), `canBasicThwart` (319), `canBasicAttack` (204), `canBasicRecover` (172) check form, exhaustion, phase, targets. None checks the power.
- [`legal-actions-generator.ts:684-720`](../../src/engine/pipeline/legal-actions-generator.ts#L684-L720) pushes `ALLY_THWART` options **without calling `canAllyThwart`** (it only imports `canAllyAttack`).
- [`stat-calculator.ts`](../../src/engine/pipeline/stat-calculator.ts) `getEffectiveAllyStats` (139), `getEffectiveHeroStats` (393), `getEffectiveVillainStats` (97), `getEffectiveMinionAttack` (36) add every modifier to the base.
- [`player-bot.ts:153-170`](../../src/engine/simulation/player-bot.ts#L153-L170) picks `ALLY_THWART` for any ready ally without a legality check.

### Upstream inventory (all packs)

| Code | Card | Dash | Gate |
| :-- | :-- | :-- | :-- |
| `01050` | Hulk (ally) | THW | **Gate 1** |
| `46003` Snow Clone, `62020` Hulk | allies | THW | later |
| `32066` Robert Kelly, `40130` Hope Summers | allies | ATK, THW | later |
| `39012a`–`39014a` Spiral | villain | ATK | later |
| `55027a/b` Loki, `55029b`–`55032b` Fading Figment | villain | ATK, SCH | later |

Some other cards *omit* the field (`undefined`, not `null`), e.g. Norman Osborn `02001a` ATK and several `aoa` minions. Upstream does not mark those as dash, so they keep today's defaults (§7, open decision 1).

## 3. Simplification check

- **No `number | null` type change.** Making `attack: number | null` would touch every arithmetic reader across engine and UI. Instead, keep the numeric field at `0` and record the dash in one new field. Every existing reader gets the correct "treated as 0" value for free.
- **One helper, many callers.** `hasDashPower(card, power)` is used by legality, stats, generator, bot and UI. No per-site `=== null` checks.
- **Generator reuses `canAllyThwart`** instead of adding its own dash check. This also closes the existing gap where the generator skipped ally thwart legality.

## 4. Proposed fix

### 4.1 Model — [`src/engine/models/card.ts`](../../src/engine/models/card.ts)

```ts
export type CharacterPower = 'attack' | 'thwart' | 'defense' | 'recover' | 'scheme';

export interface NormalizedCard {
  // ...
  /** Powers printed as a dash (–): cannot be used, treated as an unmodifiable 0 (RR v1.8 "Dash (Value)"). */
  dashPowers?: CharacterPower[];
}

export function hasDashPower(card: Pick<NormalizedCard, 'dashPowers'>, power: CharacterPower): boolean {
  return card.dashPowers?.includes(power) ?? false;
}
```

### 4.2 Loader — [`card-loader.ts`](../../src/data/importer/card-loader.ts)

- Add `collectDashPowers(raw, powers)`: returns the powers whose raw value is exactly `null`.
- In each character case (hero, alter-ego, villain, ally, minion), set `dashPowers` (omitted when empty) and use `0` as the numeric value for a `null` power.
- Ally: `thwart: raw.thwart === null ? 0 : (raw.thwart ?? 1)`, same for `attack`. The `undefined` defaults are unchanged. The consequential-cost default (`attack_cost` / `thwart_cost`) is **not** touched here; it belongs to the editor plan §1.3.

### 4.3 Legality — [`legality-checker.ts`](../../src/engine/pipeline/legality-checker.ts)

Add a dash check right after the exhaustion check, with reason `"<name> has no <POWER> (–) and cannot use it."`:

| Function | Check |
| :-- | :-- |
| `canAllyThwart` | `hasDashPower(ally.card, 'thwart')` |
| `canAllyAttack` | `hasDashPower(ally.card, 'attack')` |
| `canBasicThwart` / `canBasicAttack` | `hasDashPower(player.hero, 'thwart' / 'attack')` |
| `canBasicRecover` | `hasDashPower(player.alterEgo, 'recover')` |

Hero `DEF` dash (defending) has no Gate 1 card; add the same check where a hero is declared as defender only if the defender path has a single legality function (verify during implementation; otherwise defer, §7).

### 4.4 Stats — [`stat-calculator.ts`](../../src/engine/pipeline/stat-calculator.ts)

In `getEffectiveAllyStats`, `getEffectiveHeroStats`, `getEffectiveVillainStats`, `getEffectiveMinionAttack`: after summing modifiers, force each dash power back to `0` ("unmodifiable 0"). Values used by abilities (e.g. "the ally with the lowest SCH") already read these functions or the numeric `0`.

### 4.5 Action generator & bot

- [`legal-actions-generator.ts:684-720`](../../src/engine/pipeline/legal-actions-generator.ts#L684-L720): gate both ally-thwart pushes on `canAllyThwart(...).allowed`.
- [`player-bot.ts:153-170`](../../src/engine/simulation/player-bot.ts#L153-L170): only choose `ALLY_THWART` / `ALLY_ATTACK` when `canAllyThwart` / `canAllyAttack` allows it; otherwise fall through to the next option. This protects the Gate 1 100-game simulation from a rejected-action loop.

### 4.6 UI — display only

- [`AllyActionModal.tsx`](../../src/ui/components/board/AllyActionModal.tsx) (lines 36–51) and the ally stat block in [`HeroZone.tsx`](../../src/ui/components/board/HeroZone.tsx) (~922): show `–` instead of the number for a dash power, and hide the bonus badge for it. The thwart button disables automatically: `getValidThwartTargets` ([`thwart-target-utils.ts:47`](../../src/ui/components/board/thwart-target-utils.ts#L47)) already calls `canAllyThwart`.
- Replace the `?? 1` fallbacks at `AllyActionModal.tsx:40-41` with the loader values (they are always set).

### 4.6b UI and Card Editor

- **Game UI:** `src/ui/components/board/AllyActionModal.tsx`, `src/ui/components/board/HeroZone.tsx` (§4.6). Tests in §5.
- **Card Editor:** No change required. `dashPowers` is derived from upstream `null` values in the loader; it is not a supplemental field, so `CardEnrichmentSchema` and every file in `src/ui/components/editor/` are untouched.

### 4.7 Data

No supplemental change. Hulk (`01050`) has no `thwart` override.

## 5. Tests (TDD: written first, must fail before the fix)

Extend existing files; no new fixture setups where one exists.

| File | New cases |
| :-- | :-- |
| `tests/data/card-loader.test.ts` | Hulk `01050`: `thwart === 0`, `dashPowers` = `['thwart']`; ally with numeric powers has no `dashPowers`; villain `55027a` gets `['attack','scheme']`; an omitted (`undefined`) power is **not** a dash |
| `tests/engine/ally-thwart-legality.test.ts` | Hulk ready, threat > 0: `canAllyThwart` → not allowed, reason mentions THW; `dispatchAction(ALLY_THWART)` fails and Hulk stays ready; Hulk can still `ALLY_ATTACK` |
| `tests/engine/dynamic-stat-calculator.test.ts` | Hulk + Inspired (`01074`, +1 THW / +1 ATK): THW stays 0, ATK = printed + 1 |
| `tests/engine/legal-actions-generator.test.ts` | No `ALLY_THWART` option for Hulk; Spider-Woman (`01011`) still gets one |
| `tests/engine/deterministic-simulation.test.ts` | Bot with only Hulk ready and high threat does not return `ALLY_THWART` |
| `tests/ui/` (AllyActionModal test, new file only if none exists) | Hulk modal shows `THW –` and the thwart button is disabled |

Existing tests to re-run: `tests/engine/hulk-discard-response.test.ts`, `tests/engine/hulk-prompt-order.test.ts`, `tests/engine/thwart-label.test.ts`, `tests/engine/core-player-reverify.test.ts`.

Verification (bug-fix Step 6): `rtk npx prettier --check <changed>`, `rtk npm run lint`, `rtk npm run typecheck`, `rtk npx vitest related <changed> --run` (0 failed, 0 skipped). Full suite runs on push via `.githooks/pre-push`.

## 6. Documentation

- New ADR is **not** needed: this applies an existing rule; no design choice changes. The `dashPowers` field is documented by its TSDoc in `card.ts` (no spec file lists `NormalizedCard` fields today).
- [`docs/algorithmic_rules_reference.md`](../algorithmic_rules_reference.md) (lines 42–43, ally attack/thwart transitions): add "power not dash (–)" to the ready-ally guard.
- CHANGELOG fragment: `changes/unreleased/316-dash-power-values.md`.
- Fix the truncated issue body on GitHub (the current body cuts off mid-sentence) with a short summary of §1–§2 when closing.

## 7. Open decisions

1. **Omitted vs. `null` powers.** Only `null` counts as a dash. Omitted fields (e.g. Norman Osborn, AoA minions) keep current defaults. Revisit when those packs are integrated (Gate 2+), not Gate 1.
2. **Villain / minion dash during activation** (Loki, Spiral, Fading Figment): this plan sets their stat to an unmodifiable 0. Whether a dash-SCH villain still "schemes" (and draws boost) is a rules question for those scenarios. Deferred with trigger: integration of the Mojo / Time-Twisted encounter sets.
3. **Hero DEF dash:** no card in any pack prints it; enforce only if the defender path has one legality function (§4.3).
