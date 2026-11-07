---
type: Fixed
---

- **Fix (Engine, UI): Multi-type resource costs charge every type ([Issue #667](https://github.com/SteveRodrigue/MCD/issues/667))**
  - Upgraded Drones, Sonic Converter, Solid-Sound Body, Sonic Boom, Running Interference and All Tied Up now require every printed resource. They charged only the first type before.
  - The payment modal shows the full cost (`0 / 3`), lists each type, offers cards of every required type, and counts only resources that fill a slot.
  - Intimidation's "2 resources of any type" can now be paid with any resources. Its data named a type that does not exist.
  - The action list badge names every type, and the simulation bot pays typed costs correctly.
