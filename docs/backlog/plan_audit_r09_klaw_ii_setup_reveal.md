# Plan R9: Klaw II "When Revealed" at setup; The "Immortal" Klaw as a side scheme

> **Status:** Implemented.
> **Source:** post-remediation report of code audit AUD-20261017-232534 (item R9), found during F011-A (`1b44727`).
> **Gate:** 2 (Klaw). Related: [#265](https://github.com/SteveRodrigue/MCD/issues/265) (Klaw encounter cards without supplemental entries), [#292](https://github.com/SteveRodrigue/MCD/issues/292) (Klaw's additional boost Forced Interrupt). **Tier:** 2. **Estimate:** 3–4 h.
> **Queue:** section 3.5 of [teamwork_status_and_next_target.md](teamwork_status_and_next_target.md). File a Gate 2 issue for it when work starts.

## Printed cards

- **Klaw II (01114):** "**When Revealed**: Search the encounter deck and discard pile for The "Immortal" Klaw and reveal it. Shuffle the encounter deck. [star] **Forced Interrupt**: When Klaw attacks, give him 1 additional boost card for this activation."
- **The "Immortal" Klaw (01127), side scheme:** "Klaw gets +10 hit points. _(When this scheme is defeated, Klaw loses those hit points.)_"

## Rules / spec analysis (confidence 100 %)

- Appendix II Setup, step 12c (`references/rules/appendices/02_setup.md:41-47`): "Resolve any 'Setup' and 'When Revealed' abilities on the villain."
- Glossary "When Revealed Abilities" (`references/rules/glossary/W.md`): they resolve when a new villain stage is revealed; at setup, during step 12.
- Glossary "Reveal": a revealed side scheme enters play in the villain's play area, then its When Revealed abilities resolve.

Klaw Expert starts on Klaw II (`klaw/definition.json`, `EXPERT: ["01114", "01115"]`), so its When Revealed must resolve at setup. Rhino II already does this: its ability is supplemental data (`core_encounter.json`, `rhino_stage_ii_when_revealed`) and `revealVillainStage` runs it at setup and on advance.

## Current behaviour (two defects)

1. `KlawScenarioPlugin.onVillainStageAdvanced` (`src/engine/scenarios/built-in/klaw/plugin.ts:75`) runs the reveal only when Klaw I advances. **Expert never gets The "Immortal" Klaw.**
2. `resolveStageIIWhenRevealed` (`klaw/plugin.ts:78`) pushes 01127 into Klaw's **attachments** and adds `10 × players` hit points directly. The card is a side scheme; its +10 hit points last while the scheme is in play and are lost when it is defeated.

## Simplification & Refactor Check

- **Delete** `onVillainStageAdvanced` and `resolveStageIIWhenRevealed` from the Klaw plugin, and the `onVillainStageAdvanced` hook from `DeclarativeScenarioPlugin` if Klaw was its only user (check Ultron first).
- **Data, not code:** Klaw II gets a `WHEN_REVEALED` ability mirroring Rhino II's (`SEARCH` encounter deck + discard for 01127, reveal, shuffle). The "Immortal" Klaw gets a constant hit point modifier on the villain while in play. Find the existing primitive first (`rg -n "HIT_POINTS|maxHealth" src/data/supplemental/schema-primitives.ts`); if none fits, stop and ask before adding a primitive.
- Verify the printed "+10" against the card image: upstream text may drop a per-player icon. Do not assume `× players` (the current code does). If unsure, stop and ask.

## File changes

| File                                                                                              | Change                                                             |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `src/data/supplemental/pack/core_encounter.json`                                                  | 01114 When Revealed; 01127 hit point modifier (**owner approval**) |
| `src/engine/scenarios/built-in/klaw/plugin.ts`                                                    | Delete the stage II code                                           |
| `src/engine/scenarios/declarative-plugin.ts`                                                      | Delete the hook if unused                                          |
| Klaw scenario tests (`rtk npx vitest related src/engine/scenarios/built-in/klaw/plugin.ts --run`) | Cases below                                                        |
| `changes/unreleased/<date>-klaw-ii-setup-reveal.md`                                               | `Fixed` fragment                                                   |

## Tests (write first)

1. Klaw Expert setup: The "Immortal" Klaw is in play as a side scheme; Klaw's hit points include its bonus (fails today).
2. Klaw Standard, Klaw I defeated: same result on advance.
3. The "Immortal" Klaw defeated: Klaw loses the bonus.
4. Encounter deck is shuffled after the search (deck order changes with a fixed seed).

## Open decisions

1. Approve the supplemental data change for 01114 and 01127.
2. Per-player or flat +10 (card image check).

## UI and Card Editor impact

UI: The "Immortal" Klaw shows among side schemes, not on Klaw. Card Editor: the two entries become editable data.

## Commit

`fix(data): Reveal The "Immortal" Klaw when Klaw II is revealed, also at setup` with `Refs #265, AUD-20261017-232534 R9`.
