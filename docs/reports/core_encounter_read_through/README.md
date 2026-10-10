# Core encounter cards: read-through of the data against the printed text

Item 14 of the status file, run 2026-10-09. One report per encounter set (20 files). All 108 cards of `data/upstream/pack/core_encounter.json` were read against `src/data/supplemental/pack/core_encounter.json`, the glossary and the engine code where the meaning was in doubt. No data, code or test was changed.

## Totals

| Verdict                                                                             | Cards |
| :---------------------------------------------------------------------------------- | ----: |
| OK (modelled, or intrinsic keyword / icon / no text)                                |    48 |
| DEFECT (wrong or invented step)                                                     |     6 |
| GAP (rules text, no entry, [#265](https://github.com/SteveRodrigue/MCD/issues/265)) |    54 |
| Documentation defect                                                                |     1 |

## Defects (each needs your approval before any data change)

| Card                                                                         | Set                                               | Problem                                                                                   | Needs                                                        |
| :--------------------------------------------------------------------------- | :------------------------------------------------ | :---------------------------------------------------------------------------------------- | :----------------------------------------------------------- |
| `01099` Charge ([#294](https://github.com/SteveRodrigue/MCD/issues/294))     | [rhino](rhino.md)                                 | Overkill and +3 ATK are permanent; printed text discards Charge at the end of the attack. | End-of-attack discard of a card that modified the attack.    |
| `01102` Sandman                                                              | [rhino](rhino.md)                                 | Invented Forced Response (discard 2 encounter cards); printed text is Toughness only.     | Data only: remove the ability.                               |
| `01106` Stampede ([#295](https://github.com/SteveRodrigue/MCD/issues/295))   | [rhino](rhino.md)                                 | Missing "if a character is damaged by this attack, that character is stunned".            | "This attack damaged a character" fact (also `01118`).       |
| `01111` Explosion ([#296](https://github.com/SteveRodrigue/MCD/issues/296))  | [bomb_scare](bomb_scare.md)                       | X damage dealt to each hero and ally instead of X assigned among them.                    | "Assign X damage among" primitive.                           |
| `01157` Killmonger ([#297](https://github.com/SteveRodrigue/MCD/issues/297)) | [black_panther_nemesis](black_panther_nemesis.md) | Invented tough status on reveal; printed damage immunity missing.                         | Damage-source immunity primitive; strip and block meanwhile. |
| `01172` Whiplash                                                             | [iron_man_nemesis](iron_man_nemesis.md)           | Invented tough status on reveal; printed text is Retaliate 1 only.                        | Data only: remove the ability.                               |

`01102` Sandman and `01172` Whiplash are data-only fixes (remove the invented ability) and need your approval, no issue.

Documentation defect: `docs/specifications/supplemental/10_sequences_and_prompts.md` (gate `IF_RESULT`) documents `gateParams: { fact }` with lowercase facts (`"amountZero"`); the schema and every card use `result` with upper-case values (`AMOUNT_ZERO`, `src/data/supplemental/gate-params.ts`).

Hygiene: `01156`, `01157` and `01167` have no `audit.confidence`; `01156` prints no rules text upstream (compare with the physical card).

## Cross-set observations

- The Ultron set (22 cards) cannot be entered until a facedown Drone minion primitive exists.
- Two invented abilities share one shape ("Forced Response on `WHEN_REVEALED` gives self a tough status card"): `01157` and `01172`. Worth a grep over other packs for the same pattern when Phase 6 starts.

## Reports

[rhino](rhino.md), [bomb_scare](bomb_scare.md), [klaw](klaw.md), [masters_of_evil](masters_of_evil.md), [ultron](ultron.md), [under_attack](under_attack.md), [black_panther](black_panther.md), [black_panther_nemesis](black_panther_nemesis.md), [she_hulk](she_hulk.md), [she_hulk_nemesis](she_hulk_nemesis.md), [spider_man](spider_man.md), [spider_man_nemesis](spider_man_nemesis.md), [iron_man](iron_man.md), [iron_man_nemesis](iron_man_nemesis.md), [captain_marvel](captain_marvel.md), [captain_marvel_nemesis](captain_marvel_nemesis.md), [legions_of_hydra](legions_of_hydra.md), [the_doomsday_chair](the_doomsday_chair.md), [standard](standard.md), [expert](expert.md).
