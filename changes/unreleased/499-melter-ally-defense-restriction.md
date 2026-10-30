---
type: Added
---

- **Feat (Engine, Data): Melter ally defender constraint and exhaust allies boost ([Issue #499](https://github.com/SteveRodrigue/MCD/issues/499))**
  - Implement Melter (`01132`) constant ability: engaged player must defend against Melter's attacks with an ally they control, if able.
  - Implement Melter (`01132`) Boost: exhaust each ally you control via `EXHAUST` on `ALL_CONTROLLED_ALLIES`.
  - Introduce generic `RESTRICT_DEFENSE` schema effect with `REQUIRE_ALLY_IF_ABLE` requirement.
  - Centralize defender declaration legality into `canDeclareDefender` in `src/engine/pipeline/legality-checker.ts` (One Legality Gate, ADR-0090).
  - Enforce defender legality in `handleDeclareDefender`, `step3_openDefenderDeclarationPrompt`, and simulation `evaluateDefensePolicy`.
  - Resolve and delete ambiguity report `docs/ambiguities/core_encounter_01132_melter.md`, raising Melter confidence to 100.
