# Plan: #218, implement the Surge keyword

> **Status:** implemented 2026-10-05 (approved with decision 8 = (a), remove the dead composites; committed `9a0830d`). Tier 2 (new reveal-path behaviour, one shared helper, importer fix for one keyword). Engine prerequisite for the Rhino slice: the six cards that print Surge never reveal the extra card today.
> **UI / Card Editor impact:** none (no schema change).

## 1. Rule (`npm run rule -- surge`)

> When an encounter card with this keyword is revealed, the player resolving the card deals themself a facedown encounter card from the top of the encounter deck. Surge is equivalent to the triggered ability *When Revealed: Deal yourself 1 facedown encounter card*. Complete resolving the original card, as well as any response abilities triggered by that card being revealed, before revealing the additional card.

Printed Surge in the core encounter set: `01121` Weapons Runner (minion), `01158` Heart-Shaped Herb, `01178` Kree Manipulator, `01185` Biomechanical Upgrades (attachment), `01191` Exhaustion, `01193` Under Fire. Cards that only say "this card **gains** surge" (conditional, the `SURGE` effect) do not print the keyword.

## 2. Findings that shape the design

1. **The importer's Surge tag is wrong, so reading it would be harmful.** `parseKeywords` (`card-loader.ts` L145) tags Surge when the text contains `surge.`, which also matches "this card gains surge." In the core encounter set that tags **17 cards that do not print it** (`01104`, `01105`, `01106`, `01111`, `01112`, `01124`, `01146`, `01163`, `01164`, `01165`, `01168`, `01175`, `01179`, `01187`, `01188`, `01189`, `01190`) next to the 6 that do. Implementing the keyword on top of that tag would make all 17 surge unconditionally (Stampede `01106` would surge in alter-ego form and also in hero form). The fix for Surge is part of this plan; the same defect on the other 15 keywords (hundreds of phantom tags across all packs) is filed as [#243](https://github.com/SteveRodrigue/MCD/issues/243) with the audit data.
2. **Printed formats vary** (`Surge.`, `Surge <i>(...)</i>` without a period on `01158`, `Surge .` on `27152`, bare `Surge` on `07009`), so detection must be "a whole sentence of a text line is the keyword", not a substring.
3. **Nine hand-rolled surge sites exist**, with different mechanics: the generic `SURGE` effect (`effects/index.ts` ~L4399) and `DISCARD` `fallback: "SURGE"` (~L1277) draw through `drawEncounterCard` (reshuffle and acceleration handled); four legacy card-named composites (`HEAL_DAMAGE_WITH_SURGE`, `ADD_STATUS_WITH_SURGE`, `REVEAL_ENCOUNTER_CARD_WITH_SURGE`, `DISCARD_UPGRADE_OR_SUPPORT_OR_SURGE`) use a raw `encounterDeck.shift()` that skips the reshuffle, and no pack uses them (`rg` over the three packs: 0 hits; they violate ADR-0021 and exist only in the engine, the schema enum and one schema test).
4. **Where the keyword fires.** Both the synchronous reveal loop (`step4_revealEncounterCards`) and the prompt-resumption path call `resolveActiveEncounterCardAfterInterrupt` once a card has finished resolving, so the end of that function is the single place that covers every card type (minion, side scheme, attachment, treachery, obligation) and the stepping flow. The extra card is only *dealt* facedown there and is revealed later by the reveal loop, so "complete the original card (and its pending choices) before revealing the additional card" holds even when the card opens a prompt.
5. **Cancelled When Revealed.** Surge is defined as equivalent to a When Revealed ability, so when the card's When Revealed effects are cancelled (Enhanced Spider-Sense `01004`, Get Behind Me! `01078`) the surge does not happen either. Implemented via the existing `isCancelled` flag; a test pins it.
6. **No double surge.** A card that prints Surge and also "gains surge" by effect must surge once. `EncounterExecutionContext` gets a `surged` flag, set by the shared helper, checked by the keyword path.

## 3. Design

- **Importer:** a small `hasPrintedKeyword(text, keyword)` helper (strip `<i>...</i>` reminder text and `<b>` tags, split each line into sentences, a sentence equal to the keyword with an optional number counts). Used for **Surge only** in this change; #243 migrates the other keywords. Corpus test: the six printed cards are tagged, the 17 false positives are not, and the formats in finding 2 are covered.
- **Shared helper** `dealSurgeCard(state, player)` in a new `pipeline/surge.ts`: draws with `drawEncounterCard` (reshuffle and acceleration rules), appends to the player's `dealtEncounterCards`, sets `activeEncounterContext.surged`, logs `encounter.surge.triggered`. Used by the keyword path, the `SURGE` effect and `DISCARD` `fallback: "SURGE"`.
- **Keyword path:** at the end of `resolveActiveEncounterCardAfterInterrupt`, before the context is cleared: `if (!isCancelled && hasKeyword(card, Keyword.SURGE) && !context.surged) dealSurgeCard(...)`.
- **Dead composites:** see decision in section 8.

## 4. Cards (protocol: printed text, original data, proposed data, why)

**Correction after reading the data (2026-10-05):** the statement "no data change needed for the six cards" was wrong. `01178` and `01191` are fine. `01193` Under Fire carried an explicit `SURGE` step duplicating the keyword: removed. The other three have missing or wrong data, independent of the keyword: `01158` (active placeholder `HEAL_DAMAGE 2`), `01185` and `01121` (no entry): filed as [#244](https://github.com/SteveRodrigue/MCD/issues/244). `docs/ambiguities/core_encounter_surge-keyword.md` is deleted; the audit stamps of `01191` are bumped (`reviewedAt`). `01179` and `01169` stay blocked on #219 and #220 (they only *gain* surge).

## 5. Tests (TDD, each written first and seen failing)

New `tests/engine/surge-keyword.test.ts` through the real reveal path (`step4_revealEncounterCards`), encounter deck stacked so the extra card is identifiable:

1. Each of the six printed cards reveals exactly one extra card, which is dealt after the original is fully resolved (check order via the log and the dealt queue).
2. A card without Surge (`01110` Hydra Bomber) deals none; a "gains surge" card (`01106` Stampede in hero form: no surge, in alter-ego form: one surge) surges exactly once (guards the importer fix and the no-double-surge rule).
3. A card that prints Surge **and** whose ability also runs the `SURGE` effect surges once (synthetic card).
4. Surge with a pending prompt: Kree Manipulator (a prompt-free card) and a prompting card (Hydra Bomber with a synthetic Surge keyword) reveal the extra card only after the choice resolves.
5. Cancelled When Revealed (Get Behind Me! on a Surge card): no surge.
6. Empty encounter deck: the extra card comes from the reshuffled discard and acceleration increases (the `drawEncounterCard` rules), not a silent miss.
7. Importer: `hasPrintedKeyword` formats and the corpus assertion (6 true, 17 false-positive cards untagged).
8. Existing tests that referenced the old tags (`rg Keyword.SURGE tests`, `treacheries-activations`, `villain-phase`) keep passing or are updated only where they asserted a phantom tag; any such change is reported.

## 6. Files

`src/data/importer/card-loader.ts` (helper plus Surge), new `src/engine/pipeline/surge.ts`, `src/engine/pipeline/villain-phase.ts`, `src/engine/models/state.ts` (`surged` flag), `src/engine/effects/index.ts` (`SURGE` and fallback use the helper; composites per decision), `src/data/supplemental/pack/core_encounter.json` (`01191` audit stamp), `docs/ambiguities/core_encounter_surge-keyword.md` (deleted), spec 08 or the keyword docs (Surge semantics, one line each in the importer and the reveal path), `CHANGELOG.md`, trackers, `npm run report:declarations`.

## 7. Out of scope (tracked)

[#243](https://github.com/SteveRodrigue/MCD/issues/243) (substring keyword detection for the other 15 keywords); multi-villain encounter decks ([#210](https://github.com/SteveRodrigue/MCD/issues/210), the extra card may come from any encounter deck with several villains); the exact moment the extra card is revealed when a player was dealt several cards (heroic mode): it is appended to that player's facedown cards like the existing `SURGE` effect.

## 7b. Implementation notes (2026-10-05)

- Decision taken by the user: (a), the four dead composites are removed (engine cases, `EffectTypeSchema`, `schema.json`, the effect union type, three editor registry entries; `DISCARD_UPGRADE_OR_SUPPORT_OR_SURGE` only existed in the type union and one rejection test).
- A prompt-opening Surge card deals the extra card immediately (facedown) and the reveal loop reveals it when the villain phase resumes its reveal step; the test drives that resume explicitly.
- Existing test updated, not weakened: `treacheries-activations` Under Fire asserted the old double modelling (+2 dealt cards from the ability alone); it now asserts +1 and points at the surge tests.
- 53 more core encounter cards (Klaw, Ultron, Masters of Evil, Hydra, Doomsday Chair) have rules text and no supplemental entry: recorded in #244 and the status doc, out of Gate 1 scope.

## 8. Open decision (resolved)

**The four dead card-named surge composites** (`HEAL_DAMAGE_WITH_SURGE`, `ADD_STATUS_WITH_SURGE`, `REVEAL_ENCOUNTER_CARD_WITH_SURGE`, `DISCARD_UPGRADE_OR_SUPPORT_OR_SURGE`): unused by every pack, banned by ADR-0021, and two of them bypass the deck reshuffle with a raw `encounterDeck.shift()`. (a) Remove them in this change (engine cases, schema enum, regenerated `schema.json`, the one schema test that names them, spec mentions, editor registry if listed): recommended, it leaves a single surge path and no hidden duplicates. (b) Leave them and file an issue. I recommend (a); the cost is a slightly larger diff in `schema.ts` and its tests.
