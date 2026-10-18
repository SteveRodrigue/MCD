# Plan R16: Review all project documentation against the code

> **Status:** Proposed, waiting for owner approval. **Starts only when R1 to R15 are delivered, deferred with an owner decision recorded, or closed.** It is the last row of section 3.5.
> **Source:** owner request on 2026-10-18, after the AUD-20261017-232534 remediation (25 commits, `94ebc97..f6e470f`) and the R1–R15 plans.
> **Gate:** Tech Debt & Tooling. **Tier:** 1 (documentation only). **Estimate:** 1–2 days.
> **Skill:** `documentation-audit` with scope `all` (read-only for code; a hook blocks non-Markdown edits; code defects found become GitHub issues).
> **Queue:** section 3.5 of [teamwork_status_and_next_target.md](teamwork_status_and_next_target.md).

## Why

The remediation and the R plans change engine structure, contracts and tooling that the documentation describes. Addenda were written for the decisions directly touched (ADR-0010, ADR-0080, ADR-0081, ADR-0085, `docs/coding_guidelines.md`), but nobody has re-read the whole set. Documentation is a derived artifact: when prose and code disagree, the code wins, unless the code breaks an accepted ADR or RR v1.8 (then it is a defect, not a doc fix).

## Scope

| Area                | Files                                                                                                                                                                                                            | Focus                                                                              |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| ADRs                | `docs/decisions/` (85 ADRs + README index)                                                                                                                                                                       | Status (Accepted / Superseded), addenda, links between ADRs, index rows            |
| Specifications      | `docs/specifications/` (17 files incl. `supplemental/01–11`, `QUICK_REFERENCE.md`, `content_plugins_scenarios_and_campaigns.md`, `tooling/card_supplemental_editor.md`)                                          | Effect list, filter keys, scenario plugin contract, editor endpoints               |
| Guides              | `docs/guidelines/`, `docs/visual-guides/`, `docs/tools/`, `docs/coding_guidelines.md`, `docs/algorithmic_rules_reference.md`, `docs/technology_evaluation_and_architecture.md`, `docs/roadmap_and_milestones.md` | Architecture diagrams (engine overview, ability lifecycle, trigger stack), how-tos |
| Root and agent docs | `README.md`, `CONTRIBUTING.md`, `CHEATSHEET.md`, `AGENTS.md`, `.agents/rules/`, `.agents/skills/*/SKILL.md`                                                                                                      | Commands, paths, dependency list, lint scope                                       |
| Reports             | `docs/reports/`                                                                                                                                                                                                  | Mark outdated reports as historical, do not rewrite them                           |

Out of scope: `CHANGELOG.md` and `changes/unreleased/` (release history), `docs/backlog/` (working space), `references/rules/`.

## Known drift to check first (seed list, found 2026-10-18)

| Changed in                       | What changed                                                                                                     | Docs that still mention the old state                                                                                    |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| F004 `ea437e8`                   | `src/engine/scenarios/catalog.ts` deleted; setup reads `ScenarioRegistry`                                        | `CONTRIBUTING.md`, ADR-0010 body (addendum exists)                                                                       |
| F003 `b0ab6c6`                   | `passActivePlayer` removed; one `endPlayerPhase` step                                                            | ADR-0027                                                                                                                 |
| F011-B/A `a73b311`, `1b44727`    | `onVillainPhaseStep1/2`, `evaluateWinLossConditions`, `RhinoScenarioPlugin` removed; `DeclarativeScenarioPlugin` | `docs/specifications/content_plugins_scenarios_and_campaigns.md`, `docs/guidelines/scenario_creation_guide.md`           |
| F008 `c40f9a6`                   | `matchCardFilter` alias removed; filter reads normalized fields; `PLAYER_NEMESIS` semantics                      | ADR-0046, `docs/specifications/supplemental/04_universal_card_filter.md`                                                 |
| F009 `b53e02e`                   | `appendLog`; no `Date.now()` in the engine                                                                       | ADR-0081 body (addendum exists), `content_plugins_scenarios_and_campaigns.md` examples                                   |
| F010-A `e66dec3`                 | `executeStep` dispatches through `EFFECT_HANDLERS`                                                               | `docs/visual-guides/02-ability-lifecycle.md`, `01-engine-overview.md`, supplemental spec "how to add an effect" sections |
| F014-A `add5fba`, F015 `64021c6` | `src/data/supplemental/runtime.ts`; schema enums derived from engine enums                                       | `docs/specifications/supplemental_data_schema.md`, `supplemental/README.md`                                              |
| F005-A `bc97330`                 | Catalog cards frozen and shared; `overrideCard` in tests                                                         | `.agents/rules/coding-and-testing-rules.md` (test-writing rule), `CONTRIBUTING.md`                                       |
| F018, F021 `a299afd`, `3b6df41`  | Dependencies removed; lint covers `tests tools scripts`; `ENGINE_VERSION` from `package.json`                    | `docs/technology_evaluation_and_architecture.md`, `README.md`, `CHEATSHEET.md`                                           |
| F019 `36806cc`                   | Write endpoints on the dev server only; pack file name validation                                                | `docs/specifications/tooling/card_supplemental_editor.md`, `docs/installation_guide.md`                                  |
| R1–R15                           | Whatever those plans deliver (each lists its own doc impact)                                                     | Re-check each delivered plan's doc list                                                                                  |

`implementation_plan.md` mentions in `.agents/skills/` and ADR-0021 refer to the generic plan artifact name, not the deleted root file: confirm, do not change blindly.

## Method (per the `documentation-audit` skill)

1. Inventory every doc in scope; for each, list the code paths and symbols it names (`rg` the symbols in `src`).
2. Classify findings by the skill's taxonomy, with a confidence score and `file:line` evidence; nothing below 80 % is written.
3. Auto-apply Minor/Major findings at 95 % or higher; stop for approval on Critical findings and on any ADR status change (Superseded / Deprecated). Never delete an ADR: supersede it.
4. Update the ADR index (`docs/decisions/README.md`) and cross-links.
5. Code defects found on the way become GitHub issues (milestone at triage), not doc edits.
6. Report in `logs/reports/` per the skill; summary in chat.

## Simplification & Refactor Check

Prefer deleting or merging duplicated prose (the same contract described in a spec, a guide and an ADR) over updating three copies: keep the ADR for the decision, the spec for the contract, the guide for the how-to, and link between them.

## Tests / verification

Markdown only. Check links (`rg -o "\]\(([^)]+\.md)" docs` resolves), Prettier on changed files, and that every symbol named in a spec exists (`rg`).

## Open decisions

1. One commit per area (recommended: ADRs, specifications, guides, root/agent docs) or one commit.
2. Mark `docs/reports/` files as historical with a header line, or leave them untouched.

## UI and Card Editor impact

None (documentation only).

## Commits

`docs: <area> match the code after the AUD-20261017-232534 remediation`, one per area, with `Refs AUD-20261017-232534 R16`.
