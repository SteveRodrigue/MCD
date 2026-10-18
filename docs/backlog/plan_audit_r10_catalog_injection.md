# Plan R10: Inject the card catalog into the engine; close out #275

> **Status:** Proposed. **Tier 3 (public contract): owner decision required before any code.** Deferred by the owner on 2026-10-17 (F014-B).
> **Source:** post-remediation report of code audit AUD-20261017-232534 (item R10): F014 option B; architecture move M4. Issue [#275](https://github.com/SteveRodrigue/MCD/issues/275) (Gate 2, scenario packaging).
> **Gate:** Tech Debt & Tooling (#275 part: Gate 2). **Estimate:** 2–3 days (catalog), 1–2 h (#275 close-out).
> **Queue:** section 3.5 of [teamwork_status_and_next_target.md](teamwork_status_and_next_target.md).

## Problem

Nine engine modules import the module-level `cardCatalog` singleton from `src/data/importer/card-loader.ts`: `decks/starter-decks.ts`, `effects/index.ts`, `scenarios/advance-villain-stage.ts`, `scenarios/declarative-plugin.ts`, `scenarios/modular-sets.ts`, `scenarios/built-in/klaw/plugin.ts`, `scenarios/built-in/ultron/plugin.ts`, `specials/wakanda-forever.ts`, `state/game-setup.ts`. The engine is therefore hard-wired to the bundled Core JSON: a test or a future pack cannot give it another catalog, and `src/engine` depends on `src/data/importer` at runtime.

## Rules / spec analysis

Not a rules change. ADR-0033 (scenario setup pipeline), ADR-0010 and its F004 addendum, ADR-0083 (schemas drive the editor).

## Design options (owner picks one)

| Option                                                          | What changes                                                                                                                                                             | Pros                                 | Cons                                                                                                         |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| **A. `CardRepository` port in the state context (recommended)** | `setupGame(options)` takes `catalog: CardRepository` (interface: `getCard`, `getExpandedCardsBySet`); the engine keeps it by reference beside the state (not serialised) | Testable; multi-pack ready; one seam | Every module reaching the catalog needs the reference: plugins, specials, effects (signature change, Tier 3) |
| B. Module-level `setCardCatalog()`                              | One setter at boot; the singleton import is replaced by a getter                                                                                                         | Small diff                           | Still global state; tests must reset it                                                                      |
| C. Keep the singleton                                           | Nothing                                                                                                                                                                  | Zero cost                            | Coupling stays                                                                                               |

## Simplification & Refactor Check (option A)

- **Merge** the nine imports behind one `CardRepository` interface implemented by the existing `cardCatalog` class (no new catalog class).
- **Delete** the scenario plugins' direct catalog reads; `DeclarativeScenarioPlugin` receives the repository in `onGameSetup`.
- Plan this together with R11: the kernel (R11) is where the repository would be wired, so R10 option A is a first step of R11.

## #275 close-out (no owner decision needed)

F011-A (`1b44727`) delivered #275's acceptance 1, 2 and 4 (generic setup, stage progression and per-player scaling in `DeclarativeScenarioPlugin`; Rhino is a plain instance). Check and finish:

- Acceptance 3: add a test that a scenario defined only by a `definition.json` (no subclass) sets up and advances a stage.
- Acceptance 5: ADR addendum (ADR-0033) and the Rhino scenario README.
- Then close #275 with `Fixes #275`.

## File changes (option A)

`src/data/importer/card-loader.ts` (implements the port), `src/engine/state/game-setup.ts`, `src/engine/scenarios/*`, `src/engine/specials/wakanda-forever.ts`, `src/engine/effects/index.ts`, `src/engine/decks/starter-decks.ts`, `src/ui/App.tsx` (passes the catalog), test helpers; new ADR.

## Tests

- A test engine run with a fake two-card repository (proves the seam).
- Full engine suite and `npm run simulate` unchanged.

## Open decisions

1. Option A, B or C.
2. Do it before or together with R11.

## UI and Card Editor impact

None visible. The Card Editor keeps using the catalog directly.
