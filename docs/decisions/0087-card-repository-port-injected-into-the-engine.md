# [ADR-0087] Card Repository Port Injected into the Engine

- **Status:** Accepted
- **Date:** 2026-10-20
- **Authors:** MCD Core Team
- **Deciders:** Owner & Claude
- **Related Issues:** Code audit AUD-20261017-232534, finding F014-B (Plan R10); [#275](https://github.com/SteveRodrigue/MCD/issues/275)

---

## Context and Problem Statement

Nine engine modules imported the module-level `cardCatalog` singleton from `src/data/importer/card-loader.ts`. The engine was hard-wired to the bundled Core JSON: a test or a future pack could not give it another catalog, and `src/engine` depended on `src/data/importer` at runtime.

## Decision Drivers

- The engine reads card definitions through one seam that a test or a pack can replace.
- One path, no module-level state to reset between tests.
- The catalog is a service, not game state: it must not be serialised or copied with the state.

## Considered Options

1. **`CardRepository` port carried by the game state (chosen).**
2. Module-level `setCardCatalog()` called once at boot (still global state, tests must reset it).
3. Keep the singleton.

## Decision Outcome

**Chosen option 1.**

- `CardRepository` (`src/engine/models/card-repository.ts`) lists the reads the engine makes: `getCard`, `getCardsBySet`, `getCardsByType`, `getExpandedCardsBySet`, `getNemesisCardsForHero`, `getVillainByStage`, `getMainSchemeByStage`. `CardCatalog` implements it; no second catalog class exists.
- `setupGame` requires `catalog: CardRepository` and stores it in `state.options.catalog`. `cloneGameState` carries it by reference, so a clone never copies the catalog.
- Engine code reads it with `getCatalog(state)`, which throws a clear error for a state built without a catalog. Scenario plugins, `advanceVillainStage`, the effect executor and the Wakanda Forever special all have the state in hand; no signature needed a new parameter except `getSpecialAbility`.
- `src/engine` no longer imports `cardCatalog`. The UI and the simulation script pass the bundled `cardCatalog` to `setupGame`; the Card Editor keeps using it directly.
- Hand-built test states set `options: { catalog: cardCatalog }`.

## Consequences

- A test runs the engine on a fake repository (`tests/engine/catalog-injection.test.ts`), including a scenario that is only a `definition.json` (a `DeclarativeScenarioPlugin` with no subclass).
- A saved game state does not contain the catalog; whoever restores one must set `options.catalog` again.
- This is a first step of the engine kernel (R11), where the repository would be wired.
