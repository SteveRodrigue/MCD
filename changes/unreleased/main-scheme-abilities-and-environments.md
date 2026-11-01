---
type: Changed
---

- **Main scheme abilities and environments are built into the engine (M5b of the content folder refactor, ADR-0092)**
  - The engine now resolves the Setup and When Revealed abilities printed on a scenario's main scheme cards from card data: at game setup (Appendix II step 12) and when the main scheme advances. Klaw's setup is now plain supplemental data on `01116a`, `01116b` and `01117a` (the Defense Network search and the discard-until-a-minion), so `KlawScenarioPlugin` is gone. Searching the encounter deck now shuffles it, as the Search rule requires.
  - **Bug fix:** Klaw's setup used card `01124` as "Defense Network". `01124` is Sound Manipulation, a treachery; Defense Network is the side scheme `01125`. The old code pulled the treachery out of the encounter deck and put it in play as a side scheme.
  - **Bug fix:** a revealed environment card was resolved like a treachery and discarded. It now enters the villain's play area (`state.environments`), and `SEARCH` into `TABLEAU` puts a found environment there too. Ultron's stage 1A (put the Ultron Drones environment into play) is data on `01137a`, so the scenario-specific `excludedEncounterTypes` is gone; only Ultron's stage 1B facedown Drones stay code.
  - Klaw and Ultron seeded setups change on purpose (the shuffle, the correct Defense Network); the Rhino setup and Gauntlet are unchanged. The coverage gate now includes the four new main scheme abilities. The environment log key is `environment.entersPlay`.
