# Read-through: Captain Marvel nemesis (`01176` to `01179`)

Item 14 of the status file. Verdicts: **OK**, **DEFECT**, **GAP** ([#265](https://github.com/SteveRodrigue/MCD/issues/265)). Date 2026-10-09; no data was edited.

| Code    | Card                 | Verdict | Evidence                                                                                                           |
| :------ | :------------------- | :------ | :----------------------------------------------------------------------------------------------------------------- |
| `01176` | The Psyche-Magnitron | OK      | `ADD_THREAT` 1 per hero on the scheme; hazard icon is a card field.                                                |
| `01177` | Yon-Rogg             | OK      | Forced Response on `MINION_ATTACKED` (minion completed an attack, spec `02`): 1 threat on card `01176`.            |
| `01178` | Kree Manipulator     | OK      | Surge keyword; 1 threat on the main scheme; Boost gated `IF_UNDEFENDED_ATTACK` (villain) for 1 threat (`b2ab514`). |
| `01179` | Yon-Rogg's Treason   | OK      | `DISCARD` every energy card from hand (`resourceIcons`), surge on `amountZero` (#219). Confidence 95.              |

## Findings

None.
