---
type: Changed
---

- **Test tooling (Engine): Stage-Setter card-ability coverage gate, phase 1 ([Issue #431](https://github.com/SteveRodrigue/MCD/issues/431))**
  - `npm run simulate` now sweeps every Core Set ability (161) through the real engine pipeline (`src/engine/simulation/ability-stage-setter.ts`) and reports coverage by timing in `logs/simulations/simulation_summary.md`. It exits non-zero when any ability is uncovered or any extra variant (two players, each `PLAYER_CHOICE` branch) fails. The old 100-game win-rate run moved to `npm run simulate -- --balance` as an informational report. New flags: `--card <code>`, `--replay <id>`, `--seed <s>`.
  - Added the Effect-Delta Registry and verifier (`effect-delta-verifier.ts`) and the coverage ledger with a per-timing "covered" rule (`ability-coverage.ts`). `runMatch` now fails on any `engine.stepError` log entry unless `allowStepErrors` is set. `tests/engine/card-ability-coverage.test.ts` is the CI gate (100% coverage, no errors, identical replay fingerprints).
  - Fixed: the use of an identity card ability (*Rechannel*, *Spider Sense*, *I Object*) and of a damage-shield attachment (*Armored Rhino Suit*) was never counted in `abilitiesUsed`; each now records its use.
