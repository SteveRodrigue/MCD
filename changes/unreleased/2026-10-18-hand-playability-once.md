---
type: Changed
---

- **Performance (UI): The hand evaluates each card once per state (AUD-20261017-232534 F012)**
  - `PlayerHandTray` computes one playability map per hand and game state, shared by the click check, the End Turn pulse and the card fan; before, every card was evaluated three times per render.
  - `App` applies the two UI settings the engine reads (`autoResolveUnambiguous`, `villainPhaseStepping`) through one helper instead of five copied blocks.
