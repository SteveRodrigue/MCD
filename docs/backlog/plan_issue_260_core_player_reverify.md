# Plan: #260 Ancestral Knowledge `01042`, `SEARCH` takes N cards (`minimumTake`, `distinctBy`)

> **Status:** DRAFT, awaiting owner approval. The other eight cards of #260 are done and uncommitted (CHANGELOG, `tests/engine/core-player-reverify.test.ts`). Decisions already taken by the owner (2026-10-07): `minimumTake` optional with default 1; `distinctBy: "NAME"`; `isVoluntary` goes away from `SEARCH`; no `fromTop: false` in the data.
> **Baseline:** 2,317 tests green.
> **UI / Card Editor impact:** yes. A multi-select decision prompt (new), the `SEARCH` parameter panel of the Card Editor.

## Printed text and rules

Ancestral Knowledge `01042`: "**Alter-Ego Action**: Choose up to 3 different cards in your discard pile and shuffle them into your deck."

- "Up to 3" = 0 to 3 cards. "Different" = different card names (owner: two copies of "Wakanda Forever!" cannot both be chosen).
- RR v1.8 Search (`npm run rule -- search`): a found card is added; with several candidates the player chooses. So a search that says "add a card" is mandatory when a candidate exists, which is the default `minimumTake: 1`.
- Shuffle: the deck is shuffled after the cards are added (`DECK_SHUFFLE`, already modelled).

## Findings in the engine (evidence)

1. **The `SEARCH` prompt picks exactly one card.** `effects/index.ts` builds one option per candidate (`SEARCH_AND_SELECT_RESOLUTION`) and `action-dispatcher.ts` L3090-3200 resolves `chosenInstanceId` only. `takeCount: 3` only matters for the auto-select test. With more than 3 cards in the discard pile Ancestral Knowledge moves **one** card; with 1 to 3 cards it moves all of them with no choice (`shouldAutoSelect`, L4935). Both are wrong.
2. `isVoluntary` is a hidden default: `effects/index.ts` L4722-4729 makes every Action / Alter-Ego Action search voluntary, anything else mandatory, and the auto-select test reads a different value (`step.effectParams.isVoluntary`) than the prompt (`isVoluntary`). Cards: only Futurist `01029b` sets it (`false`).
3. No multi-select decision prompt exists (`RESOLVE_DECISION_PROMPT` carries one `selectedOptionId`; `DecisionPromptModal` is single-choice). The Mulligan screen is the UI precedent.
4. `tests/engine/ancestral-knowledge-shuffle.test.ts` pins the auto-take of all cards (it encodes the defect).

## Original and proposed data

`01042` original (relevant lines):

```json
"effectParams": {
  "source": ["PLAYER_DISCARD"],
  "target": "SELF",
  "fromTop": false,
  "takeCount": 3,
  "autoSelectIfUnambiguous": true,
  "lookCount": "ALL",
  "selectedDestination": "DECK_SHUFFLE",
  "unselectedDestination": "DISCARD"
}
```

`01042` proposed (removed: `fromTop`, `autoSelectIfUnambiguous` (schema default `true`); added: `minimumTake`, `distinctBy`):

```json
"effectParams": {
  "source": ["PLAYER_DISCARD"],
  "target": "SELF",
  "lookCount": "ALL",
  "takeCount": 3,
  "minimumTake": 0,
  "distinctBy": "NAME",
  "selectedDestination": "DECK_SHUFFLE",
  "unselectedDestination": "DISCARD"
}
```

`unselectedDestination: "DISCARD"` is kept only if the engine needs it for a full search (unselected cards of a full search never move; to be confirmed by the test and removed from the data if it is a no-op).

`01029b` Futurist: delete the line `"isVoluntary": false` (the default 1 gives the same behaviour). Cards `01034`, `01040b`, `01041`, `01095`: data unchanged.

## Engine and schema

- `SearchParams` (`schema.ts`, `effect-params.ts` table): add `minimumTake` (integer >= 0, default 1, must be <= `takeCount`), `distinctBy` (`'NAME'`), remove `isVoluntary` from `SEARCH` (it stays on `PLAYER_CHOICE`).
- Selection rule: the player chooses between `minimumTake` and `takeCount` candidates (distinct by name when `distinctBy` is set); fewer candidates than `minimumTake` means all of them are taken. Auto-select only when the number of eligible candidates is <= `minimumTake` and `autoSelectIfUnambiguous` is not `false` (nothing left to choose). The "Pass / Do not select" option is replaced by Confirm with 0 cards, allowed only when `minimumTake` is 0.
- New multi-select decision prompt: `PendingDecisionPrompt.selection { min, max, distinctBy? }`; `RESOLVE_DECISION_PROMPT` accepts `selectedOptionIds`; validation (count in range, distinct names, ids belong to the prompt) in `prompt-queue.ts`; the resolver in `action-dispatcher.ts` routes all chosen cards to `selectedDestination`, the rest to `unselectedDestination`, shuffles once. Single-pick searches (`takeCount` 1) keep their current one-click flow (`max` = 1), so no regression.
- Behaviour change to confirm (decision 1): Stark Tower `01034` is an Alter-Ego Action, so it is voluntary today through the hidden default; with the default `minimumTake: 1` its pass option disappears. The text is "returns the topmost Tech upgrade", no choice, auto-select already applies, so in practice no change.
- `fromTop` stays in the engine (Stark Tower uses `fromTop: true`); only the redundant `false` leaves `01042`.

## UI and Card Editor

- `DecisionPromptModal`: multi-select mode (card tiles as in the Mulligan screen, selected state, counter "n of max", Confirm enabled when `min <= n <= max`, tiles of a name already picked are disabled when `distinctBy` is set). Pop-art style kept.
- Card Editor (`effect-parameter-registry.ts`): `SEARCH` gets `minimumTake` (number) and `distinctBy` (select), loses `isVoluntary`; description of `autoSelectIfUnambiguous` updated.
- Spec `06_effects_zones_cards.md` (parameter table: `takeCount` = maximum, new keys, removed key, defaults), `10_sequences_and_prompts.md` (multi-select prompt), ADR addendum (SEARCH selection model), CHANGELOG, status file, `npm run schema:generate`, `npm run report:declarations`.

## Tests (written first, watched failing)

1. Engine, `ancestral-knowledge-shuffle.test.ts` rewritten: 2 cards in the discard pile open a prompt (no auto-take); choosing 1 shuffles only that card; choosing 0 moves nothing; choosing 4 or an unknown id is rejected.
2. 5 cards in the discard pile: exactly the chosen 3 move (today only 1).
3. Two copies of "Wakanda Forever!" (same name) cannot both be chosen; choosing both is rejected; the second tile is disabled in the modal.
4. `minimumTake` default: Futurist / Shuri / Foresight / Rhino behave as before (data tests + one behaviour test each for the mandatory pick; Shuri with one upgrade in deck is auto-taken).
5. Schema member guard (`schema-member-coverage`), `effect-params-keys` guard, Card Editor tests for the two new params and the removed one.
6. UI: multi-select modal (counter, Confirm bounds, distinct disabling).

## Files

`src/data/supplemental/schema.ts`, `schema.json`, `effect-params.ts`, `pack/core.json` (`01042`, `01029b`; confidence of `01042` to 95 once green), `src/engine/effects/index.ts`, `src/engine/pipeline/action-dispatcher.ts`, `prompt-queue.ts`, `models/state.ts`, `models/actions.ts`, `src/ui/components/board/DecisionPromptModal.tsx`, `src/ui/components/editor/effect-parameter-registry.ts`, specs 06 and 10, ADR addendum, tests above. No `audit.comment` is touched.

## Open decisions

1. Stark Tower `01034` loses its (accidental) pass option: acceptable? (no visible change today, see above).
2. Scope: one commit for the whole change, or engine / schema first and the multi-select modal in a second commit? Recommendation: one commit, because the data cannot be correct without the modal.
