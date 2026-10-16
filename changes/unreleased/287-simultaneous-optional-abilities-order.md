---
type: Added
---

- **Feature (Engine & UI): Simultaneous Optional Abilities Resolution Order ([Issue #287](https://github.com/SteveRodrigue/MCD/issues/287))**
  - Detects when two or more optional ability prompts trigger simultaneously on the same event and constructs an `ORDER_SIMULTANEOUS_ABILITIES` prompt for the First Player per RR v1.8 Simultaneous Resolution.
  - Adds `SimultaneousAbilitiesModal` comic pop-art UI dialog allowing the first player to reorder abilities upfront using Up/Down buttons or drag-and-drop.
  - Re-inserts candidates into the prompt queue according to the chosen `sequenceOrder` on `RESOLVE_DECISION_PROMPT`.
  - Deprecates and removes redundant `TREACHERY_REVEALED` trigger primitive in favor of unified `ENCOUNTER_CARD_REVEALED` filtered by `triggerFilter.cardFilter` (`UniversalCardFilter`).
  - Adds `cardFilter` accordion subform to Card Editor `TriggerFilterSection` with `UniversalCardFilterBuilder` for visual card criteria authoring.

