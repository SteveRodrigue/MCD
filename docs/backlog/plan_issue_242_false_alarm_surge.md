# Plan: #242, False Alarm `01112` surges when you are already confused

> **Status:** implemented 2026-10-05 (approved; committed `7686171`). The two "already confused" tests failed before the data change; 1,838 tests green after it, and 15 repeated runs of the new file were all green. Tier 1 (data only, no engine or schema change). Queue item 2 of section 3.1 in [teamwork_status_and_next_target.md](teamwork_status_and_next_target.md). Closes #242 (`Fixes #242`).
> **UI / Card Editor impact:** none (existing effect, gate and selector).

## 1. Printed card text

[False Alarm] (01112), treachery, Bomb Scare modular set (2 copies):

> **When Revealed**: You are confused. If you are already confused, this card gains surge.

## 2. Original supplemental data

```json
"01112": {
  "abilities": [
    {
      "id": "false_alarm_confuse",
      "timing": "FORCED_RESPONSE",
      "trigger": "WHEN_REVEALED",
      "steps": [
        { "effect": "ADD_STATUS", "effectParams": { "status": "CONFUSED", "target": "SELF_IDENTITY" } }
      ]
    }
  ],
  "audit": { "createdAt": "2026-08-27T23:00", "updatedAt": "2026-10-04T21:30", "reviewedAt": "2026-10-04T21:30",
             "reviewedBy": "antigravity", "rulesVersion": "v1.8", "confidence": 98, "originalText": "<printed text>" }
}
```

## 3. Proposed supplemental data

```json
"01112": {
  "abilities": [
    {
      "id": "false_alarm_confuse",
      "timing": "WHEN_REVEALED",
      "trigger": "WHEN_REVEALED",
      "steps": [
        {
          "id": "false_alarm_confuse_step",
          "effect": "ADD_STATUS",
          "effectParams": { "status": "CONFUSED", "target": "SELF_IDENTITY" }
        },
        {
          "id": "false_alarm_surge_step",
          "effect": "SURGE",
          "gate": "IF_ALREADY_HAS_STATUS",
          "gateParams": { "status": "CONFUSED", "target": "SELF_IDENTITY" }
        }
      ]
    }
  ],
  "audit": { "createdAt": "2026-08-27T23:00", "updatedAt": "<now>", "reviewedAt": "<now>",
             "reviewedBy": "claude", "rulesVersion": "v1.8", "confidence": 98, "originalText": "<printed text, unchanged>" }
}
```

## 4. Why

1. **The second sentence is missing.** Today the card never surges.
2. **Same shape as a working card.** Rhino's `01105` ("Give Rhino a tough status card. If Rhino already has a tough status card, this card gains surge") already uses exactly this pair: `ADD_STATUS`, then `SURGE` gated `IF_ALREADY_HAS_STATUS`.
3. **How the gate decides "already".** `ADD_STATUS` records `conditionMet = alreadyHadStatus` on its result (`effects/index.ts` L3353). `alreadyHadStatus` is true only when the target already held the status before this step (L3278). The gate reads that result first (`step-gate-evaluator.ts` L73). So the check is made *before* this card's confusion, which is what "already confused" means.
4. **"You" in either form.** RR v1.8 *You, Your* refers to the player resolving the card. `SELF_IDENTITY` is the identity in hero or alter-ego form (kept from #222).
5. **Status limit.** RR v1.8 *Status Cards*: one status card of each type at a time. An already confused player stays at one confused card and the card surges.
6. **`SURGE` effect, not the keyword.** "This card gains surge" is conditional. It uses the `SURGE` effect, which shares one path with the keyword since #218 (`dealSurgeCard`: deck exhaustion, reshuffle, acceleration). The card does not print the Surge keyword (pinned in `printed-keyword.test.ts`).
7. **Canonical timing.** `WHEN_REVEALED`/`WHEN_REVEALED`, as for `01158`.
8. **`gateParams`.** They are only a fallback that the gate never reaches here (the previous step's result is always present). They are kept for readability, the same as `01105`. Note: that fallback only handles `VILLAIN` (`step-gate-evaluator.ts` L78). It is not hit by this card; I will add it to the WP7 note rather than widen this change.

Decompiled round trip: "When revealed: the revealing player's identity gets a confused status card. If it already had one, reveal 1 more encounter card." This matches the printed text.

**Edge case outside Gate 1:** an identity with Steady can hold two confused cards. With one confused card it would take a second and not surge. That matches the engine's reading of "already confused" only if you count by the limit. No core hero has Steady. Recorded here, not handled.

## 5. Tests (written first, seen failing)

New file `tests/engine/false-alarm-surge.test.ts`, real reveal path (`step4_revealEncounterCards`), with filler cards on top of the encounter deck so the shuffled Rhino deck cannot change the outcome (the lesson from `4d200a5`):

1. Not confused, hero form: becomes confused, no extra card revealed. (Passes today; pins the first sentence.)
2. Already confused, hero form: stays at one confused card, exactly one extra card revealed. **Fails today.**
3. Already confused, alter-ego form: the same surge. **Fails today.**
4. Not confused, alter-ego form: confused, no surge.

The existing `self-hero-selector.test.ts` False Alarm tests and the other suites that reveal `01112` must keep passing unchanged.

## 6. Files

- `src/data/supplemental/pack/core_encounter.json` (`01112` only, textual edit, CRLF preserved)
- `tests/engine/false-alarm-surge.test.ts` (new)
- `docs/reports/supplemental_declarations_usage_report.md` (regenerated)
- `CHANGELOG.md` `[Unreleased]`
- This plan's status line, [teamwork_status_and_next_target.md](teamwork_status_and_next_target.md) (item 2 done; also fill in commit `4d200a5` for #244), [plan_issue_244_heart_shaped_herb.md](plan_issue_244_heart_shaped_herb.md) (commit hash), [plan_effect_params_remediation.md](plan_effect_params_remediation.md) (WP7 note on the `VILLAIN`-only gate fallback), [handoff_prompt.md](handoff_prompt.md) (good-first-item 1 done)

## 7. Open decisions

None blocking.
