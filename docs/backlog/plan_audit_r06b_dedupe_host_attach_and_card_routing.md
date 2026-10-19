# Plan: Merge duplicated host attachment and card routing (R6 follow-up, review findings 2 and 3)

Status: **implemented, uncommitted**. Decisions 1-4 taken as recommended; issue #332. The router lives in `src/engine/effects/card-routing.ts` (not `state/`) because it executes effects.

## Problem

Two blocks of copy-pasted code moved into new files during R6 without being merged.

1. **Host attachment** (`src/engine/pipeline/actions/play.ts`, `resolveChosenHostAttachment`, about 330 lines). Minion, ally and enemy each repeat: collect candidates, prompt when more than one, attach and log when exactly one, attach with no target when none, and attach and log when `targetInstanceId` is given. Only the candidate list, prompt text and `maxPerHost` handling differ.
2. **Card routing** (`src/engine/effects/handlers/cards.ts` `routeSearchedCards`, and `src/engine/pipeline/actions/shared.ts` `routeCardInstances`). Both switch over the same destinations (LEAVE_IN_PLACE, REVEAL, HAND, TABLEAU with side schemes, DISCARD, DECK_TOP, DECK_BOTTOM, DECK_SHUFFLE, ATTACH_TO_TARGET). `routeSearchedCards` decides the origin zone per card and takes 8 parameters.

## Rules / spec analysis

No gameplay rule changes intended. Rules touched: attachments and `maxPerHost` limits (RR v1.8 attachment rules, card text "limit 1 per character"), and search/scry routing (RR v1.8 p. 19, 26). Run `npm run rule -- attachment` while implementing to confirm the host rules.

## Behavior differences found (must be decided, not silently merged)

| #   | Area                                              | Current behavior                                                                                                                                                       | Risk                                                                                                                                                                     |
| --- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| a   | Host attach, `maxPerHost`                         | Enemy checks it on villains and minions, ally checks it on allies, **minion never checks it**                                                                          | Likely an omission. Only 2 cards use `maxPerHost` today: Webbed Up (CHOSEN_ENEMY) and Inspired (CHOSEN_ALLY). Neither targets minions alone, so no card is affected now. |
| b   | Host attach, prompt text                          | Minion and ally descriptions use the bare card name; enemy uses the name with the controller                                                                           | Cosmetic.                                                                                                                                                                |
| c   | Routing, encounter detection                      | `routeSearchedCards` treats `card.faction === 'encounter'` as encounter; `routeCardInstances` looks only at the source zone                                            | A merged router must pick one rule.                                                                                                                                      |
| d   | Routing, DECK_TOP / DECK_BOTTOM / DECK_SHUFFLE    | Search uses `origin.startsWith('ENCOUNTER')`; `routeCardInstances` uses `=== 'ENCOUNTER_DECK'`, so a card from ENCOUNTER_DISCARD goes to the **player** deck           | Probable bug in `routeCardInstances`.                                                                                                                                    |
| e   | Routing, ATTACH_TO_TARGET                         | Search attaches to `context.chosenTargetInstanceId \|\| targetPlayerId \|\| player.id` with the step's target; `routeCardInstances` uses `player.id` and a passed host | Needs one signature.                                                                                                                                                     |
| f   | Host attach, no candidates, no `targetInstanceId` | Attaches with an undefined target and logs a blank name                                                                                                                | Existing behavior; keep it in this refactor.                                                                                                                             |

## Simplification & Refactor Check

- **Deleted:** the three host branches (about 330 lines) and `routeSearchedCards` (about 130 lines).
- **Merged:** host attachment into one function driven by a small per-kind table; both routers into the single `routeCardInstances`.
- **Parameterized:** `routeCardInstances` takes `sourceZone: string | ((card: CardInstance) => string)` and an optional `attach: { host: string; targetId: string }`. Existing callers keep passing a string.
- **Moved:** the router to `src/engine/state/card-routing.ts`, so `effects/handlers/cards.ts` does not import from `pipeline/actions`. `actions/shared.ts` keeps only the other two helpers.
- **No new parallel path, no alias, no shim.** Callers are updated in the same change.

## Subtasks

Each subtask ends with a green `rtk npx tsc --noEmit` and the named test run. Order matters.

**Task A: Host attachment**

1. **A1: Characterization tests first** (`tests/engine/host-attachment.test.ts`, new). Against the current code, per kind (minion, ally, enemy): explicit `targetInstanceId`; zero, one and many candidates; `maxPerHost` filtering for ally and enemy; log key and params; prompt id prefix, title, option flags and onomatopoeia. Also assert the minion branch ignores `maxPerHost` so decision a is visible. All must pass before any refactor.
2. **A2: Per-kind table.** In `play.ts`, one `HOST_KINDS` map (aliases, candidate collector, prompt id prefix, title, noun, option flag, onomatopoeia, fallback name). Candidates become `{ id, name, cardName }`.
3. **A3: One `attachToChosenHost` body.** Explicit target resolves a display name and attaches; otherwise 0 / 1 / many as today. Replace the three branches and the generic fallback.
4. **A4: One log helper** for the repeated `card.attached.to_host` `appendLog` (it appears 12 times).
5. **A5: Apply decision a and b**, update A1 expectations accordingly, run `rtk npx vitest related src/engine/pipeline/actions/play.ts --run`.

**Task B: Card routing**

6. **B1: Characterization tests** (`tests/engine/card-routing.test.ts`, new, plus keep `search-destination-routing`, `search-multi-zone`, `search-and-select-routing`). Cover every destination for player zones, encounter zones and a mixed-origin search, plus side-scheme TABLEAU and `DECK_SHUFFLE` with both decks. Record decisions c, d and e as explicit cases.
7. **B2: Move and extend `routeCardInstances`** to `src/engine/state/card-routing.ts` with the per-card origin and `attach` parameters. Use one `isEncounterZone(zone)` predicate (decision c, d).
8. **B3: Switch `cards.ts`.** Group nothing; pass `(card) => cardOriginMap.get(card.instanceId) ?? sourceZones[0]`. Delete `routeSearchedCards` and its 8-argument calls.
9. **B4: Switch `prompts.ts`** to import from the new module; trim `actions/shared.ts`.
10. **B5: Run** `rtk npx vitest related src/engine/effects/handlers/cards.ts src/engine/pipeline/actions/prompts.ts --run`.

**Task C: Close out**

11. **C1:** Correct the R6 changelog fragment and ADR-0086 wording about merged host blocks; add a fragment for this work.
12. **C2:** `rtk npx eslint src tests --max-warnings 0`, `rtk npx tsc --noEmit`, then the full suite on push.

## File changes

- `[ADD]` `src/engine/state/card-routing.ts`
- `[MODIFY]` `src/engine/pipeline/actions/play.ts`, `prompts.ts`, `shared.ts`, `src/engine/effects/handlers/cards.ts`
- `[ADD]` `tests/engine/host-attachment.test.ts`, `tests/engine/card-routing.test.ts`
- `[MODIFY]` `changes/unreleased/2026-10-19-r06-action-handler-registry.md`, `docs/decisions/0086-action-handler-registry.md`
- `[ADD]` `changes/unreleased/` fragment

## UI / Card Editor impact

None. The prompt option flags `isAttachmentMinionChoice`, `isAttachmentAllyChoice` and `isAttachmentEnemyChoice` stay as they are; `prompts.ts:1060-1066` and `tests/engine/prompt-cancellation.test.ts` read them. Prompt text for minion and ally changes only if decision b is taken.

## Risks

- Hidden reliance on the divergent behavior in a card test. Mitigation: characterization tests first, then the full suite on push.
- The unified encounter rule (decision c, d) changes where a card lands in rare mixed-zone searches. Mitigation: explicit B1 cases and a changelog note.

## Estimate

About 4 hours: A about 2 hours, B about 1.5 hours, C about 30 minutes.

## Open decisions

1. **Minion `maxPerHost` (a):** apply it uniformly (recommended, no current card is affected) or preserve "minions ignore it"?
2. **Prompt description wording (b):** use the label with the controller everywhere (recommended) or keep the current mix?
3. **Encounter detection (c, d):** use the origin zone with `startsWith('ENCOUNTER')` for all three deck destinations, plus the `faction === 'encounter'` check (recommended, matches search today) or zone only?
4. **Tracking:** file a GitHub issue for this work (recommended), or fold it under #127?
