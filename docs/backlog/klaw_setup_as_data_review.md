# Review — Can Klaw's setup be data?

**Status:** Conclusion reached (2026-11-01). **Yes, Klaw's setup can be data.** This replaces an earlier version of this document that concluded Klaw needed a script; that version was wrong (see section 6).
**Used by:** [the M5 plan](plan_content_m5_scenarios_and_hooks.md).
**Related:** [ADR-0092](../decisions/0092-content-packs-and-runtime-loading.md), Rules Reference v1.8 (Appendix II step 12 and the main scheme entry), Gate 2 scenario plug-in work (#275).

## 1. Short answer

Klaw's setup is printed text on its main scheme cards, and **every effect in it already exists as data**. The only thing missing is that the engine never *runs* a main scheme's Setup and When Revealed abilities (Appendix II step 12 and the main scheme advance rules). That is one generic engine feature, and it serves **62 main schemes in 17 packs**, not just Klaw. Once it exists, Klaw needs no script.

## 2. What Klaw does today

`KlawScenarioPlugin.resolveStage1ASetup` (`src/engine/scenarios/built-in/klaw/plugin.ts`, about 50 lines):

1. Finds side scheme `01124` (Defense Network) in the encounter deck, or (a bug) creates it from the catalog if it is not there, and puts it into `state.sideSchemes` with threat = base threat x players. **It does not shuffle the deck.**
2. Discards encounter cards until a minion comes up and engages it with the first player.

It runs from `DeclarativeScenarioPlugin.onGameSetup`, which sets the main scheme **directly to stage 1B** and ignores its text. A villain's When Revealed is data (`revealVillainStage` runs the card's abilities through the effect engine); a main scheme's is not.

## 3. What the cards and the rules say

| Card | Text (paraphrased) | Existing data primitive |
| --- | --- | --- |
| `01116a` (1A) | Setup: search the encounter deck for the Defense Network side scheme and reveal it, shuffle, advance to 1B. | `SEARCH` with `source: ENCOUNTER_DECK`, `selectedDestination: REVEAL`, `shuffleAfter: true`. Klaw II (`01114`) already does this for the "Immortal" Klaw side scheme. |
| `01116b` (1B) | When Revealed: discard from the encounter deck until a minion is discarded; put it into play engaged with the first player. | `DISCARD` with `mode: UNTIL_MATCH`, `untilFilter: { types: ["minion"] }`, `matchingDestination: PLAY`, `target: FIRST_PLAYER`. Core card `01128` (The Masters of Evil) uses this exact shape. |
| `01117a` (2A) | The same When Revealed, then advance to 2B. | Same `DISCARD` step. |
| `01117b` (2B) | If completed, the players lose. | Already handled by the plugin. |

Rules Reference v1.8: **Appendix II step 12** (a) resolve Setup abilities on main scheme 1A, (b) flip to 1B and resolve its When Revealed, (c) resolve the villain's Setup and When Revealed. **Main scheme, when the deck advances:** resolve When Revealed on the A side of the new top card, flip to B, place starting threat, resolve When Revealed on the B side.

## 4. Evidence that this is not a one-of

Counted over all 4,379 upstream cards (`content/packs/*/cards`):

| Pattern | Cards | Packs |
| --- | --- | --- |
| "Discard from the encounter deck until a minion is discarded" | 15 | core, cw, hercules, mts, mut_gen, ncrawler, synthezoid, toafk, trors, x23 |
| "Discard ... until a [type] is discarded" (any type) | 19 | ant, aoa, core, cw, magneto, mut_gen, and others |
| Main scheme A side with a `Setup:` line | 62 | 17 packs (aoa, aos, core, cw, gmw, gob, hood, mojo, mts, mut_gen, ...) |
| Search the encounter deck for a side scheme and reveal or put it into play | 14 | core, gmw, mts, mut_gen, ncrawler, sm, trors, tt, wonder_man |

Many of those Setup lines are as simple as Klaw's, for example "Put the Criminal Enterprise environment into play. Shuffle the encounter deck. Advance to stage 1B." (`02004a`) and "Put a Goblin Thrall minion into play engaged with each player..." (`02017a`). For comparison, Wakanda Forever exists in only two packs (the core Black Panther hero set and one other), and its handler resolves other cards' Special abilities with its own ordering prompt, which is why it is a pack script and Klaw is not.

## 5. What has to be built, and what changes on purpose

**One generic engine feature:** resolve a main scheme's abilities from card data at the two points the rules name.

1. At setup (step 12a and 12b): run the `SETUP` abilities of main scheme side A, then place stage B and run its `WHEN_REVEALED` abilities, through the same effect engine `revealVillainStage` uses.
2. When the main scheme advances: run the A-side `WHEN_REVEALED`, flip, place threat, run the B-side `WHEN_REVEALED`.

Then Klaw's three cards get supplemental abilities (data) and `KlawScenarioPlugin` is deleted. Rhino is unaffected (its main scheme cards are `noSupplementalNeeded`; its Setup is "advance to 1B").

**Behavior changes, all rules corrections and all intentional:**

- **Shuffle.** The printed Setup shuffles the encounter deck; today's code does not. Seeded Klaw games change.
- **Stage 2A.** Today the 2A "discard until a minion" never happens in a game (nothing runs it on advance); the data version resolves it.
- **Defense Network can never be missing; creating it was a bug.** It belongs to the Klaw set, so it is always among the cards; if the search does not find it (dealt as a facedown boost or encounter card, say) the search finds nothing, which the engine already handles. A card cannot be created out of thin air, so the fallback is deleted, not preserved.
- **Starting threat** for Defense Network will come from the normal reveal path rather than base threat x players; to be checked against the card when implemented.

Ultron's 1A (put the Ultron Drones environment into play) is also data once the engine supports environments (see the M5 plan). Only its 1B, which puts a facedown Drone minion into play, stays a script for now: facedown minions are a concept shared by Ultron's villain stages and other packs (Gate 2, #275).

## 6. What was wrong with the first version of this review

- It said **no primitive loops until a type is found**. `DISCARD` `UNTIL_MATCH` exists, and `01128` already uses it for exactly Klaw's step.
- It treated "Klaw needs a script" as the cost of missing primitives, when the only missing piece is the generic main scheme ability resolution.
- It recommended scripting Klaw to keep M5 a pure refactor. The rules fix is small, generic and needed by 62 cards, so it belongs in M5.

## 7. Verification

- Characterization digests of Rhino, Klaw and Ultron setup (1 and 2 players, Standard and Expert, fixed seed) recorded on `main` before the change. Rhino and Ultron digests must stay identical; Klaw digests are re-recorded in the same PR with the three reasons above.
- `npm run simulate -- --no-stats` byte-identical to `main` (the Gauntlet is Rhino only).
- New tests: main scheme Setup and When Revealed at setup and on advance (including stage 2A), `UNTIL_MATCH` for a minion engaging the first player, the Defense Network search with shuffle.
