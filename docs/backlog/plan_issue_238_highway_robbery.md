# Plan: #238, Highway Robbery `01166` loses the card taken from each hand

> **Status:** implemented 2026-10-05 (approved with option A for the RNG; the UI uses the facedown stack instead of a badge; seeded RNG is the separate issue #252). Engine fix plus a small UI addition; the card data does not change.
> **Scope:** `01166` only. Queue item 3 of section 3.1 in [teamwork_status_and_next_target.md](teamwork_status_and_next_target.md) (P1). The commit will say `Fixes #238`.
> **UI / Card Editor impact:** UI yes (facedown cards stack under the side scheme with the player card back). Card Editor none (no new effect, selector, gate or parameter; `RETURN_TO_HAND` and `ATTACH_FACEDOWN_CARDS_FROM_HAND` keep their schema).

## 1. Printed card text

[Highway Robbery] (01166), side scheme:

> **When Revealed**: Each player places a random card from their hand facedown here.
> **When Defeated**: Return each facedown card here to its owner's hand.

## 2. Evidence: four defects in one path

1. **Orphaned host (the card vanishes).** Every reveal site builds a `SideSchemeState` for `state.sideSchemes` and passes a *different* object (`cardInst`) as `sourceCardInstance` (`effects/index.ts` L3956 to L3967, `action-dispatcher.ts` L166 to L184, `villain-phase.ts` L670 to L690). `ATTACH_FACEDOWN_CARDS_FROM_HAND` (`effects/index.ts` L5193) pushes the stolen cards onto that throwaway instance, so the real side scheme never holds them. The cards are out of the hand and out of the game state. Nothing renders them.
2. **Wrong zone.** The cards are pushed to `attachments` with an `as any` cast. RR v1.8 and this engine's own model use `cardsUnderneath` for "out-of-play cards placed under this card" (`state.ts` L28). An attachment is an in-play card.
3. **Discarded before the return.** `defeatSideScheme` (L431) runs `processHostDefeated` first (step 1, L461), which calls `discardHostAttachmentsAndTuckedCards`. That empties `attachments` and `cardsUnderneath` into the discard piles. The `When Defeated` ability (step 3, L484) then runs `RETURN_TO_HAND` on an empty list.
4. **`Math.random` pick** (L5196) with no way to test it. Each player with an empty hand is skipped, which is correct.

Also found: `RETURN_TO_HAND` (L4584) has a fallback branch that moves the source card itself to hand. It is used by other cards, so it stays, but its attachments branch will read `cardsUnderneath`.

## 3. Proposed engine changes

1. **Resolve the real host.** A new small helper in `effects/` returns the zone entity that owns `context.sourceCardInstance`: the `SideSchemeState` whose `instanceId` matches (and, for symmetry, the villain / main scheme / minion cases only when a card needs them; not in this change). `ATTACH_FACEDOWN_CARDS_FROM_HAND` writes to `host.cardsUnderneath`. This fixes all reveal sites at once without touching them, and it keeps the primitive generic (ADR-0021: no card names).
2. **Use `cardsUnderneath`.** Stolen cards keep their `ownerId` (set from the player they came from). Remove the `as any` casts for this path.
3. **Return before discard.** In `defeatSideScheme`, run the scheme's own `When Defeated` abilities (step 3) before `processHostDefeated` (step 1) so "return each facedown card here" sees the cards. The facedown cards still left under the scheme afterwards (a scheme that does not return them) are discarded exactly as today. The `defeatedInstance` already carries `cardsUnderneath` from the state entry.
4. **`RETURN_TO_HAND`** reads `cardsUnderneath`, pushes each card to its owner's hand (`ownerId`, no fallback to "the acting player" for a card that has an owner), clears the list, and logs.
5. **Random pick** stays random (RR "random"). See the open decision.

## 4. Proposed UI change (revised after owner feedback 2026-10-05)

No count badge. Facedown cards stack under the side scheme exactly like attachments do, which is closer to the table game.

- `VillainZone.tsx` L403 renders `CardView` plus a threat badge per side scheme. Wrap the scheme card in the same host layout used for attachments and render `CardAttachmentFan` in `staircase` mode (the stacking of Issue #83/#84: each card offset down and left, behind the host, z-index decreasing).
- `CardAttachmentFan` gets one new case: each entry of `cardsUnderneath` is drawn with `CardView isFacedown cardBackType="player"` (the existing player card back, `getCardBackUrl('player')`, with its fallback colour) at the same staircase offsets, after any attachments. Their identity is never rendered face up (hidden information); no hover zoom of the front, no select callback.
- The existing "N Underneath" pill in `CardAttachmentFan` is replaced by the stack for every host (villain, minion, ally, identity), so there is one way to show cards underneath. Cards are drawn facedown with the back that matches their owner: `player` for player cards (Highway Robbery) and `encounter` for encounter cards, chosen by `getCardBackTypeForCard`.
- The scheme's threat badge stays on the host card. A `title` on each facedown card names the owner ("Facedown card from <player>") so two players' cards can be told apart.

## 5. Tests (written first, seen failing)

New file `tests/engine/highway-robbery.test.ts`, real reveal path (`step4_revealEncounterCards`, filler cards on top of `state.encounterDeck` as in `heart-shaped-herb.test.ts`):

1. Two players with hands: after the reveal each hand is one card shorter, and `state.sideSchemes[...]` holds both cards in `cardsUnderneath` with the right `ownerId`. Fails today (cards are on an orphan).
2. A player with an empty hand loses nothing and the other player still places a card.
3. Defeat the side scheme (`defeatSideScheme`): each owner's hand has the original card back, the discard piles contain no stolen card, and `assertCardConservation` passes. Fails today.
4. Defeat via the real thwart path (threat to 0), not only the helper.
5. Cards never go to the wrong owner when player two defeats the scheme.
6. A scheme with facedown cards defeated without a return ability still discards them (the `discardHostAttachmentsAndTuckedCards` contract is unchanged; covered by the existing suite).
7. UI: a `VillainZone` render test: a side scheme with two `cardsUnderneath` renders two `card-view-facedown` elements with the player card back, and no front face or card name leaks into the DOM. A `CardAttachmentFan` test for a host with attachments plus cards underneath (order and count).

Determinism: tests use one-card hands (or assert on the set of cards) so the random pick cannot make them flaky. Each new file is run 15 to 25 times (pitfall table).

## 6. Files

- `src/engine/effects/index.ts` (`ATTACH_FACEDOWN_CARDS_FROM_HAND`, `RETURN_TO_HAND`, `defeatSideScheme` order, host helper)
- `src/ui/components/board/VillainZone.tsx`, `src/ui/components/cards/CardAttachmentFan.tsx`
- `tests/engine/highway-robbery.test.ts` (new), a UI test next to the existing `VillainZone` tests
- Docs: spec in `docs/specifications/supplemental/` for both effects (zone and ordering), ADR addendum on defeat ordering ("When Defeated before host cleanup"), `CHANGELOG.md` `[Unreleased]`, this plan, the two living trackers, the status file and handoff prompt
- No supplemental data change, so no `report:declarations` regeneration (I will run it anyway to confirm no diff)

## 7. Open decision (one question)

**Random source.** The engine has no seeded RNG: every shuffle and random pick uses `Math.random` (about 20 call sites). Options:

- **A (recommended):** keep `Math.random` for this pick, matching the engine, and make the tests independent of it. The defects listed above are the real losses; swapping the RNG is a cross-cutting change.
- **B:** introduce an injectable RNG on `GameState` now and use it here only. This starts a second pattern next to 20 untouched sites.
- **C:** introduce the injectable RNG and migrate every site in this change. Cleanest, but much larger than a P1 fix; it would be its own issue.

## 8. Implementation notes (2026-10-05)

- All 5 new engine tests failed before the fix (cards lost), pass after; run 20 times, stable.
- The old `aspect-and-encounter-promotions` Highway Robbery test called the effects with a scheme instance that was not in state (the bug itself) and asserted `attachments`; it was removed, the new file covers the real paths.
- UI deviation from the plan: the facedown title shows the owner's player id (the fan has no access to player names).
- Gates: see the hand-back message.
