# Plan: #331 Legal Practice `01023` offered the main scheme despite a preventing icon

> **Status:** revised after owner feedback (2026-10-22): **#331 stays open**; the fix is a consolidation of the sprawling validity checks into reusable functions. **Scope C chosen by the owner** (section 5). Awaiting approval of the plan to start. No code, test or data changed yet.
> **Issue:** [#331](https://github.com/SteveRodrigue/MCD/issues/331) (Gate 1, P2, bug, needs-review). Overlaps [#366](https://github.com/SteveRodrigue/MCD/issues/366) (Tech Debt; "remove the effect-name legality checks left outside the gate") and a slice of [#367](https://github.com/SteveRodrigue/MCD/issues/367).
> **UI / Card Editor impact:** none. No schema, supplemental data or `audit` change. Engine only (UI callers of `canBasic*` / `canAlly*` are renamed if option B or C is chosen).

## 1. Report

Rhino, Standard, She-Hulk + Black Panther (2 players), round 6, player phase, filed 2026-10-19:

> Legal Practice (01023): "I was proposed to thwart on main Scheme and I should not have been able: because of an ICON."

The snapshot `gamestate_1792427335681_bug.json` is not on disk (`logs/` starts at `1792545609298`), so the exact board is unknown.

## 2. Rules (`references/rules/`, no PDF)

- **Crisis icon:** while one is in play, **player cards** cannot remove threat from the main scheme; encounter abilities are unaffected.
- **Patrol:** while a Patrol minion is engaged with a player, **that player** cannot use cards they control to thwart the main scheme.
- **Guard:** while a Guard minion is engaged with a player, **that player** cannot attack a villain.
- **Target (RR v1.8):** an ability is initiable only with at least one valid target; ADR-0090 makes `checkAbilityTargets` the one gate.

All three restrictions have the same shape: _"for this acting player and a player-card source, is this scheme/villain not a legal target?"_

## 3. Findings

**Probe at HEAD** (throwaway test, deleted): Legal Practice with a Crisis side scheme in play correctly never offers the main scheme (prompt lists side schemes only; main-only plus Crisis is rejected). So the plain Crisis case holds since #340; the reported board is unknown. Patrol and uncounted Crisis zones (for example `player.obligations`) are untested.

**Root problem: the same rule is written many times, so each copy can drift.** Inventory (read from the code):

### 3.1 "Main scheme blocked by Crisis / Patrol" (8 copies)

| #   | Site                                                                                 | Notes                                                                                                                           |
| :-- | :----------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `threat-pipeline.ts:449` `getMainSchemeBlock`                                        | The executor. `ignoresCrisis` skips Crisis only; `ignoresPatrol` is set from `!isPlayerSource`.                                 |
| 2   | `target-resolver.ts:1135` `resolveTargets` `CHOSEN_SCHEME`                           | `ignoresCrisis` skips **Crisis and Patrol**. Differs from #1.                                                                   |
| 3   | `target-resolver.ts:1753` `getEligibleTargets` `CHOSEN_SCHEME`                       | Same expression as #2, second copy in the same file. Feeds the gate.                                                            |
| 4   | `legality-checker.ts:300` `canBasicThwart`                                           | Patrol + Crisis, own wording.                                                                                                   |
| 5   | `legality-checker.ts:378` `canAllyThwart`                                            | Copy of #4.                                                                                                                     |
| 6   | `legality-checker.ts:967` `hasEligibleThreatRemovalTarget`                           | Recomputes Crisis + Patrol, ignores `ignoresCrisis` entirely. Used by #7 and #8.                                                |
| 7   | `legality-checker.ts:1018` `evaluateSchemeTargetRequirement` (event play)            | Finds `REMOVE_THREAT` by effect name.                                                                                           |
| 8   | `legality-checker.ts:1235` `canInitiateAbility` step 5A (ability use)                | Finds `REMOVE_THREAT` by effect name; also a second place for the Confused-thwart exemption (already in `isCancelledByOwnStatus`). |

Plus `encounter.ts:116` derives `ignoresCrisis` / `ignoresPatrol` a third way. **Two of the copies already disagree** (#1 vs #2 on what `ignoresCrisis` ignores; #6 ignores it). That is exactly the "offered but blocked" class of bug #331 describes.

### 3.2 Guard (3 copies) and the player-action window (7 copies)

- Guard: `canBasicAttack`, `canAllyAttack`, `canInitiateAbility` 5B (plus a display read in `ui/.../attack-target-utils.ts:75`).
- "Player Phase only" + "not your turn": pasted into `canChangeForm`, `canBasicRecover`, `canBasicAttack`, `canAllyAttack`, `canBasicThwart`, `canAllyThwart` and partly in `canInitiateAbility`.
- `canBasicAttack` / `canAllyAttack` and `canBasicThwart` / `canAllyThwart` are near-identical pairs that differ only by who acts (hero vs ally). About 25 callers (`combat.ts`, `legal-actions-generator.ts`, `player-bot.ts`, `attack-target-utils.ts`, `thwart-target-utils.ts`, `IdentityActionModal.tsx`, `identity-action-utils.ts`).

### 3.3 Out of this ticket (stay in #366)

`evaluateMinionTargetRequirement`, `evaluateAllyTargetRequirement`, `evaluateEnemyTargetRequirement` (ATTACH_TO_HOST requirements), the two target-choice prompt mechanisms (`EVENT_CHOSEN_TARGET` in `play.ts`, `ABILITY_CHOSEN_TARGET` in `abilities.ts`) and `CardPaymentModal`'s effect-name picker. They are a different rule family (attach hosts, prompts, UI) and would double this change.

## 4. Design: one place per rule

New leaf module `src/engine/pipeline/target-restrictions.ts` (imports models and `crisis.ts` only, so `target-resolver`, `legality-checker` and `threat-pipeline` can all use it without a cycle; ADR-0088):

```ts
type MainSchemeBlock = 'CRISIS' | 'PATROL';

/** RR v1.8 "Crisis Icon", "Patrol": why this player's cards cannot remove threat from the main scheme. */
export function getMainSchemeThreatBlock(
  state: GameState,
  actingPlayer: PlayerState,
  options: { isPlayerSource: boolean; ignoresCrisis?: boolean },
): MainSchemeBlock | undefined;

/** RR v1.8 "Guard": whether this player's cards cannot attack the villain. */
export function isVillainAttackBlockedByGuard(actingPlayer: PlayerState): boolean;
```

One definition of the semantics: encounter-source effects ignore both; `ignoresCrisis` skips **Crisis only** (the printed param is "may remove threat from the main scheme while Crisis is in play"), Patrol still applies to player cards. Reason strings and log keys live next to it (a `Record<MainSchemeBlock, ...>`), so the legality reason, the log line and the onomatopoeia come from one table.

The action window gets the same treatment inside `legality-checker.ts`: one `checkActionWindow(state, player)` for "Player Phase only / your turn".

## 5. Scope options (owner decides)

| Option                      | Changes                                                                                                                                                                                                                                                                                                                                                                                                                                              | Size (plan + TDD + gates) | Risk                                              |
| :-------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------ | :------------------------------------------------ |
| **A. Restriction rules**    | Add `target-restrictions.ts`. Sites 1 to 6 and `encounter.ts` call it; Guard copies call `isVillainAttackBlockedByGuard`; `getMainSchemeBlock` becomes a thin mapper. Net: about 8 copies down to 1.                                                                                                                                                                                                                                                  | about 3 h                 | Low                                               |
| **B. A + actor merge**      | Everything in A, plus: `checkActionWindow`; merge `canBasicAttack` + `canAllyAttack` into one `canAttack(state, playerId, actor, target)` and the thwart pair into `canThwart(...)`, with `actor = { kind: 'hero' } \| { kind: 'ally', instanceId }`. About 25 callers renamed (no aliases left behind).                                                                                                                                                | about 6 h                 | Medium (wide rename, behaviour unchanged)         |
| **C. B + move into gate (recommended)** | Everything in B, plus: sites 6, 7, 8 are **deleted**. `checkAbilityTargets` judges the scheme selectors `MAIN_SCHEME`, `SIDE_SCHEME`, `CHOSEN_SCHEME` (a slice of #367) through `getEligibleTargets`, which already calls the shared block function; step 5A and `evaluateSchemeTargetRequirement` disappear, so `REMOVE_THREAT` is checked in exactly one place (`AFFECT_RULES` + enumeration). Guard 5B stays for #366. Removes the `REMOVE_THREAT` part of the `legality-checker.ts` entry in `ALLOWED_EFFECT_NAME_CHECKS`. | about 1 day               | Medium-high (touches the gate; safety net below)  |

Recommendation: **C**. It makes threat removal follow the same path as READY / HEAL / EXHAUST did in #340, which is what you asked for ("a reusable function instead of duplicating checks"), and it is the only option where a future prevention rule cannot be forgotten in one of eight places. B alone leaves the event-play and ability-use copies. C leaves Guard (DEAL_DAMAGE) and the ATTACH_TO_HOST requirements to #366.

`Refs #366` in the commit (item 1 partly done), never `Fixes`. `Refs #331`, never `Fixes`, until the owner confirms the reported symptom is gone.

## 6. Tests (written first)

Safety net, must pass unchanged: `crisis-scheme-targeting`, `crisis-interdiction-different-scheme`, `keywords-crisis`, `ally-thwart-legality`, `thwart-label`, `legal-practice-play`, `mark-v-helmet`, `legal-actions-generator`, `target-legality-requirements`, `legality-gate-guards`.

New `tests/engine/target-restrictions.test.ts` (unit, the function) and `tests/engine/legal-practice-prevention.test.ts` (play path, 2 players, She-Hulk + Black Panther):

1. Crisis icon from each zone `countCrisisIconsInPlay` reads (side scheme, main-scheme attachment, ally attachment, engaged minion, villain attachment, tableau) blocks the main scheme.
2. Patrol minion engaged with the acting player blocks it; engaged with the **other** player does not.
3. `isPlayerSource: false` ignores both; `ignoresCrisis: true` ignores Crisis but not Patrol (pins the #1 vs #2 disagreement).
4. **Parity table:** for one set of boards, `canBasicThwart`, `canAllyThwart`, Legal Practice (event play), Surveillance Team (ability use) and the executor (`applyThwart`) all agree on "main scheme allowed / blocked". This is the test that would have caught #331's class.
5. Guard: villain attack blocked by Guard for hero and ally, minion attack allowed.
6. (C) `legality-gate-guards.test.ts`: the allow-list entry for `legality-checker.ts` shrinks to the Guard / `DEAL_DAMAGE` debt only; a new guard test fails if `Keyword.PATROL`, `Keyword.GUARD` or `hasCrisisInPlay` is read outside `target-restrictions.ts` and `crisis.ts`.
7. If a probe test reveals the real #331 board (for example an uncounted Crisis zone), it joins case 1 and drives the fix in `countCrisisIconsInPlay`.

## 7. Files

- Add: `src/engine/pipeline/target-restrictions.ts`, `tests/engine/target-restrictions.test.ts`, `tests/engine/legal-practice-prevention.test.ts`.
- Edit: `legality-checker.ts` (delete sites 4 to 8 and the Guard copies; B/C: merge pairs), `target-resolver.ts` (sites 2, 3), `threat-pipeline.ts` (site 1), `encounter.ts`, `crisis.ts` (only if a zone is missing), callers of the renamed functions (B/C), `legality-gate-guards.test.ts`.
- Docs: ADR-0090 addendum (threat-removal restrictions now follow the gate; REMOVE_THREAT debt closed), `docs/coding_guidelines.md` §15.11 (name the restriction module), `CHANGELOG.md` `[Unreleased]`. Delete this plan and update the status file in the delivering commit.

## 8. Open decisions

1. **Scope: A, B or C?** (Recommended: C.)
2. **Snapshot.** If you still have `gamestate_1792427335681_bug.json`, I can reproduce the exact board before step 1 of the tests; otherwise the parity table stands in for it.
3. **#366.** Record in #366 what this ticket removed (comment on the issue), leaving items 2 to 4 there. OK?
