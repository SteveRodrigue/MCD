# [ADR-0076] Canonical Villain Collections, Active Villain Id and Accessor Contract

- **Status:** Accepted
- **Date:** 2026-10-03
- **Authors:** MCD Core Team
- **Deciders:** User & Claude
- **Related Issues:** #194 (accessor migration), #215 (legacy field removal), #210 (per-villain encounter decks), #211 (side schemes and scheme threat), #212 (multi-villain targeting), #213 (active counter effects), #214 (MC03 Wrecking Crew scenario)

---

## Context and Problem Statement

`GameState` carried two parallel representations of the villain and the main scheme: the collections `villains[]` / `mainSchemes[]` (with an active index) and the legacy direct pointers `villain` / `mainScheme`. About 520 source locations read or write the pointers.

The two representations are not kept in sync. `dispatchAction`, the villain phase and the simulator clone state with `JSON.parse(JSON.stringify(state))`, which turns the shared object into two independent copies. After any dispatched action, damage applied through `state.villain.health` is invisible to `villains[0]` (confirmed by `tests/engine/active-villain-accessors.test.ts`: the accessor still reports full health after a dispatched attack).

MC03 Wrecking Crew (rules insert p.5-7) puts four villains in play at once. Only the **active villain** (the one holding the *active counter*) activates, "the villain" in card text means the active villain only, the counter moves by card effect at any time, players may attack any villain, and a defeated villain is removed (final stage) while the counter moves on. An index into the array cannot survive villain removal or stage replacement.

---

## Decision Drivers

- One source of truth that survives cloning.
- A model that already fits Wrecking Crew, so MC03 is a data and scenario change and not a second migration.
- No behavior change for the single-villain core scenarios during the migration.

---

## Decision Outcome

1. **`villains[]` and `mainSchemes[]` are canonical.** The legacy `villain` / `mainScheme` fields are deprecated pointers, kept in sync by the setters only until their removal (#215).
2. **The active villain is identified by `activeVillainId` (instance id), not by an index.** Unset means the first villain. `activeMainSchemeIndex` stays (single main scheme).
3. **Accessor contract** (`src/engine/models/state.ts`):

| Function | Use |
|---|---|
| `getActiveVillain` | "the villain" in card text, the villain phase activation, boost source |
| `getVillainsInPlay` | targeting lists, Guard checks, win checks (every villain, active or not) |
| `getVillainById` | an already chosen or hosting villain (combat target, attachment host) |
| `setActiveVillain` | move the active counter by id |
| `replaceVillain` | stage advance in place; the counter follows when the replaced villain held it |
| `removeVillain` | final-stage defeat; a scenario callback picks the successor (default: first remaining) |
| `getMainSchemesInPlay`, `getActiveMainScheme`, `getMainSchemeById`, `replaceActiveMainScheme` | same split for main schemes |

4. **Call-site classification.** Every access to a villain falls in one of three categories, and the accessor is chosen accordingly instead of mapping everything to the active villain:
   - **A, active-villain semantics:** card text "the villain", villain phase activation, boost dealing.
   - **B, by id:** combat and damage after a target is chosen, attachment hosts, validators.
   - **T, targeting:** attack and thwart option lists, legality, Guard, win condition: enumerate every villain in play.

   An architecture guard (`tests/engine/legacy-villain-pointer-guard.test.ts`) allows each file only its current number of legacy accesses; the allowance only shrinks, and ends at `models/state.ts` (the accessors' fallback) and `state/game-setup.ts` (initial construction).

5. **Clone re-link (temporary).** `cloneGameState` (`state.ts`) replaces the raw JSON clones in `dispatchAction`, the villain phase, player-phase cleanup and the simulator, and re-links `villain` / `mainScheme` to the clone's active entities. That removes the divergence at its source and makes the migration order-independent: migrated code writes `villains[]`, unmigrated readers (and test fixtures) still see the same objects. It is deleted with the legacy fields in #215.

### Consequences

- Positive: the clone divergence disappears once all sites are migrated; multi-villain scenarios need no further state-shape migration; scenario plugins use `setActiveVillain` / `replaceVillain` / `replaceActiveMainScheme` instead of hand-syncing three fields.
- Negative: a multi-batch migration touching core pipelines; test fixtures keep using the legacy pointer until #215.
- Out of scope (tracked): per-villain encounter decks (#210), per-villain scheme threat destination and signature side schemes (#211), multi-villain targeting and Guard (#212), active counter effects (#213), the Wrecking Crew scenario (#214). Tower Defense (multiple main schemes) is not designed for.

## Rules References

RR v1.8 "Villain", "Villain Defeat", "Villain Phase", "Activation"; MC03 Wrecking Crew rules insert p.5-7 (new rules: The Active Villain, Multiple Villains and Encounter Decks, Signature Side Schemes).
