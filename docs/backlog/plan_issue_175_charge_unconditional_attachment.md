# Plan: Issue #175 — Charge (01099) "Attach to Rhino" must not be a When Revealed effect

> Status: **Awaiting approval** (no source/test/data edits made yet)

## 1. Answer to the reporter's question ("code or supplemental data?")

**Supplemental data only**, plus a regression test. The engine already attaches encounter Attachment cards unconditionally; the data adds a cancellable window it should not have.

## 2. Findings

- `core_encounter.json` `01099` declares `charge_attach` with `timing/trigger: "WHEN_REVEALED"` and an `ATTACH_TO_HOST` step (`target: "VILLAIN"`).
- `villain-phase.ts:1053-1064` (and the dealt-card path at ~570): if a card has any `WHEN_REVEALED` ability, the engine dispatches the `WHEN_REVEALED` trigger, which "Cancel When Revealed" responses can cancel. That is the bug: Charge is cancellable.
- `villain-phase.ts:~705-720` (`resolveActiveEncounterCardAfterInterrupt`, `CardType.ATTACHMENT` branch) already does `state.villain.attachments.push(cardInstance)` unconditionally, before running any `WHEN_REVEALED` abilities. So the declared `ATTACH_TO_HOST` step is redundant (`attachCardToHost` removes the card from all zones and re-pushes it, so it is idempotent).
- Same defect on the sibling Rhino attachments: `01098` Armored Rhino Suit (`armored_rhino_suit_attach`) and `01100` Ivory Horn (`ivory_horn_attach`) — both text "Attach to Rhino." Their other abilities (Forced Interrupts, Hero Action) are untouched.

## 3. Rules (RR v1.8)

- "Attach to [X]" on an encounter attachment is part of how the card enters play, not a When Revealed ability (RR "Attachment" and "When Revealed" entries). Verify with `npm run rule -- attachment` and `npm run rule -- "when revealed"` during implementation, following See also links per AGENTS.md.

## 4. Design

- Remove the `*_attach` `WHEN_REVEALED` ability from Charge (`01099`). Intrinsic attachment stays in the engine's `ATTACHMENT` reveal branch (generic, no card-specific code).
- Apply the same removal to `01098` and `01100` (recommended; see decision 1).
- No engine change unless the red tests show a gap (e.g. attachment not attached when the card has no `WHEN_REVEALED` ability).
- `audit.comment` is not touched (AGENTS.md policy). `audit.updatedAt` / `reviewedAt` left as is unless you want them bumped.

## 5. Files

| Tag | File | Change |
|---|---|---|
| MODIFY | `src/data/supplemental/pack/core_encounter.json` | Remove `charge_attach` (01099); same for `armored_rhino_suit_attach` (01098) and `ivory_horn_attach` (01100) |
| NEW | `tests/engine/encounter-attachment-unconditional.test.ts` | Regression tests below |
| MODIFY | `docs/reports/supplemental_declarations_usage_report.md` | Regenerate with `rtk npm run report:declarations` |
| MODIFY | `CHANGELOG.md`, `docs/backlog/teamwork_status_and_next_target.md` | Status |
| CHECK | `docs/` (ADRs/specs mentioning `ATTACH_TO_HOST` or When Revealed attachments) | Update only if they describe attachments as When Revealed; a short note in the spec on encounter attachments if absent |

## 6. UI / Card Editor impact

None (data-only). The Card Editor will simply show Charge without the `charge_attach` ability.

## 7. TDD (red first)

1. Reveal Charge with a "Cancel When Revealed" response available: Charge still ends up in `state.villain.attachments`, and no `WHEN_REVEALED` trigger/prompt is offered for it. **(red before the data change)**
2. Reveal Charge uncancelled: attached to Rhino exactly once (no duplicate).
3. Same two cases for Armored Rhino Suit (01098) and Ivory Horn (01100).
4. Charge keeps its constant ATK +3 and OVERKILL declarations (`01099` abilities `charge_atk_bonus`, `charge_overkill`) after the edit.
5. Existing tests in `tests/engine/attachments-encounter.test.ts` still pass.

I will find the existing "cancel When Revealed" fixture card (grep in `tests/engine`) to reuse for case 1.

## 8. Verification

`rtk npm test -- tests/engine/encounter-attachment-unconditional.test.ts tests/engine/attachments-encounter.test.ts`, then `rtk npm run report:declarations`, `rtk npm run format:check`, `rtk npm run lint`, `rtk npm run typecheck`, `rtk npm test` (0 failed, 0 skipped).

## 9. Open decisions

1. **Scope** (Recommended: fix all three Rhino attachments 01098/01099/01100, since they share the defect). Alternative: Charge only, file follow-ups for the other two.
2. **Declaration style** (Recommended: remove the ability; the engine owns intrinsic attachment). Alternative: keep a declarative marker such as `timing: "CONSTANT"` attach step; not recommended because it duplicates the engine branch.
3. **Delivery** (Recommended: one commit `fix(data): Make Rhino attachments unconditional (Fixes #175)`).

## 10. Estimate

About 30 minutes: 10 min tests, 5 min data edits, 15 min report, docs, gates.
