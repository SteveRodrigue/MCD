---
type: Fixed
---

- **Fix (UI): The combat log shows damage and Tough loss as sentences ([Issue #328](https://github.com/SteveRodrigue/MCD/issues/328), [Issue #330](https://github.com/SteveRodrigue/MCD/issues/330))**
  - Damage reads "Counter-Punch dealt 2 damage to Rhino." (the source is the card, or the hero for a basic attack); Tough lost, Piercing, immunity, damage shields and Stunned/Confused cleared have their own lines.
  - Added English and French templates for the 102 log keys that had none (they showed as raw keys); the catalog guard now fails on a raw-key fallback.
  - The `DEAL_DAMAGE` handler no longer writes duplicate damage lines; the damage pipeline is the only writer.
