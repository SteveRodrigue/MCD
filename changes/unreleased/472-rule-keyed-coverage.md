---
type: Added
---

- **Test tooling (Engine): rule-keyed coverage in the simulation ([Issue #472](https://github.com/SteveRodrigue/MCD/issues/472))**
  - `npm run simulate` now also reports coverage per rule. Every entry of the Rules Reference v1.8 glossary (`references/rules/rules_graph.json`) is mapped in `rule-observations.ts` to what a run must show (a game-log key, an ability timing, an effect or a trigger), or is declared untested with a reason (`definition`, `no-observable` or `no-scenario`). The table is typed over every glossary slug, the log catalog, the ability timings and the effect types, so a new glossary entry or a renamed log key does not compile until it is mapped.
  - `simulation_summary.md` gains a rule-coverage section (observed by the Stage-Setter and by the Gauntlet), the rules no scenario observed, and the rules declared untested. Passing Stage-Setter runs and clean trigger windows now carry the log keys they wrote (`logKeys`); the replay catalog and fingerprints are unchanged.
  - The run fails only on drift: a glossary entry without a mapping, a mapping for an entry that no longer exists, or a mapping that names an unknown timing, effect or trigger. Unobserved and untested rules are reported, not gated.
  - `scripts/lookup-rule.ts` now shares the typed glossary graph (`rules-graph.ts`) and prints the correct usage text (`npm run rule -- <rule_name>`).
