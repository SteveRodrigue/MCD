# Plan: Issue #185 — Gray out Surveillance Team (01064) when no threat can be removed

> Status: **Implemented** (committed `569274c`). Decisions: gray for any reason the player can't act; grayed cards are not clickable (hover zoom stays); applies to all tableau cards with Action/Resource abilities. Tests live in `tests/ui/tableau-card-actionability.test.tsx`. Documented in ADR-0074.

## 1. Root cause

- Engine is already correct: `canInitiateAbility` (`src/engine/pipeline/legality-checker.ts:1281-1292`) rejects `REMOVE_THREAT` when `hasEligibleThreatRemovalTarget` is false (no threat, Crisis, or Patrol — fixed in #181).
- UI gap: `evaluateTableauCardLegality` (`src/ui/components/board/tableau-card-legality.ts`) only checks **identity form**. `HeroZone.tsx:1057` feeds it into `CardView isUsable`, so the card is never grayed for state-based reasons. `TableauActionModal.tsx:33` uses the same helper.
- The "USE" button in `HeroZone.tsx:~1120` already disables via `canInitiateAbility`. Only the card face (grayscale/badge) and modal header are wrong.

## 2. Rules (RR v1.8)

- An action that cannot change game state or has no legal target cannot be initiated (RR "Initiating abilities / potential to change game state", cited at `legality-checker.ts:1281`). Crisis and Patrol block main-scheme threat removal (already in engine).
- No new rule; reuse the engine check. Verify wording with `npm run rule -- "change the game state"` during implementation.

## 3. Design

Add an optional state-aware layer to the UI helper, reusing the engine (no duplicated rules, engine stays headless):

- `evaluateTableauCardLegality(cardInst, currentForm, ctx?: { gameState, playerId })`.
- After the form checks pass, if `ctx` is given: take the card's abilities usable in the current form with action timing. If there is at least one and **every** one fails `canInitiateAbility` for a **target/state reason**, return `{ isUsable: false, reason }`. No badge (badges are form-only).
- "Target/state reason" excludes turn/phase, exhausted, and once-per-round limits, so the card is not grayed just because it is the other player's turn. See open decision 1.
- Callers pass `gameState` and `player.id`: `HeroZone.tsx:1057`, `TableauActionModal.tsx:33`.

## 4. Files

| Tag | File | Change |
|---|---|---|
| MODIFY | `src/ui/components/board/tableau-card-legality.ts` | Add optional `ctx` and state-aware check |
| MODIFY | `src/ui/components/board/HeroZone.tsx` | Pass `{ gameState, playerId }` at line ~1057 |
| MODIFY | `src/ui/components/board/TableauActionModal.tsx` | Pass ctx at line ~33 |
| MODIFY | `tests/ui/tableau-form-legality.test.tsx` | New cases below |
| MODIFY | `CHANGELOG.md` | `[Unreleased]` entry |
| MODIFY | `docs/backlog/teamwork_status_and_next_target.md` | Mark #185 resolved, set #179 active |

No `src/engine/` and no `src/data/supplemental/` changes.

## 5. UI / Card Editor impact

- UI: tableau cards get the existing grayscale `isUsable=false` treatment (same pop-art style as form-gated cards). Card face stays clickable (modal still opens to show why), per open decision 2.
- Card Editor: none.

## 6. TDD (tests written first, must fail before the fix)

In `tests/ui/tableau-form-legality.test.tsx`:

1. Surveillance Team, main scheme threat 0, no side schemes → `isUsable: false`, reason mentions no threat. **(red first)**
2. Same card, main scheme threat > 0, no Crisis/Patrol → `isUsable: true`.
3. Threat only on main scheme but a Crisis side scheme in play → `isUsable: false`; Crisis scheme has threat → true. Patrol minion engaged → false for main-scheme-only threat.
4. Side scheme with threat > 0 while main threat 0 → `isUsable: true`.
5. Not the player's turn / card exhausted with threat available → still `isUsable: true` (no turn-based graying).
6. Omitting `ctx` keeps current form-only behavior (existing tests unchanged).
7. Render `CardView` with the result → grayscale class and unusable overlay present when false.

## 7. Verification

`rtk npm test -- tests/ui/tableau-form-legality.test.tsx`, then `rtk npm run format:check`, `rtk npm run lint`, `rtk npm run typecheck`, `rtk npm test` (0 failed, 0 skipped).

## 8. Open decisions

1. **Scope of graying.** Recommended: gray only for target/state reasons (no threat target); not for turn, exhausted, or limit. Alternative: gray whenever `canInitiateAbility` fails for any reason.
2. **Click behavior.** Recommended: card still opens the modal (shows disabled ability with reason). Alternative: block the click when unusable. The issue only asks for graying.
3. **Generalization.** Recommended: apply to every tableau card via `canInitiateAbility` (covers heal/ready/attack targets too, which also helps #179 later). Alternative: scope to `REMOVE_THREAT` only.

## 9. Estimate

About 45 minutes: 15 min tests, 15 min helper + wiring, 15 min gates and docs.
