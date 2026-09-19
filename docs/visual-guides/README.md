# MCD Visual Guides — Engine Flow Atlas

> [!NOTE]
> **Purpose:** This folder is a **companion, diagram-first atlas** to the prose-and-schema
> specifications in [`docs/specifications/`](../specifications/README.md). It does not
> redefine any contract — every diagram here links back to the authoritative spec section,
> ADR, or source file that governs the behavior shown.
>
> Use these guides to build a mental model of "what happens when" _before_ diving into the
> field-by-field schema tables. They are aimed at anyone authoring or reviewing
> [`src/data/supplemental/`](../../src/data/supplemental/) card JSON, not just engine developers.

---

## Why this exists

The [supplemental schema specification suite](../specifications/supplemental/README.md) is
precise and exhaustive, but it describes primitives **in isolation** (one `timing`, one
`trigger`, one effect at a time). It doesn't show how those primitives compose into an actual
turn, attack, or villain phase. That composition is exactly what a card author needs in their
head to answer questions like:

- "If I set `timing: 'INTERRUPT'` and `trigger: 'ATTACK'`, _when exactly_ does my step run
  relative to boost cards and damage calculation?"
- "My ability has three `steps` with a `gate` — in what order do gates, conditions, and
  triggers actually evaluate?"
- "Where does my new `WHEN_REVEALED` treachery fit inside the Villain Phase?"

Each guide below answers one of these questions with a diagram, not a table.

---

## Guide Index

| Guide                                                                      | Answers                                                                                        | Grounded In                                                                                                                                                                                                                                  |
| :------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [01. Engine & Round Overview](./01-engine-overview.md)                     | What is the big loop? What are the zones my card's targets/effects live in?                    | [`algorithmic_rules_reference.md`](../algorithmic_rules_reference.md), `src/engine/pipeline/round-upkeep.ts`                                                                                                                                 |
| [02. Ability Lifecycle](./02-ability-lifecycle.md)                         | From JSON `ability` to on-screen effect: legality → cost → steps → gates → effects → triggers. | [03. Costs & Targeting](../specifications/supplemental/03_costs_and_targeting.md), [10. Sequences & Modals](../specifications/supplemental/10_sequences_and_prompts.md), `src/engine/pipeline/cost-engine.ts`, `src/engine/effects/index.ts` |
| [03. Trigger Resolution Stack](./03-trigger-resolution-stack.md)           | When multiple cards react to the same event, what fires first?                                 | [02. Timings & Triggers](../specifications/supplemental/02_timings_and_triggers.md), `src/engine/triggers/trigger-dispatcher.ts`                                                                                                             |
| [04. Combat & Villain Phase Sequences](./04-combat-and-villain-phase.md)   | What is the exact step-by-step order of an attack, and of the 6-step Villain Phase?            | [05. Combat & Threat](../specifications/supplemental/05_effects_combat_threat.md), `src/engine/pipeline/combat-pipeline.ts`, `src/engine/pipeline/villain-phase.ts`                                                                          |
| [05. Card Authoring Decision Guide](./05-card-authoring-decision-guide.md) | "I'm writing a new card — which `timing`/`trigger`/`effect` do I pick?"                        | All of [`docs/specifications/supplemental/`](../specifications/supplemental/README.md)                                                                                                                                                       |

---

## Reading Conventions

- All diagrams use [Mermaid](https://mermaid.js.org/), which renders natively in GitHub and VS Code preview.
- Rectangular nodes are **engine steps/functions**; diamonds are **decision gates**; rounded
  nodes are **card-author-facing schema fields** (e.g. `timing`, `trigger`, `gate`).
- File paths in diagram labels are clickable context, not guaranteed line-stable — use them as
  a starting point for `grep`/search, not a pinned reference.
- These guides are **illustrative summaries**. Where a diagram and a specification module
  disagree, the specification module (and ultimately the source code) always wins.

## Related Documentation

- [Supplemental Data Schema Specification](../specifications/supplemental/README.md)
- [Algorithmic Rules Reference](../algorithmic_rules_reference.md)
- [Card Mechanics Breakdown](../specifications/card_mechanics_breakdown.md)
- [Card Integration Protocol](../../.agents/skills/card-integration-protocol/SKILL.md)
