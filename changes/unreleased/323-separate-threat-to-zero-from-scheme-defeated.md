---
type: Fixed
---

- **Fix (Engine & Data): Separate "Threat Reached 0" from "Scheme Defeated" ([Issue #323](https://github.com/SteveRodrigue/MCD/issues/323))**
  - Promotes `SCHEME_THREAT_REDUCED_TO_ZERO` to a schema-supported trigger in `TriggerTypeSchema` and regenerates `schema.json`.
  - Removes the off-schema alias `TRIGGER_EQUIVALENTS` from `trigger-dispatcher.ts`, isolating `SCHEME_DEFEATED` strictly to defeated side schemes.
  - Prevents main scheme threat reductions to 0 from incorrectly triggering cards listening for `SCHEME_DEFEATED` (e.g. _Skilled Investigator_, _Followed_).
  - Eliminates double trigger dispatch on side schemes thwarted to 0 threat.
  - Standardizes side scheme defeat in distributed threat removal allocation paths (`effects/index.ts` and `action-dispatcher.ts`) through canonical `defeatSideScheme` and dispatches `SCHEME_THREAT_REDUCED_TO_ZERO` whenever threat reaches 0.
  - Empties `KNOWN_OFF_SCHEMA_DISPATCHES` in `ability-types-parity.test.ts`, restoring 100% on-schema trigger dispatch across the engine.
