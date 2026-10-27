---
type: Fixed
---

- **Fix (Engine): A choice between options is offered only when one option can affect something ([Issue #457](https://github.com/SteveRodrigue/MCD/issues/457))**
  - The legality gate (`checkAbilityTargets`, ADR-0090) now reads `PLAYER_CHOICE` options: the choice is valid when any option has a valid target (RR v1.8 "Target"), and a choice prompt disables an option that cannot affect anything while another can. When none can, every option stays open.
  - A step with a `fallback` never blocks an ability, and selectors filled in at run time (`PREVIOUS_TARGET`, `HOST`, `DAMAGED_CHARACTER`) are classified `DEPENDENT` and never judged up front.
  - One exhaustive selector table (`SELECTOR_CLASS`) replaces the separate chosen and event selector sets; the dead `SIDE_SCHEME` entry is gone. Groundwork for #365 and #367.
