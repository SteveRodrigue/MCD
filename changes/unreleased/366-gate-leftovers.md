---
type: Changed
---

- **Refactor (Engine): The legality gate decides attachments and searches; one target-choice implementation ([Issue #366](https://github.com/SteveRodrigue/MCD/issues/366))**
  - An upgrade or support is played only while a host can take it: `ATTACH_TO_HOST` has a gate rule (`maxPerHost`), so the three by-selector host checks, the `SEARCH` check in `canInitiateAbility` and the minion check in the cost engine are deleted. The refusal reads "No host can take this card." or "No matching card to search."
  - A search over several zones (the encounter deck and its discard pile) is allowed while one of them has something.
  - The payment modal lists the valid hosts of Spider-Tracer, Inspired and Webbed Up, taken from the engine, and the host prompt lists only hosts the gate accepts.
  - Target prompts share one description (`describeTarget`: heroes and allies show their controller, schemes their threat) and one first-target chooser (`chooseInitialTarget`); the guard test now covers every effect that has a gate rule.
