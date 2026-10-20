---
type: Changed
---

- **Refactor (Engine, UI): Strongly Typed Log Catalog & Canonical Role Vocabulary (`AUD-20261017-232534` R7, ADR-0081 Addendum)**
  - Created a strongly typed `LogEvents` catalog in `src/engine/models/log-events.ts` and updated `appendLog` in `src/engine/state/game-log.ts` to strictly enforce type-safe keys and parameters at compile time.
  - Standardized all engine log emissions across 24 call sites to the canonical 5-role parameter vocabulary (`actor`, `target`, `card`, `amount`, `source`).
  - Streamlined `normalizeLogParams` and hierarchical log key formatting in `src/ui/utils/comic-log-formatter.ts`, eliminating over 170 guessing branches.
  - Aligned English and French comic log templates in `src/locales/` with the canonical placeholder keys.
  - Added compile-time and runtime type tests in `tests/engine/typed-game-log.test.ts`, comprehensive formatter guard tests across all catalog keys in `tests/ui/log-catalog-guard.test.ts`, and updated `tests/ui/comic-log-formatter.test.ts`.
