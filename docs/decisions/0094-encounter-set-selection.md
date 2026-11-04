# [ADR-0094] Encounter Set Selection at Setup

* **Status:** Accepted
* **Date:** 2026-11-04
* **Authors:** MCD Core Team
* **Deciders:** Project Maintainer
* **Extends:** [ADR-0033](0033-official-15-step-scenario-setup-engine-and-modular-plugin-pipeline.md) (encounter set taxonomy), [ADR-0092](0092-content-packs-and-runtime-loading.md) (pack format)
* **Related:** [Issue #561](https://github.com/SteveRodrigue/MCD/issues/561)

---

## Context and Problem Statement

Later packs add alternatives to the Standard and Expert encounter sets. The Hood insert and the Age of Apocalypse rulebook say these sets may be used instead of the original when a scenario requires it, so they are a player choice and not a difficulty level. Some scenarios also break the usual rule: The Wrecking Crew uses no other encounter sets, and competitive Civil War replaces the Standard set.

A scenario manifest cannot list these choices without going stale each time a pack adds a set, and the setup screen needs to offer only what the chosen scenario and difficulty allow.

---

## Decision

1. **Packs declare their sets in `encounter-sets.json`,** one list with a `kind`: `modular`, `standard` or `expert`. RR v1.8 says Standard and Expert sets are not modular and cannot fill a modular slot, so `kind` keeps them out of it.
2. **Manifests say nothing about these sets by default.** `modularEncounterSets` holds only `mandatory`, `slotCount` and `recommendedModularSets`. A new pack with a new set needs no manifest edit.
3. **`encounterSetRules` is the exception.** `{ "standard": { "fixed": null } }` removes a choice, and `{ "fixed": "<set code>" }` forces a set.
4. **`supportedDifficulties` decides which difficulties the player can pick.** Setting up a game on any other difficulty is an error, and a supported difficulty must have villain stages.
5. **One resolver.** `describeEncounterSetSlots` lists what a scenario offers and `resolveScenarioSetup` returns what the game plays. The setup screen reads the first and the plugin the second, so they cannot disagree.
6. **The game state records what was played:** `encounterSets` and `expertMode`. `expertMode` is stored, not inferred from the Expert set, because a scenario can play expert mode with no Expert set.

### What each selection does

| Player selects | Standard set | Expert set | `expertMode` | Source |
| ----------------- | ------------ | ---------------------- | ------------ | ------------------------------------ |
| Skirmish | Required | None | false | RR Skirmish Mode |
| Skirmish + Expert | Required | Required: any listed | true | RR: skirmish combines with expert |
| Standard | Required | None | false | RR Standard Mode |
| Expert | Required | Required: any listed | true | RR Expert Mode, Learn to Play |
| Any + Heroic X | Unchanged | Unchanged | Unchanged | RR Heroic Mode: more cards dealt only |

The default of a required slot is the first set listed, which is Core's because every pack loads after it. An Expert set on Standard difficulty is not offered: it is not an RR mode.

---

## Consequences

* A scenario's other setup, such as The Wrecking Crew's four decks or a setup table that lists a value per mode, is not covered here. Each is decided when that scenario is integrated, including whether a script hook is needed.
* Whether an ability needs a script is a separate rule: see `docs/engine/coding_guidelines.md` §15.
