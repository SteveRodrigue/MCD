# Core encounter cards: read-through of the data against the printed text

Item 14 of the status file, run 2026-10-09. All 108 cards of `data/upstream/pack/core_encounter.json` were read against `src/data/supplemental/pack/core_encounter.json`, the glossary and the engine code where the meaning was unclear. Trimmed 2026-10-21: the reports of sets with no open item were deleted (they are in git history); the six sets below still have unmodelled cards.

## Totals (as of the 2026-10-09 run)

| Verdict                                                                             | Cards |
| :---------------------------------------------------------------------------------- | ----: |
| OK (modelled, or intrinsic keyword / icon / no text)                                |    48 |
| DEFECT (wrong or invented step)                                                     |     6 |
| GAP (rules text, no entry, [#265](https://github.com/SteveRodrigue/MCD/issues/265)) |    54 |
| Documentation defect                                                                |     1 |

## Resolved since the run

- All 6 defects are fixed: Charge [#294](https://github.com/SteveRodrigue/MCD/issues/294), Stampede [#295](https://github.com/SteveRodrigue/MCD/issues/295), Explosion [#296](https://github.com/SteveRodrigue/MCD/issues/296) and Killmonger [#297](https://github.com/SteveRodrigue/MCD/issues/297) are closed; the invented abilities on Sandman `01102` and Whiplash `01172` were removed.
- The `IF_RESULT` documentation defect in `docs/specifications/supplemental/10_sequences_and_prompts.md` is fixed.

## Still open

- 54 GAP cards in the six sets below: [#265](https://github.com/SteveRodrigue/MCD/issues/265) (53 cards) and `01185` Biomechanical Upgrades (#262). Delete a set's report in the commit that models the set.
- Hygiene: `01156` and `01167` have no `audit.confidence`; `01156` prints no rules text upstream (compare with the physical card). Tracked in [#348](https://github.com/SteveRodrigue/MCD/issues/348).
- The Ultron set (22 cards) cannot be entered until a facedown Drone minion primitive exists.

## Reports

[klaw](klaw.md), [masters_of_evil](masters_of_evil.md), [ultron](ultron.md), [under_attack](under_attack.md), [legions_of_hydra](legions_of_hydra.md), [the_doomsday_chair](the_doomsday_chair.md)
