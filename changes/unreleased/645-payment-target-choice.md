---
type: Fixed
---

- **Fix (UI): The player chooses the target when playing a card ([Issue #645](https://github.com/SteveRodrigue/MCD/issues/645))**
  - The target choice now sits at the top of the payment screen, above the resources. Before, it could sit out of view, so Spider-Tracer landed on the first Drone without asking.
  - With two or more valid targets, none is preselected and Confirm & Play! waits for the player's choice. A single valid target is still selected for you.
  - In a choice of two or more minions, each names the hero it is engaged with. A minion's tile also lists the cards attached to it, so two Drones can be told apart.
  - The attachment prompt and the combat log no longer show names like "Drone (Hero Seat 1 (Spider-Man))".
