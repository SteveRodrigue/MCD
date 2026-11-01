# Review — Does Klaw need a setup script?

**Status:** For decision (2026-11-01). Written for [the M5 plan](plan_content_m5_scenarios_and_hooks.md), which proposes moving Klaw's and Ultron's setup into Core pack scripts.
**Related:** Gate 2 scenario plug-in work (#275), [ADR-0092](../decisions/0092-content-packs-and-runtime-loading.md), Rules Reference v1.8 (Appendix II step 12 and the main scheme entry).

## 1. Short answer

**Today, yes. But not because Klaw is special.** Klaw's setup is printed on its main scheme cards, and the engine does not resolve a main scheme's Setup or When Revealed abilities from card data at all. The two scenario subclasses hard-code those steps in TypeScript. Klaw could be pure data once the engine resolves main scheme abilities generically (a rules requirement anyway), plus one small primitive. Until then the honest options are a script that keeps today's behavior, or building the generic features first.

## 2. What Klaw does today

`KlawScenarioPlugin.resolveStage1ASetup` (about 50 lines, `src/engine/scenarios/built-in/klaw/plugin.ts`):

1. **Defense Network.** Looks for side scheme `01124` in the encounter deck and removes it; if it is not there, creates it from the catalog. Puts it into `state.sideSchemes` with threat = base threat (2 when missing) x player count. Logs it. **It does not shuffle the deck.**
2. **First minion.** Discards encounter cards one by one until a minion comes up, then puts that minion into the first player's engaged minions. Logs it.

Where it runs, in `DeclarativeScenarioPlugin.onGameSetup`: the villain is created, the main scheme is set **directly to stage 1B**, the encounter deck is built, then `resolveStage1ASetup`, then the villain's When Revealed abilities (these are data: `revealVillainStage` runs the villain card's `WHEN_REVEALED` abilities through the effect engine, which is how Klaw II's search already works).

## 3. What the cards and the rules say

Paraphrased from the card data:

| Card | Text |
| --- | --- |
| `01116a` (stage 1A) | Setup: search the encounter deck for the Defense Network side scheme and reveal it, shuffle the encounter deck, advance to stage 1B. |
| `01116b` (stage 1B) | When Revealed: discard from the encounter deck until a minion is discarded; put that minion into play engaged with the first player. |
| `01117a` (stage 2A) | The same When Revealed (discard until a minion, engage it), then advance to stage 2B. |
| `01117b` (stage 2B) | If this stage is completed, the players lose. |

Rules Reference v1.8:

- **Appendix II step 12:** (a) resolve any Setup abilities on main scheme 1A; (b) flip it to 1B and resolve its When Revealed abilities; (c) resolve the villain's Setup and When Revealed abilities.
- **Main scheme, when the deck advances:** remove the old card; resolve any When Revealed on the **A** side of the new top card; flip it to **B**, place its starting threat, and resolve any When Revealed on that side.

## 4. Why data does not fit today

| # | What a data version needs | Status in the engine | Evidence |
| --- | --- | --- | --- |
| 1 | Resolve main scheme **1A Setup** and **1B When Revealed** from card data at setup (RR step 12a and 12b) | **Missing.** Only the villain's reveal runs abilities. The main scheme is placed on 1B directly and its text is ignored. | `declarative-plugin.ts`, `onGameSetup` |
| 2 | Resolve **A-side and B-side When Revealed** when the main scheme advances (RR main scheme, steps 2 and 3) | **Missing, and a rules gap today.** `onMainSchemeCompleted` swaps the card and logs; nothing runs. So Klaw's stage 2A "discard until a minion" never happens in a real game, scripted or not. | `declarative-plugin.ts`, `onMainSchemeCompleted`; no code path resolves a main scheme `WHEN_REVEALED` |
| 3 | A primitive for "discard from the encounter deck until a minion, put it into play engaged with the first player" | **Missing.** `SEARCH`, `DISCARD` and `PUT_INTO_PLAY` (from set aside, discard, hand or deck, to tableau, engaged or side schemes) exist; none loops until a type is found. | `effect-params.ts` |
| 4 | "Search for Defense Network, reveal it, shuffle" | **Exists.** `SEARCH` with `selectedDestination: REVEAL` and `shuffleAfter` is what Klaw II uses. | `core_encounter.json`, card `01114` |

So the real gaps are 1 to 3. They are generic engine features, not Klaw code.

## 5. How today's script differs from the printed text

If Klaw became data, these would change, so each needs a decision and a test:

- **Shuffle.** The printed Setup shuffles the encounter deck; today's code does not. A data version shuffles, which changes the random numbers drawn and therefore every seeded Klaw game.
- **Missing side scheme.** Today's code creates Defense Network when it is not in the deck; the printed search would simply find nothing. (Only matters if the encounter set is missing.)
- **Starting threat.** Today's code uses base threat x players with a default of 2; going through the normal reveal path for a side scheme may compute it differently. To verify before relying on it.
- **Stage 2A.** A data version would (correctly) resolve the stage 2A reveal; today it does not.

Rhino is unaffected by all of this: its main scheme cards are `noSupplementalNeeded` and it has no setup text.

## 6. Options

| | **A. Script now (unchanged behavior)** | **B. Build the generic features first** | **C. A now, B tracked** |
| --- | --- | --- | --- |
| What | Move Klaw's setup (and Ultron's) into Core pack scripts exactly as is. | Implement 1, 2 and 3 above, write Klaw's setup as data, accept the intended behavior changes (shuffle, 2A reveal). Ultron stays a script (it also needs the facedown Drone concept). | A for M5, plus an issue for B in Gate 2. |
| Behavior change | None. Parity gate: setup digests and `simulate` byte-identical. | Klaw games change on purpose; needs dedicated tests and a decision on section 5. | None now. |
| Size | About half a day inside M5b. | Several days; it touches the setup path every scenario uses. | A, plus writing the issue. |
| Risk to Gate 1 (Rhino) | Low. | Medium: shared setup code, mitigated by Rhino digests and `simulate`. | Low. |
| Leaves | Two scripts that exist only because of 1 to 3. | No Klaw script; one Ultron script. | Same as A until Gate 2. |

## 7. Recommendation

**Option C.** M5 is a refactor with a byte-for-byte parity gate; mixing in new engine features and intended behavior changes would defeat that gate. The generic features are real, rules-required work, so they get their own issue, with the stage 2A gap as the concrete bug that proves it, in the Gate 2 milestone next to #275. When that lands, `klaw.ts` is deleted and Klaw becomes data. This is a deferral of a different piece of work, not of debt in M5's path: M5 itself moves the code out of the engine and leaves the engine with no Klaw knowledge.

If you would rather not carry two scripts that exist only for a missing engine feature, option B is the clean alternative; say so and I will plan it as its own milestone before M5b.

## 8. Decisions needed

1. Option A/C (scripts now) or B (features first)?
2. If A/C: file the "resolve main scheme Setup and When Revealed from data" issue now, in Gate 2 (#275)?
3. For the later data version: accept the shuffle and the stage 2A reveal as intended fixes?

## 9. How either option is verified

- Setup digests for Rhino, Klaw and Ultron (1 and 2 players, Standard and Expert, fixed seed), recorded on current `main` before any change.
- `npm run simulate -- --no-stats` byte-identical to `main` (Gate 1 scope is Rhino).
- For option B, new tests for each primitive and for the stage 2A reveal, with the Klaw digests re-recorded in the same PR and the reason stated.
