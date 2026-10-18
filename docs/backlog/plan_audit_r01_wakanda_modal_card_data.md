# Plan R1: Wakanda Forever! modal reads its upgrades by card code

> **Status:** Proposed, waiting for owner approval.
> **Source:** post-remediation report of code audit AUD-20261017-232534 (item R1), found while writing the F007 Rhino smoke suite.
> **Gate:** 1 (Black Panther is a Core hero). **Tier:** 1. **Estimate:** 2–3 h.
> **Queue:** section 3.5 of [teamwork_status_and_next_target.md](teamwork_status_and_next_target.md).

## Problem

`src/ui/components/board/WakandaForeverModal.tsx:22` hard-codes `UPGRADE_CONFIGS` for the four Black Panther upgrades and matches each prompt option by a **name substring** of the option label or description (`:71`). The entry for 01049 is named "Panther Suit"; the card is **Vibranium Suit** (`npm run card:get -- 01049`). Its option therefore never matches and renders the generic fallback tile (no icon, no base/finisher text). Any future rename or translation breaks the match the same way.

The engine builds the prompt in `src/engine/specials/wakanda-forever.ts:104` with `id`, `label` (card name) and `description` (card text), but not `cardCode`, although `DecisionPromptOption.cardCode` exists (`src/engine/models/state.ts:206`).

## Rules / spec analysis

Not a rules change. Wakanda Forever! (01045, supplemental `core.json:1765`): the player resolves each Black Panther upgrade's Special ability in an order of their choice; the last one resolved is the "final step" (finisher). The modal only orders the sequence; resolution stays in the engine. Read the event entry with `npm run rule -- "special"` only if the ordering logic is touched (it is not).

## Simplification & Refactor Check

- **Merge:** match by `option.cardCode` (set by the engine) instead of by name substring. The label already carries the card name from the catalog, so the hard-coded `name` and `code` fields in `UPGRADE_CONFIGS` are deleted.
- **Keep (presentation only):** icon, colour class and the short badge texts, keyed by card code. Open decision 1 asks whether the badge texts should instead come from the supplemental ability `originalText`.
- **Delete:** the description-substring fallback path.
- No new function; `UpgradeMeta` loses `name` and `code` (taken from the option).

## File changes

| File                                                    | Change                                                                                                      |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `src/engine/specials/wakanda-forever.ts`                | Options carry `cardCode: u.card.code`                                                                       |
| `src/ui/components/board/WakandaForeverModal.tsx`       | `UPGRADE_STYLES: Record<string, …>` keyed by code; name from `opt.label`; fallback only for an unknown code |
| `tests/ui/wakanda-forever-modal.test.tsx`               | Add the cases below                                                                                         |
| `changes/unreleased/<date>-wakanda-modal-card-codes.md` | `Fixed` fragment                                                                                            |

## Tests (write first)

1. Modal with options for 01046–01049 (with `cardCode`) renders four styled tiles, and the 01049 tile shows "Vibranium Suit" with its icon (fails today).
2. An option with an unknown code renders the fallback tile.
3. Engine: the Wakanda prompt options carry `cardCode` (extend the existing Wakanda Forever engine test; find it with `rtk npx vitest related src/engine/specials/wakanda-forever.ts --run`).

## Open decisions

1. Badge texts ("1 DMG AOE", "2 MOVE"...): keep as hand-written UI copy keyed by code (recommended, smallest change), or derive from the supplemental ability text (more work; text is long for a tile).

## UI and Card Editor impact

UI: the Vibranium Suit tile gets its proper icon and colour. Card Editor: none.

## Acceptance

All four Black Panther upgrades show their own tile in the modal; no name literal remains in `WakandaForeverModal.tsx`.

## Commit

`fix(ui): Match Wakanda Forever upgrades by card code` with `Refs AUD-20261017-232534 R1`.
