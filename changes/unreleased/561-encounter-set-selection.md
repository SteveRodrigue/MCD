---
type: Added
---

- **Feature (Setup): Choose the Standard and Expert sets, after a difficulty the scenario supports ([Issue #561](https://github.com/SteveRodrigue/MCD/issues/561))**
  - The setup screen now goes scenario, difficulty, then encounter sets, and shows only the difficulties a scenario supports.
  - Standard difficulty adds no Expert set, Expert requires one, and Skirmish may add one (RR v1.8 Modes of Play). Heroic mode selects no set.
  - Packs list their sets in `encounter-sets.json`, which replaces `modular-sets.json`. Scenario manifests no longer repeat the Standard and Expert sets; `encounterSetRules` declares a scenario's exception.
